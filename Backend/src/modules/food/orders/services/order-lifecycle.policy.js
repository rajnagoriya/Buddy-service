/**
 * Central Food order lifecycle policy.
 * Used by cart, pricing, create, restaurant status, share, cancel, and complete.
 */

import { ValidationError } from '../../../../core/auth/errors.js';
import { haversineKm } from '../../../../core/location/haversine.util.js';

export const MAX_RESTAURANTS_PER_ORDER = 3;
export const MAX_DRIVERS_PER_ORDER = 2;

/**
 * Canonical order-status adjacency map (the real state machine, not just monotonic rank).
 * `from → [allowed next]`. Terminal states have no outgoing edges. Used by `canOrderTransition`
 * to block bypassable jumps (e.g. ready_for_pickup → delivered, skipping pickup) that the older
 * rank-only `isStatusAdvance` let through. Note: `reached_pickup` / `reached_drop` are tracked on
 * `deliveryState`, not `orderStatus`, so they are not modelled here.
 */
export const ORDER_STATUS_TRANSITIONS = {
  scheduled: ['created', 'cancelled_by_user', 'cancelled_by_restaurant', 'cancelled_by_admin'],
  created: [
    'confirmed', 'preparing', 'ready_for_pickup', 'picked_up',
    'rejected_by_restaurant', 'cancelled_by_user', 'cancelled_by_restaurant', 'cancelled_by_admin',
  ],
  confirmed: [
    'preparing', 'ready_for_pickup', 'picked_up',
    'rejected_by_restaurant', 'cancelled_by_user', 'cancelled_by_restaurant', 'cancelled_by_admin',
  ],
  preparing: ['ready_for_pickup', 'picked_up', 'cancelled_by_restaurant', 'cancelled_by_admin'],
  ready_for_pickup: ['picked_up', 'cancelled_by_restaurant', 'cancelled_by_admin'],
  picked_up: ['delivered', 'cancelled_by_admin'],
  delivered: [],
  rejected_by_restaurant: ['created', 'confirmed', 'cancelled_by_restaurant', 'cancelled_by_admin'],
  cancelled_by_user: [],
  cancelled_by_restaurant: [],
  cancelled_by_admin: [],
};

