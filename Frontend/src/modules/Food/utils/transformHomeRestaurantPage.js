import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";

const getRestaurantDisplayName = (restaurant) => {
  const nameCandidates = [
    restaurant?.name,
    restaurant?.restaurantName,
    restaurant?.restaurantName?.english,
    restaurant?.restaurantName?.value,
    restaurant?.onboarding?.step1?.restaurantName,
  ];
  const resolvedName = nameCandidates.find(
    (candidate) =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );
  return resolvedName ? resolvedName.trim() : "Restaurant";
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

export function sortRestaurantsForDisplay(restaurants, filters, location) {
  const userLat = location?.latitude;
  const userLng = location?.longitude;
  if (!userLat || !userLng) return restaurants;

  return [...restaurants].sort((a, b) => {
    const aAvailable = getRestaurantAvailabilityStatus(a, new Date(), {
      ignoreOperationalStatus: true,
    }).isOpen;
    const bAvailable = getRestaurantAvailabilityStatus(b, new Date(), {
      ignoreOperationalStatus: true,
    }).isOpen;

    if (aAvailable !== bAvailable) {
      return aAvailable ? -1 : 1;
    }

    if (filters?.sortBy === "price-low") {
      return (a.featuredPrice || 0) - (b.featuredPrice || 0);
    }
    if (filters?.sortBy === "price-high") {
      return (b.featuredPrice || 0) - (a.featuredPrice || 0);
    }
    if (filters?.sortBy === "rating-high") {
      return (b.rating || 0) - (a.rating || 0);
    }
    if (filters?.sortBy === "rating-low") {
      return (a.rating || 0) - (b.rating || 0);
    }

    const aDistance = a.distanceInKm !== null ? a.distanceInKm : Infinity;
    const bDistance = b.distanceInKm !== null ? b.distanceInKm : Infinity;
    return aDistance - bDistance;
  });
}

export function transformRestaurantApiList(
  restaurantsArray,
  { location, filters, extractImages, buildRestaurantImageCandidates },
) {
  const userLat = location?.latitude;
  const userLng = location?.longitude;

  const transformed = (restaurantsArray || []).map((restaurant) => {
    const deliveryTime = restaurant.estimatedDeliveryTime || "25-30 mins";
    let distance = restaurant.distance || "1.2 km";

    const restaurantLocation = restaurant.location;
    const restaurantLat =
      restaurantLocation?.latitude ||
      (restaurantLocation?.coordinates &&
      Array.isArray(restaurantLocation.coordinates)
        ? restaurantLocation.coordinates[1]
        : null);
    const restaurantLng =
      restaurantLocation?.longitude ||
      (restaurantLocation?.coordinates &&
      Array.isArray(restaurantLocation.coordinates)
        ? restaurantLocation.coordinates[0]
        : null);

    let distanceInKm = null;
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
      distanceInKm = calculateDistanceKm(
        userLat,
        userLng,
        restaurantLat,
        restaurantLng,
      );
      if (distanceInKm >= 1) {
        distance = `${distanceInKm.toFixed(1)} km`;
      } else {
        distance = `${Math.round(distanceInKm * 1000)} m`;
      }
    }

    const cuisine =
      Array.isArray(restaurant.cuisines) && restaurant.cuisines.length > 0
        ? restaurant.cuisines[0]
        : "Multi-cuisine";

    const coverImages = extractImages([
      ...(Array.isArray(restaurant.coverImages)
        ? restaurant.coverImages
        : [restaurant.coverImages]
      ).filter(Boolean),
      restaurant.coverImage,
    ]);

    const profileImageCandidates = extractImages([
      ...buildRestaurantImageCandidates(restaurant.profileImage),
      ...buildRestaurantImageCandidates(
        restaurant.onboarding?.step2?.profileImageUrl,
      ),
      ...buildRestaurantImageCandidates(restaurant.image),
      ...buildRestaurantImageCandidates(restaurant.imageUrl),
    ]);
    const profileImageUrl = profileImageCandidates[0] || "";

    const menuImageCandidates = extractImages(
      Array.isArray(restaurant.menuImages) ? restaurant.menuImages : [],
    );
    const featuredItemImages = extractImages(
      (Array.isArray(restaurant.featuredItems)
        ? restaurant.featuredItems
        : []
      ).map((item) => item?.image),
    );

    const allImages = Array.from(
      new Set(
        [
          ...coverImages,
          ...profileImageCandidates,
          ...menuImageCandidates,
          ...featuredItemImages,
        ].filter(Boolean),
      ),
    );
    const image = allImages[0] || profileImageUrl || "";
    const offerText = restaurant.offer || null;

    return {
      id: restaurant.restaurantId || restaurant._id,
      mongoId: restaurant._id || null,
      name: getRestaurantDisplayName(restaurant),
      cuisine,
      cuisines: Array.isArray(restaurant.cuisines) ? restaurant.cuisines : [],
      rating: Number(restaurant.rating) || 0,
      deliveryTime:
        restaurant.deliveryTime ||
        restaurant.estimatedDeliveryTime ||
        (restaurant.estimatedDeliveryTimeMinutes
          ? `${restaurant.estimatedDeliveryTimeMinutes} mins`
          : deliveryTime),
      distance,
      distanceInKm,
      image,
      images: allImages,
      priceRange: restaurant.priceRange || "$$",
      featuredDish:
        restaurant.featuredDish ||
        (restaurant.cuisines && restaurant.cuisines.length > 0
          ? `${restaurant.cuisines[0]} Special`
          : "Special Dish"),
      featuredPrice: restaurant.featuredPrice || 249,
      offer: offerText,
      slug: restaurant.slug,
      restaurantId: restaurant.restaurantId,
      pureVegRestaurant: restaurant.pureVegRestaurant === true,
      location: restaurant.location,
      isActive: restaurant.isActive !== false,
      isAcceptingOrders: restaurant.isAcceptingOrders !== false,
      openDays: Array.isArray(restaurant.openDays) ? restaurant.openDays : [],
      deliveryTimings: restaurant.deliveryTimings || null,
      outletTimings: restaurant.outletTimings || null,
      openingTime:
        restaurant.openingTime ||
        restaurant?.deliveryTimings?.openingTime ||
        null,
      closingTime:
        restaurant.closingTime ||
        restaurant?.deliveryTimings?.closingTime ||
        null,
    };
  });

  return sortRestaurantsForDisplay(transformed, filters, location);
}

