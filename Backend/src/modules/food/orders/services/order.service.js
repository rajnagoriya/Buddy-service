import mongoose from 'mongoose';
import { FoodOrder, FoodSettings } from '../models/order.model.js';
import { FoodCheckoutSession } from '../models/foodCheckoutSession.model.js';
// import { paymentSnapshotFromOrder } from './foodOrderPayment.service.js';
import { logger } from '../../../../utils/logger.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { attachOutletTimingsToRestaurants } from '../../restaurant/services/outletTimings.service.js';
import { getRestaurantOrderableStatus } from '../../shared/utils/restaurantAvailability.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { FoodZone } from '../../admin/models/zone.model.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import { ValidationError, ForbiddenError, NotFoundError } from '../../../../core/auth/errors.js';
import { buildPaginationOptions, buildPaginatedResult } from '../../../../utils/helpers.js';
import { FoodOffer } from '../../admin/models/offer.model.js';
import { recordOfferRedemption } from '../../admin/services/offer.service.js';
import { FoodDeliveryCommissionRule } from '../../admin/models/deliveryCommissionRule.model.js';
import { FoodRestaurantCommission } from '../../admin/models/restaurantCommission.model.js';
import { FoodTransaction } from '../models/foodTransaction.model.js';
import { FoodSupportTicket } from '../../user/models/supportTicket.model.js';
import { config } from '../../../../config/env.js';
import { FoodDeliveryBoySettings } from '../../admin/models/deliveryBoySettings.model.js';
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  getRazorpayKeyId,
  isRazorpayConfigured,
  initiateRazorpayRefund
} from '../helpers/razorpay.helper.js';
import { getIO, rooms } from '../../../../config/socket.js';
import { addOrderJob } from '../../../../queues/producers/order.producer.js';
import { fetchPolyline } from '../utils/googleMaps.js';
import { getFirebaseDB } from '../../../../config/firebase.js';
import * as foodTransactionService from './foodTransaction.service.js';
import * as userWalletService from '../../user/services/userWallet.service.js';
import { syncUserCart } from '../../user/services/userCart.service.js';
import { calculateOrderPricing } from './order-pricing.service.js';
import {
  validateRestaurantChainForItems,
  validateNewRestaurantAgainstLast,
} from './restaurant-chain-radius.service.js';
import * as dispatchService from './order-dispatch.service.js';
import * as checkoutService from './order-checkout.service.js';

async function clearUserCartAfterOrder(userId) {
  if (!userId) return;
  try {
    await syncUserCart(userId, { items: [], restaurantMeta: [], cartType: null });
  } catch (err) {
    logger.warn(`Failed to clear cart after order for user ${userId}: ${err?.message || err}`);
  }
}
import * as deliveryService from './order-delivery.service.js';
import * as paymentService from './order-payment.service.js';
import { getRoadDistanceMeters } from '../../../../core/location/distance.service.js';
import {
  enqueueOrderEvent,
  haversineKm,
  calculateDistanceSlabFee,
  resolveOrderDistanceKmAsync,
  applyDeliverySurcharges,
  generateFourDigitDeliveryOtp,
  sanitizeOrderForExternal,
  emitDeliveryDropOtpToUser,
  notifyOwnersSafely,
  notifyOwnerSafely,
  buildRestaurantScopedOrder,
  buildOrderIdentityFilter,
  toGeoPoint,
  pushStatusHistory,
  normalizeOrderForClient,
  applyAggregateRating,
  buildDeliverySocketPayload,
  notifyRestaurantNewOrder,
  isStatusAdvance,
  freeOrderDispatch,
} from './order.helpers.js';




const COMMISSION_CACHE_MS = 10 * 1000;
let commissionRulesCache = null;
let commissionRulesLoadedAt = 0;

async function getActiveCommissionRules() {
  const now = Date.now();
  if (
    commissionRulesCache &&
    now - commissionRulesLoadedAt < COMMISSION_CACHE_MS
  ) {
    return commissionRulesCache;
  }
  const list = await FoodDeliveryCommissionRule.find({
    status: { $ne: false },
  }).lean();
  commissionRulesCache = list || [];
  commissionRulesLoadedAt = now;
  return commissionRulesCache;
}

// 🗑️ Moved to foodTransaction.service.js to centralize finance logic.


async function getRiderEarning(distanceKm) {
  const rules = await getActiveCommissionRules();
  return calculateDistanceSlabFee(distanceKm, rules);
}

/** Append-only food_order_payments row; never blocks main flow on failure */
// 🗑️ Deprecated in favor of FoodTransaction system.

// ----- Settings -----
export async function getDispatchSettings() {
  return dispatchService.getDispatchSettings();
}

export async function updateDispatchSettings(dispatchMode, adminId) {
  return dispatchService.updateDispatchSettings(dispatchMode, adminId);
}

// ----- Calculate (validation + return pricing from payload) -----
export async function calculateOrder(userId, dto) {
  return calculateOrderPricing(userId, dto);
}

export async function validateRestaurantChain(lastRestaurantId, newRestaurantId) {
  return validateNewRestaurantAgainstLast(lastRestaurantId, newRestaurantId);
}

// ----- Create order -----
/**
 * @param {object} [options]
 * @param {{ razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string, expectedAmount?: number }} [options.verifiedPrepaid]
 *        When set, Razorpay was already verified — create FoodOrder as paid (no unpaid order).
 */
