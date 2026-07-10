import mongoose from 'mongoose';
import { FoodOrder, FoodSettings } from '../models/order.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { FoodDeliveryCashDeposit } from '../../delivery/models/foodDeliveryCashDeposit.model.js';
import { FoodDeliveryCashLimit } from '../../admin/models/deliveryCashLimit.model.js';
import { BuddyIdentity } from '../../../../core/identity/buddyIdentity.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { logger } from '../../../../utils/logger.js';
import { config } from '../../../../config/env.js';
import { getIO, rooms } from '../../../../config/socket.js';
import { addOrderJob } from '../../../../queues/producers/order.producer.js';
import {
  buildDeliverySocketPayload,
  buildOrderIdentityFilter,
  haversineKm,
  notifyOwnerSafely,
  notifyOwnersSafely,
  MAX_DISPATCH_ATTEMPTS,
} from './order.helpers.js';
import { fetchRoadDistancesKm } from '../utils/googleMaps.js';

// Singleton initializer loop for Socket Bridge at server boot
let socketBridgeInitialized = false;
function tryInitSocketBridge() {
  if (socketBridgeInitialized) return;
  try {
    const io = getIO(true);
    if (io) {
      import('../../../../shared/adapters/socket-bridge.service.js')
        .then(({ initializeSocketBridge }) => {
          initializeSocketBridge(io);
          socketBridgeInitialized = true;
          logger.info('[SocketBridge] Successfully initialized once at server boot via order-dispatch service hook.');
        })
        .catch((err) => {
          logger.warn(`[SocketBridge] Failed to load socket-bridge.service.js: ${err.message}`);
        });
    } else {
      setTimeout(tryInitSocketBridge, 200);
    }
  } catch (err) {
    setTimeout(tryInitSocketBridge, 200);
  }
}
tryInitSocketBridge();

/**
 * Symmetric check to the taxi side: drop any delivery partner whose linked
 * BuddyIdentity says they're currently in taxi mode. Legacy partners without
 * an identityId are passed through unchanged.
 */
async function excludeTaxiModePartners(partners = []) {
  if (!partners.length) return partners;
  const partnerIds = partners.map((p) => p.partnerId || p._id).filter(Boolean);
  if (!partnerIds.length) return partners;

  const partnerDocs = await FoodDeliveryPartner.find({ _id: { $in: partnerIds } })
    .select('_id identityId')
    .lean();
  const identityByPartner = new Map(
    partnerDocs.map((d) => [String(d._id), d.identityId ? String(d.identityId) : null]),
  );

  const identityIds = [...new Set(partnerDocs.map((d) => d.identityId).filter(Boolean))];
  if (!identityIds.length) return partners;

  const taxiModeIds = await BuddyIdentity.find({
    _id: { $in: identityIds },
    activeService: 'taxi',
  })
    .select('_id')
    .lean();
  if (!taxiModeIds.length) return partners;
  const blocked = new Set(taxiModeIds.map((d) => String(d._id)));

  return partners.filter((p) => {
    const identityId = identityByPartner.get(String(p.partnerId || p._id));
    return !identityId || !blocked.has(identityId);
  });
}