export function recalculateRestaurantDistances(restaurants, location) {
  if (!location?.latitude || !location?.longitude) return restaurants;
  if (!Array.isArray(restaurants) || restaurants.length === 0) return restaurants;

  const userLat = location.latitude;
  const userLng = location.longitude;

  return restaurants.map((restaurant) => {
    if (!restaurant.location) return restaurant;

    const restaurantLat =
      restaurant.location?.latitude ||
      (restaurant.location?.coordinates &&
      Array.isArray(restaurant.location.coordinates)
        ? restaurant.location.coordinates[1]
        : null);
    const restaurantLng =
      restaurant.location?.longitude ||
      (restaurant.location?.coordinates &&
      Array.isArray(restaurant.location.coordinates)
        ? restaurant.location.coordinates[0]
        : null);

    if (
      !restaurantLat ||
      !restaurantLng ||
      Number.isNaN(restaurantLat) ||
      Number.isNaN(restaurantLng)
    ) {
      return restaurant;
    }

    const distanceInKm = calculateDistanceKm(
      userLat,
      userLng,
      restaurantLat,
      restaurantLng,
    );

    let calculatedDistance;
    if (distanceInKm >= 1) {
      calculatedDistance = `${distanceInKm.toFixed(1)} km`;
    } else {
      calculatedDistance = `${Math.round(distanceInKm * 1000)} m`;
    }

    if (
      restaurant.distance === calculatedDistance &&
      restaurant.distanceInKm === distanceInKm
    ) {
      return restaurant;
    }

    return {
      ...restaurant,
      distance: calculatedDistance,
      distanceInKm,
    };
  });
}
