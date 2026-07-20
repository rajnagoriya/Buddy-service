import mongoose from 'mongoose';
import { logger } from '../../../../utils/logger.js';
import {
  sendNotificationToOwner,
  sendNotificationToOwners,
} from "../../../../core/notifications/firebase.service.js";
import { getIO, rooms } from '../../../../config/socket.js';
import { addOrderJob } from '../../../../queues/producers/order.producer.js';

export function enqueueOrderEvent(action, payload = {}) {
  try {
    void addOrderJob({ action, ...payload }).catch((err) => {
      logger.warn(`BullMQ enqueue order event failed: ${action} - ${err?.message || err}`);
    });
  } catch (err) {
    logger.warn(`BullMQ enqueue order event failed (sync): ${action} - ${err?.message || err}`);
  }
}

// Canonical implementation lives in core/location/haversine.util.js.
// Import for local use, then re-export for existing importers.
import { haversineKm } from '../../../../core/location/haversine.util.js';
export { haversineKm };

export function resolveSlabAmounts(rule) {
  if (!rule) return { userCharge: 0, deliveryBoyFee: 0 };
  const legacyBase = Number(rule.basePayout);
  const hasLegacy = Number.isFinite(legacyBase) && legacyBase >= 0;

  // Prefer new fields; fall back to legacy basePayout when field is missing (undefined/null)
  const userCharge = Number(
    rule.userCharge ?? (hasLegacy ? legacyBase : 0),
  );
  const deliveryBoyFee = Number(
    rule.deliveryBoyFee ?? (hasLegacy ? legacyBase : 0),
  );

  return {
    userCharge: Number.isFinite(userCharge) && userCharge >= 0 ? userCharge : 0,
    deliveryBoyFee: Number.isFinite(deliveryBoyFee) && deliveryBoyFee >= 0 ? deliveryBoyFee : 0,
  };
}

/**
 * Match a fixed distance slab.
 * Inclusive min/max; if multiple slabs match a boundary (e.g. 2 km on 0–2 and 2–4),
 * the lower (first) slab wins.
 */
export function findMatchingDistanceSlab(distanceKm, rules = []) {
  const d = Math.max(0, Number(distanceKm) || 0);
  const list = Array.isArray(rules) ? rules.filter((r) => r && r.status !== false) : [];
  if (!list.length) return null;

  const sorted = [...list].sort(
    (a, b) => (Number(a.minDistance) || 0) - (Number(b.minDistance) || 0),
  );

  for (const rule of sorted) {
    const min = Number(rule.minDistance || 0);
    const max = rule.maxDistance == null ? null : Number(rule.maxDistance);
    if (d < min) continue;
    if (max != null && Number.isFinite(max) && d > max) continue;
    return rule;
  }

  // Beyond last closed slab → use last open-ended or last rule
  const last = sorted[sorted.length - 1];
  if (last && (last.maxDistance == null || last.maxDistance === undefined)) return last;
  return null;
}

/**
 * Fixed slab fee for the customer (userCharge of matching slab).
 * No per-km accumulation.
 */
export function calculateDistanceSlabFee(distanceKm, rules = []) {
  const matched = findMatchingDistanceSlab(distanceKm, rules);
  if (!matched) return 0;
  const { userCharge } = resolveSlabAmounts(matched);
  return Math.round(userCharge);
}

/** Fixed slab fee for the delivery partner (deliveryBoyFee of matching slab). */
export function calculateDistanceSlabRiderFee(distanceKm, rules = []) {
  const matched = findMatchingDistanceSlab(distanceKm, rules);
  if (!matched) return 0;
  const { deliveryBoyFee } = resolveSlabAmounts(matched);
  return Math.round(deliveryBoyFee);
}

/** Resolve both customer + rider fixed fees for a distance. */
export function resolveDistanceSlabQuote(distanceKm, rules = []) {
  const matched = findMatchingDistanceSlab(distanceKm, rules);
  if (!matched) {
    return {
      matched: null,
      userCharge: 0,
      deliveryBoyFee: 0,
    };
  }
  const amounts = resolveSlabAmounts(matched);
  return {
    matched,
    userCharge: Math.round(amounts.userCharge),
    deliveryBoyFee: Math.round(amounts.deliveryBoyFee),
  };
}

export function calculateRangeDeliveryFee(distanceKm, ranges = []) {
  const d = Number(distanceKm);
  if (!Number.isFinite(d) || d < 0) return null;
  const list = Array.isArray(ranges) ? [...ranges] : [];
  if (!list.length) return null;

  const sorted = list.sort((a, b) => Number(a.min) - Number(b.min));
  for (let i = 0; i < sorted.length; i += 1) {
    const range = sorted[i];
    const min = Number(range.min);
    const max = Number(range.max);
    const fee = Number(range.fee);
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(fee)) continue;
    const isLastRange = i === sorted.length - 1;
    const inRange = isLastRange
      ? d >= min && d <= max
      : d >= min && d < max;
    if (inRange) return fee;
  }
  return null;
}