export async function createOrder(userId, dto, options = {}) {
  const items = Array.isArray(dto.items) ? dto.items : [];
  if (items.length === 0) throw new ValidationError("No items in order");

  await validateRestaurantChainForItems(items);

  // Identify unique restaurants
  const restaurantIds = [...new Set(items.map(it => it.restaurantId).filter(Boolean))];
  if (dto.restaurantId && !restaurantIds.includes(dto.restaurantId)) {
    restaurantIds.push(dto.restaurantId);
  }

  const restaurants = await FoodRestaurant.find({ _id: { $in: restaurantIds } })
    .select("status restaurantName zoneId location isAcceptingOrders name profileReviewStatus")
    .lean();

  if (restaurants.length === 0) throw new ValidationError("Restaurants not found");

  const restaurantsWithTimings = await attachOutletTimingsToRestaurants(restaurants);
  const now = new Date();

  for (const r of restaurantsWithTimings) {
    if (
      r.status !== "approved" ||
      r.profileReviewStatus === "pending" ||
      r.isAcceptingOrders === false
    ) {
      throw new ValidationError(`Restaurant ${r.name || r.restaurantName} is not accepting orders`);
    }

    const orderable = getRestaurantOrderableStatus(r, now);
    if (!orderable.isOrderable) {
      throw new ValidationError(
        `Restaurant ${r.name || r.restaurantName} is closed right now. Please try again during open hours.`,
      );
    }
  }

  const mainRestaurant = restaurantsWithTimings[0];
  const settings = await getDispatchSettings();
  const dispatchMode = settings.dispatchMode;

  const deliveryAddress = {
    label: dto.address?.label || "Home",
    name: dto.address?.name || dto.address?.fullName || dto.customerName || "",
    fullName: dto.address?.fullName || dto.address?.name || dto.customerName || "",
    street: dto.address?.street || "",
    additionalDetails: dto.address?.additionalDetails || "",
    city: dto.address?.city || "",
    state: dto.address?.state || "",
    zipCode: dto.address?.zipCode || "",
    phone: dto.address?.phone || "",
    location: dto.address?.location?.coordinates
      ? { type: "Point", coordinates: dto.address.location.coordinates }
      : undefined,
  };

  const paymentMethod = dto.paymentMethod === "card" ? "razorpay" : dto.paymentMethod;
  const isCash = paymentMethod === "cash";
  const isWallet = paymentMethod === "wallet";
  const verifiedPrepaid = options.verifiedPrepaid || null;

  // Always recalculate server-side (coupon validity + fees + catalog prices) before placing
  const recalculated = await calculateOrderPricing(userId, {
    items,
    restaurantId: dto.restaurantId,
    deliveryAddress: dto.address,
    couponCode: dto.pricing?.couponCode,
    deliverySpeedOptionId: dto.deliverySpeedOptionId,
    deliveryOption: dto.deliveryOption,
  });

  // Prefer hydrated catalog lines for all downstream order creation
  const pricedItems = Array.isArray(recalculated.items) && recalculated.items.length > 0
    ? recalculated.items
    : items;

  const normalizedPricing = {
    subtotal: Number(recalculated.pricing?.subtotal ?? 0),
    foodSubtotal: Number(recalculated.pricing?.foodSubtotal ?? recalculated.pricing?.subtotal ?? 0),
    tax: Number(recalculated.pricing?.tax ?? 0),
    packagingFee: Number(recalculated.pricing?.packagingFee ?? 0),
    restaurantPackagingTotal: Number(
      recalculated.pricing?.restaurantPackagingTotal ?? recalculated.pricing?.packagingFee ?? 0,
    ),
    deliveryFee: Number(recalculated.pricing?.deliveryFee ?? 0),
    platformFee: Number(recalculated.pricing?.platformFee ?? 0),
    discount: Number(recalculated.pricing?.discount ?? 0),
    deliveryDiscount: Number(recalculated.pricing?.deliveryDiscount ?? 0),
    platformSubsidy: Number(recalculated.pricing?.platformSubsidy ?? 0),
    couponCategory: recalculated.pricing?.couponCategory || undefined,
    total: Number(recalculated.pricing?.total ?? 0),
    currency: String(recalculated.pricing?.currency || "INR"),
    restaurantCommission: Number(dto.pricing?.restaurantCommission || 0),
    couponCode: recalculated.pricing?.couponCode ? String(recalculated.pricing.couponCode).trim().toUpperCase() : undefined,
    couponCreatedBy: recalculated.pricing?.couponCreatedBy || undefined,
    offerId: recalculated.pricing?.offerId || undefined,
    deliveryFeeBreakdown: recalculated.pricing?.deliveryFeeBreakdown || null,
    restaurantGroups: recalculated.pricing?.restaurantGroups || undefined,
  };

  if (dto.pricing?.couponCode && !normalizedPricing.couponCode) {
    const msg =
      recalculated.couponError?.message ||
      recalculated.pricing?.couponError?.message ||
      "Coupon is not valid for this order";
    throw new ValidationError(msg);
  }

  if (verifiedPrepaid && Number.isFinite(Number(verifiedPrepaid.expectedAmount))) {
    const expected = Math.round(Number(verifiedPrepaid.expectedAmount) * 100);
    const actual = Math.round(normalizedPricing.total * 100);
    if (expected !== actual) {
      throw new ValidationError("Order total changed after payment. Contact support for a refund.");
    }
  }

  const couponCodeMeta = normalizedPricing.couponCode;
  if (couponCodeMeta) {
    const offerDoc = await FoodOffer.findOne({ couponCode: couponCodeMeta }).lean();
    if (offerDoc) {
      normalizedPricing.couponCreatedBy = offerDoc.createdBy || 'admin';
      normalizedPricing.offerId = offerDoc._id;
    }
  }

  // Prepaid Razorpay: validate + lock pricing in checkout session; create FoodOrder only after payment
  if (paymentMethod === "razorpay" && !verifiedPrepaid) {
    const lockedDto = {
      ...dto,
      items: pricedItems,
      pricing: {
        ...(dto.pricing || {}),
        couponCode: normalizedPricing.couponCode,
      },
    };
    const checkout = await checkoutService.createPrepaidCheckoutSession({
      userId,
      dto: lockedDto,
      pricing: normalizedPricing,
    });
    return {
      order: null,
      checkoutId: checkout.checkoutId,
      paymentType: 'PREPAID',
      amount: normalizedPricing.total,
      razorpayOrderId: checkout.razorpay?.orderId || null,
      pricing: checkout.pricing,
      razorpay: checkout.razorpay,
      expiresAt: checkout.expiresAt,
      requiresPayment: true,
    };
  }

  let deliveryBoySettings = await FoodDeliveryBoySettings.findOne({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();
  if (!deliveryBoySettings) {
    deliveryBoySettings = await FoodDeliveryBoySettings.findOne()
      .sort({ createdAt: -1 })
      .lean();
  }

  const totalItemCount = pricedItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 1),
    0,
  );
  const splitEnabled = deliveryBoySettings ? (deliveryBoySettings.splitOrderEnabled !== false) : true;
  const splitThreshold = Number(deliveryBoySettings?.splitOrderThreshold ?? 20);
  const isSplitOrder = Boolean(splitEnabled && splitThreshold > 0 && totalItemCount >= splitThreshold);
  const isMultiRestaurant = restaurants.length > 1;

  const userLoc = deliveryAddress.location?.coordinates;
  const totalDistanceKm = await resolveOrderDistanceKmAsync(restaurantsWithTimings, userLoc);

  const baseRiderEarning = await getRiderEarning(totalDistanceKm);
  const riderSurcharge = applyDeliverySurcharges(baseRiderEarning, {
    isMultiRestaurant,
    isSplitOrder,
    deliveryBoySettings,
  });
  const riderEarning = riderSurcharge.fee;

  const pickups = restaurants.map(r => ({
    restaurantId: r._id,
    restaurantName: r.name || r.restaurantName,
    status: 'pending',
    location: r.location,
    items: pricedItems.filter(it => String(it.restaurantId) === String(r._id)).map(it => it.name)
  }));

  // Calculate restaurant commission per restaurant (sum stored on pricing for compat)
  const restaurantGroups = Array.isArray(recalculated.pricing?.restaurantGroups)
    ? recalculated.pricing.restaurantGroups
    : restaurants.map((r) => ({
        restaurantId: String(r._id),
        restaurantName: r.name || r.restaurantName,
        subtotal: pricedItems
          .filter((it) => String(it.restaurantId) === String(r._id))
          .reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0),
        packagingFee: 0,
      }));

  const restaurantSettlement = [];
  let totalRestaurantCommission = 0;
  for (const group of restaurantGroups) {
    const foodAmount = Number(group.subtotal) || 0;
    const packaging = Number(group.packagingFee) || 0;
    const { commissionAmount } = await foodTransactionService.getRestaurantCommissionSnapshot({
      pricing: { subtotal: foodAmount },
      restaurantId: group.restaurantId,
    });
    const commission = Number(commissionAmount) || 0;
    // GST on commission (18% marketplace services GST; informational for settlement reports)
    const commissionGST = Number((commission * 0.18).toFixed(2));
    const restaurantPayout = Math.max(0, Number((foodAmount + packaging - commission).toFixed(2)));
    totalRestaurantCommission += commission;
    restaurantSettlement.push({
      restaurantId: group.restaurantId,
      restaurantName: group.restaurantName || '',
      foodAmount,
      packagingFee: packaging,
      commission,
      commissionGST,
      restaurantPayout,
    });
  }

  normalizedPricing.restaurantCommission = totalRestaurantCommission || 0;

  const customerDeliveryFeePaid = Math.max(
    0,
    normalizedPricing.deliveryFee - Number(normalizedPricing.deliveryDiscount || 0),
  );
  const deliveryMargin = Math.max(0, Number((customerDeliveryFeePaid - riderEarning).toFixed(2)));

  const driverSettlement = {
    deliveryFee: customerDeliveryFeePaid,
    tip: Number(dto.tip || 0) || 0,
    incentive: 0,
    driverPayout: Math.max(0, Number((riderEarning + Number(dto.tip || 0)).toFixed(2))),
  };

  const platformRevenue = {
    platformFee: Number(normalizedPricing.platformFee) || 0,
    commission: totalRestaurantCommission || 0,
    deliveryMargin,
  };

  const platformProfit = Math.max(
    0,
    normalizedPricing.platformFee +
    normalizedPricing.deliveryFee +
    normalizedPricing.restaurantCommission -
    riderEarning -
    Number(normalizedPricing.platformSubsidy || 0),
  );

  const payment = verifiedPrepaid
    ? {
        method: "razorpay",
        status: "paid",
        amountDue: normalizedPricing.total,
        razorpay: {
          orderId: verifiedPrepaid.razorpayOrderId,
          paymentId: verifiedPrepaid.razorpayPaymentId,
          signature: verifiedPrepaid.razorpaySignature,
        },
        qr: {},
      }
    : {
        method: paymentMethod,
        status: isCash ? "cod_pending" : isWallet ? "paid" : "created",
        amountDue: normalizedPricing.total,
        razorpay: {},
        qr: {},
      };

  const isScheduledOrder = dto.scheduledAt && new Date(dto.scheduledAt) > new Date();

  const order = new FoodOrder({
    userId: new mongoose.Types.ObjectId(userId),
    restaurantId: mainRestaurant._id,
    isMultiRestaurant: restaurants.length > 1,
    pickups,
    zoneId: mainRestaurant.zoneId,
    items: pricedItems,
    deliveryAddress,
    customerName: deliveryAddress.name,
    customerPhone: deliveryAddress.phone,
    pricing: normalizedPricing,
    restaurantSettlement,
    driverSettlement,
    platformRevenue,
    payment,
    orderStatus: isScheduledOrder ? "scheduled" : "created",
    restaurantNote: dto.restaurantNote || "",
    note: dto.note || "",
    sendCutlery: dto.sendCutlery !== false,
    scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
    riderEarning,
    platformProfit,
    deliveryFleet: dto.deliveryFleet || "standard",
    deliveryOption: dto.deliveryOption || "Standard Delivery",
    deliveryTime: dto.deliveryTime || "25–35 mins",
    estimatedTime: dto.estimatedTime ?? 30,
    dispatch: { modeAtCreation: dispatchMode, status: "unassigned" },
    statusHistory: [
      {
        at: new Date(),
        byRole: "SYSTEM",
        from: "",
        to: isScheduledOrder ? "scheduled" : "created",
        note: verifiedPrepaid
          ? "Order placed after prepaid payment"
          : isScheduledOrder
            ? "Scheduled order placed"
            : "Order placed",
      },
    ],
  });

  await order.save();

  if (isWallet) {
    try {
      await userWalletService.deductWalletBalance(userId, order.pricing.total, `Payment for order #${order.order_id || order._id}`, { orderId: order._id });
    } catch (err) {
      await FoodOrder.deleteOne({ _id: order._id });
      throw err;
    }
  }

  await foodTransactionService.createInitialTransaction({
    ...(order.toObject?.() || order),
    pricing: normalizedPricing,
    payment,
  });

  if (verifiedPrepaid) {
    try {
      await foodTransactionService.updateTransactionStatus(order._id, 'captured', {
        status: 'captured',
        razorpayPaymentId: verifiedPrepaid.razorpayPaymentId,
        razorpaySignature: verifiedPrepaid.razorpaySignature,
        recordedByRole: "USER",
        recordedById: new mongoose.Types.ObjectId(userId),
        note: 'Payment verified before order create',
      });
    } catch (err) {
      logger.warn(`Failed to mark transaction captured for prepaid order ${order._id}: ${err?.message || err}`);
    }
  }

  try {
    await notifyOwnersSafely([{ ownerType: "USER", ownerId: userId }], {
      title: "Order Confirmed! 🍔",
      body: `Your order #${order.order_id || order._id} has been placed successfully.`,
      data: {
        type: "order_created",
        orderId: String(order._id),
        link: `/food/user/orders/${order._id}`,
      },
    });
  } catch { }

  const couponCode = dto.pricing?.couponCode ? String(dto.pricing.couponCode).trim().toUpperCase() : "";
  if (couponCode) {
    const offer = await FoodOffer.findOne({ couponCode, isDeleted: { $ne: true } }).lean();
    if (offer) {
      await recordOfferRedemption({ offer, order, userId });
    }
  }

  const dispatchableStatuses = ["created", "confirmed", "preparing", "ready_for_pickup", "ready", "picked_up"];
  if (
    dispatchMode === "auto"
    && (isCash || isWallet || order.payment.status === "paid" || order.payment.status === "cod_pending")
    && dispatchableStatuses.includes(order.orderStatus)
  ) {
    try {
      await dispatchService.tryAutoAssign(order._id);
    } catch { }
  }

  // Cart clear for confirmed orders (COD / wallet / prepaid-verified razorpay)
  if (isCash || isWallet || verifiedPrepaid) {
    await clearUserCartAfterOrder(userId);
  }

  const clientOrder = normalizeOrderForClient(order);
  return {
    order: clientOrder,
    orderId: String(order._id),
    orderNumber: order.order_id || clientOrder?.order_id || String(order._id),
    paymentType: verifiedPrepaid ? 'PREPAID' : (isCash ? 'COD' : (isWallet ? 'WALLET' : 'PREPAID')),
    amount: normalizedPricing.total,
    pricing: normalizedPricing,
    razorpay: null,
    requiresPayment: false,
  };
}

// ----- Verify payment -----
/**
 * Prepaid flow: checkoutId + Razorpay proof → verify server-side → create FoodOrder.
 * Legacy: orderId (unpaid FoodOrder created before pay) still supported.
 */