/** True if `to` is a valid successor of `from` per ORDER_STATUS_TRANSITIONS. */
export function canOrderTransition(from, to) {
  if (!from) return true; // start of flow
  if (from === to) return false; // no self-loops (idempotency handled by callers)
  const allowed = ORDER_STATUS_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function assertOrderTransition(from, to) {
  if (!canOrderTransition(from, to)) {
    throw new ValidationError(`Illegal order transition: '${from}' → '${to}'.`);
  }
}

/** Pickup statuses that still participate in the active multi-restaurant trip */
const ACTIVE_PICKUP_STATUSES = new Set([
  'pending',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
]);

const ACCEPTED_OR_LATER_PICKUP = new Set([
  'accepted',
  'preparing',
  'ready',
  'picked_up',
]);

const TERMINAL_ORDER_STATUSES = new Set([
  'delivered',
  'cancelled_by_user',
  'cancelled_by_restaurant',
  'cancelled_by_admin',
]);

export function countUniqueRestaurantIds(items = []) {
  const ids = new Set();
  for (const item of items || []) {
    const rid = String(item?.restaurantId || '').trim();
    if (rid) ids.add(rid);
  }
  return ids.size;
}

export function assertMaxRestaurants(items = []) {
  const count = countUniqueRestaurantIds(items);
  if (count > MAX_RESTAURANTS_PER_ORDER) {
    throw new ValidationError(
      `You can order from a maximum of ${MAX_RESTAURANTS_PER_ORDER} restaurants at a time`,
    );
  }
  return count;
}

export function assertMultiOrderAllowed(settings, restaurantCount) {
  if (restaurantCount <= 1) return;
  if (settings && settings.multiOrderEnabled === false) {
    throw new ValidationError('Multi-restaurant orders are currently disabled');
  }
}

export function isActivePickup(pickup) {
  if (!pickup) return false;
  if (pickup.permanentlyDropped) return false;
  const status = String(pickup.status || '');
  if (status === 'cancelled') return false;
  return ACTIVE_PICKUP_STATUSES.has(status);
}

export function getActivePickups(order) {
  const pickups = Array.isArray(order?.pickups) ? order.pickups : [];
  return pickups.filter(isActivePickup);
}

/** Fallback kitchen prep when a menu item carries no preparationTime. */
export const DEFAULT_PREP_MINUTES = 15;
/** Assumed average road speed used to convert trip distance into ETA minutes. */
export const AVG_SPEED_KMPH = 20;

/** Parse a menu preparationTime ("15 mins" | "15" | 15 | null) into minutes; 0 when unknown. */
export function parsePrepMinutes(value) {
  if (value == null) return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  }
  const match = String(value).match(/(\d+)/);
  if (!match) return 0;
  const minutes = parseInt(match[1], 10);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

/** A kitchen is only as fast as its slowest item. */
export function computeRestaurantPrepMinutes(items = []) {
  let max = 0;
  for (const item of items || []) {
    const minutes = parsePrepMinutes(item?.preparationTime);
    if (minutes > max) max = minutes;
  }
  return max > 0 ? max : DEFAULT_PREP_MINUTES;
}

/** Kitchens cook in parallel, so combined readiness = the slowest remaining kitchen. */
export function computeCombinedPrepMinutes(order) {
  const active = getActivePickups(order);
  if (active.length === 0) return DEFAULT_PREP_MINUTES;
  const max = active.reduce((acc, p) => Math.max(acc, Number(p.prepMinutes) || 0), 0);
  return max > 0 ? max : DEFAULT_PREP_MINUTES;
}

/** Combined ETA (minutes) = slowest kitchen + travel time over the whole trip. */
export function computeOrderEtaMinutes(order, distanceKm = 0) {
  const prep = computeCombinedPrepMinutes(order);
  const km = Math.max(0, Number(distanceKm) || 0);
  const travel = Math.round((km / AVG_SPEED_KMPH) * 60);
  return Math.max(1, prep + travel);
}

/**
 * Assign visit order: farthest-from-customer first, nearest-to-customer last, so the final leg
 * to the customer is the shortest. Deterministic and cheap — no routing API call.
 * `customerCoords` is GeoJSON order [lng, lat]. Mutates + returns the list.
 */
export function assignPickupSequence(pickups = [], customerCoords = null) {
  const list = Array.isArray(pickups) ? pickups : [];
  const cLng = Number(Array.isArray(customerCoords) ? customerCoords[0] : NaN);
  const cLat = Number(Array.isArray(customerCoords) ? customerCoords[1] : NaN);

  if (Number.isFinite(cLat) && Number.isFinite(cLng) && list.length > 1) {
    const distanceToCustomer = (pickup) => {
      const coords = pickup?.location?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return 0;
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 0;
      return haversineKm(cLat, cLng, lat, lng);
    };
    list.sort((a, b) => distanceToCustomer(b) - distanceToCustomer(a));
  }

  list.forEach((pickup, index) => {
    pickup.sequence = index;
  });
  return list;
}

/**
 * The stop the driver should head to next.
 * Follows `sequence`, but if the next sequenced stop is not ready and another remaining stop
 * already is, send them to the ready one first so they never idle at a cold kitchen.
 */
export function getNextPickup(order) {
  const remaining = getActivePickups(order).filter(
    (p) => String(p.status || '') !== 'picked_up',
  );
  if (remaining.length === 0) return null;

  const bySequence = remaining
    .slice()
    .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0));

  const head = bySequence[0];
  if (String(head.status || '') === 'ready') return head;
  return bySequence.find((p) => String(p.status || '') === 'ready') || head;
}

/**
 * Customer/driver-facing multi-stop progress, e.g. "Picked up 1 of 2".
 *
 * Per-pickup `status` is only maintained for multi-restaurant orders — the single-restaurant
 * path tracks readiness on `orderStatus` and never advances `pickups[0].status`. So single
 * orders are derived from `orderStatus`, otherwise every single order would look "waiting".
 */