function getRestaurantLatLng(restaurant) {
  const coords = restaurant?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Fee distance path: user → R1 → R2 → … → Rn (cart order).
 * Single restaurant: user → R1.
 */
function resolveOrderDistanceKmStraight(restaurants = [], userLoc) {
  if (!Array.isArray(restaurants) || restaurants.length === 0) return 0;
  if (!Array.isArray(userLoc) || userLoc.length < 2) return 0;

  const points = [{ lat: userLoc[1], lng: userLoc[0] }];
  for (const restaurant of restaurants) {
    const point = getRestaurantLatLng(restaurant);
    if (point) points.push(point);
  }
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += haversineKm(
      points[i].lat,
      points[i].lng,
      points[i + 1].lat,
      points[i + 1].lng,
    );
  }
  return total;
}

/** Sync fallback (haversine). Prefer resolveOrderDistanceKmAsync for road distance. */
export function resolveOrderDistanceKm(restaurants = [], userLoc) {
  return resolveOrderDistanceKmStraight(restaurants, userLoc);
}

/**
 * Order delivery distance in km (road preferred).
 * Path: user → R1 → R2 → … → Rn.
 */
export async function resolveOrderDistanceKmAsync(restaurants = [], userLoc) {
  const straight = resolveOrderDistanceKmStraight(restaurants, userLoc);
  if (!Array.isArray(restaurants) || restaurants.length === 0) return 0;
  if (!Array.isArray(userLoc) || userLoc.length < 2) return 0;

  try {
    const { fetchRoadDistancesKm } = await import('../utils/googleMaps.js');
    const user = { lat: userLoc[1], lng: userLoc[0] };

    const points = [user];
    for (const restaurant of restaurants) {
      const point = getRestaurantLatLng(restaurant);
      if (point) points.push(point);
    }
    if (points.length < 2) return 0;

    let total = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const [leg] = (await fetchRoadDistancesKm(points[i], [points[i + 1]])) || [];
      if (!Number.isFinite(leg)) {
        return Number.isFinite(straight) ? Number(straight.toFixed(2)) : 0;
      }
      total += leg;
    }
    return Number(total.toFixed(2));
  } catch {
    // fall through to straight-line
  }

  return Number.isFinite(straight) ? Number(straight.toFixed(2)) : 0;
}

export function applyDeliverySurcharges(baseFee, { isMultiRestaurant, isSplitOrder, deliveryBoySettings } = {}) {
  const base = Math.max(0, Number(baseFee) || 0);
  let surcharge = 0;
  let multiplier = 1;

  if (isMultiRestaurant) {
    surcharge += Math.max(0, Number(deliveryBoySettings?.multiOrderAdditionalCharge) || 0);
  }
  if (isSplitOrder) {
    surcharge += base;
    multiplier = 2;
  }

  return {
    baseFee: base,
    surcharge,
    multiplier: isSplitOrder ? multiplier : 1,
    fee: base + surcharge,
  };
}

export function resolveSpeedFeeModifier(deliveryBoySettings, deliverySpeedOptionId, deliveryOptionName) {
  const options = Array.isArray(deliveryBoySettings?.deliverySpeedOptions)
    ? deliveryBoySettings.deliverySpeedOptions.filter((o) => o && o.isEnabled !== false)
    : [];
  if (!options.length) return 0;

  const id = String(deliverySpeedOptionId || "").trim();
  if (id) {
    const byId = options.find((o) => String(o.id) === id);
    if (byId) return Number(byId.feeModifier) || 0;
  }

  const name = String(deliveryOptionName || "").trim().toLowerCase();
  if (name) {
    const byName = options.find((o) => String(o.name || "").trim().toLowerCase() === name);
    if (byName) return Number(byName.feeModifier) || 0;
  }

  const defaultOption = options.find((o) => o.isDefault) || options[0];
  return Number(defaultOption?.feeModifier) || 0;
}

export function generateFourDigitDeliveryOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function sanitizeOrderForExternal(orderDoc) {
  const o = orderDoc?.toObject ? orderDoc.toObject() : { ...(orderDoc || {}) };
  delete o.deliveryOtp;
  const dv = o.deliveryVerification;
  if (dv && dv.dropOtp != null) {
    const d = dv.dropOtp;
    o.deliveryVerification = {
      ...dv,
      dropOtp: {
        required: Boolean(d.required),
        verified: Boolean(d.verified),
      },
    };
  }
  o.orderMongoId = (o._id || orderDoc?._id || "").toString();
  // Ensure orderId field for UI always contains the pretty ID
  o.orderId = o.order_id || o.orderMongoId; 
  return o;
}

export function emitDeliveryDropOtpToUser(order, plainOtp) {
  try {
    const io = getIO();
    if (!io || !plainOtp || !order?.userId) return;
    io.to(rooms.user(order.userId)).emit("delivery_drop_otp", {
      orderMongoId: order._id?.toString?.(),
      orderId: order.order_id || order._id?.toString?.(),
      otp: plainOtp,
      message:
        "Share this OTP with your delivery partner to hand over the order.",
    });
  } catch (e) {
    logger.warn(`emitDeliveryDropOtpToUser failed: ${e?.message || e}`);
  }
}

export async function notifyOwnersSafely(targets, payload) {
  try {
    await sendNotificationToOwners(targets, payload);
  } catch (error) {
    logger.warn(`FCM notification failed: ${error?.message || error}`);
  }
}