export async function verifyPayment(userId, dto) {
  // New pay-then-place flow
  if (dto.checkoutId) {
    const session = await checkoutService.getCheckoutSessionForUser(dto.checkoutId, userId);

    if (session.status === 'completed' && session.foodOrderId) {
      const existing = await FoodOrder.findById(session.foodOrderId);
      if (existing) {
        return { order: normalizeOrderForClient(existing), payment: existing.payment, checkoutId: String(session._id) };
      }
    }

    const { alreadyCompleted } = await checkoutService.verifyCheckoutPayment(session, {
      razorpayOrderId: dto.razorpayOrderId,
      razorpayPaymentId: dto.razorpayPaymentId,
      razorpaySignature: dto.razorpaySignature,
    });

    if (alreadyCompleted && session.foodOrderId) {
      const existing = await FoodOrder.findById(session.foodOrderId);
      if (existing) {
        return { order: normalizeOrderForClient(existing), payment: existing.payment, checkoutId: String(session._id) };
      }
    }

    const claimed = await checkoutService.claimCheckoutForOrderCreate(session._id, {
      razorpayPaymentId: dto.razorpayPaymentId,
      razorpaySignature: dto.razorpaySignature,
    });

    if (!claimed) {
      const fresh = await checkoutService.getCheckoutSessionForUser(dto.checkoutId, userId);
      if (fresh.foodOrderId) {
        const existing = await FoodOrder.findById(fresh.foodOrderId);
        if (existing) {
          return { order: normalizeOrderForClient(existing), payment: existing.payment, checkoutId: String(fresh._id) };
        }
      }
      throw new ValidationError('Checkout is being processed. Please wait.');
    }

    const result = await createOrder(userId, claimed.orderPayload, {
      verifiedPrepaid: {
        razorpayOrderId: dto.razorpayOrderId,
        razorpayPaymentId: dto.razorpayPaymentId,
        razorpaySignature: dto.razorpaySignature,
        expectedAmount: claimed.amountDue,
      },
    });

    if (!result?.order?._id) {
      throw new ValidationError('Failed to create order after payment');
    }

    await checkoutService.markCheckoutCompleted(claimed, result.order._id);

    return {
      order: result.order,
      payment: result.order.payment,
      checkoutId: String(claimed._id),
    };
  }

  // Legacy: order already created, mark paid
  const identity = buildOrderIdentityFilter(dto.orderId);
  if (!identity) throw new ValidationError("Order id or checkoutId required");

  const order = await FoodOrder.findOne({
    ...identity,
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (!order) throw new NotFoundError("Order not found");
  if (order.payment.status === "paid")
    return { order: normalizeOrderForClient(order), payment: order.payment };

  const valid = verifyPaymentSignature(
    dto.razorpayOrderId,
    dto.razorpayPaymentId,
    dto.razorpaySignature,
  );
  if (!valid) throw new ValidationError("Payment verification failed");

  order.payment.status = "paid";
  order.payment.razorpay.paymentId = dto.razorpayPaymentId;
  order.payment.razorpay.signature = dto.razorpaySignature;
  pushStatusHistory(order, {
    byRole: "USER",
    byId: userId,
    from: order.orderStatus,
    to: "created",
    note: "Payment verified",
  });
  await order.save();

  await foodTransactionService.updateTransactionStatus(order._id, 'captured', {
    status: 'captured',
    razorpayPaymentId: dto.razorpayPaymentId,
    razorpaySignature: dto.razorpaySignature,
    recordedByRole: "USER",
    recordedById: new mongoose.Types.ObjectId(userId)
  });

  // Notify Customer about payment success
  await notifyOwnersSafely([{ ownerType: "USER", ownerId: userId }], {
    title: "Payment Successful! ✅",
    body: `We have received your payment of ₹${order.payment.amountDue} for Order #${order._id.toString()}.`,
    image: "https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png",
    data: {
      type: "payment_success",
      orderId: String(order._id.toString()),
      orderMongoId: String(order._id),
    },
  });

  const settings = await getDispatchSettings();
  const dispatchableStatuses = [
    "created",
    "confirmed",
    "preparing",
    "ready_for_pickup",
    "ready",
    "picked_up",
  ];
  if (settings.dispatchMode === "auto" && dispatchableStatuses.includes(order.orderStatus)) {
    try {
      await tryAutoAssign(order._id);
    } catch { }
  }

  await clearUserCartAfterOrder(userId);

  return { order: normalizeOrderForClient(order), payment: order.payment };
}

export async function cancelCheckout(userId, checkoutId) {
  const session = await checkoutService.cancelCheckoutSession(checkoutId, userId);
  return {
    checkoutId: String(session._id),
    status: session.status,
  };
}

/**
 * Webhook helper: if payment captured for a checkout session, create the FoodOrder.
 * Idempotent — safe to call alongside client verifyPayment.
 */
export async function finalizeCheckoutFromWebhook(rzOrderId, rzPaymentId) {
  const session = await checkoutService.findCheckoutByRazorpayOrderId(rzOrderId);
  if (!session) return null;
  if (session.status === 'completed' && session.foodOrderId) {
    return FoodOrder.findById(session.foodOrderId);
  }
  if (checkoutService.isCheckoutExpired(session) && session.status === 'pending_payment') {
    session.status = 'expired';
    await session.save();
    return null;
  }

  const claimed = await checkoutService.claimCheckoutForOrderCreate(session._id, {
    razorpayPaymentId: rzPaymentId,
  });
  if (!claimed) {
    const fresh = await FoodCheckoutSession.findById(session._id);
    if (fresh?.foodOrderId) return FoodOrder.findById(fresh.foodOrderId);
    return null;
  }

  const result = await createOrder(String(claimed.userId), claimed.orderPayload, {
    verifiedPrepaid: {
      razorpayOrderId: rzOrderId,
      razorpayPaymentId: rzPaymentId,
      razorpaySignature: claimed.razorpay?.signature || 'webhook',
      expectedAmount: claimed.amountDue,
    },
  });

  if (result?.order?._id) {
    await checkoutService.markCheckoutCompleted(claimed, result.order._id);
    return result.order;
  }
  return null;
}

// ----- Auto-assign -----

/**
 * Start or continue a smart cascading dispatch.
 * @param {string} orderId - Mongo ID of the order.
 * @param {object} options - Options (retry count, etc)
 */
export async function tryAutoAssign(orderId, options = {}) {
  return dispatchService.tryAutoAssign(orderId, options);
}

/**
 * Triggered by worker after 60 seconds of zero response.
 */
export async function processDispatchTimeout(orderId, partnerId, options = {}) {
  return dispatchService.processDispatchTimeout(orderId, partnerId, options);
}

async function applyOrderRefundIfPaid(order, { recordedByRole = 'SYSTEM', recordedById = null, note = '', preferWallet = false } = {}) {
  const paymentMethod = String(order.payment?.method || 'cash').toLowerCase();
  const paymentStatus = String(order.payment?.status || 'cod_pending').toLowerCase();
  const hasRefundProcessed =
    String(order.payment?.refund?.status || 'none').toLowerCase() === 'processed';

  if (paymentStatus !== 'paid' || hasRefundProcessed) return order;

  const refundToWallet = async () => {
    await userWalletService.refundWalletBalance(
      order.userId,
      order.pricing.total,
      note || `Refund for order #${order.order_id || order._id}`,
      { orderId: order._id },
    );
    order.payment.status = 'refunded';
    order.payment.refund = {
      status: 'processed',
      destination: 'wallet',
      amount: order.pricing.total,
      processedAt: new Date(),
    };
  };

  if (paymentMethod === 'razorpay' && order.payment?.razorpay?.paymentId) {
    if (preferWallet) {
      try {
        await refundToWallet();
      } catch (err) {
        logger.warn(`applyOrderRefundIfPaid wallet (razorpay→wallet) failed for ${order._id}: ${err?.message || err}`);
        order.payment.refund = { status: 'failed', destination: 'wallet', amount: order.pricing.total };
      }
    } else {
      try {
        const refundResult = await initiateRazorpayRefund(
          order.payment.razorpay.paymentId,
          order.pricing.total,
        );
        if (refundResult.success) {
          order.payment.status = 'refunded';
          order.payment.refund = {
            status: 'processed',
            destination: 'source',
            amount: order.pricing.total,
            refundId: refundResult.refundId,
            processedAt: new Date(),
          };
        } else {
          order.payment.refund = { status: 'failed', destination: 'source', amount: order.pricing.total };
        }
      } catch (err) {
        logger.warn(`applyOrderRefundIfPaid razorpay failed for ${order._id}: ${err?.message || err}`);
        order.payment.refund = { status: 'failed', destination: 'source', amount: order.pricing.total };
      }
    }
  } else if (paymentMethod === 'wallet') {
    try {
      await refundToWallet();
    } catch (err) {
      logger.warn(`applyOrderRefundIfPaid wallet failed for ${order._id}: ${err?.message || err}`);
      order.payment.refund = { status: 'failed', destination: 'wallet', amount: order.pricing.total };
    }
  }

  try {
    const finalPaymentMethod = String(order.payment?.method || paymentMethod).toLowerCase();
    const finalPaymentStatus = String(order.payment?.status || paymentStatus).toLowerCase();
    const isOnlinePaid =
      finalPaymentMethod === 'razorpay' &&
      (finalPaymentStatus === 'paid' || finalPaymentStatus === 'refunded');
    await foodTransactionService.updateTransactionStatus(order._id, order.orderStatus, {
      status: isOnlinePaid ? 'refunded' : 'failed',
      note: note || 'Order cancelled with refund',
      recordedByRole,
      recordedById,
    });
  } catch (err) {
    logger.warn(`applyOrderRefundIfPaid transaction sync failed: ${err?.message || err}`);
  }

  return order;
}

/**
 * Cancel order when no delivery partner accepts after all dispatch retries.
 */
export async function cancelOrderNoDriverFound(orderId) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) return null;

  const order = await FoodOrder.findOne({
    ...identity,
    orderStatus: { $in: ['created', 'scheduled'] },
    'dispatch.status': { $in: ['unassigned', 'offered', 'assigned'] },
  });
  if (!order) return null;

  const from = order.orderStatus;
  const cancelNote = 'No delivery partner found. Order cancelled and refund initiated where applicable.';
  order.orderStatus = 'cancelled_by_admin';
  freeOrderDispatch(order);
  pushStatusHistory(order, {
    byRole: 'SYSTEM',
    from,
    to: 'cancelled_by_admin',
    note: cancelNote,
  });

  await applyOrderRefundIfPaid(order, { note: cancelNote, preferWallet: true });
  await order.save();

  const refundDetail =
    order.payment?.status === 'refunded'
      ? order.payment?.refund?.destination === 'wallet'
        ? ` ₹${order.pricing.total} has been credited to your wallet.`
        : ` Your refund of ₹${order.pricing.total} is being processed.`
      : '';

  try {
    const io = getIO();
    if (io) {
      const payload = {
        orderMongoId: order._id?.toString?.(),
        orderId: order._id.toString(),
        orderStatus: order.orderStatus,
        title: 'Delivery partner not found',
        message: `We couldn't find a delivery partner for your order.${refundDetail}`,
        failureReason: 'driver_not_found',
        dispatch: order.dispatch || null,
        payment: order.payment || null,
      };
      io.to(rooms.user(order.userId)).emit('order_status_update', payload);
    }
  } catch (err) {
    logger.warn(`cancelOrderNoDriverFound socket emit failed: ${err?.message || err}`);
  }

  await notifyOwnersSafely(
    [{ ownerType: 'USER', ownerId: order.userId }],
    {
      title: 'Delivery partner not found',
      body: `We couldn't find a delivery partner near you. Your order has been cancelled.${refundDetail}`,
      data: {
        type: 'driver_not_found',
        orderId: String(order._id),
        orderMongoId: String(order._id),
      },
    },
  );

  enqueueOrderEvent('order_cancelled_no_driver', {
    orderMongoId: order._id?.toString?.(),
    orderId: order._id.toString(),
  });

  return normalizeOrderForClient(order);
}

async function finalizeRestaurantRejectionExhausted(order, restaurantId, note = '') {
  const from = order.orderStatus;
  const assignedRiderId = order.dispatch?.deliveryPartnerId;
  const cancelNote =
    note ||
    'Restaurant rejected the order 3 times. Order cancelled, driver released, and refund initiated where applicable.';

  order.orderStatus = 'cancelled_by_restaurant';
  freeOrderDispatch(order);
  pushStatusHistory(order, {
    byRole: 'SYSTEM',
    byId: restaurantId,
    from,
    to: 'cancelled_by_restaurant',
    note: cancelNote,
  });

  await applyOrderRefundIfPaid(order, {
    recordedByRole: 'RESTAURANT',
    recordedById: restaurantId,
    note: cancelNote,
  });
  await order.save();

  const refundDetail =
    order.payment?.status === 'refunded'
      ? ` Refund of ₹${order.pricing.total} is being processed.`
      : '';
  const userMessage = `The restaurant is not accepting this order after 3 attempts.${refundDetail}`;
  const riderMessage = `Restaurant rejected order #${order.order_id || order._id} after 3 attempts. You are now free to accept new orders.`;

  try {
    const io = getIO();
    if (io) {
      const payload = {
        orderMongoId: order._id?.toString?.(),
        orderId: order._id.toString(),
        orderStatus: order.orderStatus,
        title: 'Order cancelled — restaurant rejected',
        message: userMessage,
        failureReason: 'restaurant_rejected',
      };
      io.to(rooms.user(order.userId)).emit('order_status_update', payload);
      io.to(rooms.restaurant(restaurantId)).emit('order_status_update', payload);
      if (assignedRiderId) {
        io.to(rooms.delivery(assignedRiderId)).emit('order_status_update', {
          ...payload,
          message: riderMessage,
        });
      }
    }
  } catch (err) {
    logger.warn(`finalizeRestaurantRejectionExhausted socket emit failed: ${err?.message || err}`);
  }

  const notifyList = [
    { ownerType: 'USER', ownerId: order.userId },
    { ownerType: 'RESTAURANT', ownerId: restaurantId },
  ];
  if (assignedRiderId) {
    notifyList.push({ ownerType: 'DELIVERY_PARTNER', ownerId: assignedRiderId });
  }

  await notifyOwnersSafely(notifyList, {
    title: 'Order cancelled — restaurant rejected',
    body: userMessage,
    data: {
      type: 'restaurant_rejection_exhausted',
      orderId: String(order._id),
      orderMongoId: String(order._id),
    },
  });

  if (assignedRiderId) {
    await notifyOwnerSafely(
      { ownerType: 'DELIVERY_PARTNER', ownerId: assignedRiderId },
      {
        title: 'Order cancelled',
        body: riderMessage,
        data: {
          type: 'restaurant_rejection_exhausted',
          orderId: String(order._id),
          orderMongoId: String(order._id),
        },
      },
    );
  }

  enqueueOrderEvent('order_cancelled_restaurant_rejection_exhausted', {
    orderMongoId: order._id?.toString?.(),
    orderId: order._id.toString(),
    restaurantId: String(restaurantId),
    deliveryPartnerId: assignedRiderId ? String(assignedRiderId) : null,
  });

  return order;
}