async function filterPartnersByCashLimit(partners = [], options = {}) {
  if (!Array.isArray(partners) || partners.length === 0) return [];
  const requiredAmount = Math.max(0, Number(options.requiredAmount || 0));
  const allowOverLimitFallback = options.allowOverLimitFallback !== false;

  const limitDoc = await FoodDeliveryCashLimit.findOne({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();
  const totalCashLimit = Number(limitDoc?.deliveryCashLimit || 0);

  // Treat missing/non-positive setting as "no cap" to avoid blocking all dispatch.
  if (!Number.isFinite(totalCashLimit) || totalCashLimit <= 0) {
    return partners.map((p) => ({
      ...p,
      availableCashLimit: Number.MAX_SAFE_INTEGER,
      allowOverLimit: false,
      requiredCashForOrder: requiredAmount,
    }));
  }

  const partnerIds = partners
    .map((p) => p?.partnerId || p?._id)
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));

  if (partnerIds.length === 0) return [];

  const [cashAgg, depositsAgg] = await Promise.all([
    FoodOrder.aggregate([
      {
        $match: {
          'dispatch.deliveryPartnerId': { $in: partnerIds },
          orderStatus: 'delivered',
          'payment.method': 'cash',
        },
      },
      {
        $group: {
          _id: '$dispatch.deliveryPartnerId',
          grossCashCollected: { $sum: { $ifNull: ['$pricing.total', 0] } },
        },
      },
    ]),
    FoodDeliveryCashDeposit.aggregate([
      {
        $match: {
          deliveryPartnerId: { $in: partnerIds },
          status: 'Completed',
        },
      },
      {
        $group: {
          _id: '$deliveryPartnerId',
          depositedCash: { $sum: { $ifNull: ['$amount', 0] } },
        },
      },
    ]),
  ]);

  const grossCashByPartner = new Map(
    (cashAgg || []).map((row) => [String(row._id), Number(row.grossCashCollected || 0)]),
  );
  const depositedByPartner = new Map(
    (depositsAgg || []).map((row) => [String(row._id), Number(row.depositedCash || 0)]),
  );

  const withCapacity = partners.map((p) => {
    const partnerId = String(p?.partnerId || p?._id || '');
    if (!partnerId) return null;
    const grossCash = grossCashByPartner.get(partnerId) || 0;
    const depositedCash = depositedByPartner.get(partnerId) || 0;
    const cashInHand = Math.max(0, grossCash - depositedCash);
    const availableCashLimit = Math.max(0, totalCashLimit - cashInHand);
    return {
      ...p,
      availableCashLimit,
      allowOverLimit: false,
      requiredCashForOrder: requiredAmount,
    };
  }).filter(Boolean);

  // Base block: riders with zero available limit should not receive fresh offers.
  const baseEligible = withCapacity.filter((p) => Number(p.availableCashLimit || 0) > 0);
  if (baseEligible.length === 0) return [];

  if (requiredAmount <= 0) return baseEligible;

  const sufficient = baseEligible.filter(
    (p) => Number(p.availableCashLimit || 0) >= requiredAmount,
  );
  if (sufficient.length > 0) return sufficient;

  if (!allowOverLimitFallback) return [];

  // Fallback: keep order moving by offering to highest available-limit riders.
  return baseEligible
    .slice()
    .sort((a, b) => Number(b.availableCashLimit || 0) - Number(a.availableCashLimit || 0))
    .map((p) => ({
      ...p,
      allowOverLimit: true,
    }));
}