export async function notifyOwnerSafely(target, payload) {
  try {
    await sendNotificationToOwner({ ...target, payload });
  } catch (error) {
    logger.warn(`FCM notification failed: ${error?.message || error}`);
  }
}

export function buildOrderIdentityFilter(orderIdOrMongoId) {
  const raw = String(orderIdOrMongoId || "").trim();
  if (!raw) return null;
  if (mongoose.isValidObjectId(raw))
    return { _id: new mongoose.Types.ObjectId(raw) };
  
  // Search BOTH underscore and camelCase variants for robust lookup
  return { 
    $or: [
        { order_id: raw },
        { orderId: raw }
    ]
  };
}

export function toGeoPoint(lat, lng) {
  if (lat == null || lng == null) return undefined;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  return { type: "Point", coordinates: [b, a] };
}

export function pushStatusHistory(order, { byRole, byId, from, to, note = "" }) {
  order.statusHistory.push({
    at: new Date(),
    byRole,
    byId: byId || undefined,
    from,
    to,
    note,
  });
}

export const MAX_DISPATCH_ATTEMPTS = 10;

/** Auto-cancel food orders with no accepted driver after this age. Testing: 1 min → production: 5 min. */
export const NO_DRIVER_AUTO_CANCEL_MS = 1 * 60 * 1000;

/**
 * How long a bulk order waits for a second (shared) delivery partner to join before the
 * primary partner is allowed to complete the delivery solo with the full earning restored.
 * Prevents a ≥threshold-item order from getting permanently stuck when no 2nd driver joins.
 */
export const SHARE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Driver-first escalation: once a rider has accepted but NO restaurant has accepted yet
 * (orderStatus still 'created'), re-notify the restaurant after RESEND, then auto-reject +
 * refund + release the driver after TIMEOUT. Prevents a driver from being stranded on an
 * order the restaurant silently ignores.
 */
export const RESTAURANT_ACK_RESEND_MS = 2 * 60 * 1000;
export const RESTAURANT_ACK_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Server-side geofence for "reached pickup" / "reached drop". Fail-OPEN when the rider's
 * last known location is missing or staler than RIDER_LOCATION_STALE_MS (Mongo location can
 * lag the Redis hot path by ~30s), so legitimate riders are never blocked; only gross spoofing
 * (marking arrived from far away) is rejected. Radii are intentionally generous.
 */
export const PICKUP_GEOFENCE_METERS = 1000;
export const DROP_GEOFENCE_METERS = 1000;
export const RIDER_LOCATION_STALE_MS = 10 * 60 * 1000;

export function freeOrderDispatch(orderDoc) {
  if (!orderDoc) return;
  orderDoc.dispatch = orderDoc.dispatch || {};
  orderDoc.dispatch.status = 'cancelled';
  orderDoc.dispatch.deliveryPartnerId = null;
  orderDoc.dispatch.sharedPartnerId = null;
  orderDoc.dispatch.acceptedAt = undefined;
  orderDoc.dispatch.assignedAt = undefined;
}

export function computeRiderToRestaurantDistanceKm(orderDoc) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc || {};
  const riderCoords = order?.lastRiderLocation?.coordinates;
  if (!Array.isArray(riderCoords) || riderCoords.length < 2) return null;

  const restaurantCoords =
    order?.restaurantId?.location?.coordinates ||
    order?.pickups?.[0]?.location?.coordinates ||
    null;
  if (!Array.isArray(restaurantCoords) || restaurantCoords.length < 2) return null;

  const [rLng, rLat] = riderCoords;
  const [restLng, restLat] = restaurantCoords;
  const km = haversineKm(rLat, rLng, restLat, restLng);
  return Number.isFinite(km) ? Number(km.toFixed(2)) : null;
}

export function normalizeOrderForClient(orderDoc) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc || {};
  const mongoId = (order._id || orderDoc?._id || "").toString();
  const displayId = order.order_id || mongoId;
  const phase = order?.deliveryState?.currentPhase;
  const prePickupPhases = new Set(['en_route_to_pickup', 'at_pickup']);
  const prePickupStatuses = new Set(['created', 'confirmed', 'preparing', 'ready_for_pickup', 'reached_pickup']);
  const showRiderToRestaurantDistance =
    prePickupPhases.has(phase) ||
    (prePickupStatuses.has(order?.orderStatus) && order?.dispatch?.status === 'accepted');

  return {
    ...order,
    orderMongoId: mongoId,
    orderId: displayId,
    status: order?.orderStatus || order?.status || "",
    deliveredAt:
      order?.deliveryState?.deliveredAt || order?.deliveredAt || null,
    deliveryPartnerId:
      order?.dispatch?.deliveryPartnerId || order?.deliveryPartnerId || null,
    rating: order?.ratings?.restaurant?.rating ?? order?.rating ?? null,
    restaurantNote: order?.restaurantNote || "",
    cancellationReason: (order?.orderStatus?.includes('cancel') || order?.status?.includes('cancel')) 
      ? (order.statusHistory?.findLast(h => h.to?.includes('cancel'))?.note || "")
      : null,
    failureReason: (() => {
      const cancelNote = String(
        order.statusHistory?.findLast((h) => h.to?.includes('cancel'))?.note || '',
      ).toLowerCase();
      if (cancelNote.includes('no delivery partner')) return 'driver_not_found';
      if (cancelNote.includes('3 times') || cancelNote.includes('3 attempts')) return 'restaurant_rejected';
      return null;
    })(),
    riderToRestaurantDistanceKm: showRiderToRestaurantDistance
      ? computeRiderToRestaurantDistanceKm(order)
      : null,
    deliveryState: {
      ...(order?.deliveryState || {}),
      currentLocation: order?.lastRiderLocation?.coordinates?.length >= 2 ? {
        lat: order.lastRiderLocation.coordinates[1],
        lng: order.lastRiderLocation.coordinates[0]
      } : (order?.deliveryState?.currentLocation || null)
    }
  };
}