// ----- User: list, get, cancel -----
export async function listOrdersUser(userId, query) {
  const { page, limit, skip } = buildPaginationOptions(query);
  const filter = { userId: new mongoose.Types.ObjectId(userId) };
  const [docs, total] = await Promise.all([
    FoodOrder.find(filter)
      .populate(
        "restaurantId",
        "restaurantName profileImage area city location rating totalRatings",
      )
      .populate("dispatch.deliveryPartnerId", "name phone rating totalRatings")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FoodOrder.countDocuments(filter),
  ]);
  return buildPaginatedResult({
    docs: docs.map((doc) => normalizeOrderForClient(doc)),
    total,
    page,
    limit,
  });
}

export async function getOrderById(
  orderId,
  { userId, restaurantId, deliveryPartnerId, admin } = {},
) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");
  const order = await FoodOrder.findOne(identity)
    .populate(
      "restaurantId",
      "restaurantName ownerPhone profileImage area city location rating totalRatings primaryContactNumber",
    )
    .populate("dispatch.deliveryPartnerId", "name fullName phone phoneNumber rating totalRatings profileImage avatar")
    .populate("userId", "name fullName phone email")
    .select("+deliveryOtp")
    .lean();
  if (!order) throw new NotFoundError("Order not found");

  if (admin) return normalizeOrderForClient(order);

  const orderUserId = order.userId?._id?.toString() || order.userId?.toString();
  const orderRestaurantId = order.restaurantId?._id?.toString() || order.restaurantId?.toString();
  const orderPartnerId = order.dispatch?.deliveryPartnerId?.toString();
  const sharedPartnerId = order.dispatch?.sharedPartnerId?.toString();

  if (userId && orderUserId !== userId.toString())
    throw new ForbiddenError("Not your order");
  
  if (deliveryPartnerId && orderPartnerId !== deliveryPartnerId.toString() && sharedPartnerId !== deliveryPartnerId.toString()) {
    throw new ForbiddenError("Not your delivery order");
  }
  if (restaurantId) {
    const restaurantIdStr = restaurantId.toString();
    const isPrimaryRestaurant = orderRestaurantId === restaurantIdStr;
    const isPickupRestaurant = (order.pickups || []).some(
      (p) => String(p.restaurantId || '') === restaurantIdStr,
    );
    if (!isPrimaryRestaurant && !isPickupRestaurant) {
      throw new ForbiddenError("Not your restaurant order");
    }

    // Enforce: Restaurant cannot see the order until a rider has accepted it
    const isAccepted = order.dispatch?.status === 'accepted';
    if (!isAccepted) {
      throw new ForbiddenError("Order is still being assigned to a delivery partner. You will see it once a rider is confirmed.");
    }
  }

  if (deliveryPartnerId && ![orderPartnerId, sharedPartnerId].includes(deliveryPartnerId.toString()))
    throw new ForbiddenError("Not assigned to you");

  if (deliveryPartnerId || restaurantId) {
    if (restaurantId) {
      const scoped = buildRestaurantScopedOrder(order, restaurantId);
      return sanitizeOrderForExternal(scoped);
    }
    return sanitizeOrderForExternal(order);
  }

  if (userId) {
    const drop = order.deliveryVerification?.dropOtp || {};
    const secret = String(order.deliveryOtp || "").trim();
    const out = normalizeOrderForClient(order);
    delete out.deliveryOtp;
    out.deliveryVerification = {
      ...(order.deliveryVerification || {}),
      dropOtp: {
        required: Boolean(drop.required),
        verified: Boolean(drop.verified),
      },
    };
    if (!drop.verified && secret) {
      out.handoverOtp = secret;
    }
    return out;
  }

  return sanitizeOrderForExternal(order);
}

export async function getDropOtpUser(orderId, userId) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");
  const order = await FoodOrder.findOne({
    ...identity,
    userId: new mongoose.Types.ObjectId(userId),
  }).select("+deliveryOtp");
  if (!order) throw new NotFoundError("Order not found");

  const phase = order.deliveryState?.currentPhase;
  const isEligible = phase === "at_drop";

  if (!isEligible) {
    throw new ValidationError(
      "OTP will appear once the delivery partner requests it at your location."
    );
  }

  if (!String(order.deliveryOtp || "").trim()) {
    throw new ValidationError(
      "OTP is not available yet. Ask the delivery partner to request OTP again."
    );
  }

  return { otp: order.deliveryOtp };
}

/**
 * Watchdog: Recovers orders stuck in 'assigned' or 'preparing' status for too long.
 * Should be called on server startup.
 */
export async function recoverStuckOrders() {
  const now = new Date();
  const FIVE_MIN = 5 * 60 * 1000;
  const TWO_MIN = 2 * 60 * 1000;

  try {
    // 1. Stuck in 'assigned' (partner never accepted) for > 2m
    const stuckAssigned = await FoodOrder.find({
      'dispatch.status': 'assigned',
      'dispatch.acceptedAt': { $exists: false },
      'dispatch.assignedAt': { $lt: new Date(now - TWO_MIN) },
      orderStatus: { $nin: ['delivered', 'cancelled_by_user', 'cancelled_by_restaurant'] }
    });

    if (stuckAssigned.length > 0) {
      logger.info(`Watchdog: Healing ${stuckAssigned.length} stuck assigned orders.`);
      for (const order of stuckAssigned) {
        // Reset status to unassigned and re-trigger auto-assign
        order.dispatch.status = 'unassigned';
        order.dispatch.deliveryPartnerId = null;
        await order.save();
        await tryAutoAssign(order._id);
      }
    }

    // 2. Clear old dispatching locks (cleanup in case of crash)
    await FoodOrder.updateMany(
      { 'dispatch.dispatchingAt': { $lt: new Date(now - FIVE_MIN) } },
      { $unset: { 'dispatch.dispatchingAt': '' } }
    );

    // 3. Stuck in 'created' (waiting for restaurant) after rider accepted for > 5m
    const stuckWaitingForStore = await FoodOrder.find({
      orderStatus: 'created',
      'dispatch.status': 'accepted',
      'dispatch.acceptedAt': { $lt: new Date(now - FIVE_MIN) }
    });

    if (stuckWaitingForStore.length > 0) {
      logger.warn(`Watchdog: Found ${stuckWaitingForStore.length} orders waiting too long for restaurant acceptance.`);
      // Optional: Add notification to Store Owners here if they missed the socket event
    }

    // 4. Auto-Cancel orders with NO RIDER after 15 minutes
    const FIFTEEN_MIN = 15 * 60 * 1000;
    const noRiderTimeout = await FoodOrder.find({
      orderStatus: { $in: ['created', 'scheduled'] },
      'dispatch.status': { $in: ['unassigned', 'offered', 'assigned'] },
      createdAt: { $lt: new Date(now - FIFTEEN_MIN) }
    });

    if (noRiderTimeout.length > 0) {
      logger.info(`Watchdog: Auto-cancelling ${noRiderTimeout.length} orders due to no rider availability.`);
      for (const order of noRiderTimeout) {
        await cancelOrderNoDriverFound(order._id.toString());
      }
    }

  } catch (err) {
    logger.error(`Watchdog recovery error: ${err.message}`);
  }
}

export async function resyncState(userId, role) {
  if (role === "USER") {
    const order = await FoodOrder.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      orderStatus: {
        $nin: [
          "delivered",
          "cancelled_by_user",
          "cancelled_by_restaurant",
          "cancelled_by_admin",
        ],
      },
    })
      .select("+deliveryOtp")
      .sort({ createdAt: -1 })
      .lean();

    if (order) {
      const out = normalizeOrderForClient(order);
      // Re-add handover OTP if order is picked up
      if (
        (order.deliveryState?.currentPhase === "at_drop" || order.orderStatus === "picked_up") &&
        !order.deliveryVerification?.dropOtp?.verified &&
        order.deliveryOtp
      ) {
        out.handoverOtp = order.deliveryOtp;
      }
      return { activeOrder: out };
    }
    return { activeOrder: null };
  }

  if (role === "DELIVERY_PARTNER" || role === "DRIVER") {
    const order = await FoodOrder.findOne({
      "dispatch.deliveryPartnerId": new mongoose.Types.ObjectId(userId),
      "dispatch.status": { $in: ["assigned", "accepted"] },
      orderStatus: {
        $nin: ["delivered", "cancelled_by_user", "cancelled_by_restaurant"],
      },
    })
      .populate("restaurantId")
      .lean();
    return { activeOrder: order ? sanitizeOrderForExternal(order) : null };
  }

  return {};
}

