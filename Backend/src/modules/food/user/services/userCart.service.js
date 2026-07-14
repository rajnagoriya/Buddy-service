import mongoose from 'mongoose';
import { FoodUserCart } from '../models/foodUserCart.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { attachOutletTimingsToRestaurants } from '../../restaurant/services/outletTimings.service.js';
import { getRestaurantOrderableStatus } from '../../shared/utils/restaurantAvailability.js';

const toCartResponse = (cartDoc) => {
  if (!cartDoc) {
    return { items: [], restaurantMeta: [], updatedAt: null };
  }
  const plain = typeof cartDoc.toObject === 'function' ? cartDoc.toObject() : cartDoc;
  return {
    items: plain.items || [],
    restaurantMeta: plain.restaurantMeta || [],
    updatedAt: plain.updatedAt || null,
  };
};

export const getUserCart = async (userId) => {
  const cart = await FoodUserCart.findOne({ userId }).lean();
  return toCartResponse(cart);
};

export const syncUserCart = async (userId, { items, restaurantMeta }) => {
  const cart = await FoodUserCart.findOneAndUpdate(
    { userId },
    { $set: { items, restaurantMeta } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return toCartResponse(cart);
};

export const validateCartRestaurants = async ({ restaurants, force = false }) => {
  const uniqueIds = [...new Set(restaurants.map((r) => String(r.restaurantId).trim()).filter(Boolean))];
  const objectIds = uniqueIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const restaurantDocs = objectIds.length
    ? await FoodRestaurant.find({ _id: { $in: objectIds } })
      .select('restaurantName status isAcceptingOrders')
      .lean()
    : [];

  const restaurantsWithTimings = await attachOutletTimingsToRestaurants(restaurantDocs);

  const restaurantById = new Map(
    restaurantsWithTimings.map((doc) => [String(doc._id), doc]),
  );
  const now = new Date();
  const changed = [];

  for (const cached of restaurants) {
    const restaurantId = String(cached.restaurantId).trim();
    const doc = restaurantById.get(restaurantId);
    const restaurantName = doc?.restaurantName || cached.restaurantName || 'Restaurant';

    let currentStatus = 'closed';
    let reason = 'not-found';

    if (doc) {
      const orderable = getRestaurantOrderableStatus(doc, now);
      currentStatus = orderable.status;
      reason = orderable.reason;
    }

    const previousStatus = cached.lastKnownStatus === 'closed' ? 'closed' : 'open';
    const statusChanged = currentStatus !== previousStatus;

    if (force) {
      if (currentStatus === 'closed') {
        changed.push({
          restaurantId,
          restaurantName,
          status: currentStatus,
          previousStatus,
          reason,
        });
      }
      continue;
    }

    if (statusChanged) {
      changed.push({
        restaurantId,
        restaurantName,
        status: currentStatus,
        previousStatus,
        reason,
      });
    }
  }

  return {
    changed,
    validatedAt: now.toISOString(),
    hasClosedRestaurants: changed.some((entry) => entry.status === 'closed'),
  };
};