/**
 * Amount the restaurant receives for this order:
 * food + packaging - commission - (restaurant-funded coupon discount when applicable).
 */
export function resolveRestaurantEarnings(order, restaurantId) {
  const rid = String(restaurantId || '').trim();
  const orderRestaurantId = String(
    order?.restaurantId?._id || order?.restaurantId || '',
  ).trim();
  const pricing = order?.pricing || {};
  const discount = Number(pricing.discount || 0) || 0;
  const isRestaurantCoupon = pricing.couponCreatedBy === 'restaurant';
  const settlements = Array.isArray(order?.restaurantSettlement)
    ? order.restaurantSettlement
    : [];
  const match = settlements.find(
    (s) => String(s?.restaurantId?._id || s?.restaurantId || '').trim() === rid,
  );

  let foodAmount = 0;
  let packagingFee = 0;
  let commission = 0;
  let payout = null;

  if (match) {
    foodAmount = Number(match.foodAmount) || 0;
    packagingFee = Number(match.packagingFee) || 0;
    commission = Number(match.commission) || 0;
    payout = Number(match.restaurantPayout);
    if (!Number.isFinite(payout)) {
      payout = Math.max(0, Number((foodAmount + packagingFee - commission).toFixed(2)));
    }
  } else {
    const items = Array.isArray(order?.items) ? order.items : [];
    foodAmount = items.reduce((sum, item) => {
      const itemRid = String(item?.restaurantId?._id || item?.restaurantId || '').trim();
      const belongs =
        itemRid ? itemRid === rid : orderRestaurantId === rid;
      if (!belongs) return sum;
      const price = Number(item?.price || 0);
      const qty = Number(item?.quantity || 1);
      return sum + (Number.isFinite(price) ? price : 0) * (Number.isFinite(qty) ? qty : 1);
    }, 0);
    if (!foodAmount && orderRestaurantId === rid) {
      foodAmount = Number(pricing.subtotal || 0) || 0;
    }
    packagingFee =
      orderRestaurantId === rid
        ? Number(pricing.packagingFee || pricing.restaurantPackagingTotal || 0) || 0
        : 0;
    commission =
      orderRestaurantId === rid
        ? Number(pricing.restaurantCommission || 0) || 0
        : 0;
    payout = Math.max(0, Number((foodAmount + packagingFee - commission).toFixed(2)));
  }

  // Restaurant-funded coupons reduce restaurant payout (matches FoodTransaction.restaurantShare).
  // Apply only for the primary restaurant when coupon is restaurant-created.
  const applyCouponDiscount =
    isRestaurantCoupon &&
    discount > 0 &&
    (settlements.length <= 1 || rid === orderRestaurantId);
  const restaurantDiscount = applyCouponDiscount ? discount : 0;
  if (restaurantDiscount > 0) {
    payout = Math.max(0, Number((payout - restaurantDiscount).toFixed(2)));
  }

  return {
    foodAmount: Number(foodAmount.toFixed(2)),
    packagingFee: Number(packagingFee.toFixed(2)),
    commission: Number(commission.toFixed(2)),
    discount: Number(restaurantDiscount.toFixed(2)),
    payout: Number((Number.isFinite(payout) ? payout : 0).toFixed(2)),
  };
}

export function mapPickupStatusToRestaurantOrderStatus(pickupStatus, fallbackOrderStatus = 'created') {
  const pickup = String(pickupStatus || '').toLowerCase().trim();
  switch (pickup) {
    case 'pending':
      return 'created';
    case 'accepted':
      return 'confirmed';
    case 'preparing':
      return 'preparing';
    case 'ready':
    case 'ready_for_handover':
      return 'ready_for_pickup';
    case 'picked_up':
      return 'picked_up';
    case 'cancelled':
      return 'cancelled_by_restaurant';
    default:
      break;
  }
  const fallback = String(fallbackOrderStatus || 'created').toLowerCase().trim();
  return fallback || 'created';
}