async function listNearbyOnlineDeliveryPartners(
  restaurantId,
  { maxKm = 15, limit = 25, requiredAmount = 0, allowOverLimitFallback = true } = {},
) {
  let coordinates = null;
  if (restaurantId && restaurantId.location && Array.isArray(restaurantId.location.coordinates)) {
    coordinates = restaurantId.location.coordinates;
  } else if (restaurantId) {
    const rId = (restaurantId?._id || restaurantId).toString();
    const restaurant = await FoodRestaurant.findById(rId)
      .select("location")
      .lean();
    if (restaurant?.location?.coordinates?.length) {
      coordinates = restaurant.location.coordinates;
    }
  }

  if (!coordinates) {
    const partners = await FoodDeliveryPartner.find({
      status: "approved",
      availabilityStatus: "online",
    })
      .select("_id status name")
      .limit(Math.max(1, limit))
      .lean();

    const cashEligiblePartners = await filterPartnersByCashLimit(
      partners.map((p) => ({ partnerId: p._id, ...p })),
      { requiredAmount, allowOverLimitFallback },
    );
    const modeEligible = await excludeTaxiModePartners(cashEligiblePartners);

    return {
      restaurant: null,
      partners: modeEligible.map((p) => ({ partnerId: p.partnerId || p._id, distanceKm: null })),
    };
  }

  const [rLng, rLat] = coordinates;
  const allOnline = await FoodDeliveryPartner.find({
    availabilityStatus: "online",
  })
    .select("_id status lastLat lastLng lastLocationAt name")
    .lean();

  const scored = [];
  const allowedStatuses = process.env.NODE_ENV === 'production' ? ['approved'] : ['approved', 'pending'];
  const STALE_GPS_MS = 10 * 60 * 1000;

  for (const p of allOnline) {
    if (!allowedStatuses.includes(p.status)) continue;

    const isStale = !p.lastLocationAt || (Date.now() - new Date(p.lastLocationAt).getTime()) > STALE_GPS_MS;
    if (p.lastLat == null || p.lastLng == null || isStale) {
      scored.push({ partnerId: p._id, distanceKm: 999, status: p.status });
      continue;
    }

    const d = haversineKm(rLat, rLng, p.lastLat, p.lastLng);
    if (Number.isFinite(d) && d <= maxKm) {
      scored.push({ partnerId: p._id, distanceKm: d, status: p.status });
    }
  }

  scored.sort((a, b) => a.distanceKm - b.distanceKm);
  const picked = scored.slice(0, Math.max(1, limit));

  // Re-rank top candidates by road distance when Google Maps is configured.
  if (picked.length > 0 && Number.isFinite(rLat) && Number.isFinite(rLng)) {
    const partnerById = new Map(allOnline.map((p) => [String(p._id), p]));
    const roadCandidates = picked
      .map((entry) => {
        const p = partnerById.get(String(entry.partnerId));
        if (!p || p.lastLat == null || p.lastLng == null) return null;
        return { entry, lat: p.lastLat, lng: p.lastLng };
      })
      .filter(Boolean);

    if (roadCandidates.length > 0) {
      const roadKmList = await fetchRoadDistancesKm(
        { lat: rLat, lng: rLng },
        roadCandidates.map((c) => ({ lat: c.lat, lng: c.lng })),
      );
      if (Array.isArray(roadKmList)) {
        roadCandidates.forEach((c, idx) => {
          const roadKm = roadKmList[idx];
          if (Number.isFinite(roadKm)) {
            c.entry.distanceKm = roadKm;
            c.entry.distanceSource = 'road';
          }
        });
        picked.sort((a, b) => a.distanceKm - b.distanceKm);
      }
    }
  }

  if (picked.length === 0) {
    const anyOnline = await FoodDeliveryPartner.find({
      status: { $in: allowedStatuses },
      availabilityStatus: "online",
    })
      .select("_id status name identityId")
      .limit(Math.max(1, limit))
      .lean();

    const eligible = await excludeTaxiModePartners(
      anyOnline.map((p) => ({ partnerId: p._id, ...p })),
    );

    return {
      partners: eligible.map((p) => ({
        partnerId: p.partnerId || p._id,
        distanceKm: null,
        status: p.status,
      })),
    };
  }

  const final = (config.env === 'production')
    ? picked.filter(p => p.status === 'approved')
    : picked;

  const cashEligibleFinal = await filterPartnersByCashLimit(final, {
    requiredAmount,
    allowOverLimitFallback,
  });
  const modeEligibleFinal = await excludeTaxiModePartners(cashEligibleFinal);

  return { partners: modeEligibleFinal };
}

export async function getDispatchSettings() {
  return { dispatchMode: "auto" };
}

export async function updateDispatchSettings(dispatchMode, adminId) {
  // Always set to auto
  await FoodSettings.findOneAndUpdate(
    { key: "dispatch" },
    {
      $set: {
        dispatchMode: "auto",
        updatedBy: { role: "ADMIN", adminId, at: new Date() },
      },
    },
    { upsert: true, new: true },
  );
  return getDispatchSettings();
}

