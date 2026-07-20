import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { useLocation as useLocationHook } from "@food/hooks/useLocation"
import { useProfile } from "@food/context/ProfileContext"
import { useInfinitePagination } from "@food/hooks/useInfinitePagination"
import { diningAPI } from "@food/api"
import DiningQuickActions from "@food/components/user/dining/DiningQuickActions"
import DiningHeroBanner from "@food/components/user/dining/DiningHeroBanner"
import DiningCategoryRow from "@food/components/user/dining/DiningCategoryRow"
import DiningFiltersBar from "@food/components/user/dining/DiningFiltersBar"
import DiningFilterSheet from "@food/components/user/dining/DiningFilterSheet"
import DiningRestaurantCard, { DiningRestaurantSkeleton } from "@food/components/user/dining/DiningRestaurantCard"
import { formatDistanceKm } from "@food/components/user/dining/diningUtils"

const PAGE_LIMIT = 12

const slugifyValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

const roundCoord = (value, digits = 3) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const p = 10 ** digits
  return Math.round(n * p) / p
}

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

const mapBanners = (banners) =>
  (Array.isArray(banners) ? banners : [])
    .map((banner, index) => {
      const imageUrl = String(banner?.imageUrl || "").trim()
      if (!imageUrl) return null
      return {
        id: String(banner?._id || banner?.id || `dining-banner-${index}`),
        imageUrl,
        tagline: String(banner?.title || banner?.tagline || "").trim(),
        promoCode: String(banner?.ctaText || banner?.promoCode || "").trim(),
      }
    })
    .filter(Boolean)

const loadingRestaurantCards = Array.from({ length: 6 }, (_, index) => `restaurant-skeleton-${index}`)