export function buildRestaurantScopedOrder(orderDoc, restaurantId) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc || {};
  const rid = String(restaurantId || '').trim();
  if (!rid) return order;

  const orderRestaurantId = String(
    order?.restaurantId?._id || order?.restaurantId || '',
  ).trim();

  // Keep items that belong to this restaurant. If an item has no restaurantId
  // (legacy/single-restaurant orders), treat it as belonging to the order's restaurant.
  const filteredItems = Array.isArray(order.items)
    ? order.items.filter((item) => {
        const itemRid = String(item?.restaurantId?._id || item?.restaurantId || '').trim();
        if (itemRid) return itemRid === rid;
        return orderRestaurantId === rid;
      })
    : [];
  const filteredPickups = Array.isArray(order.pickups)
    ? order.pickups.filter(
        (pickup) => String(pickup?.restaurantId?._id || pickup?.restaurantId || '') === rid,
      )
    : [];

  const earnings = resolveRestaurantEarnings(
    { ...order, items: filteredItems },
    rid,
  );

  // Restaurant clients should only see what they earn — not customer bill fees.
  const restaurantPricing = {
    ...(order.pricing || {}),
    subtotal: earnings.foodAmount,
    packagingFee: earnings.packagingFee,
    restaurantCommission: earnings.commission,
    discount: earnings.discount,
    tax: 0,
    deliveryFee: 0,
    platformFee: 0,
    deliveryDiscount: 0,
    platformSubsidy: 0,
    total: earnings.payout,
  };

  // Multi-restaurant: each restaurant must see ITS pickup status, not aggregate orderStatus.
  // Otherwise after restaurant A accepts, restaurant B incorrectly sees "preparing/accepted".
  const ownPickup = filteredPickups[0] || null;
  const hasMultiPickups = Array.isArray(order.pickups) && order.pickups.length > 1;
  const scopedStatus = hasMultiPickups || ownPickup
    ? mapPickupStatusToRestaurantOrderStatus(
        ownPickup?.status,
        // Before rider accept, restaurants shouldn't act; still show created/pending for this pickup
        ownPickup ? 'created' : (order?.orderStatus || order?.status || 'created'),
      )
    : (order?.orderStatus || order?.status || '');

  const scoped = {
    ...order,
    items: filteredItems,
    pickups: filteredPickups,
    restaurantId: rid,
    pricing: restaurantPricing,
    restaurantEarnings: earnings,
    restaurantPayout: earnings.payout,
    // Explicit client fields for restaurant live panel / accept popup
    status: scopedStatus,
    orderStatus: scopedStatus,
    // Keep aggregate for debugging / DP-aligned clients that need it
    aggregateOrderStatus: order?.orderStatus || order?.status || '',
    myPickupStatus: ownPickup?.status || null,
  };

  if (filteredPickups.length === 1 && filteredPickups[0]?.restaurantName) {
    scoped.restaurantName = filteredPickups[0].restaurantName;
  }

  return scoped;
}

/**
 * Build restaurant-facing order timeline with date + time from statusHistory.
 */
