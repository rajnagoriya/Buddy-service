import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { useLocationSelector } from "@food/components/user/UserLayout"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import { useLocation as useLocationHook } from "@food/hooks/useLocation"
import { useProfile } from "@food/context/ProfileContext"
import { diningAPI } from "@food/api"
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability"
import DiningFiltersBar from "@food/components/user/dining/DiningFiltersBar"
import DiningRestaurantCard, { DiningRestaurantSkeleton } from "@food/components/user/dining/DiningRestaurantCard"
import { formatDistanceKm } from "@food/components/user/dining/diningUtils"
import DiningCategoryHeader, {
  DiningCategoryHero,
  DiningCategoryEmpty,
} from "@food/components/user/dining/DiningCategoryShell"

const slugifyValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

const formatCategoryHeading = (category) =>
  String(category || "dining")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const getCoordinates = (restaurant) => {
  const latitude = restaurant?.location?.latitude
  const longitude = restaurant?.location?.longitude
  if (typeof latitude === "number" && typeof longitude === "number") {
    return { latitude, longitude }
  }
  const coords = restaurant?.location?.coordinates
  if (Array.isArray(coords) && coords.length === 2) {
    return { latitude: coords[1], longitude: coords[0] }
  }
  return null
}

const getDistanceKm = (userLocation, restaurant) => {
  const userLat = Number(userLocation?.latitude)
  const userLng = Number(userLocation?.longitude)
  const restaurantCoords = getCoordinates(restaurant)
  if (!Number.isFinite(userLat) || !Number.isFinite(userLng) || !restaurantCoords) {
    return Number.POSITIVE_INFINITY
  }
  const toRadians = (value) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRadians(restaurantCoords.latitude - userLat)
  const dLng = toRadians(restaurantCoords.longitude - userLng)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(userLat)) *
      Math.cos(toRadians(restaurantCoords.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const CATEGORY_DESCRIPTIONS = {
  "casual-dining": "Relaxed restaurants perfect for everyday meals with friends and family.",
  "family-dining": "Spacious spots with menus everyone will enjoy — ideal for group dining.",
  "fine-dining": "Premium experiences with curated menus and elevated ambience.",
  "cafe": "Coffee, snacks, and light bites in cosy café settings.",
}

export default function DiningCategory() {
  const { category } = useParams()
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const { openLocationSelector } = useLocationSelector()
  const { location } = useLocationHook()
  const { addFavorite, removeFavorite, isFavorite } = useProfile()

  const [restaurants, setRestaurants] = useState([])
  const [categoryMeta, setCategoryMeta] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeFilters, setActiveFilters] = useState(new Set())

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const params = category
          ? location?.city
            ? { category, city: location.city }
            : { category }
          : location?.city
            ? { city: location.city }
            : {}

        const [restaurantsRes, categoriesRes] = await Promise.all([
          diningAPI.getRestaurants(params),
          diningAPI.getCategories().catch(() => null),
        ])

        if (categoriesRes?.data?.success && Array.isArray(categoriesRes.data.data)) {
          const match = categoriesRes.data.data.find(
            (item) => slugifyValue(item?.slug || item?.name) === slugifyValue(category),
          )
          if (match) setCategoryMeta(match)
        }

        if (restaurantsRes?.data?.success) {
          const payload = restaurantsRes.data.data
          const list = Array.isArray(payload?.restaurants)
            ? payload.restaurants
            : Array.isArray(payload)
              ? payload
              : []
          setRestaurants(list)
        } else {
          setRestaurants([])
        }
      } catch {
        setError("Failed to load dining restaurants")
        setRestaurants([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchRestaurants()
  }, [category, location?.city])

  const heading = useMemo(() => categoryMeta?.name || formatCategoryHeading(category), [categoryMeta, category])
  const description = useMemo(
    () =>
      categoryMeta?.description ||
      CATEGORY_DESCRIPTIONS[slugifyValue(category)] ||
      "Explore restaurants in this dining category and book your table.",
    [categoryMeta, category],
  )

  const normalizedRestaurants = useMemo(() => {
    return restaurants
      .filter((r) => String(r?.restaurantName || r?.name || "").trim())
      .sort((a, b) => {
        const aEnabled = a?.diningSettings?.isEnabled === true
        const bEnabled = b?.diningSettings?.isEnabled === true
        if (aEnabled && !bEnabled) return -1
        if (!aEnabled && bEnabled) return 1
        return 0
      })
      .map((restaurant, index) => {
        const distanceKm = getDistanceKm(location, restaurant)
        const availability = getRestaurantAvailabilityStatus(restaurant)
        const restaurantName = String(restaurant?.restaurantName || restaurant?.name || "").trim()

        return {
          ...restaurant,
          id: restaurant._id || restaurant.id || `restaurant-${index}`,
          name: restaurantName,
          slug: String(restaurant?.restaurantNameNormalized || "").trim() || slugifyValue(restaurantName),
          cuisine:
            Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0
              ? restaurant.cuisines.join(", ")
              : "Multi-cuisine",
          image: String(
            restaurant?.coverImages?.[0]?.url ||
              restaurant?.coverImages?.[0] ||
              restaurant?.coverImage ||
              restaurant?.menuImages?.[0]?.url ||
              restaurant?.menuImages?.[0] ||
              restaurant?.profileImage?.url ||
              restaurant?.profileImage ||
              "",
          ).trim(),
          offer: String(restaurant?.offer || "Pre-book table").trim(),
          featuredDish: String(restaurant?.featuredDish || "Chef's special").trim(),
          featuredPrice: Number(restaurant?.featuredPrice || 0),
          rating: Number(restaurant?.rating || restaurant?.avgRating || 0),
          deliveryTime: String(
            restaurant?.estimatedDeliveryTime ||
              restaurant?.deliveryTime ||
              (restaurant?.estimatedDeliveryTimeMinutes
                ? `${restaurant.estimatedDeliveryTimeMinutes} mins`
                : "30-40 mins"),
          ).trim(),
          distanceValue: distanceKm,
          distance: formatDistanceKm(distanceKm),
          diningType: slugifyValue(category) || "family-dining",
          isEnabled: restaurant?.diningSettings?.isEnabled !== false,
          availability,
          costForTwo: restaurant?.costForTwo,
        }
      })
  }, [restaurants, location, category])

  const filteredRestaurants = useMemo(() => {
    let list = [...normalizedRestaurants]

    if (activeFilters.has("delivery-under-30")) {
      list = list.filter((r) => {
        const match = String(r.deliveryTime || "").match(/(\d+)/)
        return match && parseInt(match[1], 10) <= 30
      })
    }
    if (activeFilters.has("rating-4-plus")) {
      list = list.filter((r) => r.rating >= 4)
    }
    if (activeFilters.has("distance-under-2km")) {
      list = list.filter((r) => (r.distanceValue || 0) <= 2)
    }

    return list
  }, [normalizedRestaurants, activeFilters])

  const toggleFilter = useCallback((filterId) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(filterId)) next.delete(filterId)
      else next.add(filterId)
      return next
    })
  }, [])

  const buildToggleFavorite = useCallback(
    (restaurant, restaurantSlug, favorite) => (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (favorite) {
        removeFavorite(restaurantSlug)
      } else {
        addFavorite({
          slug: restaurantSlug,
          name: restaurant.name,
          cuisine: restaurant.cuisine,
          rating: restaurant.rating,
          deliveryTime: restaurant.deliveryTime,
          distance: restaurant.distance,
          image: restaurant.image,
        })
      }
    },
    [addFavorite, removeFavorite],
  )

  const cityName = location?.city || "Select location"

  return (
    <AnimatedPage className="min-h-screen bg-[#FAFAFA] pb-28 dark:bg-[#0a0a0a]">
      <DiningCategoryHeader
        cityName={cityName}
        onBack={goBack}
        onLocationClick={openLocationSelector}
      />

      <DiningFiltersBar
        loading={isLoading}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        onOpenFilters={() => navigate("/food/user/dining")}
      />

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 space-y-5">
        <DiningCategoryHero
          title={heading}
          description={description}
          count={filteredRestaurants.length}
          categoryImage={categoryMeta?.imageUrl || categoryMeta?.image || ""}
        />

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <DiningRestaurantSkeleton key={`skeleton-${i}`} index={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-12 text-center text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
            {error}
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <DiningCategoryEmpty title={heading} />
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {filteredRestaurants.map((restaurant, index) => {
                const restaurantSlug = restaurant.slug
                const favorite = isFavorite(restaurantSlug)
                return (
                  <DiningRestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    index={index}
                    favorite={favorite}
                    onToggleFavorite={buildToggleFavorite(restaurant, restaurantSlug, favorite)}
                    variant="mobile"
                  />
                )
              })}
            </div>

            <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredRestaurants.map((restaurant, index) => {
                const restaurantSlug = restaurant.slug
                const favorite = isFavorite(restaurantSlug)
                return (
                  <DiningRestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    index={index}
                    favorite={favorite}
                    onToggleFavorite={buildToggleFavorite(restaurant, restaurantSlug, favorite)}
                    variant="desktop"
                  />
                )
              })}
            </div>
          </>
        )}
      </div>
    </AnimatedPage>
  )
}