export function getPickupProgress(order) {
  const active = getActivePickups(order);
  const isMulti = Boolean(order?.isMultiRestaurant) && active.length > 1;

  if (!isMulti) {
    const status = String(order?.orderStatus || '');
    const collected = ['picked_up', 'reached_drop', 'delivered'].includes(status);
    return {
      picked: collected ? 1 : 0,
      total: 1,
      nextRestaurantId: '',
      nextRestaurantName: '',
      isWaitingForFood: !collected && status !== 'ready_for_pickup',
      label: '',
    };
  }

  const total = active.length;
  const picked = active.filter((p) => String(p.status || '') === 'picked_up').length;
  const next = getNextPickup(order);
  return {
    picked,
    total,
    nextRestaurantId: next ? String(next.restaurantId || '') : '',
    nextRestaurantName: next?.restaurantName || '',
    isWaitingForFood: Boolean(next && String(next.status || '') !== 'ready'),
    label: `Picked up ${picked} of ${total}`,
  };
}


/**
 * All remaining (active) restaurants have accepted (or progressed past accept).
 */
export function areAllActiveRestaurantsAccepted(order) {
  const active = getActivePickups(order);
  if (active.length === 0) {
    // Single-restaurant orders may have empty pickups[]
    if (!order?.isMultiRestaurant) {
      return ['confirmed', 'preparing', 'ready_for_pickup', 'reached_pickup', 'picked_up', 'reached_drop', 'delivered']
        .includes(String(order?.orderStatus || ''));
    }
    return false;
  }
  return active.every((p) => ACCEPTED_OR_LATER_PICKUP.has(String(p.status || '')));
}

export function isPrimaryDriverAccepted(order) {
  return (
    String(order?.dispatch?.status || '') === 'accepted' &&
    Boolean(order?.dispatch?.deliveryPartnerId)
  );
}

export function getTotalItemCount(orderOrItems) {
  const items = Array.isArray(orderOrItems?.items)
    ? orderOrItems.items
    : Array.isArray(orderOrItems)
      ? orderOrItems
      : [];
  return items.reduce((sum, it) => sum + (Number(it?.quantity) || 1), 0);
}

export function isShareRequired(order, settings = {}) {
  const splitEnabled = settings?.splitOrderEnabled !== false;
  const threshold = Number(settings?.splitOrderThreshold ?? 20);
  if (!splitEnabled || !(threshold > 0)) return false;
  return getTotalItemCount(order) >= threshold;
}

export function isSharedDriverJoined(order) {
  return Boolean(order?.dispatch?.sharedPartnerId);
}

/**
 * Fully locked: all active restaurants accepted + primary driver accepted,
 * and if share is required then shared partner must have joined.
 * Not locked while any pickup is awaiting DP resend.
 */
export function isOrderFullyLocked(order, settings = {}) {
  const pickups = Array.isArray(order?.pickups) ? order.pickups : [];
  const awaitingResend = pickups.some(
    (p) =>
      !p.permanentlyDropped &&
      String(p.status || '') === 'cancelled',
  );
  if (awaitingResend) return false;

  if (!areAllActiveRestaurantsAccepted(order)) return false;
  if (!isPrimaryDriverAccepted(order)) return false;
  if (isShareRequired(order, settings) && !isSharedDriverJoined(order)) return false;
  return true;
}

/**
 * Cancel permission matrix.
 * @param {'USER'|'RESTAURANT'|'DELIVERY_PARTNER'|'ADMIN'|'SYSTEM'} role
 */