export async function tryAutoAssign(orderId, options = {}) {
  const attempt = options.attempt || 1;
  const lockTimeout = 90000; // 90 seconds lock interval

  console.log("[QC UNIFIED DEBUG] tryAutoAssign entered", orderId);

  const dispatchableStatuses = new Set([
    'created',
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'ready',
    'picked_up',
  ]);

  const isObjectId = mongoose.Types.ObjectId.isValid(orderId);
  const FoodOrder = mongoose.model('FoodOrder');
  const Order = mongoose.model('Order');

  let order = null;
  let isQc = false;

  // Try to find in Food Order
  order = await FoodOrder.findOneAndUpdate(
    {
      _id: isObjectId ? new mongoose.Types.ObjectId(orderId) : null,
      orderStatus: { $in: Array.from(dispatchableStatuses) },
      $or: [
        { 'dispatch.status': 'unassigned' },
        {
          'dispatch.status': 'assigned',
          'dispatch.acceptedAt': { $exists: false },
          'dispatch.assignedAt': { $lt: new Date(Date.now() - lockTimeout) }
        }
      ],
      'dispatch.dispatchingAt': { $exists: false }
    },
    {
      $set: { 'dispatch.dispatchingAt': new Date() }
    },
    { new: true }
  ).populate(['restaurantId', 'userId', 'zoneId']);

  if (!order) {
    // Try to find in QC Order
    const qcQuery = {
      workflowStatus: 'DELIVERY_SEARCH',
      'dispatch.status': { $in: ['unassigned', 'offered', 'timed_out'] },
      'dispatch.dispatchingAt': { $exists: false }
    };
    if (isObjectId) {
      qcQuery._id = new mongoose.Types.ObjectId(orderId);
    } else {
      qcQuery.orderId = orderId;
    }

    console.log("[QC UNIFIED DEBUG] QC Find query:", JSON.stringify(qcQuery));

    order = await Order.findOneAndUpdate(
      qcQuery,
      {
        $set: { 'dispatch.dispatchingAt': new Date() }
      },
      { new: true }
    ).populate(['seller', 'customer']);

    if (order) {
      isQc = true;
    }
  }

  console.log("[QC UNIFIED DEBUG] QC order found?", !!order, "isQc:", isQc);
  if (order) {
    console.log("[QC UNIFIED DEBUG] workflowStatus:", order.workflowStatus);
    console.log("[QC UNIFIED DEBUG] dispatch.status:", order.dispatch?.status);
    console.log("[QC UNIFIED DEBUG] seller coordinates:", order.seller?.location?.coordinates || order.seller?.location);
  }

  if (!order) {
    logger.info(`tryAutoAssign: Skip for ${orderId} (not dispatchable, already dispatching, accepted, or lock active).`);
    return null;
  }

  try {
    const offeredIds = (order.dispatch?.offeredTo || []).map(o => o.partnerId.toString());
    const paymentMethod = String(isQc ? (order.paymentMode || 'COD') : (order.payment?.method || 'cash')).toLowerCase();
    const isCashOrder = paymentMethod === 'cash' || paymentMethod === 'cod';
    const requiredAmount = isCashOrder ? Number(order.pricing?.total || 0) : 0;
    
    // RADIUS EXPANSION LOGIC
    const isPriority = isQc ? false : ['confirmed', 'preparing', 'ready_for_pickup', 'ready'].includes(order.orderStatus);
    
    let maxKm = 15;
    if (isPriority) {
      maxKm = 60;
    } else {
      if (attempt === 2) maxKm = 25;
      if (attempt === 3) maxKm = 40;
      if (attempt >= 4) maxKm = 60;
    }

    const searchOptions = {
      maxKm,
      limit: 15,
      requiredAmount,
      allowOverLimitFallback: true,
    };

    // Use normalized pickup from adapter
    const { normalizePickupForDispatch } = await import('../../../../shared/adapters/qc-dispatch.adapter.js');
    const pickupTarget = normalizePickupForDispatch(order, isQc ? 'quick' : 'food');

    console.log("[QC UNIFIED DEBUG] Normalized pickup target coordinates:", pickupTarget?.location?.coordinates);

    const { partners } = await listNearbyOnlineDeliveryPartners(pickupTarget, searchOptions);
    
    console.log("[QC UNIFIED DEBUG] Rider count found from listNearbyOnlineDeliveryPartners:", partners?.length, "Rider details:", JSON.stringify(partners));

    // TIERED ALERT LOGIC
    const isPhase2 = attempt >= 3;
    const isPhase3 = attempt >= 6; // ~6 minutes

    if (isPhase3 && !isQc) {
      logger.error(`[CRITICAL] Order ${order._id} unassigned for ${attempt} mins. Triggering Admin Alert (Phase 3).`);
      try {
        await notifyOwnersSafely(
          [{ ownerType: 'ADMIN', ownerId: 'GLOBAL' }],
          {
            title: 'Unassigned Food Order Crisis!',
            body: `Food Order #${order.order_id || order._id} has not been picked up for 5+ minutes.`,
            data: { type: 'admin_alert_unassigned', orderId: order._id.toString() }
          }
        );
      } catch (err) {
        logger.warn(`Admin notification failed: ${err.message}`);
      }
    }

    const eligible = partners.filter(p => !offeredIds.includes(p.partnerId.toString()));

    if (eligible.length === 0) {
      logger.info(`tryAutoAssign: No NEW eligible partners in ${maxKm}km for order ${order._id}. Restarting hunt...`);

      if (!isQc && attempt >= MAX_DISPATCH_ATTEMPTS) {
        try {
          const { cancelOrderNoDriverFound } = await import('./order.service.js');
          await cancelOrderNoDriverFound(order._id.toString());
        } catch (err) {
          logger.error(`tryAutoAssign: cancelOrderNoDriverFound failed for ${order._id}: ${err.message}`);
        }
        return order;
      }
      
      const io = getIO();
      if (io && partners.length > 0) {
        let payload;
        if (isQc) {
          const { adaptQcOrderToFoodShape } = await import('../../../../shared/adapters/delivery-response.adapter.js');
          payload = buildDeliverySocketPayload(adaptQcOrderToFoodShape(order), null);
        } else {
          payload = buildDeliverySocketPayload(order, order.restaurantId);
        }
        for (const p of partners) {
          const roomName = rooms.delivery(p.partnerId);
          io.to(roomName).emit('new_order_available', { ...payload, pickupDistanceKm: p.distanceKm });
        }
      }

      // Re-queue itself to keep trying
      await addOrderJob({
        action: 'DISPATCH_TIMEOUT_CHECK',
        orderMongoId: order._id.toString(),
        orderId: isQc ? order.orderId : order._id.toString(),
        attempt: attempt + 1
      }, { delay: 30000 }); // Retry faster (30s) if no one found

      return order;
    }

    const io = getIO();
    let payload;
    if (isQc) {
      const { adaptQcOrderToFoodShape } = await import('../../../../shared/adapters/delivery-response.adapter.js');
      payload = buildDeliverySocketPayload(adaptQcOrderToFoodShape(order), null);
    } else {
      payload = buildDeliverySocketPayload(order, order.restaurantId);
    }

    const phase1Batch = eligible.slice(0, Math.min(3, eligible.length));

    if (isPhase2) {
      // PHASE 2 BROADCAST: Notify everyone remaining
      logger.info(`[Phase 2] Broadcasting order ${order._id} to ${eligible.length} riders.`);
      for (const p of eligible) {
        const roomName = rooms.delivery(p.partnerId);
        if (io) {
          const eventPayload = { ...payload, pickupDistanceKm: p.distanceKm };
          io.to(roomName).emit('new_order', eventPayload);
          io.to(roomName).emit('new_order_available', eventPayload);
        }
      }
    } else {
      // PHASE 1: Offer to top few nearby riders
      const lead = phase1Batch[0];
      if (lead) {
        logger.info(`[Phase 1] Offering order ${order._id} to ${phase1Batch.length} riders (lead ${lead.partnerId}, ${lead.distanceKm}km)`);
      }

      for (const p of phase1Batch) {
        const roomName = rooms.delivery(p.partnerId);
        if (io) {
          const eventPayload = { ...payload, pickupDistanceKm: p.distanceKm };
          io.to(roomName).emit('new_order', eventPayload);
          io.to(roomName).emit('new_order_available', eventPayload);
        }
      }

      if (lead && !isQc) {
        try {
          await notifyOwnerSafely(
            { ownerType: 'DELIVERY_PARTNER', ownerId: lead.partnerId },
            {
              title: 'New order assigned!',
              body: `You have 60 seconds to accept Order #${order.order_id || order._id}.`,
              data: { type: 'new_order', orderId: order._id.toString() },
            },
          );
        } catch (err) {
          logger.warn(`Push notification failed for partner ${lead.partnerId}: ${err.message}`);
        }
      }
    }

    const partnersToRecord = isPhase2 ? eligible : phase1Batch;
    const offeredToEntries = partnersToRecord.map(p => ({
      partnerId: p.partnerId,
      at: new Date(),
      action: 'offered',
      allowOverLimit: Boolean(p.allowOverLimit),
      requiredCashForOrder: Number(p.requiredCashForOrder || requiredAmount || 0),
      attemptNumber: attempt,
      radiusKm: maxKm,
    }));

    order.dispatch = order.dispatch || {};
    order.dispatch.status = 'offered'; // Set status to 'offered' during active offer attempt
    order.dispatch.deliveryPartnerId = null;
    order.dispatch.offeredTo = order.dispatch.offeredTo || [];
    order.dispatch.offeredTo.push(...offeredToEntries);

    const collectionName = isQc ? 'quick_orders' : 'food_orders';
    const updateRes = await mongoose.connection.db.collection(collectionName).updateOne(
      { _id: order._id },
      {
        $set: {
          'dispatch.status': 'offered',
          'dispatch.deliveryPartnerId': null
        },
        $push: {
          'dispatch.offeredTo': { $each: offeredToEntries }
        }
      }
    );
    // Re-check in 60s
    await addOrderJob({
      action: 'DISPATCH_TIMEOUT_CHECK',
      orderMongoId: order._id.toString(),
      orderId: isQc ? order.orderId : order._id.toString(),
      attempt: attempt + 1
    }, { delay: 60000 });

    return order;
  } finally {
    const collectionName = isQc ? 'quick_orders' : 'food_orders';
    await mongoose.connection.db.collection(collectionName).updateOne(
      { _id: order._id },
      { $unset: { 'dispatch.dispatchingAt': '' } }
    );
  }
}


