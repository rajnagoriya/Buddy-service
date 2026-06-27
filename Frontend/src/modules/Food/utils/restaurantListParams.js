/** Home restaurant list page size (backend max 15 for scope=home). */
export const HOME_RESTAURANTS_PAGE_SIZE = 12;

const PLACEHOLDER_CITIES = new Set([
  "current location",
  "unknown city",
  "select location",
]);

/**
 * Resolve a usable city name from the user's saved/detected location.
 * @param {object|null|undefined} location
 * @returns {string|null}
 */
export function resolveUserListCity(location) {
  const raw = String(location?.city || "").trim();
  if (!raw) return null;
  if (PLACEHOLDER_CITIES.has(raw.toLowerCase())) return null;
  return raw;
}

/**
 * Build query params for GET /food/restaurant/restaurants (Home feed).
 * City filtering is enforced server-side when scope=home.
 */
export function buildRestaurantListParams(
  filters = {},
  location = null,
  _zoneId = null,
  page = 1,
  limit = HOME_RESTAURANTS_PAGE_SIZE,
) {
  const params = {
    page: Math.max(1, Number(page) || 1),
    limit: Math.min(
      Math.max(Number(limit) || HOME_RESTAURANTS_PAGE_SIZE, 1),
      15,
    ),
    scope: "home",
  };

  const city = resolveUserListCity(location);
  if (city) {
    params.city = city;
  }

  if (
    Number.isFinite(location?.latitude) &&
    Number.isFinite(location?.longitude)
  ) {
    params.lat = location.latitude;
    params.lng = location.longitude;
  }

  if (filters.sortBy) {
    params.sortBy = filters.sortBy;
  }

  if (filters.selectedCuisine) {
    params.cuisine = filters.selectedCuisine;
  }

  if (filters.activeFilters?.has("rating-45-plus")) {
    params.minRating = 4.5;
  } else if (filters.activeFilters?.has("rating-4-plus")) {
    params.minRating = 4.0;
  } else if (filters.activeFilters?.has("rating-35-plus")) {
    params.minRating = 3.5;
  }

  if (filters.activeFilters?.has("delivery-under-30")) {
    params.maxDeliveryTime = 30;
  } else if (filters.activeFilters?.has("delivery-under-45")) {
    params.maxDeliveryTime = 45;
  }

  if (filters.activeFilters?.has("distance-under-1km")) {
    params.radiusKm = 1.0;
  } else if (filters.activeFilters?.has("distance-under-2km")) {
    params.radiusKm = 2.0;
  }

  if (filters.activeFilters?.has("price-under-200")) {
    params.maxPrice = 200;
  } else if (filters.activeFilters?.has("price-under-500")) {
    params.maxPrice = 500;
  }

  if (filters.activeFilters?.has("has-offers")) {
    params.hasOffers = "true";
  }

  if (filters.activeFilters?.has("top-rated")) {
    params.topRated = "true";
  } else if (filters.activeFilters?.has("trusted")) {
    params.trusted = "true";
  }

  return params;
}

export function buildRestaurantListQueryKey(locationKey, filters = {}) {
  const activeFilterKey = Array.from(filters.activeFilters || [])
    .sort()
    .join("|");
  return `${locationKey}|${filters.sortBy || ""}|${filters.selectedCuisine || ""}|${activeFilterKey}`;
}

/**
 * @param {unknown} payload
 * @returns {unknown[]}
 */
export function extractRestaurantListItems(payload) {
  if (!payload || typeof payload !== "object") return [];
  const data = /** @type {Record<string, unknown>} */ (payload);
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.restaurants)) return data.restaurants;
  return [];
}