export function canCancel({ role, order, settings = {} }) {
  const status = String(order?.orderStatus || '');
  if (TERMINAL_ORDER_STATUSES.has(status)) {
    return { allowed: false, reason: 'Order is already terminal' };
  }

  if (role === 'ADMIN' || role === 'SYSTEM') {
    return { allowed: true };
  }

  if (isOrderFullyLocked(order, settings)) {
    return {
      allowed: false,
      reason: 'Order is locked after restaurants and drivers accepted. Only admin can cancel.',
      code: 'ORDER_LOCKED_ADMIN_ONLY',
    };
  }

  if (role === 'USER') {
    if (['created', 'scheduled'].includes(status)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Order cannot be cancelled at this stage' };
  }

  if (role === 'RESTAURANT') {
    // Before full lock, restaurant may reject (handled via status update, not cancel)
    if (isOrderFullyLocked(order, settings)) {
      return {
        allowed: false,
        reason: 'Order is locked. Only admin can cancel.',
        code: 'ORDER_LOCKED_ADMIN_ONLY',
      };
    }
    return { allowed: true };
  }

  if (role === 'DELIVERY_PARTNER') {
    return { allowed: false, reason: 'Delivery partner cannot cancel the order' };
  }

  return { allowed: false, reason: 'Cancel not allowed' };
}

export function assertCanCancel(args) {
  const result = canCancel(args);
  if (!result.allowed) {
    throw new ValidationError(result.reason || 'Cancel not allowed');
  }
  return result;
}

export function assertCanShareSecondDriver(order) {
  if (order?.dispatch?.sharedPartnerId) {
    throw new ValidationError(`Maximum ${MAX_DRIVERS_PER_ORDER} drivers already assigned`);
  }
}

/**
 * Refund amount for a dropped restaurant: food + packaging + proportional tax on food.
 * Delivery fee and platform fee are kept unless the whole order is cancelled.
 */
export function computeDroppedRestaurantRefundAmount(order, restaurantId) {
  const rid = String(restaurantId || '');
  const groups = Array.isArray(order?.pricing?.restaurantGroups)
    ? order.pricing.restaurantGroups
    : [];
  const group = groups.find((g) => String(g?.restaurantId || '') === rid);

  let foodAmount = 0;
  let packagingFee = 0;

  if (group) {
    foodAmount = Number(group.subtotal) || 0;
    packagingFee = Number(group.packagingFee) || 0;
  } else {
    const items = (order?.items || []).filter(
      (it) => String(it?.restaurantId || '') === rid,
    );
    foodAmount = items.reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0,
    );
    const settlement = (order?.restaurantSettlement || []).find(
      (s) => String(s?.restaurantId || '') === rid,
    );
    packagingFee = Number(settlement?.packagingFee) || 0;
  }

  const foodSubtotal = Number(order?.pricing?.foodSubtotal ?? order?.pricing?.subtotal) || 0;
  const taxTotal = Number(order?.pricing?.tax) || 0;
  const taxShare =
    foodSubtotal > 0 && foodAmount > 0
      ? Math.round(taxTotal * (foodAmount / foodSubtotal))
      : 0;

  const amount = Math.max(0, Number((foodAmount + packagingFee + taxShare).toFixed(2)));
  return {
    amount,
    foodAmount,
    packagingFee,
    taxShare,
  };
}

/**
 * Append an immutable settlement snapshot onto the order document (in-memory).
 */
export function pushSettlementSnapshot(order, event, note = '') {
  if (!order) return null;
  if (!Array.isArray(order.settlementSnapshots)) order.settlementSnapshots = [];

  const breakdown = order.pricing?.deliveryFeeBreakdown || null;
  const activeCount = getActivePickups(order).length;
  const snap = {
    at: new Date(),
    event: String(event || 'create'),
    pricing: order.pricing
      ? {
          foodSubtotal: Number(order.pricing.foodSubtotal ?? order.pricing.subtotal) || 0,
          packagingFee: Number(order.pricing.packagingFee) || 0,
          deliveryFee: Number(order.pricing.deliveryFee) || 0,
          platformFee: Number(order.pricing.platformFee) || 0,
          tax: Number(order.pricing.tax) || 0,
          discount: Number(order.pricing.discount) || 0,
          deliveryDiscount: Number(order.pricing.deliveryDiscount) || 0,
          total: Number(order.pricing.total) || 0,
          restaurantGroups: order.pricing.restaurantGroups || [],
        }
      : null,
    riderEarning: Number(order.riderEarning) || 0,
    sharedRiderEarning: Number(order.sharedRiderEarning) || 0,
    platformProfit: Number(order.platformProfit) || 0,
    driverSettlement: order.driverSettlement || null,
    platformRevenue: order.platformRevenue || null,
    deliveryFeeBreakdown: breakdown,
    isMultiRestaurant: Boolean(order.isMultiRestaurant),
    isSplitOrder: Boolean(breakdown?.isSplitOrder),
    activePickupCount: activeCount,
    partialRefundAmount: (order.partialRefunds || []).reduce(
      (sum, r) => sum + (Number(r?.amount) || 0),
      0,
    ),
    note: note || '',
  };
  order.settlementSnapshots.push(snap);
  return snap;
}