function readStoredLocation() {
  try {
    const raw = localStorage.getItem("userLocation")
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

export default function Dining() {
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [activeFilterTab, setActiveFilterTab] = useState("sort")
  const [sortBy, setSortBy] = useState(null)
  const [selectedCuisine, setSelectedCuisine] = useState(null)
  const { location } = useLocationHook()
  const { addFavorite, removeFavorite, isFavorite } = useProfile()

  const [categories, setCategories] = useState([])
  const [diningHeroBanners, setDiningHeroBanners] = useState([])
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0)
  const autoSlideIntervalRef = useRef(null)
  const touchStartXRef = useRef(0)
  const touchStartYRef = useRef(0)
  const touchEndXRef = useRef(0)
  const touchEndYRef = useRef(0)
  const isBannerSwipingRef = useRef(false)

  const diningLocation = useMemo(() => {
    const fromHook = location || {}
    const cityFromHook = String(fromHook?.city || "").trim()
    const hasValidHookCity = cityFromHook && cityFromHook.toLowerCase() !== "current location"
    if (hasValidHookCity) return fromHook
    const stored = readStoredLocation()
    return stored ? { ...fromHook, ...stored } : fromHook
  }, [location?.city, location?.latitude, location?.longitude])

  const restaurantParams = useMemo(() => {
    const lat = roundCoord(diningLocation?.latitude)
    const lng = roundCoord(diningLocation?.longitude)
    const cityRaw = String(diningLocation?.city || "").trim()
    const city = cityRaw && cityRaw.toLowerCase() !== "current location" ? cityRaw : ""
    const params = {}
    if (city) params.city = city
    if (lat != null && lng != null) {
      params.lat = lat
      params.lng = lng
    }
    return params
  }, [diningLocation?.city, diningLocation?.latitude, diningLocation?.longitude])

  const locationKey = useMemo(
    () => `${restaurantParams.city || ""}|${restaurantParams.lat ?? ""}|${restaurantParams.lng ?? ""}`,
    [restaurantParams],
  )

  const fetchPage = useCallback(
    async (page) => {
      const response = await diningAPI.getHome({
        ...restaurantParams,
        page,
        limit: PAGE_LIMIT,
      })
      const payload = response?.data?.success ? response.data.data || {} : {}

      if (page === 1) {
        setDiningHeroBanners(mapBanners(payload.banners))
        setCategories(Array.isArray(payload.categories) ? payload.categories : [])
      }

      return {
        items: Array.isArray(payload.restaurants) ? payload.restaurants : [],
        pagination: payload.pagination,
      }
    },
    [restaurantParams],
  )

  const {
    items: restaurantList,
    isLoading: loading,
    isLoadingMore,
    hasNextPage,
    loadMoreRef,
    pagination,
  } = useInfinitePagination({
    queryKey: locationKey,
    fetchPage,
    initialLimit: PAGE_LIMIT,
  })

  const safeCategories = useMemo(
    () =>
      (Array.isArray(categories) ? categories : [])
        .filter((category) => String(category?.name || "").trim().length > 0)
        .map((category) => ({
          ...category,
          name: String(category?.name || "").trim(),
          slug: slugifyValue(category?.slug || category?.name),
          imageUrl: String(category?.imageUrl || "").trim(),
        })),
    [categories],
  )

  const normalizedRestaurantList = useMemo(() => {
    return (Array.isArray(restaurantList) ? restaurantList : [])
      .filter((restaurant) => String(restaurant?.restaurantName || restaurant?.name || "").trim().length > 0)
      .map((restaurant, index) => {
        const distanceKm = getDistanceKm(diningLocation, restaurant)
        const restaurantName = String(restaurant?.restaurantName || restaurant?.name || "").trim()
        const rawType = restaurant?.diningSettings?.diningType
        let types = []
        if (Array.isArray(rawType)) types = rawType
        else if (typeof rawType === "string" && rawType.trim()) types = rawType.split(",")
        else if (Array.isArray(restaurant?.categories)) {
          types = restaurant.categories.map((c) => (typeof c === "string" ? c : c.slug || c.name))
        }
        const uniqueTypes = Array.from(new Set(types.map((t) => slugifyValue(t)).filter(Boolean)))

        return {
          ...restaurant,
          id: restaurant?._id || restaurant?.id || `restaurant-${index}`,
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
          costForTwo: Number(restaurant?.costForTwo || 0),
          distanceValue: distanceKm,
          distance: formatDistanceKm(distanceKm),
          diningType: uniqueTypes[0] || "family-dining",
          isEnabled: restaurant?.diningSettings?.isEnabled === true,
        }
      })
  }, [restaurantList, diningLocation])

  const nearbyPopularRestaurants = useMemo(() => {
    const within10Km = normalizedRestaurantList
      .filter((restaurant) => Number.isFinite(restaurant.distanceValue) && restaurant.distanceValue <= 10)
      .sort((a, b) => a.distanceValue - b.distanceValue)
    return within10Km.length > 0 ? within10Km : normalizedRestaurantList
  }, [normalizedRestaurantList])

  const toggleFilter = useCallback((filterId) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(filterId)) next.delete(filterId)
      else next.add(filterId)
      return next
    })
  }, [])

  const hasClientFilters =
    activeFilters.size > 0 || Boolean(sortBy) || Boolean(selectedCuisine)

  const filteredRestaurants = useMemo(() => {
    let filtered = [...nearbyPopularRestaurants]

    if (activeFilters.has("distance-under-1km")) {
      filtered = filtered.filter((r) => (r.distanceValue || 0) <= 1)
    }
    if (activeFilters.has("distance-under-2km")) {
      filtered = filtered.filter((r) => (r.distanceValue || 0) <= 2)
    }
    if (activeFilters.has("distance-under-5km")) {
      filtered = filtered.filter((r) => (r.distanceValue || 0) <= 5)
    }
    if (activeFilters.has("rating-35-plus")) {
      filtered = filtered.filter((r) => r.rating >= 3.5)
    }
    if (activeFilters.has("rating-4-plus")) {
      filtered = filtered.filter((r) => r.rating >= 4)
    }
    if (activeFilters.has("rating-45-plus")) {
      filtered = filtered.filter((r) => r.rating >= 4.5)
    }
    if (selectedCuisine) {
      filtered = filtered.filter((r) => r.cuisine.toLowerCase().includes(selectedCuisine.toLowerCase()))
    }

    if (sortBy === "rating-high") {
      filtered.sort((a, b) => b.rating - a.rating)
    } else if (sortBy === "distance") {
      filtered.sort((a, b) => a.distanceValue - b.distanceValue)
    }

    return filtered
  }, [nearbyPopularRestaurants, activeFilters, selectedCuisine, sortBy])

  const resultCount = hasClientFilters
    ? filteredRestaurants.length
    : Number(pagination?.total) || filteredRestaurants.length

  useEffect(() => {
    setCurrentBannerIndex((prev) => {
      if (diningHeroBanners.length === 0) return 0
      return Math.min(prev, diningHeroBanners.length - 1)
    })
  }, [diningHeroBanners.length])

  const startBannerAutoSlide = useCallback(() => {
    if (autoSlideIntervalRef.current) clearInterval(autoSlideIntervalRef.current)
    if (diningHeroBanners.length <= 1) return
    autoSlideIntervalRef.current = setInterval(() => {
      if (!isBannerSwipingRef.current) {
        setCurrentBannerIndex((prev) => (prev + 1) % diningHeroBanners.length)
      }
    }, 4000)
  }, [diningHeroBanners.length])

  useEffect(() => {
    startBannerAutoSlide()
    return () => {
      if (autoSlideIntervalRef.current) clearInterval(autoSlideIntervalRef.current)
    }
  }, [startBannerAutoSlide])

  const handleBannerTouchStart = useCallback(
    (event) => {
      if (diningHeroBanners.length <= 1) return
      touchStartXRef.current = event.touches[0].clientX
      touchStartYRef.current = event.touches[0].clientY
      touchEndXRef.current = event.touches[0].clientX
      touchEndYRef.current = event.touches[0].clientY
      isBannerSwipingRef.current = true
    },
    [diningHeroBanners.length],
  )

  const handleBannerTouchMove = useCallback((event) => {
    if (!isBannerSwipingRef.current) return
    touchEndXRef.current = event.touches[0].clientX
    touchEndYRef.current = event.touches[0].clientY
  }, [])

  const handleBannerTouchEnd = useCallback(() => {
    if (!isBannerSwipingRef.current || diningHeroBanners.length <= 1) {
      isBannerSwipingRef.current = false
      return
    }
    const deltaX = touchEndXRef.current - touchStartXRef.current
    const deltaY = Math.abs(touchEndYRef.current - touchStartYRef.current)
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > deltaY) {
      setCurrentBannerIndex((prev) =>
        deltaX > 0
          ? (prev - 1 + diningHeroBanners.length) % diningHeroBanners.length
          : (prev + 1) % diningHeroBanners.length,
      )
      startBannerAutoSlide()
    }
    isBannerSwipingRef.current = false
  }, [diningHeroBanners.length, startBannerAutoSlide])

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
          distance: restaurant.distance,
          image: restaurant.image,
        })
      }
    },
    [addFavorite, removeFavorite],
  )

  const clearFilters = useCallback(() => {
    setActiveFilters(new Set())
    setSortBy(null)
    setSelectedCuisine(null)
  }, [])

  const bannerProps = {
    banners: diningHeroBanners,
    loading,
    currentIndex: currentBannerIndex,
    onTouchStart: handleBannerTouchStart,
    onTouchMove: handleBannerTouchMove,
    onTouchEnd: handleBannerTouchEnd,
    onDotClick: (index) => {
      setCurrentBannerIndex(index)
      startBannerAutoSlide()
    },
  }

  return (
    <AnimatedPage className="relative min-h-dvh bg-[#f7f7f5] pb-40 dark:bg-[#0a0a0a]">
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(200%); }
        }
      `}</style>

      <div className="food-mobile-hero md:bg-transparent">
        <div className="food-mobile-hero__glow food-mobile-hero__glow--left md:hidden" aria-hidden />
        <div className="food-mobile-hero__glow food-mobile-hero__glow--right md:hidden" aria-hidden />
        <div className="food-mobile-hero__pattern md:hidden" aria-hidden />

        <div className="mx-auto max-w-7xl pt-[calc(env(safe-area-inset-top,0px)+4.5rem)] md:pt-6">
          <div className="mb-3 px-4 md:mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-800/80 dark:text-amber-400">
              Table booking
            </p>
            <h1 className="mt-0.5 text-xl font-extrabold text-gray-900 dark:text-white md:text-2xl">
              Discover places to dine
            </h1>
          </div>

          <DiningFiltersBar
            loading={loading}
            activeFilters={activeFilters}
            onToggleFilter={toggleFilter}
            onOpenFilters={() => setIsFilterOpen(true)}
          />

          <div className="mt-3">
            <DiningQuickActions />
          </div>

          <div className="mt-3 pb-4 md:mt-5">
            <DiningHeroBanner {...bannerProps} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl pb-6">
        <DiningCategoryRow categories={safeCategories} loading={loading} />

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between px-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-green-700 dark:text-green-400">
                Near you
              </p>
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white sm:text-lg">
                Popular restaurants
              </h2>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-gray-500 shadow-sm dark:bg-[#1a1a1a] dark:text-gray-400">
              {resultCount}
            </span>
          </div>

          <div className="mt-3 px-4">
            {loading ? (
              <>
                <div className="flex flex-col gap-3 md:hidden">
                  {loadingRestaurantCards.map((key, index) => (
                    <DiningRestaurantSkeleton key={key} index={index} />
                  ))}
                </div>
                <div className="hidden gap-5 md:grid md:grid-cols-2 lg:grid-cols-3">
                  {loadingRestaurantCards.map((key, index) => (
                    <DiningRestaurantSkeleton key={key} index={index} />
                  ))}
                </div>
              </>
            ) : filteredRestaurants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center dark:border-gray-800 dark:bg-[#1a1a1a]">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  No restaurants match your filters
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Try clearing filters or changing your location.
                </p>
                {hasClientFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 text-sm font-bold text-green-700 dark:text-green-400"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 md:hidden">
                  {filteredRestaurants.map((restaurant, index) => {
                    const restaurantSlug = restaurant.slug || encodeURIComponent(restaurant.name)
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
                <div className="hidden gap-5 md:grid md:grid-cols-2 lg:grid-cols-3">
                  {filteredRestaurants.map((restaurant, index) => {
                    const restaurantSlug = restaurant.slug || encodeURIComponent(restaurant.name)
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

                {!hasClientFilters && (
                  <div ref={loadMoreRef} className="flex h-14 items-center justify-center py-4">
                    {isLoadingMore && (
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Loading more…
                      </span>
                    )}
                    {!isLoadingMore && !hasNextPage && filteredRestaurants.length > 0 && (
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                        You&apos;re all caught up
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <DiningFilterSheet
        open={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        activeFilterTab={activeFilterTab}
        onFilterTabChange={setActiveFilterTab}
        sortBy={sortBy}
        onSortChange={setSortBy}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        selectedCuisine={selectedCuisine}
        onCuisineChange={setSelectedCuisine}
        resultCount={resultCount}
        onClear={clearFilters}
      />
    </AnimatedPage>
  )
}
