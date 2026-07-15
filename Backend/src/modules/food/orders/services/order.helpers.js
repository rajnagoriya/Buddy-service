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

export function calculateDistanceSlabFee(distanceKm, rules = []) {
  const d = Math.max(0, Number(distanceKm) || 0);
  const list = Array.isArray(rules) ? rules.filter((r) => r && r.status !== false) : [];
  if (!list.length) return 0;

  const sorted = [...list].sort(
    (a, b) => (Number(a.minDistance) || 0) - (Number(b.minDistance) || 0),
  );
  const baseRule = sorted.find((r) => Number(r.minDistance || 0) === 0) || sorted[0];
  if (!baseRule) return 0;

  let fee = Number(baseRule.basePayout || 0);

  for (const rule of sorted) {
    const perKm = Number(rule.commissionPerKm || 0);
    if (!Number.isFinite(perKm) || perKm <= 0) continue;
    const min = Number(rule.minDistance || 0);
    const max = rule.maxDistance == null ? null : Number(rule.maxDistance);
    if (d <= min) continue;
    const upper = max == null ? d : Math.min(d, max);
    const kmInSlab = Math.max(0, upper - min);
    if (kmInSlab > 0) fee += kmInSlab * perKm;
  }

  if (!Number.isFinite(fee) || fee < 0) return 0;
  return Math.round(fee);
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
 * Chain distance: R1 → R2 → … → Rn → user (cart order).
 * Single restaurant: R1 → user.
 */
function resolveOrderDistanceKmStraight(restaurants = [], userLoc) {
  if (!Array.isArray(restaurants) || restaurants.length === 0) return 0;
  if (!Array.isArray(userLoc) || userLoc.length < 2) return 0;

  const points = [];
  for (const restaurant of restaurants) {
    const point = getRestaurantLatLng(restaurant);
    if (point) points.push(point);
  }
  if (points.length === 0) return 0;

  points.push({ lat: userLoc[1], lng: userLoc[0] });

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
 * Order delivery distance in km.
 * Road (driving) when Google Maps is available; otherwise straight-line.
 * Multi-resto: R1→R2→…→Rn→user. Single: restaurant → user.
 */
export async function resolveOrderDistanceKmAsync(restaurants = [], userLoc) {
  const straight = resolveOrderDistanceKmStraight(restaurants, userLoc);
  if (!Array.isArray(restaurants) || restaurants.length === 0) return 0;
  if (!Array.isArray(userLoc) || userLoc.length < 2) return 0;

  try {
    const { fetchRoadDistancesKm } = await import('../utils/googleMaps.js');
    const user = { lat: userLoc[1], lng: userLoc[0] };

    const points = [];
    for (const restaurant of restaurants) {
      const point = getRestaurantLatLng(restaurant);
      if (point) points.push(point);
    }
    if (points.length === 0) return 0;
    points.push(user);

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
    ? deliveryBoySettings.deliverySpeedOptions
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

export function buildRestaurantScopedOrder(orderDoc, restaurantId) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc || {};
  const rid = String(restaurantId || '').trim();
  if (!rid) return order;

  const filteredItems = Array.isArray(order.items)
    ? order.items.filter((item) => String(item?.restaurantId || '') === rid)
    : [];
  const filteredPickups = Array.isArray(order.pickups)
    ? order.pickups.filter((pickup) => String(pickup?.restaurantId || '') === rid)
    : [];

  const scoped = {
    ...order,
    items: filteredItems,
    pickups: filteredPickups,
    restaurantId: rid,
  };

  if (filteredPickups.length === 1 && filteredPickups[0]?.restaurantName) {
    scoped.restaurantName = filteredPickups[0].restaurantName;
  }

  return scoped;
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
    riderEarning: order?.riderEarning || 0,
    earnings: order?.riderEarning || order?.pricing?.deliveryFee || 0,
    deliveryFee: order?.pricing?.deliveryFee || 0,
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

export async function notifyRestaurantNewOrder(orderDoc, restaurantIdOverride = null) {
  try {
    if (!orderDoc || !canExposeOrderToRestaurant(orderDoc)) return;

    const targetRestaurantId =
      restaurantIdOverride || orderDoc?.restaurantId?._id || orderDoc?.restaurantId;
    if (!targetRestaurantId) return;

    const scopedOrder = buildRestaurantScopedOrder(orderDoc, targetRestaurantId);
    const io = getIO();
    if (io) {
      const payload = {
        ...scopedOrder,
        orderMongoId: orderDoc._id?.toString?.() || undefined,
        orderId: orderDoc.order_id || orderDoc._id?.toString?.(),
      };
      logger.info(
        `[RestaurantOrders] Emitting new_order to ${rooms.restaurant(targetRestaurantId)} for order ${orderDoc._id?.toString?.() || ''}`,
      );
      io.to(rooms.restaurant(targetRestaurantId)).emit("new_order", payload);
    }

    await notifyOwnersSafely(
      [{ ownerType: "RESTAURANT", ownerId: targetRestaurantId }],
      {
        title: "New order received",
        body: `Order #${orderDoc.order_id || orderDoc._id} is waiting for review.`,
        data: {
          type: "new_order",
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