export function buildRestaurantOrderTimeline(order = {}) {
  const formatTimestamp = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const findHistoryAt = (...statuses) => {
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    const wanted = statuses.map((s) => String(s).toLowerCase());
    const match = history.find((h) => wanted.includes(String(h?.to || '').toLowerCase()));
    return match?.at || null;
  };

  const statusLower = String(order.orderStatus || order.status || '').toLowerCase();
  const steps = [
    {
      key: 'placed',
      event: 'Order placed',
      at: order.createdAt,
      reached: true,
    },
    {
      key: 'confirmed',
      event: 'Order confirmed',
      at:
        findHistoryAt('confirmed', 'accepted') ||
        order.dispatch?.acceptedAt ||
        order.restaurantNotifiedAt,
      reached:
        Boolean(findHistoryAt('confirmed', 'accepted') || order.dispatch?.acceptedAt) ||
        ['confirmed', 'preparing', 'ready', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered'].includes(statusLower),
    },
    {
      key: 'preparing',
      event: 'Preparing',
      at: findHistoryAt('preparing'),
      reached:
        Boolean(findHistoryAt('preparing')) ||
        ['preparing', 'ready', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered'].includes(statusLower),
    },
    {
      key: 'ready',
      event: 'Ready for pickup',
      at: findHistoryAt('ready', 'ready_for_pickup'),
      reached:
        Boolean(findHistoryAt('ready', 'ready_for_pickup')) ||
        ['ready', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered'].includes(statusLower),
    },
    {
      key: 'out_for_delivery',
      event: 'Out for delivery',
      at:
        findHistoryAt('picked_up', 'out_for_delivery') ||
        order.deliveryState?.pickedUpAt,
      reached:
        Boolean(findHistoryAt('picked_up', 'out_for_delivery') || order.deliveryState?.pickedUpAt) ||
        ['picked_up', 'out_for_delivery', 'delivered'].includes(statusLower),
    },
    {
      key: 'delivered',
      event: 'Delivered',
      at:
        findHistoryAt('delivered', 'completed') ||
        order.deliveryState?.deliveredAt ||
        order.deliveredAt,
      reached:
        Boolean(
          findHistoryAt('delivered', 'completed') ||
            order.deliveryState?.deliveredAt ||
            order.deliveredAt,
        ) || statusLower === 'delivered' || statusLower === 'completed',
    },
  ];

  const timeline = steps
    .filter((step) => step.reached)
    .map((step) => ({
      event: step.event,
      timestamp: formatTimestamp(step.at),
      at: step.at || null,
      status: 'completed',
    }));

  if (statusLower.includes('cancel') || statusLower.includes('reject')) {
    const cancelAt =
      findHistoryAt(
        'cancelled',
        'cancelled_by_user',
        'cancelled_by_restaurant',
        'cancelled_by_admin',
        'rejected',
        'rejected_by_restaurant',
      ) || order.cancelledAt;
    timeline.push({
      event: statusLower.includes('reject') ? 'Rejected' : 'Cancelled',
      timestamp: formatTimestamp(cancelAt),
      at: cancelAt || null,
      status: 'rejected',
      reason: order.cancellationReason || '',
    });
  }

  return timeline;
}

/**
 * Lean restaurant-facing order payload.
 * Excludes customer bill internals, payment gateway secrets, OTPs, and other unused fields.
 */
export function toRestaurantOrderResponse(orderDoc) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : { ...(orderDoc || {}) };
  const mongoId = (order._id || order.orderMongoId || '').toString();
  const displayId = order.order_id || order.orderId || mongoId;
  const addr = order.deliveryAddress || order.address || {};
  const user = order.userId && typeof order.userId === 'object' ? order.userId : null;
  const partnerRaw = order.dispatch?.deliveryPartnerId;
  const partner =
    partnerRaw && typeof partnerRaw === 'object' ? partnerRaw : null;
  const partnerId = partner
    ? String(partner._id || partner.id || '')
    : partnerRaw
      ? String(partnerRaw)
      : null;

  const rid = String(
    order?.restaurantId?._id || order?.restaurantId || '',
  ).trim();
  const earnings =
    order.restaurantEarnings ||
    (rid ? resolveRestaurantEarnings(order, rid) : null) || {
      foodAmount: Number(order.pricing?.subtotal || 0) || 0,
      packagingFee: Number(order.pricing?.packagingFee || 0) || 0,
      commission: Number(order.pricing?.restaurantCommission || 0) || 0,
      discount: Number(order.pricing?.discount || 0) || 0,
      payout: Number(order.restaurantPayout ?? order.pricing?.total ?? 0) || 0,
    };

  const items = (Array.isArray(order.items) ? order.items : []).map((item) => ({
    name: item?.name || '',
    quantity: Number(item?.quantity || 1) || 1,
    price: Number(item?.price || 0) || 0,
    image: item?.image || undefined,
    isVeg: item?.isVeg ?? String(item?.foodType || '').toLowerCase() === 'veg',
    foodType: item?.foodType || undefined,
    addons: Array.isArray(item?.addons) ? item.addons : undefined,
    variant: item?.variant || undefined,
    specialInstructions: item?.specialInstructions || item?.note || undefined,
  }));

  const formattedAddress =
    addr.formattedAddress ||
    addr.address ||
    [addr.street, addr.additionalDetails, addr.city, addr.state, addr.zipCode || addr.pincode]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .join(', ');

  const timeline = buildRestaurantOrderTimeline(order);

  return {
    _id: mongoId,
    orderMongoId: mongoId,
    orderId: displayId,
    order_id: displayId,
    orderStatus: order.orderStatus || order.status || '',
    status: order.orderStatus || order.status || '',
    aggregateOrderStatus: order.aggregateOrderStatus || undefined,
    myPickupStatus: order.myPickupStatus || order.pickups?.[0]?.status || null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    cancelledAt: order.cancelledAt || undefined,
    cancellationReason: order.cancellationReason || undefined,
    restaurantNote: order.restaurantNote || '',
    note: order.note || '',
    sendCutlery: Boolean(order.sendCutlery),
    scheduledAt: order.scheduledAt || undefined,
    deliveryFleet: order.deliveryFleet || undefined,
    estimatedDeliveryTime: order.estimatedDeliveryTime || undefined,
    restaurantNotifiedAt: order.restaurantNotifiedAt || order.dispatch?.acceptedAt || undefined,
    restaurantId: rid,
    restaurantName:
      order.restaurantName ||
      order.restaurantId?.restaurantName ||
      order.restaurant?.restaurantName ||
      '',
    customerName:
      order.customerName ||
      user?.name ||
      user?.fullName ||
      addr.fullName ||
      addr.name ||
      '',
    customerPhone:
      order.customerPhone || user?.phone || addr.phone || '',
    userId: user
      ? {
          name: user.name || user.fullName || '',
          phone: user.phone || '',
        }
      : undefined,
    deliveryAddress: {
      street: addr.street || '',
      additionalDetails: addr.additionalDetails || '',
      city: addr.city || '',
      state: addr.state || '',
      zipCode: addr.zipCode || addr.pincode || '',
      formattedAddress,
      name: addr.fullName || addr.name || '',
      phone: addr.phone || '',
    },
    items,
    restaurantEarnings: earnings,
    restaurantPayout: Number(order.restaurantPayout ?? earnings.payout) || 0,
    pricing: {
      subtotal: earnings.foodAmount,
      packagingFee: earnings.packagingFee,
      restaurantCommission: earnings.commission,
      discount: earnings.discount,
      total: earnings.payout,
      currency: order.pricing?.currency || 'INR',
    },
    payment: {
      method: order.payment?.method || '',
      status: order.payment?.status || '',
    },
    tracking: order.tracking
      ? {
          confirmed: order.tracking.confirmed || undefined,
          preparing: order.tracking.preparing || undefined,
          ready: order.tracking.ready || undefined,
          outForDelivery: order.tracking.outForDelivery || undefined,
          delivered: order.tracking.delivered || undefined,
        }
      : undefined,
    dispatch: {
      status: order.dispatch?.status || null,
      acceptedAt: order.dispatch?.acceptedAt || undefined,
      deliveryPartnerId: partner
        ? {
            _id: partnerId,
            name: partner.name || partner.fullName || '',
            phone: partner.phone || partner.phoneNumber || '',
          }
        : partnerId,
    },
    deliveryPartnerId: partnerId,
    timeline,
    pickups: Array.isArray(order.pickups)
      ? order.pickups.map((p) => ({
          restaurantId: String(p?.restaurantId?._id || p?.restaurantId || ''),
          restaurantName: p?.restaurantName || '',
          status: p?.status || '',
        }))
      : [],
  };
}

export async function applyAggregateRating(model, entityId, newRating) {
  if (!entityId) return;
  const doc = await model.findById(entityId).select("rating totalRatings");
  if (!doc) return;

  const totalRatings = Number(doc.totalRatings || 0);
  const currentAverage = Number(doc.rating || 0);
  const nextTotal = totalRatings + 1;
  const nextAverage = Number(
    ((currentAverage * totalRatings + Number(newRating)) / nextTotal).toFixed(1),
  );

  doc.totalRatings = nextTotal;
  doc.rating = nextAverage;
  await doc.save();
}

export function buildDeliverySocketPayload(orderDoc, restaurantDoc = null) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc || {};
  const restaurant = restaurantDoc || order?.restaurantId || null;
  const restaurantLocation = restaurant?.location || {};
  const deliveryAddress = order?.deliveryAddress || {};
  const customerAddressParts = [
    deliveryAddress.street,
    deliveryAddress.additionalDetails,
    deliveryAddress.city,
    deliveryAddress.state,
    deliveryAddress.zipCode,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  return {
    orderMongoId:
      orderDoc?._id?.toString?.() || order?._id?.toString?.() || order?._id,
    orderId: order?.order_id || order?._id?.toString?.(),
    status: orderDoc?.orderStatus || order?.orderStatus,
    items: order?.items || [],
    pricing: order?.pricing,
    total: order?.pricing?.total,
    payment: order?.payment,
    paymentMethod: order?.payment?.method,
    restaurantId:
      order?.restaurantId?._id?.toString?.() ||
      order?.restaurantId?.toString?.() ||
      order?.restaurantId,
    restaurantName: restaurant?.restaurantName || order?.restaurantName,
    restaurantAddress:
      restaurantLocation?.address ||
      restaurantLocation?.formattedAddress ||
      restaurant?.addressLine1 ||
      "",
    restaurantPhone: restaurant?.phone || "",
    restaurantLocation: {
      latitude: restaurantLocation?.latitude,
      longitude: restaurantLocation?.longitude,
      address:
        restaurantLocation?.address ||
        restaurantLocation?.formattedAddress ||
        restaurant?.addressLine1 ||
        "",
      area: restaurantLocation?.area || restaurant?.area || "",
      city: restaurantLocation?.city || restaurant?.city || "",
      state: restaurantLocation?.state || restaurant?.state || "",
    },
    deliveryAddress: order?.deliveryAddress,
    customerAddress: customerAddressParts.length ? customerAddressParts.join(', ') : "",
    customerName: order?.customerName || order?.deliveryAddress?.fullName || order?.deliveryAddress?.name || order?.userId?.name || "",
    customerPhone: order?.customerPhone || order?.deliveryAddress?.phone || order?.userId?.phone || "",
    userName: order?.customerName || order?.deliveryAddress?.fullName || order?.deliveryAddress?.name || order?.userId?.name || "",
    userPhone: order?.customerPhone || order?.deliveryAddress?.phone || order?.userId?.phone || "",
    note: order?.note || "",
    riderEarning: (() => {
      const candidates = [
        order?.riderEarning,
        order?.pricing?.deliveryFeeBreakdown?.riderFee,
        order?.pricing?.deliveryFeeBreakdown?.deliveryBoyFee,
      ];
      for (const value of candidates) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) return n;
      }
      for (const value of candidates) {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0) return n;
      }
      return 0;
    })(),
    earnings: (() => {
      const candidates = [
        order?.riderEarning,
        order?.pricing?.deliveryFeeBreakdown?.riderFee,
        order?.pricing?.deliveryFeeBreakdown?.deliveryBoyFee,
      ];
      for (const value of candidates) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) return n;
      }
      for (const value of candidates) {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0) return n;
      }
      return 0;
    })(),
    deliveryBoyFee: Number(
      order?.pricing?.deliveryFeeBreakdown?.deliveryBoyFee
      ?? order?.riderEarning
      ?? 0,
    ) || 0,
    deliveryFee: order?.pricing?.deliveryFee || 0,
    deliveryFeeBreakdown: order?.pricing?.deliveryFeeBreakdown || null,
    deliveryFleet: order?.deliveryFleet,
    dispatch: order?.dispatch,
    pickups: order?.pickups || [],
    zoneId: order?.zoneId?._id || order?.zoneId || "",
    zoneName: order?.zoneId?.name || order?.zoneId?.zoneName || order?.zoneName || "",
    createdAt: order?.createdAt,
    updatedAt: order?.updatedAt,
  };
}