export async function processDispatchTimeout(orderId, partnerId, options = {}) {
  const FoodOrder = mongoose.model('FoodOrder');
  const Order = mongoose.model('Order');

  let order = await FoodOrder.findById(orderId);
  let isQc = false;
  if (!order) {
    order = await Order.findById(orderId);
    if (order) isQc = true;
  }
  if (!order) return;

  const jobAttempt = Number(options.attempt || 0);
  const nextAttempt = jobAttempt > 0
    ? jobAttempt
    : (order.dispatch?.offeredTo?.length || 0) + 1;

  if (!isQc && nextAttempt >= MAX_DISPATCH_ATTEMPTS) {
    try {
      const { cancelOrderNoDriverFound } = await import('./order.service.js');
      await cancelOrderNoDriverFound(order._id.toString());
    } catch (err) {
      logger.error(`processDispatchTimeout: cancelOrderNoDriverFound failed for ${orderId}: ${err.message}`);
    }
    return;
  }

  const stillAssigned = order.dispatch?.status === 'assigned' &&
    String(order.dispatch?.deliveryPartnerId) === String(partnerId) &&
    !order.dispatch?.acceptedAt;

  if (stillAssigned) {
    logger.info(`Dispatch timeout for partner ${partnerId} on order ${orderId}. Re-trying hunt...`);
    const offer = order.dispatch.offeredTo?.find(
      o => String(o.partnerId) === String(partnerId) && o.action === 'offered'
    );
    if (offer) offer.action = 'timeout';

    order.dispatch.status = 'unassigned';
    order.dispatch.deliveryPartnerId = null;

    const collectionName = isQc ? 'quick_orders' : 'food_orders';
    await mongoose.connection.db.collection(collectionName).updateOne(
      { _id: order._id },
      {
        $set: {
          'dispatch.status': 'unassigned',
          'dispatch.deliveryPartnerId': null,
          'dispatch.offeredTo': order.dispatch.offeredTo
        }
      }
    );
    
    await tryAutoAssign(order._id, { attempt: nextAttempt });
  } else if (order.dispatch?.status === 'unassigned' || order.dispatch?.status === 'offered') {
    await tryAutoAssign(order._id, { attempt: nextAttempt });
  }
}


