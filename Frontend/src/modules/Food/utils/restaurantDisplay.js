export const formatDistanceFromMeters = (meters) => {
  const value = Number(meters);
  if (!Number.isFinite(value) || value < 0) return "";
  if (value >= 1000) return `${(value / 1000).toFixed(1)} km`;
  return `${Math.round(value)} m`;
};

export const hasDisplayableRestaurantRating = (restaurant = {}) => {
  const rating = Number(restaurant?.rating);
  return Number.isFinite(rating) && rating > 0;
};

export const formatRestaurantRating = (restaurant = {}) => {
  const rating = Number(restaurant?.rating);
  if (!Number.isFinite(rating) || rating <= 0) return "";
  return rating.toFixed(1);
};

export const getRestaurantAddressLine = (restaurant = {}) => {
  const summary = String(restaurant?.addressSummary || "").trim();
  if (summary) return summary;

  const loc = restaurant?.location || {};
  const parts = [
    loc.area || restaurant?.area,
    loc.city || restaurant?.city,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  if (parts.length) return parts.join(", ");

  return String(loc.formattedAddress || loc.address || "").trim();
};

const calculateDistanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const resolveRestaurantDistance = (restaurant, location) => {
  if (Number.isFinite(restaurant?.distanceMeters)) {
    const distanceInKm = restaurant.distanceMeters / 1000;
    return {
      distance: restaurant.distance || formatDistanceFromMeters(restaurant.distanceMeters),
      distanceInKm,
      distanceSource: restaurant.distanceSource || "api",
    };
  }

  if (
    restaurant?.distance &&
    (restaurant.distanceSource === "road" || restaurant.distanceSource === "api")
  ) {
    const parsedKm = parseFloat(String(restaurant.distance).replace(/[^\d.]/g, ""));
    return {
      distance: restaurant.distance,
      distanceInKm: Number.isFinite(parsedKm) ? parsedKm : restaurant.distanceInKm ?? null,
      distanceSource: restaurant.distanceSource,
    };
  }

  const userLat = location?.latitude;
  const userLng = location?.longitude;
  const restaurantLocation = restaurant?.location;
  const restaurantLat =
    restaurantLocation?.latitude ||
    (Array.isArray(restaurantLocation?.coordinates)
      ? restaurantLocation.coordinates[1]
      : null);
  const restaurantLng =
    restaurantLocation?.longitude ||
    (Array.isArray(restaurantLocation?.coordinates)
      ? restaurantLocation.coordinates[0]
      : null);

  if (
    userLat &&
    userLng &&
    restaurantLat &&
    restaurantLng &&
    !Number.isNaN(userLat) &&
    !Number.isNaN(userLng) &&
    !Number.isNaN(restaurantLat) &&
    !Number.isNaN(restaurantLng)
  ) {
    const distanceInKm = calculateDistanceKm(
      userLat,
      userLng,
      restaurantLat,
      restaurantLng,
    );
    return {
      distance: formatDistanceFromMeters(distanceInKm * 1000),
      distanceInKm,
      distanceSource: "straight",
    };
  }

  return {
    distance: "",
    distanceInKm: null,
    distanceSource: "none",
  };
};