export function canExposeOrderToRestaurant(orderLike) {
  const method = String(orderLike?.payment?.method || "").toLowerCase();
  const status = String(orderLike?.payment?.status || "").toLowerCase();
  if (["cash", "wallet"].includes(method)) return true;
  return ["paid", "authorized", "captured", "settled"].includes(status);
}

export async function notifyRestaurantNewOrder(orderDoc, restaurantIdOverride = null, options = {}) {
  try {
    if (!orderDoc || !canExposeOrderToRestaurant(orderDoc)) return;

    const targetRestaurantId = String(
      restaurantIdOverride ||
        orderDoc?.restaurantId?._id ||
        orderDoc?.restaurantId ||
        '',
    ).trim();
    if (!targetRestaurantId) return;

    const freshNotify = Boolean(options.freshNotify || options.resentToRestaurant);
    const notifiedAt = freshNotify
      ? new Date()
      : orderDoc.dispatch?.acceptedAt ||
        orderDoc.restaurantNotifiedAt ||
        new Date();

    if (freshNotify && typeof orderDoc?.markModified === 'function') {
      orderDoc.restaurantNotifiedAt = notifiedAt;
    }

    const scopedOrder = buildRestaurantScopedOrder(orderDoc, targetRestaurantId);
    const leanOrder = toRestaurantOrderResponse(scopedOrder);
    const io = getIO();
    if (io) {
      const scopedStatus = leanOrder.orderStatus || leanOrder.status || 'created';
      const payload = {
        ...leanOrder,
        orderMongoId: orderDoc._id?.toString?.() || leanOrder.orderMongoId,
        orderId: orderDoc.order_id || orderDoc._id?.toString?.() || leanOrder.orderId,
        // Always use THIS restaurant's pickup-scoped status (never aggregate)
        status: scopedStatus,
        orderStatus: scopedStatus,
        // Fresh timer on DP resend; otherwise rider-accept time for first notify
        restaurantNotifiedAt: notifiedAt,
        resentToRestaurant: freshNotify,
        dispatch: leanOrder.dispatch,
        isMultiRestaurant: Boolean(orderDoc.isMultiRestaurant),
        myPickupStatus: scopedOrder.myPickupStatus || null,
      };
      logger.info(
        `[RestaurantOrders] Emitting new_order to ${rooms.restaurant(targetRestaurantId)} for order ${orderDoc._id?.toString?.() || ''} status=${scopedStatus}${freshNotify ? ' (resent)' : ''}`,
      );
      io.to(rooms.restaurant(targetRestaurantId)).emit("new_order", payload);
    }

    await notifyOwnersSafely(
      [{ ownerType: "RESTAURANT", ownerId: targetRestaurantId }],
      {
        title: freshNotify ? "Order resent — please review" : "New order received",
        body: `Order #${orderDoc.order_id || orderDoc._id} is waiting for review.`,
        data: {
          type: freshNotify ? "order_resent_to_restaurant" : "new_order",
          orderId: orderDoc._id.toString(),
          orderMongoId: orderDoc._id?.toString?.() || "",
          link: `/restaurant/orders/${orderDoc._id?.toString?.() || ""}`,
        },
      },
    );
  } catch {
    // Do not block order/payment flow if notification fails.
  }
}

