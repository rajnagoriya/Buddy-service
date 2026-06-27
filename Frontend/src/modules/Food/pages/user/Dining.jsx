import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { MapPin, Star, ArrowDownUp, Timer, IndianRupee, UtensilsCrossed } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { useLocation as useLocationHook } from "@food/hooks/useLocation"
import { useZone } from "@food/hooks/useZone"
import { useProfile } from "@food/context/ProfileContext"
import { diningAPI } from "@food/api"
import DiningQuickActions from "@food/components/user/dining/DiningQuickActions"
import DiningHeroBanner from "@food/components/user/dining/DiningHeroBanner"
import DiningCategoryRow from "@food/components/user/dining/DiningCategoryRow"
import DiningFiltersBar from "@food/components/user/dining/DiningFiltersBar"
import DiningRestaurantCard, { DiningRestaurantSkeleton } from "@food/components/user/dining/DiningRestaurantCard"
import { formatDistanceKm } from "@food/components/user/dining/diningUtils"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const slugifyValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

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

const loadingRestaurantCards = Array.from({ length: 6 }, (_, index) => `restaurant-skeleton-${index}`)

export default function Dining() {
  const navigate = useNavigate()
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [activeFilterTab, setActiveFilterTab] = useState('sort')
  const [sortBy, setSortBy] = useState(null)
  const [selectedCuisine, setSelectedCuisine] = useState(null)
  const filterSectionRefs = useRef({})
  const rightContentRef = useRef(null)
  const { location } = useLocationHook()
  const { zoneId } = useZone(location)
  const { addFavorite, removeFavorite, isFavorite } = useProfile()

  const [categories, setCategories] = useState([])
  const [restaurantList, setRestaurantList] = useState([])
  const [loading, setLoading] = useState(true)
  const [diningHeroBanners, setDiningHeroBanners] = useState([])
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0)
  const autoSlideIntervalRef = useRef(null)
  const touchStartXRef = useRef(0)
  const touchStartYRef = useRef(0)
  const touchEndXRef = useRef(0)
  const touchEndYRef = useRef(0)
  const isBannerSwipingRef = useRef(false)

  const resolveLocationForDining = useCallback(() => {
    const fromHook = location || {}
    const cityFromHook = String(fromHook?.city || "").trim()
    const hasValidHookCity = cityFromHook && cityFromHook.toLowerCase() !== "current location"

    if (hasValidHookCity) {
      return fromHook
    }

    try {
      const raw = localStorage.getItem("userLocation")
      if (!raw) return fromHook
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === "object" ? { ...fromHook, ...parsed } : fromHook
    } catch {
      return fromHook
    }
  }, [location])

  useEffect(() => {
    const fetchDiningData = async () => {
      try {
        setLoading(true)

        const activeLocation = resolveLocationForDining()
        const lat = Number(activeLocation?.latitude)
        const lng = Number(activeLocation?.longitude)
        const cityRaw = String(activeLocation?.city || "").trim()
        const city = cityRaw && cityRaw.toLowerCase() !== "current location" ? cityRaw : ""

        const restaurantParams = {}
        if (city) restaurantParams.city = city
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          restaurantParams.lat = lat
          restaurantParams.lng = lng
        }

        const [bannerResponse, cats, rests] = await Promise.all([
          diningAPI.getHeroBanners().catch(() => ({ data: { success: false, data: { banners: [] } } })),
          diningAPI.getCategories(),
          diningAPI.getRestaurants(restaurantParams),
        ])

        const heroBanners = Array.isArray(bannerResponse?.data?.data?.banners)
          ? bannerResponse.data.data.banners
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
          : []

        setDiningHeroBanners(heroBanners)
        setCategories(cats?.data?.success ? (cats.data.data || []) : [])
        setRestaurantList(rests?.data?.success ? (rests.data.data || []) : [])
      } catch (error) {
        debugError("Failed to fetch dining data", error)
        setDiningHeroBanners([])
        setCategories([])
        setRestaurantList([])
      } finally {
        setLoading(false)
      }
    }
    fetchDiningData()
  }, [resolveLocationForDining, zoneId])

  const safeCategories = useMemo(() => {
    return (Array.isArray(categories) ? categories : [])
      .filter((category) => {
        const categoryName = String(category?.name || "").trim()
        return categoryName.length > 0
      })
      .map((category, index) => ({
        ...category,
        name: String(category?.name || "").trim(),
        slug: String(category?.slug || category?.name || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
        imageUrl: String(category?.imageUrl || "").trim()
      }))
  }, [categories])

  const normalizedRestaurantList = useMemo(() => {
    return (Array.isArray(restaurantList) ? restaurantList : [])
      .filter((restaurant) => {
        const name = String(restaurant?.restaurantName || restaurant?.name || "").trim()
        return name.length > 0
      })
      .sort((a, b) => {
        const aEnabled = a?.diningSettings?.isEnabled === true
        const bEnabled = b?.diningSettings?.isEnabled === true
        if (aEnabled && !bEnabled) return -1
        if (!aEnabled && bEnabled) return 1
        return 0
      })
      .map((restaurant, index) => {
        const distanceKm = getDistanceKm(location, restaurant)
        const restaurantName = String(restaurant?.restaurantName || restaurant?.name || "").trim()
        return {
          ...restaurant,
          id: restaurant?._id || restaurant?.id || `restaurant-${index}`,
          name: restaurantName,
          slug: String(restaurant?.restaurantNameNormalized || "").trim() || slugifyValue(restaurantName),
          cuisine: Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0
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
            ""
          ).trim(),
          offer: String(restaurant?.offer || "Pre-book table").trim(),
          featuredDish: String(restaurant?.featuredDish || "Chef's special").trim(),
          featuredPrice: Number(restaurant?.featuredPrice || 0),
          rating: Number(restaurant?.rating || restaurant?.avgRating || 0),
          deliveryTime: String(
            restaurant?.estimatedDeliveryTime ||
            restaurant?.deliveryTime ||
            (restaurant?.estimatedDeliveryTimeMinutes ? `${restaurant.estimatedDeliveryTimeMinutes} mins` : "30-40 mins")
          ).trim(),
          distanceValue: distanceKm,
          distance: formatDistanceKm(distanceKm),
          diningType: (() => {
            const rawType = restaurant?.diningSettings?.diningType
            let types = []
            if (Array.isArray(rawType)) {
              types = rawType
            } else if (typeof rawType === "string" && rawType.trim()) {
              types = rawType.split(",")
            } else if (restaurant?.categories && Array.isArray(restaurant.categories)) {
              types = restaurant.categories.map(c => typeof c === 'string' ? c : c.slug || c.name)
            }
            
            const uniqueTypes = Array.from(new Set(types.map(t => slugifyValue(t)).filter(Boolean)))
            return uniqueTypes[0] || "family-dining"
          })(),
          isEnabled: restaurant?.diningSettings?.isEnabled === true,
        }
      })
  }, [restaurantList, location])

  const categoryRestaurantKeys = useMemo(() => {
    const keySet = new Set()

    normalizedRestaurantList.forEach((restaurant) => {
      const rawCategories = []

      // 1. Existing categories from the platform categories mapping
      if (Array.isArray(restaurant?.categories)) {
        rawCategories.push(...restaurant.categories)
      }

      // 2. New diningType array from diningSettings
      const dSettingsType = restaurant?.diningSettings?.diningType
      if (Array.isArray(dSettingsType)) {
        rawCategories.push(...dSettingsType)
      } else if (typeof dSettingsType === "string" && dSettingsType) {
        rawCategories.push(dSettingsType)
      }

      rawCategories.forEach((category) => {
        if (!category) return

        if (typeof category === "string") {
          const normalized = slugifyValue(category)
          if (normalized) keySet.add(normalized)
          return
        }

        if (typeof category === "object") {
          const slug = slugifyValue(category?.slug || category?.name || category?.title || "")
          if (slug) keySet.add(slug)
        }
      })
    })

    return keySet
  }, [normalizedRestaurantList])

  const filteredCategories = safeCategories

  const nearbyPopularRestaurants = useMemo(() => {
    const within10Km = normalizedRestaurantList
      .filter((restaurant) => Number.isFinite(restaurant.distanceValue) && restaurant.distanceValue <= 10)
      .sort((a, b) => a.distanceValue - b.distanceValue)

    return within10Km.length > 0 ? within10Km : normalizedRestaurantList
  }, [normalizedRestaurantList])

  const toggleFilter = (filterId) => {
    setActiveFilters(prev => {
      const newSet = new Set(prev)
      if (newSet.has(filterId)) {
        newSet.delete(filterId)
      } else {
        newSet.add(filterId)
      }
      return newSet
    })
  }

  const filteredRestaurants = useMemo(() => {
    let filtered = [...nearbyPopularRestaurants]

    if (activeFilters.has('delivery-under-30')) {
      filtered = filtered.filter(r => {
        const timeStr = String(r.deliveryTime || '')
        const timeMatch = timeStr.match(/(\d+)/)
        return timeMatch && parseInt(timeMatch[1], 10) <= 30
      })
    }
    if (activeFilters.has('delivery-under-45')) {
      filtered = filtered.filter(r => {
        const timeStr = String(r.deliveryTime || '')
        const timeMatch = timeStr.match(/(\d+)/)
        return timeMatch && parseInt(timeMatch[1], 10) <= 45
      })
    }
    if (activeFilters.has('distance-under-1km')) {
      filtered = filtered.filter(r => (r.distanceValue || 0) <= 1.0)
    }
    if (activeFilters.has('distance-under-2km')) {
      filtered = filtered.filter(r => (r.distanceValue || 0) <= 2.0)
    }
    if (activeFilters.has('rating-35-plus')) {
      filtered = filtered.filter(r => r.rating >= 3.5)
    }
    if (activeFilters.has('rating-4-plus')) {
      filtered = filtered.filter(r => r.rating >= 4.0)
    }
    if (activeFilters.has('rating-45-plus')) {
      filtered = filtered.filter(r => r.rating >= 4.5)
    }

    // Apply cuisine filter
    if (selectedCuisine) {
      filtered = filtered.filter(r => r.cuisine.toLowerCase().includes(selectedCuisine.toLowerCase()))
    }

    // Apply sorting
    if (sortBy === 'rating-high') {
      filtered.sort((a, b) => b.rating - a.rating)
    } else if (sortBy === 'rating-low') {
      filtered.sort((a, b) => a.rating - b.rating)
    }

    return filtered
  }, [nearbyPopularRestaurants, activeFilters, selectedCuisine, sortBy])

  useEffect(() => {
    setCurrentBannerIndex((prev) => {
      if (diningHeroBanners.length === 0) return 0
      return Math.min(prev, diningHeroBanners.length - 1)
    })
  }, [diningHeroBanners.length])

  useEffect(() => {
    if (typeof window === "undefined") return

    diningHeroBanners.forEach((banner) => {
      if (!banner?.imageUrl) return
      const img = new window.Image()
      img.src = banner.imageUrl
    })
  }, [diningHeroBanners])

  const startBannerAutoSlide = useCallback(() => {
    if (autoSlideIntervalRef.current) {
      clearInterval(autoSlideIntervalRef.current)
    }

    if (diningHeroBanners.length <= 1) return

    autoSlideIntervalRef.current = setInterval(() => {
      if (!isBannerSwipingRef.current) {
        setCurrentBannerIndex((prev) => (prev + 1) % diningHeroBanners.length)
      }
    }, 3500)
  }, [diningHeroBanners.length])

  const resetBannerAutoSlide = useCallback(() => {
    startBannerAutoSlide()
  }, [startBannerAutoSlide])

  useEffect(() => {
    startBannerAutoSlide()

    return () => {
      if (autoSlideIntervalRef.current) {
        clearInterval(autoSlideIntervalRef.current)
      }
    }
  }, [startBannerAutoSlide])

  const handleBannerTouchStart = useCallback((event) => {
    if (diningHeroBanners.length <= 1) return
    touchStartXRef.current = event.touches[0].clientX
    touchStartYRef.current = event.touches[0].clientY
    touchEndXRef.current = event.touches[0].clientX
    touchEndYRef.current = event.touches[0].clientY
    isBannerSwipingRef.current = true
  }, [diningHeroBanners.length])

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
    const minSwipeDistance = 40

    if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaX) > deltaY) {
      setCurrentBannerIndex((prev) => {
        if (deltaX > 0) {
          return (prev - 1 + diningHeroBanners.length) % diningHeroBanners.length
        }
        return (prev + 1) % diningHeroBanners.length
      })
      resetBannerAutoSlide()
    }

    isBannerSwipingRef.current = false
  }, [diningHeroBanners.length, resetBannerAutoSlide])


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
    [addFavorite, removeFavorite]
  )

  return (
    <AnimatedPage className="relative min-h-dvh bg-white pb-40 dark:bg-[#0a0a0a]">
      <style>{`
        @keyframes shimmer {
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
      
      {/* Mobile hero gradient section */}
      <div className="md:hidden food-mobile-hero">
        <div className="food-mobile-hero__glow food-mobile-hero__glow--left" aria-hidden />
        <div className="food-mobile-hero__glow food-mobile-hero__glow--right" aria-hidden />
        <div className="food-mobile-hero__pattern" aria-hidden />
        <div className="pt-[calc(env(safe-area-inset-top,0px)+4.5rem)] px-3">
          <DiningFiltersBar
            loading={loading}
            activeFilters={activeFilters}
            onToggleFilter={toggleFilter}
            onOpenFilters={() => setIsFilterOpen(true)}
          />

          <div className="mt-3">
            <DiningQuickActions />
          </div>

          <div className="mt-4 pb-4">
            <DiningHeroBanner
              banners={diningHeroBanners}
              loading={loading}
              currentIndex={currentBannerIndex}
              onTouchStart={handleBannerTouchStart}
              onTouchMove={handleBannerTouchMove}
              onTouchEnd={handleBannerTouchEnd}
              onDotClick={(index) => {
                setCurrentBannerIndex(index)
                resetBannerAutoSlide()
              }}
            />
          </div>
        </div>
      </div>

      {/* Desktop view top section */}
      <div className="hidden md:block">
        <DiningFiltersBar
          loading={loading}
          activeFilters={activeFilters}
          onToggleFilter={toggleFilter}
          onOpenFilters={() => setIsFilterOpen(true)}
        />

        <div className="mt-3 md:mt-4">
          <DiningQuickActions />
        </div>

        <DiningHeroBanner
          banners={diningHeroBanners}
          loading={loading}
          currentIndex={currentBannerIndex}
          onTouchStart={handleBannerTouchStart}
          onTouchMove={handleBannerTouchMove}
          onTouchEnd={handleBannerTouchEnd}
          onDotClick={(index) => {
            setCurrentBannerIndex(index)
            resetBannerAutoSlide()
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl pb-6">
        <DiningCategoryRow categories={filteredCategories} loading={loading} />

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between px-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">Near you</p>
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white sm:text-lg">Popular restaurants within 10 km</h2>
            </div>
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{filteredRestaurants.length} places</span>
          </div>

          <div className="mt-4 px-4">
            {loading ? (
              <>
                <div className="flex flex-col gap-3 md:hidden">
                  {loadingRestaurantCards.map((key, index) => (
                    <DiningRestaurantSkeleton key={key} index={index} />
                  ))}
                </div>
                <div className="hidden gap-6 md:grid md:grid-cols-2 lg:grid-cols-3">
                  {loadingRestaurantCards.map((key, index) => (
                    <DiningRestaurantSkeleton key={key} index={index} />
                  ))}
                </div>
              </>
            ) : filteredRestaurants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 px-6 py-12 text-center text-sm font-medium text-gray-500 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-gray-400">
                No popular dining restaurants were found within 10 km for the current location.
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
                <div className="hidden gap-6 md:grid md:grid-cols-2 lg:grid-cols-3">
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
              </>
            )}
          </div>
        </section>
      </div>
      {/* Filter Modal */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-[100]" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsFilterOpen(false)}
          />

          {/* Modal Content */}
          <div className="absolute bottom-0 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-4xl bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl max-h-[85vh] md:max-h-[90vh] flex flex-col animate-[slideUp_0.3s_ease-out]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 md:px-6 py-4 md:py-5 border-b dark:border-gray-800">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Filters and sorting</h2>
              <button
                onClick={() => {
                  setActiveFilters(new Set())
                  setSortBy(null)
                  setSelectedCuisine(null)
                }}
                className="text-[#16A34A] font-medium text-sm md:text-base"
              >
                Clear all
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Sidebar - Tabs */}
              <div className="w-24 sm:w-28 md:w-32 bg-gray-50 dark:bg-[#0a0a0a] border-r dark:border-gray-800 flex flex-col">
                {[
                  { id: 'sort', label: 'Sort By', icon: ArrowDownUp },
                  { id: 'time', label: 'Time', icon: Timer },
                  { id: 'rating', label: 'Rating', icon: Star },
                  { id: 'distance', label: 'Distance', icon: MapPin },
                  { id: 'price', label: 'Dish Price', icon: IndianRupee },
                  { id: 'cuisine', label: 'Cuisine', icon: UtensilsCrossed },
                ].map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeFilterTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFilterTab(tab.id)}
                      className={`flex flex-col items-center gap-1 py-4 px-2 text-center relative transition-colors ${isActive ? 'bg-white dark:bg-[#1a1a1a] text-[#16A34A]' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#16A34A] rounded-r" />
                      )}
                      <Icon className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.5} />
                      <span className="text-xs md:text-sm font-medium leading-tight">{tab.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Right Content Area - Scrollable */}
              <div ref={rightContentRef} className="flex-1 overflow-y-auto p-4 md:p-6">
                {/* Sort By Tab */}
                {activeFilterTab === 'sort' && (
                  <div className="space-y-4 mb-8">
                    <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Sort by</h3>
                    <div className="flex flex-col gap-3 md:gap-4">
                      {[
                        { id: null, label: 'Relevance' },
                        { id: 'rating-high', label: 'Rating: High to Low' },
                        { id: 'rating-low', label: 'Rating: Low to High' },
                      ].map((option) => (
                        <button
                          key={option.id || 'relevance'}
                          onClick={() => setSortBy(option.id)}
                          className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${sortBy === option.id
                            ? 'border-[#16A34A] bg-[#F0FDF4] dark:bg-[#16A34A]/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-[#16A34A]'
                            }`}
                        >
                          <span className={`text-sm md:text-base font-medium ${sortBy === option.id ? 'text-[#16A34A]' : 'text-gray-700 dark:text-gray-300'}`}>
                            {option.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Time Tab */}
                {activeFilterTab === 'time' && (
                  <div className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Estimated Time</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => toggleFilter('delivery-under-30')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('delivery-under-30')
                          ? 'border-[#16A34A] bg-[#F0FDF4] dark:bg-[#16A34A]/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-[#16A34A]'
                          }`}
                      >
                        <Timer className={`h-6 w-6 ${activeFilters.has('delivery-under-30') ? 'text-[#16A34A]' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                        <span className={`text-sm font-medium ${activeFilters.has('delivery-under-30') ? 'text-[#16A34A]' : 'text-gray-700 dark:text-gray-300'}`}>Under 30 mins</span>
                      </button>
                      <button
                        onClick={() => toggleFilter('delivery-under-45')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('delivery-under-45')
                          ? 'border-[#16A34A] bg-[#F0FDF4] dark:bg-[#16A34A]/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-[#16A34A]'
                          }`}
                      >
                        <Timer className={`h-6 w-6 ${activeFilters.has('delivery-under-45') ? 'text-[#16A34A]' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                        <span className={`text-sm font-medium ${activeFilters.has('delivery-under-45') ? 'text-[#16A34A]' : 'text-gray-700 dark:text-gray-300'}`}>Under 45 mins</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Rating Tab */}
                {activeFilterTab === 'rating' && (
                  <div className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Restaurant Rating</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => toggleFilter('rating-35-plus')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('rating-35-plus')
                          ? 'border-[#16A34A] bg-[#F0FDF4] dark:bg-[#16A34A]/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-[#16A34A]'
                          }`}
                      >
                        <Star className={`h-6 w-6 ${activeFilters.has('rating-35-plus') ? 'text-[#16A34A] fill-[#16A34A]' : 'text-gray-400 dark:text-gray-500'}`} />
                        <span className={`text-sm font-medium ${activeFilters.has('rating-35-plus') ? 'text-[#16A34A]' : 'text-gray-700 dark:text-gray-300'}`}>Rated 3.5+</span>
                      </button>
                      <button
                        onClick={() => toggleFilter('rating-4-plus')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('rating-4-plus')
                          ? 'border-[#16A34A] bg-[#F0FDF4] dark:bg-[#16A34A]/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-[#16A34A]'
                          }`}
                      >
                        <Star className={`h-6 w-6 ${activeFilters.has('rating-4-plus') ? 'text-[#16A34A] fill-[#16A34A]' : 'text-gray-400 dark:text-gray-500'}`} />
                        <span className={`text-sm font-medium ${activeFilters.has('rating-4-plus') ? 'text-[#16A34A]' : 'text-gray-700 dark:text-gray-300'}`}>Rated 4.0+</span>
                      </button>
                      <button
                        onClick={() => toggleFilter('rating-45-plus')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('rating-45-plus')
                          ? 'border-[#16A34A] bg-[#F0FDF4] dark:bg-[#16A34A]/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-[#16A34A]'
                          }`}
                      >
                        <Star className={`h-6 w-6 ${activeFilters.has('rating-45-plus') ? 'text-[#16A34A] fill-[#16A34A]' : 'text-gray-400 dark:text-gray-500'}`} />
                        <span className={`text-sm font-medium ${activeFilters.has('rating-45-plus') ? 'text-[#16A34A]' : 'text-gray-700 dark:text-gray-300'}`}>Rated 4.5+</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Distance Tab */}
                {activeFilterTab === 'distance' && (
                  <div className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Distance</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => toggleFilter('distance-under-1km')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('distance-under-1km')
                          ? 'border-[#16A34A] bg-[#F0FDF4] dark:bg-[#16A34A]/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-[#16A34A]'
                          }`}
                      >
                        <MapPin className={`h-6 w-6 ${activeFilters.has('distance-under-1km') ? 'text-[#16A34A]' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                        <span className={`text-sm font-medium ${activeFilters.has('distance-under-1km') ? 'text-[#16A34A]' : 'text-gray-700 dark:text-gray-300'}`}>Under 1 km</span>
                      </button>
                      <button
                        onClick={() => toggleFilter('distance-under-2km')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('distance-under-2km')
                          ? 'border-[#16A34A] bg-[#F0FDF4] dark:bg-[#16A34A]/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-[#16A34A]'
                          }`}
                      >
                        <MapPin className={`h-6 w-6 ${activeFilters.has('distance-under-2km') ? 'text-[#16A34A]' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                        <span className={`text-sm font-medium ${activeFilters.has('distance-under-2km') ? 'text-[#16A34A]' : 'text-gray-700 dark:text-gray-300'}`}>Under 2 km</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Price Tab */}
                {activeFilterTab === 'price' && (
                  <div className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Dish Price</h3>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => toggleFilter('price-under-200')}
                        className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has('price-under-200')
                          ? 'border-[#16A34A] bg-[#16A34A]/10 dark:bg-[#16A34A]/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-[#16A34A]'
                          }`}
                      >
                        <span className={`text-sm font-medium ${activeFilters.has('price-under-200') ? 'text-[#16A34A]' : 'text-gray-700 dark:text-gray-300'}`}>Under ₹200</span>
                      </button>
                      <button
                        onClick={() => toggleFilter('price-under-500')}
                        className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has('price-under-500')
                          ? 'border-[#16A34A] bg-[#16A34A]/10 dark:bg-[#16A34A]/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-[#16A34A]'
                          }`}
                      >
                        <span className={`text-sm font-medium ${activeFilters.has('price-under-500') ? 'text-[#16A34A]' : 'text-gray-700 dark:text-gray-300'}`}>Under ₹500</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Cuisine Tab */}
                {activeFilterTab === 'cuisine' && (
                  <div className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cuisine</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {['Continental', 'Italian', 'Asian', 'Indian', 'Chinese', 'American', 'Seafood', 'Cafe'].map((cuisine) => (
                        <button
                          key={cuisine}
                          onClick={() => setSelectedCuisine(selectedCuisine === cuisine ? null : cuisine)}
                          className={`px-4 py-3 rounded-xl border text-center transition-colors ${selectedCuisine === cuisine
                            ? 'border-[#16A34A] bg-[#F0FDF4] dark:bg-[#16A34A]/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-[#16A34A]'
                            }`}
                        >
                          <span className={`text-sm font-medium ${selectedCuisine === cuisine ? 'text-[#16A34A]' : 'text-gray-700 dark:text-gray-300'}`}>
                            {cuisine}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 md:gap-6 px-4 md:px-6 py-4 md:py-5 border-t dark:border-gray-800 bg-white dark:bg-[#1a1a1a]">
              <button
                onClick={() => setIsFilterOpen(false)}
                className="flex-1 py-3 md:py-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-sm md:text-base"
              >
                Close
              </button>
              <button
                onClick={() => setIsFilterOpen(false)}
                className={`flex-1 py-3 md:py-4 font-semibold rounded-xl transition-colors text-sm md:text-base ${activeFilters.size > 0 || sortBy || selectedCuisine
                  ? 'bg-[#16A34A] text-white hover:bg-[#15803D]'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
              >
                {activeFilters.size > 0 || sortBy || selectedCuisine
                  ? `Show ${filteredRestaurants.length} results`
                  : 'Show results'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  )
}