export async function resendDeliveryNotificationRestaurant(orderId, restaurantId) {
  const identity = buildOrderIdentityFilter(orderId);
  const order = await FoodOrder.findOne({
    ...identity,
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
  });

  if (!order) throw new NotFoundError('Order not found');

  const activeStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'ready'];
  if (!activeStatuses.includes(order.orderStatus)) {
    throw new ValidationError(`Cannot resend notification for order in status: ${order.orderStatus}`);
  }

  if (order.dispatch?.status === 'accepted') {
    throw new ValidationError('A delivery partner has already accepted this order.');
  }

  const paymentMethod = String(order.payment?.method || 'cash').toLowerCase();
  const requiredAmount = paymentMethod === 'cash' ? Number(order?.pricing?.total || 0) : 0;
  const preview = await listNearbyOnlineDeliveryPartners(order.restaurantId, {
    maxKm: 15,
    limit: 15,
    requiredAmount,
    allowOverLimitFallback: true,
  });
  const shortlistedCount = Array.isArray(preview?.partners) ? preview.partners.length : 0;

  order.dispatch.status = 'unassigned';
  order.dispatch.deliveryPartnerId = null;
  order.dispatch.offeredTo = [];
  await order.save();

  await tryAutoAssign(order._id);

  const refreshed = await FoodOrder.findById(order._id)
    .select('dispatch.offeredTo dispatch.status dispatch.deliveryPartnerId')
    .lean();
  const notifiedCount = Array.isArray(refreshed?.dispatch?.offeredTo)
    ? refreshed.dispatch.offeredTo.filter((entry) => entry?.action === 'offered').length
    : 0;
  const notifiedPartnerIds = Array.isArray(refreshed?.dispatch?.offeredTo)
    ? refreshed.dispatch.offeredTo
        .filter((entry) => entry?.action === 'offered' && entry?.partnerId)
        .map((entry) => String(entry.partnerId))
    : [];
  const io = getIO();
  const connectedSocketCount = io
    ? notifiedPartnerIds.reduce((count, pid) => {
        const roomName = rooms.delivery(pid);
        const roomSize = io?.sockets?.adapter?.rooms?.get(roomName)?.size || 0;
        return count + roomSize;
      }, 0)
    : 0;

  return {
    success: true,
    notifiedCount,
    shortlistedCount,
    requiredAmount,
    connectedSocketCount,
    dispatchStatus: refreshed?.dispatch?.status || 'unassigned',
  };
}