export const STATUS_PRIORITY = {
  created: 10,
  confirmed: 20,
  preparing: 30,
  ready_for_pickup: 40,
  reached_pickup: 50,
  picked_up: 60,
  reached_drop: 70,
  delivered: 80,
  rejected_by_restaurant: 90,
  cancelled_by_user: 100,
  cancelled_by_restaurant: 100,
  cancelled_by_admin: 100,
};

/**
 * Returns true if the next status is a valid forward progression from the current status.
 * Prevents "reversing" order status (e.g. from Preparing back to Created).
 */
export function isStatusAdvance(current, next) {
  // If current status is missing, it's effectively 'created' or start of flow
  if (!current) return true;
  
  const currentPrio = STATUS_PRIORITY[current] || 0;
  const nextPrio = STATUS_PRIORITY[next] || 0;

  // Terminal states (100) cannot transition to anything else
  if (currentPrio >= 100) return false;
  
  // Specific bypass for Resend Flow: allowed to go from rejected_by_restaurant back to created/confirmed
  if (current === 'rejected_by_restaurant' && (next === 'created' || next === 'confirmed')) return true;
  // Specific bypass for Rejection Flow: allowed to go from confirmed/preparing to rejected_by_restaurant
  if ((current === 'confirmed' || current === 'preparing' || current === 'created') && next === 'rejected_by_restaurant') return true;

  // Delivered (80) cannot transition to anything (except maybe cancellation if allowed, but here we say no)
  if (currentPrio === 80) return false;

  // Special case: Cancellation is almost always an advance unless already delivered
  if (nextPrio === 100 && currentPrio < 80) return true;

  return nextPrio > currentPrio;
}