export async function cancelOrder(orderId, userId, reason, refundDestination = "source") {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne({
    ...identity,
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (!order) throw new NotFoundError("Order not found");

  const allowed = ["created", "scheduled"];
  if (!allowed.includes(order.orderStatus))
    throw new ValidationError("Order cannot be cancelled");

  const from = order.orderStatus;
  order.orderStatus = "cancelled_by_user";
  pushStatusHistory(order, {
    byRole: "USER",
    byId: userId,
    from,
    to: "cancelled_by_user",
    note: reason || "",
  });

  const paymentMethod = String(order.payment?.method || "cash").toLowerCase();
  const paymentStatus = String(order.payment?.status || "cod_pending").toLowerCase();
  const normalizedRefundDestination =
    String(refundDestination || "source").toLowerCase() === "wallet"
      ? "wallet"
      : "source";
  const hasRefundProcessed =
    String(order.payment?.refund?.status || "none").toLowerCase() === "processed";

  // ✅ NEW: Automated Razorpay Refund on User Cancel
  if (
    paymentStatus === "paid" &&
    paymentMethod === "razorpay" &&
    order.payment?.razorpay?.paymentId &&
    !hasRefundProcessed
  ) {
    try {
      if (normalizedRefundDestination === "wallet") {
        await userWalletService.refundWalletBalance(
          userId,
          order.pricing.total,
          `Refund for cancelled order #${order.order_id || order._id}`,
          { orderId: order._id, source: "order_refund_wallet" },
        );
        order.payment.status = "refunded";
        order.payment.refund = {
          status: "processed",
          destination: "wallet",
          amount: order.pricing.total,
          refundId: "",
          processedAt: new Date()
        };
      } else {
        const refundResult = await initiateRazorpayRefund(
          order.payment.razorpay.paymentId,
          order.pricing.total
        );

        if (refundResult.success) {
          order.payment.status = "refunded";
          order.payment.refund = {
            status: "processed",
            destination: "source",
            amount: order.pricing.total,
            refundId: refundResult.refundId,
            processedAt: new Date()
          };
        } else {
          // Log failure but let order cancellation proceed
          order.payment.refund = {
            status: "failed",
            destination: "source",
            amount: order.pricing.total
          };
        }
      }
    } catch (err) {
      console.error(`Refund processing error for Order ${orderId}:`, err);
      order.payment.refund = {
        status: "failed",
        destination: normalizedRefundDestination,
        amount: order.pricing.total,
      };
    }
  } else if (
    paymentStatus === "paid" &&
    paymentMethod === "wallet" &&
    !hasRefundProcessed
  ) {
    try {
      await userWalletService.refundWalletBalance(userId, order.pricing.total, `Refund for cancelled order #${order.order_id || order._id}`, { orderId: order._id });
      order.payment.status = "refunded";
      order.payment.refund = {
        status: "processed",
        destination: "wallet",
        amount: order.pricing.total,
        processedAt: new Date()
      };
    } catch (err) {
      console.error(`Wallet refund processing error for Order ${orderId}:`, err);
      order.payment.refund = { status: "failed", destination: "wallet", amount: order.pricing.total };
    }
  }

  await order.save();

  enqueueOrderEvent("order_cancelled_by_user", {
    orderMongoId: order._id?.toString?.(),
    orderId: order._id.toString(),
    userId,
    reason: reason || "",
  });

  // Sync transaction status
  try {
    const finalPaymentMethod = String(order.payment?.method || paymentMethod || "cash").toLowerCase();
    const finalPaymentStatus = String(order.payment?.status || paymentStatus || "cod_pending").toLowerCase();
    const isOnlinePaid =
      finalPaymentMethod === "razorpay" &&
      (finalPaymentStatus === "paid" || finalPaymentStatus === "refunded");
    await foodTransactionService.updateTransactionStatus(order._id, 'cancelled_by_user', {
      status: isOnlinePaid ? 'refunded' : 'failed',
      note: `Order cancelled by user: ${reason || "No reason"}`,
      recordedByRole: 'USER',
      recordedById: userId
    });
  } catch (err) {
    logger.warn(`cancelOrder transaction sync failed: ${err?.message || err}`);
  }

  // Notify User and Restaurant about the cancellation
  const finalPaymentMethod = String(order.payment?.method || paymentMethod || "cash").toLowerCase();
  const finalPaymentStatus = String(order.payment?.status || paymentStatus || "cod_pending").toLowerCase();
  const isOnlinePaid =
    finalPaymentMethod === "razorpay" &&
    (finalPaymentStatus === "paid" || finalPaymentStatus === "refunded");
  const settledRefundDestination =
    String(order.payment?.refund?.destination || normalizedRefundDestination || "source").toLowerCase() === "wallet"
      ? "wallet"
      : "source";
  const refundDetail = isOnlinePaid
    ? settledRefundDestination === "wallet"
      ? ` Your refund of ₹${order.pricing.total} has been credited to your wallet.`
      : ` Your refund of ₹${order.pricing.total} is being processed and will be credited to your original payment method within 5-7 working days.`
    : "";

  await notifyOwnersSafely(
    [
      { ownerType: "USER", ownerId: userId },
      { ownerType: "RESTAURANT", ownerId: order.restaurantId },
    ],
    {
      title: "Order Cancelled ❌",
      body: `Order #${order.order_id || order._id} has been cancelled successfully.${refundDetail}`,
      image: "https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png",
      data: {
        type: "order_cancelled",
        orderId: String(order._id.toString()),
        orderMongoId: String(order._id),
      },
    },
  );

  // Real-time: status update via socket
  try {
    const io = getIO();
    if (io) {
      const payload = {
        orderMongoId: order._id?.toString?.(),
        orderId: order._id.toString(),
        orderStatus: order.orderStatus,
        message: `Order #${order.order_id || order._id} has been cancelled successfully.${refundDetail}`
      };
      io.to(rooms.user(userId)).emit("order_status_update", payload);
      io.to(rooms.restaurant(order.restaurantId)).emit("order_status_update", payload);
    }
  } catch (err) {
    logger.warn(`cancelOrder socket emit failed: ${err?.message || err}`);
  }

  return normalizeOrderForClient(order);
}

export async function submitOrderRatings(orderId, userId, dto) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne({
    ...identity,
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (!order) throw new NotFoundError("Order not found");
  if (String(order.orderStatus) !== "delivered") {
    throw new ValidationError("You can rate only delivered orders");
  }

  const hasDeliveryPartner = !!order.dispatch?.deliveryPartnerId;
  if (hasDeliveryPartner && !dto.deliveryPartnerRating) {
    throw new ValidationError("Delivery partner rating is required");
  }

  const restaurantAlreadyRated = Number.isFinite(
    Number(order?.ratings?.restaurant?.rating),
  );
  const deliveryAlreadyRated = Number.isFinite(
    Number(order?.ratings?.deliveryPartner?.rating),
  );
  if (restaurantAlreadyRated || (hasDeliveryPartner && deliveryAlreadyRated)) {
    throw new ValidationError("Ratings already submitted for this order");
  }

  const now = new Date();
  order.ratings = order.ratings || {};
  order.ratings.restaurant = {
    rating: dto.restaurantRating,
    comment: dto.restaurantComment || "",
    ratedAt: now,
  };

  if (hasDeliveryPartner) {
    order.ratings.deliveryPartner = {
      rating: dto.deliveryPartnerRating,
      comment: dto.deliveryPartnerComment || "",
      ratedAt: now,
    };
  }

  await Promise.all([
    applyAggregateRating(
      FoodRestaurant,
      order.restaurantId,
      dto.restaurantRating,
    ),
    hasDeliveryPartner
      ? applyAggregateRating(
        FoodDeliveryPartner,
        order.dispatch.deliveryPartnerId,
        dto.deliveryPartnerRating,
      )
      : Promise.resolve(),
  ]);

  await order.save();
  enqueueOrderEvent('order_ratings_submitted', {
    orderMongoId: order._id?.toString?.(),
    orderId: order._id.toString(),
    userId,
    restaurantRating: dto.restaurantRating,
    deliveryPartnerRating: hasDeliveryPartner ? dto.deliveryPartnerRating : null
  });
}

export async function updateOrderInstructions(orderId, userId, instructions) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne({
    ...identity,
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (!order) throw new NotFoundError("Order not found");

  const allowedStatuses = ['created', 'confirmed', 'preparing'];
  if (!allowedStatuses.includes(order.orderStatus)) {
    throw new ValidationError("Instructions can no longer be updated for this order");
  }

  order.note = String(instructions || "").trim();
  await order.save();
  return order;
}

// ----- Restaurant -----
export async function listOrdersRestaurant(restaurantId, query) {
  const { page, limit, skip } = buildPaginationOptions(query);
  const restaurantObjectId = new mongoose.Types.ObjectId(restaurantId);
  // Driver-first flow: restaurant only sees orders after a rider has accepted.
  // Use $and so restaurant ownership and payment filters do not overwrite each other.
  const filter = {
    $and: [
      {
        $or: [
          { restaurantId: restaurantObjectId },
          { 'pickups.restaurantId': restaurantObjectId },
        ],
      },
      { 'dispatch.status': 'accepted' },
      {
        $or: [
          { 'payment.method': { $in: ['cash', 'wallet'] } },
          {
            'payment.status': {
              $in: ['paid', 'authorized', 'captured', 'settled', 'refunded', 'cod_pending'],
            },
          },
        ],
      },
    ],
  };
  const [docs, total] = await Promise.all([
    FoodOrder.find(filter)
      .populate("userId", "name phone email profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FoodOrder.countDocuments(filter),
  ]);
  const scopedDocs = docs.map((doc) => buildRestaurantScopedOrder(doc, restaurantId));
  return buildPaginatedResult({ docs: scopedDocs.map(d => normalizeOrderForClient(d)), total, page, limit });
}

function computeAggregateOrderStatus(orderDoc) {
  const pickups = Array.isArray(orderDoc?.pickups) ? orderDoc.pickups : [];
  if (pickups.length === 0) return orderDoc?.orderStatus || 'created';

  const statuses = pickups.map((p) => String(p?.status || '')).filter(Boolean);
  if (statuses.some((s) => s === 'cancelled')) return 'rejected_by_restaurant';
  if (statuses.length && statuses.every((s) => ['ready', 'picked_up'].includes(s))) {
    return 'ready_for_pickup';
  }
  if (statuses.some((s) => s === 'preparing')) return 'preparing';
  if (statuses.some((s) => s === 'accepted')) return 'confirmed';
  return 'created';
}

export async function updateOrderStatusRestaurant(
  orderId,
  restaurantId,
  orderStatus,
  note = ""
) {
  const identity = buildOrderIdentityFilter(orderId);
  let order = await FoodOrder.findOne({
    ...identity,
    $or: [
      { restaurantId: new mongoose.Types.ObjectId(restaurantId) },
      { 'pickups.restaurantId': new mongoose.Types.ObjectId(restaurantId) },
    ],
  });
  if (!order) throw new NotFoundError("Order not found");
  const from = order.orderStatus;

  const restaurantIdStr = restaurantId.toString();
  const pickup = (order.pickups || []).find(
    (p) => String(p.restaurantId || '') === restaurantIdStr,
  );
  if (order.isMultiRestaurant && !pickup) {
    throw new ForbiddenError("Not your restaurant order");
  }
  const isMulti = Boolean(order.isMultiRestaurant && pickup);
  let finalStatus = orderStatus;
  let skipRefund = false;

  if (isMulti) {
    if (orderStatus === 'cancelled_by_restaurant' || orderStatus === 'rejected_by_restaurant') {
      pickup.status = 'cancelled';
      order.restaurantRejectionCount = (order.restaurantRejectionCount || 0) + 1;
      if (order.restaurantRejectionCount >= 3) {
        const finalized = await finalizeRestaurantRejectionExhausted(order, restaurantId, note);
        return normalizeOrderForClient(finalized);
      }
      finalStatus = 'rejected_by_restaurant';
      skipRefund = true;
    } else if (orderStatus === 'confirmed') {
      pickup.status = 'accepted';
    } else if (orderStatus === 'preparing') {
      pickup.status = 'preparing';
    } else if (orderStatus === 'ready_for_pickup' || orderStatus === 'ready') {
      pickup.status = 'ready';
    } else if (orderStatus === 'picked_up') {
      pickup.status = 'picked_up';
    }

    const nextAggregate = computeAggregateOrderStatus(order);
    if (isStatusAdvance(from, nextAggregate)) {
      order.orderStatus = nextAggregate;
    } else if (from === 'rejected_by_restaurant' && ['created', 'confirmed'].includes(nextAggregate)) {
      order.orderStatus = nextAggregate;
    }
  } else {
    // Handle rejection retry logic for single-restaurant flow
    if (orderStatus === 'cancelled_by_restaurant' || orderStatus === 'rejected_by_restaurant') {
      order.restaurantRejectionCount = (order.restaurantRejectionCount || 0) + 1;
      if (order.restaurantRejectionCount < 3) {
        finalStatus = 'rejected_by_restaurant';
      } else {
        const finalized = await finalizeRestaurantRejectionExhausted(order, restaurantId, note);
        return normalizeOrderForClient(finalized);
      }
    }

    if (!isStatusAdvance(from, finalStatus)) {
      throw new ValidationError(`Current order status '${from}' is further ahead than '${finalStatus}'. Order cannot be moved backwards.`);
    }
    order.orderStatus = finalStatus;
  }

  const historyNote = isMulti
    ? `${note ? `${note} - ` : ''}restaurant_status:${orderStatus}`
    : (note || '');
  pushStatusHistory(order, {
    byRole: "RESTAURANT",
    byId: restaurantId,
    from,
    to: order.orderStatus,
    note: historyNote
  });
  await order.save();

  // Custom messages / titles for status updates
  const statusForMessage = isMulti ? order.orderStatus : orderStatus;
  let title = `Order ${order._id.toString()} updated`;
  let body = `Status changed to ${String(statusForMessage).replace(/_/g, " ")}`;

  if (statusForMessage === "confirmed") {
    title = "Order Accepted! 🧑‍🍳";
    body = "The restaurant has accepted your order and is starting to prepare it.";
  } else if (statusForMessage === "preparing") {
    title = "Food is being prepared! 🍳";
    body = "Your food is currently being prepared by the restaurant.";
  } else if (statusForMessage === "ready_for_pickup") {
    title = "Food is ready! 🛍️";
    body = "Your order is ready and waiting to be picked up.";
  } else if (statusForMessage === "rejected_by_restaurant" || finalStatus === "rejected_by_restaurant") {
    title = `Order Rejected by Restaurant (${order.restaurantRejectionCount}/3) ⚠️`;
    body = isMulti
      ? `One restaurant has rejected the order. Reason: ${note || "Not specified"}. You can resend it from the delivery partner app.`
      : `The restaurant has rejected the order. Reason: ${note || "Not specified"}. You can try resending it up to 3 times.`;
  } else if (String(statusForMessage).includes("cancel") || String(finalStatus).includes("cancel")) {
    const isOnlinePaid = order.payment.method === "razorpay" && (order.payment.status === "paid" || order.payment.status === "refunded");
    const refundDetail = isOnlinePaid ? ` Your refund of ₹${order.pricing.total} is being processed and will be credited to your original payment method within 5-7 working days.` : "";

    title = "Order Cancelled ❌";
    body = `Unfortunately, your order has been cancelled by the restaurant.${refundDetail}`;
  }

  // Real-time: status update to restaurant room.
  try {
    const io = getIO();
    if (io) {
      console.log(
        `[DEBUG] Emitting status update to restaurant ${restaurantId} and user ${order.userId}: ${orderStatus}`,
      );
      const payload = {
        orderMongoId: order._id?.toString?.(),
        orderId: order._id.toString(),
        orderStatus: order.orderStatus,
        title,
        message: body,
      };

      const restRoom = rooms.restaurant(restaurantId);
      const userRoom = rooms.user(order.userId);

      console.log(`[DEBUG] Emitting order_status_update to rooms: ${restRoom}, ${userRoom}`);
      io.to(restRoom).emit("order_status_update", payload);
      io.to(userRoom).emit("order_status_update", payload);

      // Notify assigned rider via socket if they exist
      const assignedRiderId = order.dispatch?.deliveryPartnerId;
      if (assignedRiderId) {
        const riderRoom = rooms.delivery(assignedRiderId);
        console.log(`[DEBUG] Emitting order_status_update to rider room: ${riderRoom}`);
        io.to(riderRoom).emit("order_status_update", payload);
      }
    }

    const notifyList = [
      { ownerType: "USER", ownerId: order.userId },
      { ownerType: "RESTAURANT", ownerId: restaurantId },
    ];

    const assignedRiderId = order.dispatch?.deliveryPartnerId;
    if (assignedRiderId) {
      notifyList.push({ ownerType: "DELIVERY_PARTNER", ownerId: assignedRiderId });
    }

    let riderTitle = `Order #${order.order_id || order._id} updated`;
    let riderBody = `The order status is now ${String(orderStatus).replace(/_/g, " ")}.`;

    if (String(orderStatus).includes("cancel")) {
      riderTitle = "Order Cancelled ❌";
      riderBody = `Order #${order.order_id || order._id} has been cancelled. Please stop your current task.`;

      // Sync transaction status
      if (!isMulti) {
        try {
          const isOnlinePaid = order.payment.method === "razorpay" && (order.payment.status === "paid" || order.payment.status === "refunded");
          await foodTransactionService.updateTransactionStatus(order._id, 'cancelled_by_restaurant', {
            status: isOnlinePaid ? 'refunded' : 'failed',
            note: `Order cancelled by restaurant/admin`,
            recordedByRole: 'RESTAURANT',
            recordedById: restaurantId
          });
        } catch (err) {
          logger.warn(`updateOrderStatusRestaurant transaction sync failed: ${err?.message || err}`);
        }
      }
    }

    await notifyOwnersSafely(
      notifyList,
      {
        title: title,
        body: body,
        image: "https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png",
        data: {
          type: "order_status_update",
          orderId: order._id.toString(),
          orderMongoId: order._id?.toString?.() || "",
          orderStatus: String(statusForMessage || ""),
          link: `/food/user/orders/${order._id?.toString?.() || ""}`,
        },
      },
    );
  } catch (err) {
    console.error("[DEBUG] Error emitting status update to restaurant:", err);
  }

  // Real-time: delivery request / ready notifications.
  try {
    const io = getIO();
    if (io) {
      // Driver-first flow: only search for riders if none accepted yet
      if (
        (String(statusForMessage) === "preparing" || String(statusForMessage) === "confirmed") &&
        (String(from) !== "preparing" && String(from) !== "confirmed") &&
        order.dispatch?.status !== 'accepted'
      ) {
        console.log(
          `[DEBUG] Order ${order._id.toString()} status changed to '${orderStatus}'. Triggering central delivery dispatch.`,
        );

        try {
          await tryAutoAssign(order._id);
          // Refresh local order state after assignment search
          order = await FoodOrder.findById(order._id);
        } catch (err) {
          console.error(`[DEBUG] Auto-assign in updateOrderStatusRestaurant failed:`, err);
        }
      }

      // When ready for pickup -> ping assigned delivery partner.
      if (String(statusForMessage) === 'ready_for_pickup' && String(from) !== 'ready_for_pickup') {
        console.log(`[DEBUG] Order ${order._id.toString()} changed to 'ready_for_pickup'.`);
        const assignedId = order.dispatch?.deliveryPartnerId?.toString?.() || order.dispatch?.deliveryPartnerId;
        if (assignedId) {
          console.log(`[DEBUG] Notifying assigned partner ${assignedId} that order is ready.`);
          const restaurant = await FoodRestaurant.findById(restaurantId).select('restaurantName location addressLine1 area city state').lean();
          const payload = buildDeliverySocketPayload(order, restaurant);
          logger.info(
            `[DeliveryDispatch] Emitting order_ready to ${rooms.delivery(assignedId)} for order ${order._id.toString()}`,
          );
          io.to(rooms.delivery(assignedId)).emit('order_ready', payload);
        } else {
          console.log(`[DEBUG] Order ${order._id.toString()} is ready but no partner assigned.`);
        }
      }
    }
  } catch (err) {
    console.error('[DEBUG] Error in delivery notification logic:', err);
  }

  enqueueOrderEvent('restaurant_order_status_updated', {
    orderMongoId: order._id?.toString?.(),
    orderId: order._id.toString(),
    restaurantId,
    from,
    to: order.orderStatus
  });

  // ✅ NEW: Automated Razorpay Refund on Restaurant Cancel
  // Triggers if the restaurant sets status to a cancelled state (e.g., cancelled_by_restaurant)
  if (
    !skipRefund &&
    String(orderStatus).includes("cancel") &&
    order.payment.status === "paid" &&
    order.payment.method === "razorpay" &&
    order.payment.razorpay?.paymentId &&
    (!order.payment.refund || order.payment.refund.status !== "processed")
  ) {
    try {
      const refundResult = await initiateRazorpayRefund(
        order.payment.razorpay.paymentId,
        order.pricing.total
      );

      if (refundResult.success) {
        order.payment.status = "refunded";
        order.payment.refund = {
          status: "processed",
          amount: order.pricing.total,
          refundId: refundResult.refundId,
          processedAt: new Date()
        };
      } else {
        // Record failure so admin knows a manual refund might be needed
        order.payment.refund = {
          status: "failed",
          amount: order.pricing.total
        };
      }
    } catch (err) {
      console.error(`Automated refund failed for Order ${order._id.toString()} (Restaurant Cancel):`, err);
      order.payment.refund = { status: "failed", amount: order.pricing.total };
    }
    // Re-save order with updated payment status
    await order.save();
  } else if (
    !skipRefund &&
    String(orderStatus).includes("cancel") &&
    order.payment.status === "paid" &&
    order.payment.method === "wallet" &&
    (!order.payment.refund || order.payment.refund.status !== "processed")
  ) {
    try {
      await userWalletService.refundWalletBalance(order.userId, order.pricing.total, `Refund for order #${order.order_id || order._id} cancelled by restaurant`, { orderId: order._id });
      order.payment.status = "refunded";
      order.payment.refund = {
        status: "processed",
        amount: order.pricing.total,
        processedAt: new Date()
      };
    } catch (err) {
      console.error(`Wallet refund processing error for Order ${order._id.toString()}:`, err);
      order.payment.refund = { status: "failed", amount: order.pricing.total };
    }
    // Re-save order with updated payment status
    await order.save();
  }

  return normalizeOrderForClient(order);
}

/**
 * Manually re-trigger delivery partner search for a restaurant order.
 * Only allowed if status is preparing/ready and no partner has accepted yet.
 */
export async function resendDeliveryNotificationRestaurant(orderId, restaurantId) {
  return dispatchService.resendDeliveryNotificationRestaurant(orderId, restaurantId);
  const order = await FoodOrder.findOne({
    _id: new mongoose.Types.ObjectId(orderId),
    restaurantId: new mongoose.Types.ObjectId(restaurantId)
  });

  if (!order) throw new NotFoundError('Order not found');

  // Allow resend for fresh confirmed orders too, because this route is often
  // used right after restaurant confirmation when the first rider alert was missed.
  const activeStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'ready'];
  if (!activeStatuses.includes(order.orderStatus)) {
    throw new ValidationError(`Cannot resend notification for order in status: ${order.orderStatus}`);
  }

  // Guard: don't disrupt an active assignment that was already accepted
  if (order.dispatch?.status === 'accepted') {
    throw new ValidationError('A delivery partner has already accepted this order.');
  }

  // Reset dispatch state to unassigned to allow tryAutoAssign to start fresh
  order.dispatch.status = 'unassigned';
  order.dispatch.deliveryPartnerId = null;
  // Clear previously offered partners to give everyone a fresh chance when resending manually.
  order.dispatch.offeredTo = [];

  await order.save();

  // Trigger smart dispatch logic immediately
  await tryAutoAssign(order._id);

  return { success: true };
}

export async function getCurrentTripDelivery(deliveryPartnerId) {
  return deliveryService.getCurrentTripDelivery(deliveryPartnerId);
}

// ----- Delivery: available, accept, reject, status -----
export async function listOrdersAvailableDelivery(deliveryPartnerId, query) {
  return deliveryService.listOrdersAvailableDelivery(deliveryPartnerId, query);
}

export async function acceptOrderDelivery(orderId, deliveryPartnerId) {
  return deliveryService.acceptOrderDelivery(orderId, deliveryPartnerId);
}

export async function rejectOrderDelivery(orderId, deliveryPartnerId) {
  return deliveryService.rejectOrderDelivery(orderId, deliveryPartnerId);
}

export async function confirmReachedPickupDelivery(orderId, deliveryPartnerId) {
  return deliveryService.confirmReachedPickupDelivery(orderId, deliveryPartnerId);
}

/**
 * Slide to confirm pickup (Bill uploaded)
 */
export async function confirmPickupDelivery(
  orderId,
  deliveryPartnerId,
  billImageUrl,
) {
  return deliveryService.confirmPickupDelivery(
    orderId,
    deliveryPartnerId,
    billImageUrl,
  );
}

export async function confirmReachedDropDelivery(orderId, deliveryPartnerId) {
  return deliveryService.confirmReachedDropDelivery(orderId, deliveryPartnerId);
}

export async function verifyDropOtpDelivery(orderId, deliveryPartnerId, otp) {
  return deliveryService.verifyDropOtpDelivery(orderId, deliveryPartnerId, otp);
}

export async function completeDelivery(orderId, deliveryPartnerId, body = {}) {
  return deliveryService.completeDelivery(orderId, deliveryPartnerId, body);
}



export async function updateOrderStatusDelivery(orderId, deliveryPartnerId, orderStatus) {
  return deliveryService.updateOrderStatusDelivery(orderId, deliveryPartnerId, orderStatus);
}

export async function confirmSplitDelivery(orderId, deliveryPartnerId) {
  return deliveryService.confirmSplitDelivery(orderId, deliveryPartnerId);
}

// ----- COD QR collection -----
export async function createCollectQr(
  orderId,
  deliveryPartnerId,
  customerInfo = {},
) {
  return paymentService.createCollectQr(orderId, deliveryPartnerId, customerInfo);
}

export async function getPaymentStatus(orderId, deliveryPartnerId) {
  return paymentService.getPaymentStatus(orderId, deliveryPartnerId);
}

// ----- Admin -----
export async function listOrdersAdmin(query) {
  const { page, limit, skip } = buildPaginationOptions(query);
  const filter = {
    $or: [
      { "payment.method": { $in: ["cash", "wallet"] } },
      { "payment.status": { $in: ["paid", "authorized", "captured", "settled", "refunded"] } },
    ],
  };

  const rawStatus =
    typeof query.status === "string" ? query.status.trim().toLowerCase() : "";
  const cancelledBy =
    typeof query.cancelledBy === "string"
      ? query.cancelledBy.trim().toLowerCase()
      : "";
  const restaurantIdRaw =
    typeof query.restaurantId === "string" ? query.restaurantId.trim() : "";
  const userIdRaw =
    typeof query.userId === "string" ? query.userId.trim() : "";
  const startDateRaw =
    typeof query.startDate === "string" ? query.startDate.trim() : "";
  const endDateRaw =
    typeof query.endDate === "string" ? query.endDate.trim() : "";

  if (userIdRaw && mongoose.Types.ObjectId.isValid(userIdRaw)) {
    filter.userId = new mongoose.Types.ObjectId(userIdRaw);
  }

  if (rawStatus && rawStatus !== "all") {
    switch (rawStatus) {
      case "pending":
        filter.orderStatus = { $in: ["created", "confirmed"] };
        break;
      case "accepted":
        filter.orderStatus = "confirmed";
        break;
      case "processing":
        filter.orderStatus = { $in: ["preparing", "ready_for_pickup"] };
        break;
      case "food-on-the-way":
        filter.orderStatus = "picked_up";
        break;
      case "delivered":
        filter.orderStatus = "delivered";
        break;
      case "canceled":
      case "cancelled":
        filter.orderStatus = {
          $in: [
            "cancelled_by_user",
            "cancelled_by_restaurant",
            "cancelled_by_admin",
          ],
        };
        break;
      case "restaurant-cancelled":
        filter.orderStatus = "cancelled_by_restaurant";
        break;
      case "payment-failed":
        filter["payment.status"] = "failed";
        break;
      case "refunded":
        filter["payment.status"] = "refunded";
        break;
      case "offline-payments":
        filter["payment.method"] = "cash";
        filter.orderStatus = { $in: ["created", "confirmed", "delivered"] };
        break;
      case "scheduled":
        filter.scheduledAt = { $ne: null };
        break;
      default:
        break;
    }
  }

  if (cancelledBy) {
    if (cancelledBy === "restaurant") {
      filter.orderStatus = "cancelled_by_restaurant";
    } else if (cancelledBy === "user" || cancelledBy === "customer") {
      filter.orderStatus = "cancelled_by_user";
    }
  }

  if (restaurantIdRaw && mongoose.Types.ObjectId.isValid(restaurantIdRaw)) {
    filter.restaurantId = new mongoose.Types.ObjectId(restaurantIdRaw);
  }

  if (startDateRaw || endDateRaw) {
    const createdAt = {};
    const start = startDateRaw ? new Date(startDateRaw) : null;
    const end = endDateRaw ? new Date(endDateRaw) : null;
    if (start && !Number.isNaN(start.getTime())) {
      createdAt.$gte = start;
    }
    if (end && !Number.isNaN(end.getTime())) {
      createdAt.$lte = end;
    }
    if (Object.keys(createdAt).length > 0) {
      filter.createdAt = createdAt;
    }
  }

  const [docs, total] = await Promise.all([
    FoodOrder.find(filter)
      .select("+deliveryOtp")
      .populate("userId", "name phone email")
      .populate("restaurantId", "restaurantName area city ownerPhone")
      .populate("dispatch.deliveryPartnerId", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FoodOrder.countDocuments(filter),
  ]);
  const paginated = buildPaginatedResult({ docs: docs.map(d => normalizeOrderForClient(d)), total, page, limit });
  return { ...paginated, orders: paginated.data };
}

export async function assignDeliveryPartnerAdmin(
  orderId,
  deliveryPartnerId,
  adminId,
) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne(identity).populate(
    "restaurantId",
    "restaurantName location addressLine1 area city state phone",
  );
  if (!order) throw new NotFoundError("Order not found");

  const nonAssignableStatuses = [
    "delivered",
    "cancelled_by_user",
    "cancelled_by_restaurant",
    "cancelled_by_admin",
  ];
  if (nonAssignableStatuses.includes(order.orderStatus)) {
    throw new ValidationError("Cannot assign driver for this order");
  }

  const previousPartnerId =
    order.dispatch?.deliveryPartnerId?.toString?.() || null;
  if (previousPartnerId === String(deliveryPartnerId)) {
    throw new ValidationError("This driver is already assigned to the order");
  }

  const partner = await FoodDeliveryPartner.findById(deliveryPartnerId)
    .select("status name")
    .lean();
  if (!partner || partner.status !== "approved") {
    throw new ValidationError("Delivery partner not available");
  }

  const fromDispatchStatus = order.dispatch?.status || "unassigned";
  order.dispatch = order.dispatch || {};
  order.dispatch.status = "assigned";
  order.dispatch.deliveryPartnerId = new mongoose.Types.ObjectId(
    deliveryPartnerId,
  );
  order.dispatch.assignedAt = new Date();
  pushStatusHistory(order, {
    byRole: "ADMIN",
    byId: adminId,
    from: fromDispatchStatus,
    to: "assigned",
    note: previousPartnerId
      ? `Reassigned from driver ${previousPartnerId}`
      : "Assigned by admin",
  });
  await order.save();

  const restaurant = order.restaurantId;
  const payload = buildDeliverySocketPayload(order, restaurant);

  try {
    const io = getIO();
    if (io) {
      if (previousPartnerId) {
        io.to(rooms.delivery(previousPartnerId)).emit(
          "order_reassigned_elsewhere",
          {
            orderMongoId: order._id?.toString?.(),
            orderId: order._id.toString(),
            message:
              "This order has been reassigned to another delivery partner.",
          },
        );
      }
      io.to(rooms.delivery(deliveryPartnerId)).emit("new_order_available", payload);
      io.to(rooms.delivery(deliveryPartnerId)).emit("new_order", payload);
    }
  } catch (err) {
    logger.warn(
      `assignDeliveryPartnerAdmin socket emit failed: ${err?.message || err}`,
    );
  }

  if (previousPartnerId) {
    await notifyOwnerSafely(
      { ownerType: "DELIVERY_PARTNER", ownerId: previousPartnerId },
      {
        title: "Order reassigned",
        body: `Order #${order.order_id || order._id} has been reassigned to another driver.`,
        data: {
          type: "order_reassigned_elsewhere",
          orderId: String(order._id),
          orderMongoId: String(order._id),
        },
      },
    );
  }

  await notifyOwnerSafely(
    { ownerType: "DELIVERY_PARTNER", ownerId: deliveryPartnerId },
    {
      title: previousPartnerId ? "Order reassigned to you" : "New order assigned",
      body: `You have been assigned Order #${order.order_id || order._id}.`,
      data: {
        type: "new_order",
        orderId: String(order._id),
        orderMongoId: String(order._id),
      },
    },
  );

  enqueueOrderEvent("delivery_partner_assigned", {
    orderMongoId: order._id?.toString?.(),
    orderId: order._id.toString(),
    deliveryPartnerId,
    previousPartnerId,
    adminId,
  });
  return normalizeOrderForClient(order);
}

/**
 * Admin manually cancels an order. Notifies user, restaurant, and assigned driver.
 */
export async function cancelOrderByAdmin(
  orderId,
  adminId,
  reason = "",
  refundDestination,
) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne(identity);
  if (!order) throw new NotFoundError("Order not found");

  const nonCancellableStatuses = [
    "delivered",
    "cancelled_by_user",
    "cancelled_by_restaurant",
    "cancelled_by_admin",
  ];
  if (nonCancellableStatuses.includes(order.orderStatus)) {
    throw new ValidationError("Order cannot be cancelled");
  }

  const from = order.orderStatus;
  const assignedRiderId = order.dispatch?.deliveryPartnerId;
  const restaurantId = order.restaurantId;
  const cancelNote = reason?.trim() || "Order cancelled by admin";

  order.orderStatus = "cancelled_by_admin";
  freeOrderDispatch(order);
  pushStatusHistory(order, {
    byRole: "ADMIN",
    byId: adminId,
    from,
    to: "cancelled_by_admin",
    note: cancelNote,
  });

  await applyOrderRefundIfPaid(order, {
    recordedByRole: "ADMIN",
    recordedById: adminId,
    note: cancelNote,
    preferWallet: refundDestination === "wallet",
  });
  await order.save();

  const refundDetail =
    order.payment?.status === "refunded"
      ? order.payment?.refund?.destination === "wallet"
        ? ` ₹${order.pricing.total} has been credited to your wallet.`
        : ` Your refund of ₹${order.pricing.total} is being processed.`
      : "";
  const userMessage = `Order #${order.order_id || order._id} has been cancelled by admin.${refundDetail}`;
  const restaurantMessage = `Order #${order.order_id || order._id} has been cancelled by admin.`;
  const riderMessage = `Order #${order.order_id || order._id} has been cancelled by admin. You are now free to accept new orders.`;

  try {
    const io = getIO();
    if (io) {
      const payload = {
        orderMongoId: order._id?.toString?.(),
        orderId: order._id.toString(),
        orderStatus: order.orderStatus,
        title: "Order cancelled by admin",
        message: userMessage,
        failureReason: "admin_cancelled",
        cancelledBy: "admin",
      };
      io.to(rooms.user(order.userId)).emit("order_status_update", payload);
      io.to(rooms.restaurant(restaurantId)).emit("order_status_update", {
        ...payload,
        message: restaurantMessage,
      });
      if (assignedRiderId) {
        io.to(rooms.delivery(assignedRiderId)).emit("order_status_update", {
          ...payload,
          message: riderMessage,
        });
        io.to(rooms.delivery(assignedRiderId)).emit("order_cancelled", {
          ...payload,
          message: riderMessage,
        });
      }
    }
  } catch (err) {
    logger.warn(`cancelOrderByAdmin socket emit failed: ${err?.message || err}`);
  }

  await notifyOwnerSafely(
    { ownerType: "USER", ownerId: order.userId },
    {
      title: "Order cancelled by admin",
      body: userMessage,
      data: {
        type: "order_cancelled_by_admin",
        orderId: String(order._id),
        orderMongoId: String(order._id),
        cancelledBy: "admin",
      },
    },
  );

  await notifyOwnerSafely(
    { ownerType: "RESTAURANT", ownerId: restaurantId },
    {
      title: "Order cancelled by admin",
      body: restaurantMessage,
      data: {
        type: "order_cancelled_by_admin",
        orderId: String(order._id),
        orderMongoId: String(order._id),
        cancelledBy: "admin",
      },
    },
  );

  if (assignedRiderId) {
    await notifyOwnerSafely(
      { ownerType: "DELIVERY_PARTNER", ownerId: assignedRiderId },
      {
        title: "Order cancelled by admin",
        body: riderMessage,
        data: {
          type: "order_cancelled_by_admin",
          orderId: String(order._id),
          orderMongoId: String(order._id),
          cancelledBy: "admin",
        },
      },
    );
  }

  try {
    await foodTransactionService.updateTransactionStatus(
      order._id,
      "cancelled_by_admin",
      {
        status:
          order.payment?.status === "refunded" ? "refunded" : "failed",
        note: cancelNote,
        recordedByRole: "ADMIN",
        recordedById: adminId,
      },
    );
  } catch (err) {
    logger.warn(`cancelOrderByAdmin transaction sync failed: ${err?.message || err}`);
  }

  enqueueOrderEvent("order_cancelled_by_admin", {
    orderMongoId: order._id?.toString?.(),
    orderId: order._id.toString(),
    adminId: adminId ? String(adminId) : null,
    deliveryPartnerId: assignedRiderId ? String(assignedRiderId) : null,
    reason: cancelNote,
  });

  return normalizeOrderForClient(order);
}

export async function deleteOrderAdmin(orderId, adminId) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne(identity).lean();
  if (!order) throw new NotFoundError("Order not found");

  // Keep support tickets but detach deleted order reference.
  await Promise.all([
    FoodSupportTicket.updateMany(
      { orderId: order._id },
      { $set: { orderId: null } },
    ),
    FoodTransaction.deleteOne({
      $or: [{ orderId: order._id }, { orderReadableId: String(order._id.toString()) }],
    }),
    FoodOrder.deleteOne({ _id: order._id }),
  ]);

  // Remove realtime tracking node if present.
  try {
    const db = getFirebaseDB();
    if (db && order?.orderId) {
      await db.ref(`active_orders/${order._id.toString()}`).remove();
    }
  } catch (err) {
    logger.warn(`Delete order firebase cleanup failed: ${err?.message || err}`);
  }

  // Notify connected apps so stale UI entries can disappear without refresh.
  try {
    const io = getIO();
    if (io) {
      const payload = {
        orderMongoId: String(order._id),
        orderId: String(order._id.toString() || ""),
        deletedBy: "ADMIN",
        adminId: adminId ? String(adminId) : null,
      };

      if (order.userId) io.to(rooms.user(order.userId)).emit("order_deleted", payload);
      if (order.restaurantId) io.to(rooms.restaurant(order.restaurantId)).emit("order_deleted", payload);
      if (order.dispatch?.deliveryPartnerId) {
        io.to(rooms.delivery(order.dispatch.deliveryPartnerId)).emit("order_deleted", payload);
      }
    }
  } catch (err) {
    logger.warn(`Delete order socket emit failed: ${err?.message || err}`);
  }

  enqueueOrderEvent("order_deleted_by_admin", {
    orderMongoId: String(order._id),
    orderId: String(order._id.toString() || ""),
    adminId: adminId ? String(adminId) : null,
  });

  return {
    deleted: true,
    orderId: String(order._id.toString() || ""),
    orderMongoId: String(order._id),
  };
}

/**
 * Resends the order to the restaurant (up to 3 times).
 * Triggered by the delivery partner when a restaurant rejects an order they accepted.
 */
export async function resendOrderToRestaurant(orderId, deliveryPartnerId) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne({
    ...identity,
    "dispatch.deliveryPartnerId": new mongoose.Types.ObjectId(deliveryPartnerId)
  });

  if (!order) throw new NotFoundError("Order not found or not assigned to you");

  if ((order.restaurantRejectionCount || 0) >= 3) {
    throw new ValidationError("Order has reached maximum rejection limit (3 times) and is now dead.");
  }

  if (order.orderStatus !== 'rejected_by_restaurant') {
    throw new ValidationError("Order can only be resent if it was rejected by the restaurant");
  }

  const from = order.orderStatus;

  if (order.isMultiRestaurant && Array.isArray(order.pickups) && order.pickups.length > 0) {
    const cancelledPickups = order.pickups.filter((p) => p.status === 'cancelled');
    if (cancelledPickups.length === 0) {
      throw new ValidationError("No rejected restaurant to resend");
    }

    for (const pickup of cancelledPickups) {
      pickup.status = 'pending';
    }

    const to = computeAggregateOrderStatus(order);
    order.orderStatus = to;
    pushStatusHistory(order, {
      byRole: "DELIVERY_PARTNER",
      byId: deliveryPartnerId,
      from,
      to,
      note: `Resent to restaurant by delivery partner (Attempt ${order.restaurantRejectionCount}/3)`
    });

    await order.save();

    for (const pickup of cancelledPickups) {
      await notifyRestaurantNewOrder(order, pickup.restaurantId);
    }

    return normalizeOrderForClient(order);
  }

  const to = 'created';
  order.orderStatus = to;
  pushStatusHistory(order, {
    byRole: "DELIVERY_PARTNER",
    byId: deliveryPartnerId,
    from,
    to,
    note: `Resent to restaurant by delivery partner (Attempt ${order.restaurantRejectionCount}/3)`
  });

  await order.save();

  await notifyRestaurantNewOrder(order);

  return normalizeOrderForClient(order);
}



export async function reportOrderDelay(orderId, userId, role, reason) {
  const identity = buildOrderIdentityFilter(orderId);
  const order = await FoodOrder.findOne(identity);
  if (!order) throw new NotFoundError("Order not found");

  // Validate permission
  if (role === 'DELIVERY_PARTNER') {
    if (String(order.dispatch?.deliveryPartnerId) !== String(userId)) {
      throw new ForbiddenError("Not assigned to you");
    }
  } else if (role === 'RESTAURANT') {
    const isPrimary = String(order.restaurantId) === String(userId);
    const isPickup = (order.pickups || []).some(p => String(p.restaurantId) === String(userId));
    if (!isPrimary && !isPickup) throw new ForbiddenError("Not your restaurant");
  }

  order.delayContext = {
    reason: String(reason || "").trim(),
    reportedBy: role,
    reportedAt: new Date()
  };

  await order.save();

  // Socket notification to user
  try {
    const io = getIO();
    if (io) {
      io.to(rooms.user(order.userId)).emit("order_delay_update", {
        orderId: order._id.toString(),
        reason: order.delayContext.reason,
        reportedBy: role
      });
    }
  } catch {}

  return order;
}

/**
 * Marks an order as shared so other delivery partners can accept it.
 */
export async function shareOrderDelivery(orderId, deliveryPartnerId) {
  const identity = buildOrderIdentityFilter(orderId);
  const order = await FoodOrder.findOne({
    ...identity,
    "dispatch.deliveryPartnerId": new mongoose.Types.ObjectId(deliveryPartnerId)
  });

  if (!order) throw new NotFoundError("Order not found or not assigned to you");

  const currentStatus = order.orderStatus;
  const sharedStatuses = ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'];
  
  if (!sharedStatuses.includes(currentStatus)) {
    throw new ValidationError(`Order in status '${currentStatus}' cannot be shared.`);
  }

  if (order.dispatch?.sharedPartnerId) {
    throw new ValidationError('Order already has a shared partner');
  }

  // Set sharing flags
  order.dispatch.isShared = true;
  order.dispatch.sharedPartnerId = null; // Ensure it's null so another partner can join

  // Split the net rider earning 50/50
  // Fallback to delivery fee if rider earning is not pre-calculated
  const totalEarning = Number(order.riderEarning || order.pricing?.deliveryFee || 0);
  const sharedSplit = Math.round(totalEarning / 2);
  order.sharedRiderEarning = sharedSplit;
  order.riderEarning = Math.max(0, totalEarning - sharedSplit);

  pushStatusHistory(order, {
    byRole: "DELIVERY_PARTNER",
    byId: deliveryPartnerId,
    from: currentStatus,
    to: currentStatus,
    note: "Order marked as shared with other partners"
  });

  await order.save();

  // Notify nearby riders via socket (broadcast to all_delivery room)
  try {
    const io = getIO();
    if (io) {
      const payload = buildDeliverySocketPayload(order, order.restaurantId);
      io.to('all_delivery').emit('shareable_order_available', {
        ...payload,
        sharedFrom: deliveryPartnerId
      });
    }
  } catch (err) {
    logger.error(`Socket notification failed for shared order: ${err.message}`);
  }

  return normalizeOrderForClient(order);
}

/**
 * Allows another delivery partner to join a shared order.
 */
export async function acceptSharedOrderDelivery(orderId, newPartnerId) {
  const identity = buildOrderIdentityFilter(orderId);
  const order = await FoodOrder.findOne({
    ...identity,
    'dispatch.isShared': true,
    'dispatch.sharedPartnerId': null
  });

  if (!order) throw new NotFoundError("Shared order not found or no longer available");
  
  if (String(order.dispatch.deliveryPartnerId) === String(newPartnerId)) {
    throw new ValidationError("You already have this order assigned.");
  }

  const oldPartnerId = order.dispatch.deliveryPartnerId;
  const currentStatus = order.orderStatus;

  // Assign the shared partner without replacing the primary partner
  order.dispatch.sharedPartnerId = new mongoose.Types.ObjectId(newPartnerId);
  order.dispatch.isShared = false; // Closed for further joining

  // Maintain separate earnings (already split during 'share' call)
  // Ensure the shared status is tracked in history
  pushStatusHistory(order, {
    byRole: "DELIVERY_PARTNER",
    byId: newPartnerId,
    from: currentStatus,
    to: currentStatus,
    note: `Shared order slot joined by partner ${newPartnerId}`
  });

  await order.save();

  // Sync shared partner to transaction
  try {
    await foodTransactionService.updateTransactionStatus(order._id, 'shared_partner_assigned', {
      sharedPartnerId: newPartnerId,
      primaryRiderShare: order.riderEarning,
      sharedRiderShare: order.sharedRiderEarning,
      note: `Partner ${newPartnerId} joined the delivery. Earning will be split.`
    });
  } catch (err) {
    logger.error(`Failed to sync shared partner to transaction: ${err.message}`);
  }

  // Notify both partners and user
  try {
    const io = getIO();
    if (io) {
      const payload = {
        orderId: order._id.toString(),
        orderStatus: order.orderStatus,
        dispatch: order.dispatch
      };
      io.to(rooms.delivery(oldPartnerId)).emit('order_shared_accepted', payload);
      io.to(rooms.delivery(newPartnerId)).emit('order_shared_accepted', payload);
      io.to(rooms.delivery(oldPartnerId)).emit('order_status_update', payload);
      io.to(rooms.delivery(newPartnerId)).emit('order_status_update', payload);
      io.to(rooms.user(order.userId)).emit('delivery_partner_updated', payload);
      
      // Also notify all riders that the shareable slot is no longer available
      io.to('all_delivery').emit('order_claimed', { orderId: order._id.toString() });
    }
  } catch (err) {}

  await order.populate([
    { path: 'restaurantId' },
    { path: 'userId' },
    { path: 'dispatch.deliveryPartnerId', select: 'name fullName phone phoneNumber profileImage' },
    { path: 'dispatch.sharedPartnerId', select: 'name fullName phone phoneNumber profileImage' }
  ]);
  return normalizeOrderForClient(order);
}

/**
 * Background job to process scheduled orders that are due in 30 minutes or less.
 * Activated by server.js interval.
 */
export async function processScheduledOrderAlerts() {
  const now = new Date();
  const triggerWindow = new Date(now.getTime() + 30 * 60 * 1000); // 30 mins from now

  try {
    const scheduledOrders = await FoodOrder.find({
      orderStatus: 'scheduled',
      scheduledAt: { $lte: triggerWindow },
      'payment.status': { $ne: 'failed' } // skip failed payment orders
    });

    if (scheduledOrders.length === 0) {
      return;
    }

    logger.info(`[ScheduledOrders] Found ${scheduledOrders.length} orders to activate.`);

    for (const order of scheduledOrders) {
      const from = order.orderStatus;
      order.orderStatus = 'created';
      order.restaurantNotifiedForSchedule = true;
      
      order.statusHistory.push({
        at: new Date(),
        byRole: 'SYSTEM',
        from,
        to: 'created',
        note: 'Scheduled order activated (30-minute buffer reached).'
      });

      await order.save();

      // Emit socket status updates
      try {
        const io = getIO();
        if (io) {
          const payload = {
            orderMongoId: order._id.toString(),
            orderId: order.order_id || order._id.toString(),
            orderStatus: 'created',
            message: `Your scheduled order #${order.order_id || order._id} is now being processed.`
          };
          io.to(rooms.user(order.userId)).emit("order_status_update", payload);
          io.to(rooms.restaurant(order.restaurantId)).emit("order_status_update", payload);
        }
      } catch (socketErr) {
        logger.warn(`[ScheduledOrders] Socket emission failed for order ${order._id}: ${socketErr.message}`);
      }

      // Send push notification to user
      try {
        await notifyOwnersSafely([{ ownerType: "USER", ownerId: order.userId }], {
          title: "Scheduled Order Activated! 🍔",
          body: `Your scheduled order #${order.order_id || order._id} is now active and we are searching for a rider.`,
          data: {
            type: "order_created",
            orderId: String(order._id),
            link: `/food/user/orders/${order._id}`,
          },
        });
      } catch (notificationErr) {
        logger.warn(`[ScheduledOrders] Push notification failed for user ${order.userId}: ${notificationErr.message}`);
      }

      // Trigger automatic rider assignment
      const settings = await dispatchService.getDispatchSettings();
      if (settings.dispatchMode === "auto") {
        try {
          await tryAutoAssign(order._id);
        } catch (assignErr) {
          logger.error(`[ScheduledOrders] Auto-assign failed for activated order ${order._id}: ${assignErr.message}`);
        }
      }
    }
  } catch (err) {
    logger.error(`Error in processScheduledOrderAlerts: ${err.message}`);
  }
}

