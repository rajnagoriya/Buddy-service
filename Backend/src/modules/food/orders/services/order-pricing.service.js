import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import { FoodDeliveryCommissionRule } from '../../admin/models/deliveryCommissionRule.model.js';
import { FoodOffer } from '../../admin/models/offer.model.js';
import {
  checkOfferEligibility,
  computeOfferDiscount,
  getCreatedByType,
  logOfferAction,
  COUPON_CATEGORY,
} from '../../admin/services/offer.service.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import {
  calculateDistanceSlabFee,
  calculateRangeDeliveryFee,
  resolveOrderDistanceKm,
  applyDeliverySurcharges,
  resolveSpeedFeeModifier,
} from './order.helpers.js';
import { FoodDeliveryBoySettings } from '../../admin/models/deliveryBoySettings.model.js';
import { validateRestaurantChainForItems } from './restaurant-chain-radius.service.js';
export async function calculateOrderPricing(userId, dto) {
  const items = Array.isArray(dto.items) ? dto.items : [];

  await validateRestaurantChainForItems(items);
  
  // Identify unique restaurants
  const restaurantIds = [...new Set(items.map(it => it.restaurantId).filter(Boolean))];
  if (dto.restaurantId && !restaurantIds.includes(dto.restaurantId)) {
    restaurantIds.push(dto.restaurantId);
  }

  if (restaurantIds.length === 0) throw new ValidationError("No restaurant specified");

  const restaurants = await FoodRestaurant.find({ _id: { $in: restaurantIds } })
    .select("status location name")
    .lean();

  if (restaurants.length === 0) throw new ValidationError("Restaurants not found");
  
  const mainRestaurant = restaurants[0];
  if (mainRestaurant.status !== "approved")
    throw new ValidationError(`Restaurant ${mainRestaurant.name} is not available`);

  const subtotal = items.reduce(
    (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
    0,
  );

  const totalItemCount = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 1),
    0,
  );

  const feeDoc = await FoodFeeSettings.findOne({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();
  const feeSettings = feeDoc || {
    deliveryFee: 25,
    deliveryFeeRanges: [],
    freeDeliveryThreshold: 149,
    platformFee: 5,
    packagingFee: 0,
    gstRate: 5,
  };

  let deliveryBoySettings = await FoodDeliveryBoySettings.findOne({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();
  if (!deliveryBoySettings) {
    deliveryBoySettings = await FoodDeliveryBoySettings.findOne()
      .sort({ createdAt: -1 })
      .lean();
  }

  const packagingFee = feeSettings.packagingFee != null ? Number(feeSettings.packagingFee) : 0;
  const platformFee = feeSettings.platformFee != null ? Number(feeSettings.platformFee) : 0;

  const freeThreshold = Number(feeSettings.freeDeliveryThreshold || 0);
  
  const userLoc = dto?.deliveryAddress?.location?.coordinates;
  let distanceKm = resolveOrderDistanceKm(restaurants, userLoc);
  if (!Number.isFinite(distanceKm)) distanceKm = 0;

  const splitEnabled = deliveryBoySettings ? (deliveryBoySettings.splitOrderEnabled !== false) : true;
  const splitThreshold = Number(deliveryBoySettings?.splitOrderThreshold ?? 20);
  const isSplitOrder = Boolean(splitEnabled && splitThreshold > 0 && totalItemCount >= splitThreshold);
  const isMultiRestaurant = restaurants.length > 1;

  if (isMultiRestaurant && deliveryBoySettings && deliveryBoySettings.multiOrderEnabled === false) {
    throw new ValidationError("Multi-restaurant orders are currently disabled");
  }

  let baseDeliveryFee = 0;
  let deliveryFeeSource = "flat";

  if (
    Number.isFinite(freeThreshold) &&
    freeThreshold > 0 &&
    subtotal >= freeThreshold
  ) {
    baseDeliveryFee = 0;
    deliveryFeeSource = "free";
  } else {
    const rules = await FoodDeliveryCommissionRule.find({ status: true }).lean();
    if (rules?.length > 0) {
      baseDeliveryFee = calculateDistanceSlabFee(distanceKm, rules);
      deliveryFeeSource = "distance";
    } else {
      const rangeFee = calculateRangeDeliveryFee(distanceKm, feeSettings.deliveryFeeRanges);
      if (rangeFee != null) {
        baseDeliveryFee = rangeFee;
        deliveryFeeSource = "range";
      } else {
        baseDeliveryFee = Number(feeSettings.deliveryFee || 0);
        deliveryFeeSource = "flat";
      }
    }
  }

  const surchargeResult = applyDeliverySurcharges(baseDeliveryFee, {
    isMultiRestaurant,
    isSplitOrder,
    deliveryBoySettings,
  });

  const speedFeeModifier = resolveSpeedFeeModifier(
    deliveryBoySettings,
    dto.deliverySpeedOptionId,
    dto.deliveryOption,
  );

  let deliveryFee = Math.max(0, surchargeResult.fee + speedFeeModifier);
  const deliveryFeeBreakdown = {
    source: deliveryFeeSource,
    distanceKm,
    isMultiRestaurant,
    isSplitOrder,
    totalItems: totalItemCount,
    multiplier: surchargeResult.multiplier,
    additionalCharge: surchargeResult.surcharge,
    speedFeeModifier,
    baseFee: surchargeResult.baseFee,
    fee: deliveryFee,
  };

  const gstRate = feeSettings.gstRate != null ? Number(feeSettings.gstRate) : 0;
  const tax =
    Number.isFinite(gstRate) && gstRate > 0
      ? Math.round(subtotal * (gstRate / 100))
      : 0;

  let discount = 0;
  let deliveryDiscount = 0;
  let platformSubsidy = 0;
  let couponCategory = null;
  let appliedCoupon = null;
  const codeRaw = dto.couponCode
    ? String(dto.couponCode).trim().toUpperCase()
    : "";

  if (codeRaw) {
    const now = new Date();
    const offer = await FoodOffer.findOne({
      couponCode: codeRaw,
      isDeleted: { $ne: true },
      $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
    }).lean();

    if (offer) {
      const eligibility = await checkOfferEligibility(offer, {
        userId,
        restaurantIds,
        subtotal,
        isMultiRestaurant,
        now,
      });

      if (eligibility.eligible) {
        const computed = computeOfferDiscount(offer, { subtotal, deliveryFee });
        discount = computed.discount;
        deliveryDiscount = computed.deliveryDiscount;
        platformSubsidy = computed.platformSubsidy;
        couponCategory = computed.couponCategory;
        appliedCoupon = {
          code: codeRaw,
          discount,
          deliveryDiscount,
          platformSubsidy,
          couponCategory,
          createdBy: getCreatedByType(offer),
          offerId: offer._id,
        };
      } else {
        logOfferAction('failed', { couponCode: codeRaw, reason: eligibility.reason, userId });
      }
    } else {
      logOfferAction('failed', { couponCode: codeRaw, reason: 'invalid', userId });
    }
  }

  const customerDeliveryFee = Math.max(0, deliveryFee - deliveryDiscount);
  const total = Math.max(
    0,
    subtotal + packagingFee + customerDeliveryFee + platformFee + tax - discount,
  );

  return {
    pricing: {
      subtotal,
      tax,
      packagingFee,
      deliveryFee,
      deliveryDiscount,
      deliveryFeeBreakdown: deliveryFeeBreakdown || undefined,
      platformFee,
      discount,
      platformSubsidy,
      couponCategory,
      total,
      currency: "INR",
      couponCode: appliedCoupon?.code || null,
      couponCreatedBy: appliedCoupon?.createdBy || null,
      offerId: appliedCoupon?.offerId || null,
      appliedCoupon,
    },
  };
}
