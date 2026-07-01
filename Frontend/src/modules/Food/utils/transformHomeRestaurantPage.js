import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import {
  getRestaurantAddressLine,
  resolveRestaurantDistance,
} from "@food/utils/restaurantDisplay";

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
  const transformed = (restaurantsArray || []).map((restaurant) => {
    const deliveryTime = restaurant.estimatedDeliveryTime || "25-30 mins";
    const { distance, distanceInKm, distanceSource } = resolveRestaurantDistance(
      restaurant,
      location,
    );

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
      address: getRestaurantAddressLine(restaurant),
      cuisine,
      cuisines: Array.isArray(restaurant.cuisines) ? restaurant.cuisines : [],
      rating: Number(restaurant.rating) || 0,
      totalRatings: Number(restaurant.totalRatings) || 0,
      deliveryTime:
        restaurant.deliveryTime ||
        restaurant.estimatedDeliveryTime ||
        (restaurant.estimatedDeliveryTimeMinutes
          ? `${restaurant.estimatedDeliveryTimeMinutes} mins`
          : deliveryTime),
      distance,
      distanceInKm,
      distanceMeters: Number.isFinite(restaurant.distanceMeters)
        ? restaurant.distanceMeters
        : (distanceInKm !== null ? distanceInKm * 1000 : null),
      distanceSource,
      image,
      images: allImages,
      priceRange: restaurant.priceRange || "$$",
      featuredDish: restaurant.featuredDish || null,
      featuredPrice: restaurant.featuredPrice || null,
      offer: offerText,
      slug: restaurant.slug,
      restaurantId: restaurant.restaurantId,
      pureVegRestaurant: restaurant.pureVegRestaurant === true,
      location: restaurant.location,
      isActive: restaurant.isActive !== false,
      isAcceptingOrders: restaurant.isAcceptingOrders !== false,
      outletTimings: restaurant.outletTimings || null,
    };
  });

  return transformed;
}

export function recalculateRestaurantDistances(restaurants, location) {
  if (!location?.latitude || !location?.longitude) return restaurants;
  if (!Array.isArray(restaurants) || restaurants.length === 0) return restaurants;

  return restaurants.map((restaurant) => {
    if (
      restaurant.distanceSource === "road" ||
      restaurant.distanceSource === "geo" ||
      restaurant.distanceSource === "api"
    ) {
      return restaurant;
    }

    const resolved = resolveRestaurantDistance(restaurant, location);
    if (!resolved.distance) return restaurant;

    return {
      ...restaurant,
      distance: resolved.distance,
      distanceInKm: resolved.distanceInKm,
      distanceMeters: resolved.distanceInKm !== null ? resolved.distanceInKm * 1000 : null,
      distanceSource: resolved.distanceSource,
    };
  });
}
