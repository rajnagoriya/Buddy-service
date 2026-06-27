import mongoose from 'mongoose';
import { FoodOrder } from '../models/order.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import { FoodDeliveryCommissionRule } from '../../admin/models/deliveryCommissionRule.model.js';
import { FoodOffer } from '../../admin/models/offer.model.js';
import { FoodOfferUsage } from '../../admin/models/offerUsage.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { haversineKm } from './order.helpers.js';
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
    freeDeliveryUpTo: 0,
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

  const freeUpTo = Number(feeSettings.freeDeliveryUpTo || 0);
  const freeThreshold = Number(feeSettings.freeDeliveryThreshold || 0);
  
  let distanceKm = 0;
  const userLoc = dto?.deliveryAddress?.location?.coordinates;

  if (restaurants.length === 2 && userLoc?.length === 2) {
    const r1 = restaurants[0];
    const r2 = restaurants[1];
    
    if (r1.location?.coordinates?.length === 2 && r2.location?.coordinates?.length === 2) {
      const distBetweenRestaurants = haversineKm(
        r1.location.coordinates[1], r1.location.coordinates[0],
        r2.location.coordinates[1], r2.location.coordinates[0]
      );
      const distToUser = haversineKm(
        r2.location.coordinates[1], r2.location.coordinates[0],
        userLoc[1], userLoc[0]
      );
      distanceKm = distBetweenRestaurants + distToUser;
    }
  } else if (mainRestaurant?.location?.coordinates?.length === 2 && userLoc?.length === 2) {
    distanceKm = haversineKm(
      mainRestaurant.location.coordinates[1], mainRestaurant.location.coordinates[0],
      userLoc[1], userLoc[0]
    );
  }

  if (!Number.isFinite(distanceKm)) distanceKm = 0;
  let deliveryFee = 0;
  let deliveryFeeBreakdown = null;
  const splitEnabled = deliveryBoySettings ? (deliveryBoySettings.splitOrderEnabled !== false) : true;
  const splitThreshold = Number(deliveryBoySettings?.splitOrderThreshold ?? 20);
  const isSplitOrder = Boolean(splitEnabled && splitThreshold > 0 && totalItemCount >= splitThreshold);
  const isMultiRestaurant = restaurants.length > 1;
  const deliveryMultiplier = (isMultiRestaurant || isSplitOrder) ? 2 : 1;

  if (
    Number.isFinite(freeUpTo) &&
    freeUpTo > 0 &&
    subtotal >= freeUpTo
  ) {
    deliveryFee = 0;
  } else if (
    Number.isFinite(freeThreshold) &&
    freeThreshold > 0 &&
    subtotal >= freeThreshold
  ) {
    deliveryFee = 0;
  } else {
    const rules = await FoodDeliveryCommissionRule.find({ status: true }).lean();
    if (rules && rules.length > 0 && Number.isFinite(distanceKm)) {
      // Find matching rule
      let matchedRule = null;
      for (const rule of rules) {
        const min = Number(rule.minDistance) || 0;
        const max = rule.maxDistance !== null ? Number(rule.maxDistance) : null;
        if (distanceKm >= min && (max === null || distanceKm <= max)) {
          matchedRule = rule;
          break;
        }
      }
      
      if (matchedRule) {
        const min = Number(matchedRule.minDistance) || 0;
        const extraDistance = Math.max(0, distanceKm - min);
        const kmForRate = min === 0 ? distanceKm : extraDistance;
        deliveryFee = Number(matchedRule.basePayout) + (kmForRate * Number(matchedRule.commissionPerKm));
      } else {
        deliveryFee = Number(feeSettings.deliveryFee || 0);
      }
    } else {
      deliveryFee = Number(feeSettings.deliveryFee || 0);
    }
  }

  const baseFee = Number(deliveryFee || 0);
  deliveryFee = baseFee * deliveryMultiplier;

  deliveryFeeBreakdown = {
    source: "distance",
    distanceKm,
    isMultiRestaurant,
    isSplitOrder,
    totalItems: totalItemCount,
    multiplier: deliveryMultiplier,
    additionalCharge: 0,
    baseFee,
    fee: deliveryFee
  };

  const gstRate = feeSettings.gstRate != null ? Number(feeSettings.gstRate) : 0;
  const tax =
    Number.isFinite(gstRate) && gstRate > 0
      ? Math.round(subtotal * (gstRate / 100))
      : 0;

  let discount = 0;
  let appliedCoupon = null;
  const codeRaw = dto.couponCode
    ? String(dto.couponCode).trim().toUpperCase()
    : "";

  if (codeRaw) {
    const now = new Date();
    const offer = await FoodOffer.findOne({ couponCode: codeRaw }).lean();
    if (offer) {
      const statusOk = offer.status === "active";
      const startOk = !offer.startDate || now >= new Date(offer.startDate);
      const endOk = !offer.endDate || now < new Date(offer.endDate);
      const scopeOk =
        offer.restaurantScope !== "selected" ||
        String(offer.restaurantId || "") === String(dto.restaurantId || "");
      const minOk = subtotal >= (Number(offer.minOrderValue) || 0);
      let usageOk = true;
      if (
        Number(offer.usageLimit) > 0 &&
        Number(offer.usedCount || 0) >= Number(offer.usageLimit)
      ) {
        usageOk = false;
      }

      let perUserOk = true;
      if (userId && Number(offer.perUserLimit) > 0) {
        const usage = await FoodOfferUsage.findOne({
          offerId: offer._id,
          userId,
        }).lean();
        if (usage && Number(usage.count) >= Number(offer.perUserLimit)) {
          perUserOk = false;
        }
      }

      let firstOrderOk = true;
      if (userId && offer.customerScope === "first-time") {
        const c = await FoodOrder.countDocuments({
          userId: new mongoose.Types.ObjectId(userId),
        });
        firstOrderOk = c === 0;
      }
      if (userId && offer.isFirstOrderOnly === true) {
        const c2 = await FoodOrder.countDocuments({
          userId: new mongoose.Types.ObjectId(userId),
        });
        if (c2 > 0) firstOrderOk = false;
      }

      const allowed =
        statusOk &&
        startOk &&
        endOk &&
        scopeOk &&
        minOk &&
        usageOk &&
        perUserOk &&
        firstOrderOk;

      if (allowed) {
        if (offer.discountType === "percentage") {
          const raw = subtotal * (Number(offer.discountValue) / 100);
          const capped = Number(offer.maxDiscount)
            ? Math.min(raw, Number(offer.maxDiscount))
            : raw;
          discount = Math.max(0, Math.min(subtotal, Math.floor(capped)));
        } else {
          discount = Math.max(
            0,
            Math.min(subtotal, Math.floor(Number(offer.discountValue) || 0)),
          );
        }
        appliedCoupon = { code: codeRaw, discount };
      }
    }
  }

  const total = Math.max(
    0,
    subtotal + packagingFee + deliveryFee + platformFee + tax - discount,
  );

  return {
    pricing: {
      subtotal,
      tax,
      packagingFee,
      deliveryFee,
      deliveryFeeBreakdown: deliveryFeeBreakdown || undefined,
      freeDeliveryUpTo: Number.isFinite(freeUpTo) ? freeUpTo : undefined,
      platformFee,
      discount,
      total,
      currency: "INR",
      couponCode: appliedCoupon?.code || codeRaw || null,
      appliedCoupon,
    },
  };
}
