import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodDeliveryBoySettings } from '../../admin/models/deliveryBoySettings.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { haversineKm } from './order.helpers.js';
import { fetchRoadDistancesKm } from '../utils/googleMaps.js';

export const CHAIN_RESTAURANT_RADIUS_KM = 5;

export const CHAIN_RADIUS_VALIDATION_MESSAGE =
  'This restaurant is outside the allowed radius of the last selected restaurant. To place a single order, please select a nearby restaurant.';

async function getChainRadiusKm() {
  let settings = await FoodDeliveryBoySettings.findOne({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();
  if (!settings) {
    settings = await FoodDeliveryBoySettings.findOne()
      .sort({ createdAt: -1 })
      .lean();
  }
  const maxKm = Number(settings?.multiOrderMaxDistance);
  return Number.isFinite(maxKm) && maxKm > 0 ? maxKm : CHAIN_RESTAURANT_RADIUS_KM;
}

export function getRestaurantCoords(restaurant) {
  const coords = restaurant?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

/** Prefer Google road (driving) distance; fall back to straight-line haversine. */
export async function resolveChainDistanceKm(fromCoords, toCoords) {
  if (!fromCoords || !toCoords) {
    return { distanceKm: null, skipped: true, distanceSource: 'none' };
  }

  const road = await fetchRoadDistancesKm(fromCoords, [toCoords]);
  const roadKm = Array.isArray(road) ? Number(road[0]) : null;
  if (Number.isFinite(roadKm) && roadKm >= 0) {
    return { distanceKm: roadKm, skipped: false, distanceSource: 'road' };
  }

  const straightKm = haversineKm(
    fromCoords.lat,
    fromCoords.lng,
    toCoords.lat,
    toCoords.lng,
  );
  if (!Number.isFinite(straightKm)) {
    return { distanceKm: null, skipped: true, distanceSource: 'none' };
  }

  return {
    distanceKm: Number(straightKm.toFixed(2)),
    skipped: false,
    distanceSource: 'straight',
  };
}

export async function validateChainDistanceKm(fromCoords, toCoords, maxKm = CHAIN_RESTAURANT_RADIUS_KM) {
  const resolved = await resolveChainDistanceKm(fromCoords, toCoords);
  if (resolved.skipped || !Number.isFinite(resolved.distanceKm)) {
    return { valid: true, distanceKm: null, skipped: true, distanceSource: resolved.distanceSource };
  }

  return {
    valid: resolved.distanceKm <= maxKm,
    distanceKm: resolved.distanceKm,
    skipped: false,
    distanceSource: resolved.distanceSource,
  };
}

/** Restaurant IDs in the order they were first added to the cart. */
export function getRestaurantIdsInCartOrder(items) {
  const list = Array.isArray(items) ? items : [];
  const ordered = [];
  const seen = new Set();

  for (const item of list) {
    const id = String(item?.restaurantId || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  return ordered;
}

export async function validateRestaurantChainForItems(
  items,
  maxKm,
) {
  const resolvedMaxKm = Number.isFinite(Number(maxKm)) && Number(maxKm) > 0
    ? Number(maxKm)
    : await getChainRadiusKm();
  const restaurantIds = getRestaurantIdsInCartOrder(items);
  if (restaurantIds.length <= 1) {
    return { valid: true, restaurantIds };
  }

  const restaurants = await FoodRestaurant.find({ _id: { $in: restaurantIds } })
    .select('_id name location')
    .lean();

  const byId = new Map(restaurants.map((r) => [String(r._id), r]));

  for (let i = 1; i < restaurantIds.length; i += 1) {
    const prevRestaurant = byId.get(restaurantIds[i - 1]);
    const nextRestaurant = byId.get(restaurantIds[i]);
    const fromCoords = getRestaurantCoords(prevRestaurant);
    const toCoords = getRestaurantCoords(nextRestaurant);
    const { valid, skipped } = await validateChainDistanceKm(fromCoords, toCoords, resolvedMaxKm);

    if (!skipped && !valid) {
      throw new ValidationError(
        `This restaurant is outside the allowed ${resolvedMaxKm} KM road distance of the last selected restaurant. To place a single order, please select a nearby restaurant.`,
      );
    }
  }

  return { valid: true, restaurantIds };
}

export async function validateNewRestaurantAgainstLast(
  lastRestaurantId,
  newRestaurantId,
  maxKm,
) {
  const resolvedMaxKm = Number.isFinite(Number(maxKm)) && Number(maxKm) > 0
    ? Number(maxKm)
    : await getChainRadiusKm();
  const lastId = String(lastRestaurantId || '').trim();
  const nextId = String(newRestaurantId || '').trim();

  if (!lastId || !nextId || lastId === nextId) {
    return { valid: true, distanceKm: null };
  }

  const [lastRestaurant, newRestaurant] = await Promise.all([
    FoodRestaurant.findById(lastId).select('name location').lean(),
    FoodRestaurant.findById(nextId).select('name location').lean(),
  ]);

  if (!lastRestaurant || !newRestaurant) {
    throw new ValidationError('Restaurant not found');
  }

  const fromCoords = getRestaurantCoords(lastRestaurant);
  const toCoords = getRestaurantCoords(newRestaurant);
  const { valid, distanceKm, skipped, distanceSource } = await validateChainDistanceKm(
    fromCoords,
    toCoords,
    resolvedMaxKm,
  );

  if (!skipped && !valid) {
    throw new ValidationError(
      `This restaurant is outside the allowed ${resolvedMaxKm} KM road distance of the last selected restaurant. To place a single order, please select a nearby restaurant.`,
    );
  }

  return {
    valid: true,
    distanceKm,
    skipped,
    distanceSource,
    maxKm: resolvedMaxKm,
    fromRestaurantId: lastId,
    toRestaurantId: nextId,
  };
}
