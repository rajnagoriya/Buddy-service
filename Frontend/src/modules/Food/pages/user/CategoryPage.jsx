import { useState, useMemo, useRef, useEffect, startTransition, useDeferredValue } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Star, Clock, Search, SlidersHorizontal, ChevronDown, Bookmark, BadgePercent, MapPin, ArrowDownUp, Timer, IndianRupee, UtensilsCrossed, ShieldCheck, X, Loader2, Grid2x2 } from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import {
  CategoryChipRowSkeleton,
  LoadingSkeletonRegion,
  RestaurantGridSkeleton,
} from "@food/components/ui/loading-skeletons"

// Import shared food images - prevents duplication
import { foodImages } from "@food/constants/images"
import api from "@food/api"
import { restaurantAPI, adminAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { useProfile } from "@food/context/ProfileContext"
import { useLocation } from "@food/hooks/useLocation"
import { useZone } from "@food/hooks/useZone"
import { useDelayedLoading } from "@food/hooks/useDelayedLoading"
import { fetchRestaurantMenuForRestaurant } from "@food/utils/restaurantMenuCache"

// Filter options
const filterOptions = [
  { id: 'under-30-mins', label: 'Under 30 mins' },
  { id: 'price-match', label: 'Price Match', hasIcon: true },
  { id: 'flat-50-off', label: 'Flat 50% OFF', hasIcon: true },
  { id: 'under-250', label: 'Under ₹250' },
  { id: 'rating-4-plus', label: 'Rating 4.0+' },
]

// Mock data removed - using backend data only

const CATEGORY_PAGE_FILTERS_STORAGE_KEY = "food-category-page-filters-v1"



export default function CategoryPage() {
  const { category } = useParams()
  const navigate = useNavigate()
  const { vegMode } = useProfile()
  const { location } = useLocation()
  const { zoneId, isOutOfService } = useZone(location)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState(category?.toLowerCase() || 'all')
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [favorites, setFavorites] = useState(new Set())
  const [sortBy, setSortBy] = useState(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [activeFilterTab, setActiveFilterTab] = useState('sort')
  const [activeScrollSection, setActiveScrollSection] = useState('sort')
  const [isLoadingFilterResults, setIsLoadingFilterResults] = useState(false)
  const filterSectionRefs = useRef({})
  const rightContentRef = useRef(null)
  const categoryScrollRef = useRef(null)
  const menuEnrichmentRequestRef = useRef(0)
  const approvedFoodsCacheRef = useRef(null)
  const approvedFoodsInFlightRef = useRef(null)
  const hasRestoredCategoryFiltersRef = useRef(false)

  // State for categories from admin
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)

  const [restaurantsData, setRestaurantsData] = useState([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [isEnrichingMenus, setIsEnrichingMenus] = useState(false)
  const [approvedFoodsData, setApprovedFoodsData] = useState([])
  const [categoryKeywords, setCategoryKeywords] = useState({})
  const showCategorySkeleton = useDelayedLoading(loadingCategories)
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const BACKEND_ORIGIN = useMemo(() => API_BASE_URL.replace(/\/api\/?$/, ""), [])
  const slugify = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const normalizeCategoryToken = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  const matchesCategoryText = (value, keywords) => {
    const normalizedValue = normalizeCategoryToken(value)
    if (!normalizedValue) return false

    return keywords.some((keyword) => {
      const normalizedKeyword = normalizeCategoryToken(keyword)
      if (!normalizedKeyword) return false
      return (
        normalizedValue === normalizedKeyword ||
        normalizedValue.includes(normalizedKeyword) ||
        slugify(normalizedValue) === slugify(normalizedKeyword)
      )
    })
  }
  const uniqueByRestaurant = (list) => {
    const seen = new Set()
    return list.filter((row) => {
      // Use distinct keys for dishes vs restaurants to prevent collisions
      const key = row.dishId ? `dish-${row.dishId}` : (row.restaurantId || row.id || `raw-${slugify(row.name)}`)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const toArray = (value) => {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== "object") return []
    return Object.values(value).filter((entry) => entry && typeof entry === "object")
  }

  const normalizeMenu = (menu) => {
    const rawSections = toArray(menu?.sections)
    return {
      ...menu,
      sections: rawSections.map((section, sectionIndex) => ({
        ...section,
        id: String(section?.id || section?._id || `section-${sectionIndex}`),
        name: section?.name || section?.title || "Unnamed Section",
        items: toArray(section?.items).map((item, itemIndex) => ({
          ...item,
          id: String(item?.id || item?._id || `${sectionIndex}-${itemIndex}`),
        })),
        subsections: toArray(section?.subsections).map((subsection, subsectionIndex) => ({
          ...subsection,
          id: String(subsection?.id || subsection?._id || `subsection-${sectionIndex}-${subsectionIndex}`),
          name: subsection?.name || "Unnamed Subsection",
          items: toArray(subsection?.items).map((item, itemIndex) => ({
            ...item,
            id: String(item?.id || item?._id || `${sectionIndex}-${subsectionIndex}-${itemIndex}`),
          })),
        })),
      })),
    }
  }

  const fetchApprovedFoods = async () => {
    if (Array.isArray(approvedFoodsCacheRef.current)) {
      return approvedFoodsCacheRef.current
    }

    if (approvedFoodsInFlightRef.current) {
      return approvedFoodsInFlightRef.current
    }

    approvedFoodsInFlightRef.current = (async () => {
      try {
        const response = await adminAPI.getFoods({ limit: 1000 })
        const list = response?.data?.data?.foods || []
        const approvedFoods = Array.isArray(list)
          ? list.filter((food) =>
              String(food?.approvalStatus || "").toLowerCase() === "approved" &&
              food?.isAvailable !== false
            )
          : []

        approvedFoodsCacheRef.current = approvedFoods
        return approvedFoods
      } catch {
        approvedFoodsCacheRef.current = []
        return []
      } finally {
        approvedFoodsInFlightRef.current = null
      }
    })()

    return approvedFoodsInFlightRef.current
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const foods = await fetchApprovedFoods()
      if (!cancelled) {
        setApprovedFoodsData(Array.isArray(foods) ? foods : [])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const buildFallbackMenuFromFoods = (foods, restaurant) => {
    const restaurantIds = new Set(
      [
        restaurant?.restaurantId,
        restaurant?.id,
        restaurant?.mongoId,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim())
    )

    const restaurantName = String(restaurant?.name || "").trim().toLowerCase()
    const matchingFoods = foods.filter((food) => {
      const foodRestaurantId = String(food?.restaurantId || "").trim()
      const foodRestaurantName = String(food?.restaurantName || "").trim().toLowerCase()
      return (
        (foodRestaurantId && restaurantIds.has(foodRestaurantId)) ||
        (restaurantName && foodRestaurantName === restaurantName)
      )
    })

    if (matchingFoods.length === 0) {
      return null
    }

    const sectionsMap = new Map()
    matchingFoods.forEach((food, index) => {
      const sectionName = String(food?.categoryName || food?.category || "Varieties").trim() || "Varieties"
      const sectionKey = slugify(sectionName)
      if (!sectionsMap.has(sectionKey)) {
        sectionsMap.set(sectionKey, {
          id: sectionKey || `section-${index}`,
          name: sectionName,
          items: [],
          subsections: [],
        })
      }

      sectionsMap.get(sectionKey).items.push({
        id: String(food?.id || food?._id || `${sectionKey}-${index}`),
        _id: food?._id,
        name: food?.name || "Unnamed Item",
        description: food?.description || "",
        price: Number(food?.price || 0),
        originalPrice: Number(food?.originalPrice || food?.price || 0),
        image: normalizeImageUrl(food?.image),
        foodType: food?.foodType || "Non-Veg",
        isAvailable: food?.isAvailable !== false,
        categoryName: food?.categoryName || sectionName,
        category: food?.categoryName || sectionName,
        preparationTime: food?.preparationTime || "",
        approvalStatus: food?.approvalStatus || "approved",
      })
    })

    return {
      sections: Array.from(sectionsMap.values()),
    }
  }

  const getCategoryFallbackDishesFromApprovedFoods = (categoryId, restaurants) => {
    const keywords = getCategoryKeywords(categoryId)
    if (keywords.length === 0 || !Array.isArray(approvedFoodsData) || approvedFoodsData.length === 0) {
      return []
    }

    const restaurantsById = new Map()
    const restaurantsByName = new Map()
    ;(Array.isArray(restaurants) ? restaurants : []).forEach((restaurant) => {
      const idCandidates = [
        restaurant?.restaurantId,
        restaurant?.id,
        restaurant?.mongoId,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim())

      idCandidates.forEach((value) => {
        if (!restaurantsById.has(value)) {
          restaurantsById.set(value, restaurant)
        }
      })

      const normalizedName = String(restaurant?.name || "").trim().toLowerCase()
      if (normalizedName && !restaurantsByName.has(normalizedName)) {
        restaurantsByName.set(normalizedName, restaurant)
      }
    })

    return approvedFoodsData
      .filter((food) => {
        if (food?.isAvailable === false) return false
        if (String(food?.approvalStatus || "").toLowerCase() !== "approved") return false

        const categoryName = String(food?.categoryName || food?.category || "").toLowerCase()
        const foodName = String(food?.name || "").toLowerCase()
        return (
          matchesCategoryText(categoryName, keywords) ||
          matchesCategoryText(foodName, keywords)
        )
      })
      .map((food, index) => {
        const restaurantId = String(food?.restaurantId || "").trim()
        const restaurantName = String(food?.restaurantName || "").trim()
        const matchedRestaurant =
          restaurantsById.get(restaurantId) ||
          restaurantsByName.get(restaurantName.toLowerCase()) ||
          null

        const fallbackRestaurantName = restaurantName || "Restaurant"
        const fallbackSlug = slugify(fallbackRestaurantName)
        const fallbackImage = normalizeImageUrl(food?.image)

        return {
          ...(matchedRestaurant || {}),
          id: `${restaurantId || fallbackSlug || "restaurant"}-${String(food?.id || food?._id || index)}`,
          restaurantId: restaurantId || matchedRestaurant?.restaurantId || matchedRestaurant?.id || null,
          mongoId: matchedRestaurant?.mongoId || matchedRestaurant?.id || null,
          slug: matchedRestaurant?.slug || fallbackSlug,
          name: matchedRestaurant?.name || fallbackRestaurantName,
          image: matchedRestaurant?.image || fallbackImage,
          images: Array.isArray(matchedRestaurant?.images) && matchedRestaurant.images.length > 0
            ? matchedRestaurant.images
            : (fallbackImage ? [fallbackImage] : []),
          cuisine: matchedRestaurant?.cuisine || null,
          rating: matchedRestaurant?.rating || null,
          deliveryTime: matchedRestaurant?.deliveryTime || null,
          distance: matchedRestaurant?.distance || null,
          offer: matchedRestaurant?.offer || null,
          featuredDish: matchedRestaurant?.featuredDish || food?.name || null,
          featuredPrice: matchedRestaurant?.featuredPrice || Number(food?.price || 0),
          menu: matchedRestaurant?.menu || null,
          dishId: String(food?.id || food?._id || `${restaurantId}-${index}`),
          categoryDish: food,
          categoryDishName: food?.name || "Unnamed Item",
          categoryDishPrice: Number(food?.price || 0),
          categoryDishImage: fallbackImage,
          categoryDishFoodType: food?.foodType || "Non-Veg",
        }
      })
  }

  const normalizeImageUrl = (value) => {
    if (!value) return ""

    const raw =
      typeof value === "string"
        ? value
        : typeof value === "object"
          ? (value.url || value.secure_url || value.imageUrl || value.image || value.src || value.path || "")
          : ""

    if (typeof raw !== "string") return ""
    const trimmed = raw.trim()
    if (!trimmed) return ""
    if (/^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed

    const appProtocol = typeof window !== "undefined" ? window.location?.protocol : ""
    const appHost = typeof window !== "undefined" ? window.location?.hostname : ""
    let normalized = trimmed
      .replace(/\\/g, "/")
      .replace(/^(https?):\/(?!\/)/i, "$1://")
      .replace(/^(https?:\/\/)(https?:\/\/)/i, "$1")

    if (/^\/\//.test(normalized)) {
      normalized = `${appProtocol || "https:"}${normalized}`
    }

    const hasSignedParams = (url) =>
      /[?&](X-Amz-|Signature=|Expires=|AWSAccessKeyId=|GoogleAccessId=|token=|sig=|se=|sp=|sv=)/i.test(url)

    if (/^https?:\/\//i.test(normalized)) {
      try {
        const parsed = new URL(normalized, window.location.origin)
        if (
          appHost &&
          appHost !== "localhost" &&
          appHost !== "127.0.0.1" &&
          /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)
        ) {
          try {
            const backendUrl = new URL(BACKEND_ORIGIN)
            parsed.protocol = backendUrl.protocol
            parsed.hostname = backendUrl.hostname
            parsed.port = backendUrl.port
          } catch {
            parsed.protocol = window.location.protocol
            parsed.hostname = window.location.hostname
            if (window.location.port) parsed.port = window.location.port
          }
        }
        if (appProtocol === "https:" && parsed.protocol === "http:") {
          parsed.protocol = "https:"
        }
        const finalUrl = parsed.toString()
        return hasSignedParams(finalUrl) ? finalUrl : encodeURI(finalUrl)
      } catch {
        return normalized
      }
    }

    const absolutePath = normalized.startsWith("/")
      ? `${BACKEND_ORIGIN}${normalized}`
      : `${BACKEND_ORIGIN}/${normalized.replace(/^\.?\/*/, "")}`

    try {
      const parsed = new URL(absolutePath, window.location.origin)
      if (appProtocol === "https:" && parsed.protocol === "http:") {
        parsed.protocol = "https:"
      }
      const finalUrl = parsed.toString()
      return hasSignedParams(finalUrl) ? finalUrl : encodeURI(finalUrl)
    } catch {
      return absolutePath
    }
  }

  const currentFilterStorageKey = useMemo(
    () => slugify(selectedCategory || category || "all") || "all",
    [selectedCategory, category]
  )

  const parseFirstNumber = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value
    const match = String(value || "").match(/(\d+(?:\.\d+)?)/)
    return match ? Number(match[1]) : null
  }

  const getComparableDeliveryTime = (row) => parseFirstNumber(row?.deliveryTime)

  const getComparableDistance = (row) => {
    const raw = String(row?.distance || "").trim().toLowerCase()
    if (!raw) return null

    const parsed = parseFirstNumber(raw)
    if (parsed == null) return null
    if (raw.includes("m") && !raw.includes("km")) {
      return parsed / 1000
    }
    return parsed
  }

  const getComparablePrice = (row) => {
    const raw = row?.categoryDishPrice ?? row?.featuredPrice ?? null
    const parsed = typeof raw === "number" ? raw : parseFirstNumber(raw)
    return Number.isFinite(parsed) ? parsed : null
  }

  const getComparableRating = (row) => {
    const parsed = typeof row?.rating === "number" ? row.rating : parseFirstNumber(row?.rating)
    return Number.isFinite(parsed) ? parsed : null
  }

  const matchesOfferText = (value, pattern) => pattern.test(String(value || ""))

  const applyFiltersAndSorting = (rows) => {
    let nextRows = Array.isArray(rows) ? [...rows] : []

    if (activeFilters.has('under-30-mins')) {
      nextRows = nextRows.filter((row) => {
        const time = getComparableDeliveryTime(row)
        return time != null && time <= 30
      })
    }

    if (activeFilters.has('delivery-under-45')) {
      nextRows = nextRows.filter((row) => {
        const time = getComparableDeliveryTime(row)
        return time != null && time <= 45
      })
    }

    if (activeFilters.has('rating-35-plus')) {
      nextRows = nextRows.filter((row) => {
        const rating = getComparableRating(row)
        return rating != null && rating >= 3.5
      })
    }

    if (activeFilters.has('rating-4-plus')) {
      nextRows = nextRows.filter((row) => {
        const rating = getComparableRating(row)
        return rating != null && rating >= 4.0
      })
    }

    if (activeFilters.has('rating-45-plus')) {
      nextRows = nextRows.filter((row) => {
        const rating = getComparableRating(row)
        return rating != null && rating >= 4.5
      })
    }

    if (activeFilters.has('distance-under-1km')) {
      nextRows = nextRows.filter((row) => {
        const distance = getComparableDistance(row)
        return distance != null && distance <= 1
      })
    }

    if (activeFilters.has('distance-under-2km')) {
      nextRows = nextRows.filter((row) => {
        const distance = getComparableDistance(row)
        return distance != null && distance <= 2
      })
    }

    if (activeFilters.has('price-under-200')) {
      nextRows = nextRows.filter((row) => {
        const price = getComparablePrice(row)
        return price != null && price <= 200
      })
    }

    if (activeFilters.has('under-250')) {
      nextRows = nextRows.filter((row) => {
        const price = getComparablePrice(row)
        return price != null && price <= 250
      })
    }

    if (activeFilters.has('price-under-500')) {
      nextRows = nextRows.filter((row) => {
        const price = getComparablePrice(row)
        return price != null && price <= 500
      })
    }

    if (activeFilters.has('flat-50-off')) {
      nextRows = nextRows.filter((row) => matchesOfferText(row?.offer, /50\s*%/i))
    }

    if (activeFilters.has('price-match')) {
      nextRows = nextRows.filter((row) =>
        matchesOfferText(row?.offer, /price\s*match/i) ||
        matchesOfferText(row?.priceRange, /price\s*match/i) ||
        matchesOfferText(row?.categoryDish?.description, /price\s*match/i)
      )
    }

    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase()
      nextRows = nextRows.filter((row) =>
        row.name?.toLowerCase().includes(query) ||
        row.cuisine?.toLowerCase().includes(query) ||
        row.featuredDish?.toLowerCase().includes(query) ||
        row.categoryDishName?.toLowerCase().includes(query)
      )
    }

    if (sortBy) {
      nextRows.sort((left, right) => {
        if (sortBy === 'price-low' || sortBy === 'price-high') {
          const leftPrice = getComparablePrice(left)
          const rightPrice = getComparablePrice(right)
          if (leftPrice == null && rightPrice == null) return 0
          if (leftPrice == null) return 1
          if (rightPrice == null) return -1
          return sortBy === 'price-low' ? leftPrice - rightPrice : rightPrice - leftPrice
        }

        if (sortBy === 'rating-high' || sortBy === 'rating-low') {
          const leftRating = getComparableRating(left)
          const rightRating = getComparableRating(right)
          if (leftRating == null && rightRating == null) return 0
          if (leftRating == null) return 1
          if (rightRating == null) return -1
          return sortBy === 'rating-high' ? rightRating - leftRating : leftRating - rightRating
        }

        return 0
      })
    }

    return uniqueByRestaurant(nextRows)
  }

  // Fetch categories from admin API
  useEffect(() => {
    let isCancelled = false;

    const fetchCategories = async () => {
      try {
        setLoadingCategories(true)
        const response = await adminAPI.getPublicCategories(zoneId ? { zoneId } : {})

        if (isCancelled) return;

        if (response.data && response.data.success && response.data.data && response.data.data.categories) {
          const categoriesArray = response.data.data.categories

          // Transform API categories to match expected format
          const transformedCategories = [
            { id: 'all', name: "All", image: null, slug: 'all' },
            ...categoriesArray.map((cat) => ({
              id: cat.slug || cat.id,
              name: cat.name,
              image: cat.image || foodImages[0],
              slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'),
              type: cat.type,
            }))
          ]

          setCategories(transformedCategories)

          // Generate category keywords dynamically from category names
          const keywordsMap = {}
          categoriesArray.forEach((cat) => {
            const categoryId = cat.slug || cat.id
            const categoryName = cat.name.toLowerCase()

            // Generate keywords from category name
            const words = categoryName.split(/[\s-]+/).filter(w => w.length > 0)
            keywordsMap[categoryId] = [categoryName, ...words]
          })

          setCategoryKeywords(keywordsMap)
        } else {
          // Keep default "All" category on error
          setCategories([{ id: 'all', name: "All", image: null, slug: 'all' }])
        }
      } catch (error) {
        if (isCancelled) return;
        debugError('Error fetching categories:', error)
        // Keep default "All" category on error
        setCategories([{ id: 'all', name: "All", image: null, slug: 'all' }])
      } finally {
        if (!isCancelled) setLoadingCategories(false)
      }
    }

    fetchCategories()

    return () => {
      isCancelled = true;
    }
  }, [zoneId])

  // Helper function to check if menu has dishes matching category keywords
  const getCategoryKeywords = (categoryId) => {
    const raw = String(categoryId || "").trim().toLowerCase()
    const fromAdmin = categoryKeywords[raw]
    let keywords = []
    if (Array.isArray(fromAdmin) && fromAdmin.length > 0) {
      keywords = [...fromAdmin]
    } else {
      // Fallback: derive keywords from the slug in URL (e.g. "samosha" -> ["samosha"])
      // This prevents "no data" when admin categories don't include the slug.
      const parts = raw.split(/[\s-]+/).filter(Boolean)
      keywords = parts.length > 0 ? Array.from(new Set([raw, ...parts])) : []
    }

    // Add common variations/misspellings (e.g. "samosha" vs "samosa")
    if (keywords.includes('samosha') || keywords.includes('samosa')) {
      if (!keywords.includes('samosa')) keywords.push('samosa')
      if (!keywords.includes('samosha')) keywords.push('samosha')
    }

    return keywords
  }

  const checkCategoryInMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return false
    }

    const keywords = getCategoryKeywords(categoryId)
    if (keywords.length === 0) {
      return false
    }

    for (const section of menu.sections) {
      const sectionNameLower = (section.name || '').toLowerCase()
      if (matchesCategoryText(sectionNameLower, keywords)) {
        return true
      }

      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          const itemNameLower = (item.name || '').toLowerCase()
          const itemCategoryLower = (item.categoryName || item.category || '').toLowerCase()

          if (
            matchesCategoryText(itemNameLower, keywords) ||
            matchesCategoryText(itemCategoryLower, keywords)
          ) {
            return true
          }
        }
      }

      // Also check subsection items (new menu builder can nest items)
      if (section.subsections && Array.isArray(section.subsections)) {
        for (const subsection of section.subsections) {
          const subsectionNameLower = (subsection?.name || "").toLowerCase()
          if (matchesCategoryText(subsectionNameLower, keywords)) {
            return true
          }

          const subItems = Array.isArray(subsection?.items) ? subsection.items : []
          for (const item of subItems) {
            const itemNameLower = (item?.name || "").toLowerCase()
            const itemCategoryLower = (item?.categoryName || item?.category || "").toLowerCase()
            if (
              matchesCategoryText(itemNameLower, keywords) ||
              matchesCategoryText(itemCategoryLower, keywords)
            ) {
              return true
            }
          }
        }
      }
    }

    return false
  }

  // Helper function to get ALL dishes matching a category from menu (returns array of dish info)
  const getAllCategoryDishesFromMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return []
    }

    const keywords = getCategoryKeywords(categoryId)
    if (keywords.length === 0) {
      return []
    }

    const matchingDishes = []

    for (const section of menu.sections) {
      const sectionNameLower = (section?.name || "").toLowerCase()
      const sectionMatches = matchesCategoryText(sectionNameLower, keywords)

      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          const itemNameLower = (item.name || '').toLowerCase()
          const itemCategoryLower = (item.categoryName || item.category || '').toLowerCase()

          const itemMatches =
            matchesCategoryText(itemNameLower, keywords) ||
            matchesCategoryText(itemCategoryLower, keywords)

          // If the section name matches the category, include all items in it.
          if (sectionMatches || itemMatches) {
            // Calculate final price considering discounts
            const originalPrice = item.originalPrice || item.price || 0
            const discountPercent = item.discountPercent || 0
            const finalPrice = discountPercent > 0
              ? Math.round(originalPrice * (1 - discountPercent / 100))
              : originalPrice

            // Get dish image (prioritize item image, then section image)
            const dishImage = normalizeImageUrl(item.image?.url || item.image || section.image?.url || section.image)

            matchingDishes.push({
              name: item.name,
              price: finalPrice,
              image: dishImage,
              originalPrice: originalPrice,
              itemId: item._id || item.id || `${item.name}-${finalPrice}`,
              foodType: item.foodType, // Include foodType for vegMode filtering
            })
          }
        }
      }

      // Include subsection items too
      if (section.subsections && Array.isArray(section.subsections)) {
        for (const subsection of section.subsections) {
          const subsectionNameLower = (subsection?.name || "").toLowerCase()
          const subsectionMatches = matchesCategoryText(subsectionNameLower, keywords)
          const subItems = Array.isArray(subsection?.items) ? subsection.items : []

          for (const item of subItems) {
            const itemNameLower = (item?.name || "").toLowerCase()
            const itemCategoryLower = (item?.categoryName || item?.category || "").toLowerCase()
            const itemMatches =
              matchesCategoryText(itemNameLower, keywords) ||
              matchesCategoryText(itemCategoryLower, keywords)

            if (sectionMatches || subsectionMatches || itemMatches) {
              const originalPrice = item?.originalPrice || item?.price || 0
              const discountPercent = item?.discountPercent || 0
              const finalPrice = discountPercent > 0
                ? Math.round(originalPrice * (1 - discountPercent / 100))
                : originalPrice

              const dishImage = normalizeImageUrl(
                item?.image?.url || item?.image || subsection?.image?.url || subsection?.image || section?.image?.url || section?.image
              )

              matchingDishes.push({
                name: item?.name,
                price: finalPrice,
                image: dishImage,
                originalPrice: originalPrice,
                itemId: item?._id || item?.id || `${item?.name}-${finalPrice}`,
                foodType: item?.foodType,
              })
            }
          }
        }
      }
    }

    return matchingDishes
  }

  // Helper function to get FIRST featured dish for a category from menu (for backward compatibility)
  const getCategoryDishFromMenu = (menu, categoryId) => {
    const allDishes = getAllCategoryDishesFromMenu(menu, categoryId)
    return allDishes.length > 0 ? allDishes[0] : null
  }

  // Fetch restaurants from API
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoadingRestaurants(true)
        // IMPORTANT: Do NOT pass zoneId as a hard filter.
        // UX is "show all restaurants", and we only style out-of-service state.
        const params = {}
        const response = await restaurantAPI.getRestaurants(params)

        if (response.data && response.data.success && response.data.data && response.data.data.restaurants) {
          const restaurantsArray = response.data.data.restaurants

          // Helper function to check if value is a default/mock value
          const isDefaultValue = (value, fieldName) => {
            if (!value) return false

            const defaultOffers = [
              "Flat ₹50 OFF above ₹199",
              "Flat 50% OFF",
              "Flat ₹40 OFF above ₹149"
            ]
            const defaultDeliveryTimes = ["25-30 mins", "20-25 mins", "30-35 mins"]
            const defaultDistances = ["1.2 km", "1 km", "0.8 km"]
            const defaultFeaturedPrice = 249

            if (fieldName === 'offer' && defaultOffers.includes(value)) return true
            if (fieldName === 'deliveryTime' && defaultDeliveryTimes.includes(value)) return true
            if (fieldName === 'distance' && defaultDistances.includes(value)) return true
            if (fieldName === 'featuredPrice' && value === defaultFeaturedPrice) return true

            return false
          }

          // Transform restaurants - filter out default values
          const restaurantsWithIds = restaurantsArray
            .filter((restaurant) => {
              const displayName = String(restaurant.restaurantName || restaurant.name || "").trim()
              const hasName = displayName.length > 0
              return hasName
            })
            .map((restaurant) => {
              let deliveryTime = restaurant.estimatedDeliveryTime || null
              let distance = restaurant.distance || null
              let offer = restaurant.offer || null

              if (isDefaultValue(deliveryTime, 'deliveryTime')) deliveryTime = null
              if (isDefaultValue(distance, 'distance')) distance = null
              if (isDefaultValue(offer, 'offer')) offer = null

              const cuisine = restaurant.cuisines && restaurant.cuisines.length > 0
                ? restaurant.cuisines.join(", ")
                : null

              const coverImages = restaurant.coverImages && restaurant.coverImages.length > 0
                ? restaurant.coverImages.map(img => normalizeImageUrl(img.url || img)).filter(Boolean)
                : []

              const fallbackImages = restaurant.menuImages && restaurant.menuImages.length > 0
                ? restaurant.menuImages.map(img => normalizeImageUrl(img.url || img)).filter(Boolean)
                : []

              const allImages = coverImages.length > 0
                ? coverImages
                : (fallbackImages.length > 0
                  ? fallbackImages
                  : (restaurant.profileImage?.url ? [normalizeImageUrl(restaurant.profileImage.url)] : []))

              const image = allImages[0] || null
              const restaurantId = restaurant.restaurantId || restaurant._id

              let featuredDish = restaurant.featuredDish || null
              let featuredPrice = restaurant.featuredPrice || null

              if (featuredPrice && isDefaultValue(featuredPrice, 'featuredPrice')) {
                featuredPrice = null
              }

              const restaurantName = (restaurant.restaurantName || restaurant.name || "").toLowerCase()

              return {
                id: restaurantId,
                name: restaurant.restaurantName || restaurant.name,
                cuisine: cuisine,
                rating: restaurant.rating || null,
                deliveryTime: deliveryTime,
                distance: distance,
                image: image,
                images: allImages,
                priceRange: restaurant.priceRange || null,
                featuredDish: featuredDish,
                featuredPrice: featuredPrice,
                offer: offer,
                slug: restaurant.slug || (restaurant.restaurantName || restaurant.name)?.toLowerCase().replace(/\s+/g, '-'),
                restaurantId: restaurantId,
                mongoId: restaurant._id || null,
                hasPaneer: false,
                category: 'all',
              }
            }).filter(Boolean)

          startTransition(() => {
            setRestaurantsData(restaurantsWithIds)
          })

          setIsEnrichingMenus(true)
          const enrichmentRequestId = ++menuEnrichmentRequestRef.current
          void (async () => {
            try {
              const transformedRestaurants = []

              for (let index = 0; index < restaurantsWithIds.length; index += 4) {
                const batchRestaurants = restaurantsWithIds.slice(index, index + 4)
                const batchResults = await Promise.all(
                  batchRestaurants.map(async (restaurant) => {
                    try {
                      const rawMenu = await fetchRestaurantMenuForRestaurant(restaurant)
                      const menu = rawMenu ? normalizeMenu(rawMenu) : null

                      if (!menu || menu.sections.length === 0) {
                        const approvedFoods = await fetchApprovedFoods()
                        const fallbackMenu = buildFallbackMenuFromFoods(approvedFoods, restaurant)
                        if (fallbackMenu?.sections?.length > 0) {
                          const hasPaneer = checkCategoryInMenu(fallbackMenu, 'paneer-tikka')
                          return {
                            ...restaurant,
                            menu: fallbackMenu,
                            hasPaneer: hasPaneer,
                            featuredDish: restaurant.featuredDish || null,
                            featuredPrice: restaurant.featuredPrice || null,
                            categoryMatches: {},
                          }
                        }
                        return {
                          ...restaurant,
                          menu: null,
                          hasPaneer: false,
                          categoryMatches: {},
                        }
                      }

                      const hasPaneer = checkCategoryInMenu(menu, 'paneer-tikka')

                      let featuredDish = restaurant.featuredDish
                      let featuredPrice = restaurant.featuredPrice

                      if (!featuredDish || !featuredPrice) {
                        for (const section of (menu.sections || [])) {
                          if (section.items && section.items.length > 0) {
                            const firstItem = section.items[0]
                            if (!featuredDish) featuredDish = firstItem.name
                            if (!featuredPrice) {
                              const originalPrice = firstItem.originalPrice || firstItem.price || 0
                              const discountPercent = firstItem.discountPercent || 0
                              featuredPrice = discountPercent > 0
                                ? Math.round(originalPrice * (1 - discountPercent / 100))
                                : originalPrice
                            }
                            break
                          }
                        }
                      }

                      return {
                        ...restaurant,
                        menu: menu,
                        hasPaneer: hasPaneer,
                        featuredDish: featuredDish || null,
                        featuredPrice: featuredPrice || null,
                        categoryMatches: {},
                      }
                    } catch (error) {
                      debugWarn(`Failed to fetch menu for restaurant ${restaurant.restaurantId}:`, error)
                    }

                    return {
                      ...restaurant,
                      menu: null,
                      hasPaneer: false,
                      categoryMatches: {},
                    }
                  })
                )

                if (enrichmentRequestId !== menuEnrichmentRequestRef.current) return
                transformedRestaurants.push(...batchResults)
              }

              if (enrichmentRequestId === menuEnrichmentRequestRef.current) {
                startTransition(() => {
                  setRestaurantsData(transformedRestaurants)
                })
              }
            } finally {
              if (enrichmentRequestId === menuEnrichmentRequestRef.current) {
                setIsEnrichingMenus(false)
              }
            }
          })()
        } else {
          setRestaurantsData([])
        }
      } catch (error) {
        debugError('Error fetching restaurants:', error)
        setRestaurantsData([])
      } finally {
        setLoadingRestaurants(false)
      }
    }

    fetchRestaurants()
  }, [])

  // Update selected category when URL changes
  useEffect(() => {
    if (category && categories && categories.length > 0) {
      const categorySlug = category.toLowerCase()
      const matchedCategory = categories.find(cat =>
        cat.slug === categorySlug ||
        cat.id === categorySlug ||
        cat.name.toLowerCase().replace(/\s+/g, '-') === categorySlug
      )
      if (matchedCategory) {
        setSelectedCategory(matchedCategory.slug || matchedCategory.id)
      } else {
        setSelectedCategory(categorySlug)
      }
    } else if (category) {
      setSelectedCategory(category.toLowerCase())
    }
  }, [category, categories])

  useEffect(() => {
    if (typeof window === "undefined" || !currentFilterStorageKey) return

    hasRestoredCategoryFiltersRef.current = false

    try {
      const raw = window.localStorage.getItem(CATEGORY_PAGE_FILTERS_STORAGE_KEY)
      if (!raw) return

      const stored = JSON.parse(raw)
      const categoryState = stored?.[currentFilterStorageKey]
      if (!categoryState || typeof categoryState !== "object") return

      setSortBy(categoryState.sortBy || null)
      setActiveFilters(new Set(Array.isArray(categoryState.activeFilters) ? categoryState.activeFilters : []))
    } catch {
      setSortBy(null)
      setActiveFilters(new Set())
    } finally {
      hasRestoredCategoryFiltersRef.current = true
    }
  }, [currentFilterStorageKey])

  useEffect(() => {
    if (typeof window === "undefined" || !currentFilterStorageKey) return
    if (!hasRestoredCategoryFiltersRef.current) return

    try {
      const raw = window.localStorage.getItem(CATEGORY_PAGE_FILTERS_STORAGE_KEY)
      const stored = raw ? JSON.parse(raw) : {}
      stored[currentFilterStorageKey] = {
        sortBy,
        activeFilters: Array.from(activeFilters),
      }
      window.localStorage.setItem(CATEGORY_PAGE_FILTERS_STORAGE_KEY, JSON.stringify(stored))
    } catch {
      // Ignore storage failures and keep in-memory filters working.
    }
  }, [currentFilterStorageKey, sortBy, activeFilters])

  useEffect(() => {
    const rail = categoryScrollRef.current
    if (!rail) return

    const selectedButton = rail.querySelector("[data-category-selected='true']")
    if (!selectedButton || typeof selectedButton.scrollIntoView !== "function") return

    selectedButton.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    })
  }, [selectedCategory, categories])

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
    // Show loading when filter is toggled
    setIsLoadingFilterResults(true)
    setTimeout(() => {
      setIsLoadingFilterResults(false)
    }, 500)
  }

  // Scroll tracking effect for filter modal
  useEffect(() => {
    if (!isFilterOpen || !rightContentRef.current) return

    const observerOptions = {
      root: rightContentRef.current,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section-id')
          if (sectionId) {
            setActiveScrollSection(sectionId)
            setActiveFilterTab(sectionId)
          }
        }
      })
    }, observerOptions)

    Object.values(filterSectionRefs.current).forEach(ref => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [isFilterOpen])

  const toggleFavorite = (id) => {
    setFavorites(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Filter restaurants based on active filters and selected category
  // If category is selected, expand restaurants into dish cards (one card per matching dish)
  const filteredRecommended = useMemo(() => {
    const sourceData = restaurantsData.length > 0 ? restaurantsData : []
    let filtered = [...sourceData]

    // Filter by category - Dynamic filtering based on menu items
    if (selectedCategory && selectedCategory !== 'all') {
      const expandedDishes = []

      filtered.forEach(r => {
        if (r.menu) {
          const hasCategoryItem = checkCategoryInMenu(r.menu, selectedCategory)
          if (hasCategoryItem) {
            // Get ALL matching dishes for this category
            const categoryDishes = getAllCategoryDishesFromMenu(r.menu, selectedCategory)

            if (categoryDishes.length > 0) {
              const validDishes = vegMode
                ? categoryDishes.filter((dish) => dish.foodType === "Veg")
                : categoryDishes;

              validDishes.forEach((dishForCard) => {
                expandedDishes.push({
                  ...r,
                  id: `${r.id || r.restaurantId}-${dishForCard.itemId}`,
                  dishId: dishForCard.itemId || `${r.id}-dish`,
                  categoryDish: dishForCard,
                  categoryDishName: dishForCard.name,
                  categoryDishPrice: dishForCard.price,
                  categoryDishImage: dishForCard.image,
                })
              })
            }
          }
        }
      })

      filtered = expandedDishes

      if (filtered.length === 0) {
        const fallbackDishes = getCategoryFallbackDishesFromApprovedFoods(selectedCategory, sourceData)
        filtered = vegMode
          ? fallbackDishes.filter((dish) => dish.categoryDishFoodType === "Veg")
          : fallbackDishes
      }
    }

    return applyFiltersAndSorting(filtered)
  }, [selectedCategory, activeFilters, deferredSearchQuery, restaurantsData, categoryKeywords, vegMode, approvedFoodsData, sortBy])

  const filteredAllRestaurants = useMemo(() => {
    const sourceData = restaurantsData.length > 0 ? restaurantsData : []
    let filtered = [...sourceData]

    // Filter by category - Dynamic filtering based on menu items
    // If category is selected, expand restaurants into dish cards (one card per matching dish)
    if (selectedCategory && selectedCategory !== 'all') {
      const expandedDishes = []

      filtered.forEach(r => {
        if (r.menu) {
          const hasCategoryItem = checkCategoryInMenu(r.menu, selectedCategory)
          if (hasCategoryItem) {
            // Get ALL matching dishes for this category
            const categoryDishes = getAllCategoryDishesFromMenu(r.menu, selectedCategory)

            if (categoryDishes.length > 0) {
              const validDishes = vegMode
                ? categoryDishes.filter((dish) => dish.foodType === "Veg")
                : categoryDishes;

              validDishes.forEach((dishForCard) => {
                expandedDishes.push({
                  ...r,
                  id: `${r.id || r.restaurantId}-${dishForCard.itemId}`,
                  dishId: dishForCard.itemId || `${r.id}-dish`,
                  categoryDish: dishForCard,
                  categoryDishName: dishForCard.name,
                  categoryDishPrice: dishForCard.price,
                  categoryDishImage: dishForCard.image,
                })
              })
            }
          }
        }
      })

      filtered = expandedDishes

      if (filtered.length === 0) {
        const fallbackDishes = getCategoryFallbackDishesFromApprovedFoods(selectedCategory, sourceData)
        filtered = vegMode
          ? fallbackDishes.filter((dish) => dish.categoryDishFoodType === "Veg")
          : fallbackDishes
      }
    }

    return applyFiltersAndSorting(filtered)
  }, [selectedCategory, activeFilters, deferredSearchQuery, restaurantsData, categoryKeywords, vegMode, approvedFoodsData, sortBy])

  const showRestaurantSkeleton = useDelayedLoading(
    isLoadingFilterResults || loadingRestaurants || (isEnrichingMenus && selectedCategory !== 'all' && filteredRecommended.length === 0),
    { delay: 140, minDuration: 360 }
  )

  const handleCategorySelect = (category) => {
    const categorySlug = category.slug || category.id
    setSelectedCategory(categorySlug)
    // Update URL to reflect category change
    if (categorySlug === 'all') {
      navigate('/food/user/category/all')
    } else {
      navigate(`/food/user/category/${categorySlug}`)
    }
  }

  // Check if should show grayscale (user out of service)
  const shouldShowGrayscale = isOutOfService
  const isCategoryView = selectedCategory && selectedCategory !== 'all'

  const pageTitle = useMemo(() => {
    if (!selectedCategory || selectedCategory === "all") return "All dishes"
    const match = categories.find((cat) => {
      const slug = cat.slug || cat.id
      return slug === selectedCategory || cat.id === selectedCategory
    })
    if (match?.name) return match.name
    return String(selectedCategory).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }, [categories, selectedCategory])

  const filterChipClass = (isActive) =>
    `h-8 sm:h-9 px-3 sm:px-3.5 rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0 text-xs sm:text-sm font-semibold transition-all border ${
      isActive
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
    }`

  return (
    <div className={`min-h-dvh bg-[#f7f8fa] dark:bg-[#0a0a0a] pb-24 ${shouldShowGrayscale ? "grayscale opacity-75" : ""}`}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur-md dark:border-gray-800 dark:bg-[#1a1a1a]/95">
        <div className="mx-auto max-w-7xl pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 md:px-6 md:py-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-[#1a1a1a] dark:hover:bg-gray-800"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Category</p>
              <h1 className="truncate text-base font-extrabold text-gray-900 dark:text-white sm:text-lg">{pageTitle}</h1>
            </div>
          </div>

          <div className="px-3 pb-3 sm:px-4 md:px-6">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search restaurant or dish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-2xl border-gray-200 bg-gray-50 pl-10 pr-4 text-sm focus:border-green-300 focus:bg-white dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white sm:h-12 sm:text-base"
              />
            </div>
          </div>

          {/* Browse Category Section */}
          <div
            ref={categoryScrollRef}
            className="flex gap-3 overflow-x-auto border-b border-gray-100 bg-white px-3 py-2.5 scrollbar-hide sm:gap-4 sm:px-4 md:gap-5 md:px-6 md:py-3 dark:border-gray-800 dark:bg-[#1a1a1a]"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {showCategorySkeleton ? (
              <CategoryChipRowSkeleton className="py-3" />
            ) : (
              categories && categories.length > 0 ? categories.map((cat) => {
                const categorySlug = cat.slug || cat.id
                const isSelected = selectedCategory === categorySlug || selectedCategory === cat.id
                const isAllCategory = categorySlug === "all" || cat.id === "all"
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat)}
                    data-category-selected={isSelected ? "true" : "false"}
                    className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 pb-1 transition-all sm:w-20 md:w-24"
                  >
                    {isAllCategory ? (
                      <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all sm:h-16 sm:w-16 md:h-[4.5rem] md:w-[4.5rem] ${isSelected ? "border-green-500 bg-green-50 shadow-sm" : "border-gray-200 bg-white dark:border-gray-700 dark:bg-[#222]"}`}>
                        <Grid2x2 className={`h-5 w-5 sm:h-6 sm:w-6 ${isSelected ? "text-green-600" : "text-gray-400"}`} />
                      </div>
                    ) : cat.image ? (
                  <div className={`h-14 w-14 overflow-hidden rounded-full border-2 transition-all sm:h-16 sm:w-16 md:h-[4.5rem] md:w-[4.5rem] ${isSelected ? "border-green-500 shadow-sm ring-2 ring-green-100" : "border-gray-200"
                        }`}>
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // If the backend image is missing/broken, show initials instead of fake assets.
                            e.target.style.display = 'none'
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-gray-100 transition-all sm:h-16 sm:w-16 md:h-[4.5rem] md:w-[4.5rem] dark:bg-gray-800 ${isSelected ? "border-green-500 bg-green-50 shadow-sm ring-2 ring-green-100 dark:bg-green-950/20" : "border-gray-200"
                          }`}
                        aria-label={`${cat.name} category`}
                      >
                        <span className="text-sm md:text-base font-semibold text-gray-600 dark:text-gray-300">
                          {String(cat.name || "?").trim().slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className={`max-w-[4.5rem] truncate text-center text-[11px] font-semibold sm:max-w-none sm:text-xs md:text-sm ${isSelected ? "text-green-700" : "text-gray-500 dark:text-gray-400"
                      }`}>
                      {cat.name}
                    </span>
                  </button>
                )
              }) : (
                <div className="flex items-center justify-center py-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">No categories available</span>
                </div>
              )
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-2 px-3 py-2.5 sm:px-4 md:px-6 md:py-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setIsFilterOpen(true)}
                className={filterChipClass(false)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
              </button>
              {[
                { id: 'under-30-mins', label: 'Under 30 mins' },
                { id: 'delivery-under-45', label: 'Under 45 mins' },
                { id: 'rating-4-plus', label: '4.0+' },
                { id: 'rating-45-plus', label: '4.5+' },
                { id: 'distance-under-1km', label: 'Under 1 km', icon: MapPin },
                { id: 'distance-under-2km', label: 'Under 2 km', icon: MapPin },
                { id: 'flat-50-off', label: '50% OFF' },
                { id: 'under-250', label: 'Under ₹250' },
              ].map((filter) => {
                const Icon = filter.icon
                const isActive = activeFilters.has(filter.id)
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => toggleFilter(filter.id)}
                    className={filterChipClass(isActive)}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {filter.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6 px-3 py-4 sm:space-y-8 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* RECOMMENDED FOR YOU Section - Hide when "All" category is selected */}
          {filteredRecommended.length > 0 && selectedCategory !== 'all' && (
            <section>
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 sm:mb-4 md:text-xs">
                Recommended for you
              </h2>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {(isCategoryView
                  ? filteredRecommended
                  : filteredRecommended.slice(0, 6)
                ).map((restaurant) => {
                  return (
                    <Link
                      key={restaurant.id}
                      to={`/food/user/restaurants/${restaurant.name.toLowerCase().replace(/\s+/g, '-')}`}
                      className="block"
                    >
                      <div className={`group ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
                        {/* Image Container */}
                        <div className="relative mb-2 aspect-square overflow-hidden rounded-2xl border border-gray-100 bg-white">
                          {/* Use category dish image if available, otherwise restaurant image */}
                          {restaurant.categoryDishImage ? (
                            <img
                              src={restaurant.categoryDishImage}
                              alt={restaurant.categoryDishName || restaurant.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                // Fallback to restaurant image if dish image fails
                                if (restaurant.image) {
                                  e.target.src = restaurant.image
                                } else {
                                  // Show emoji placeholder
                                  e.target.style.display = 'none'
                                  const placeholder = document.createElement('div')
                                  placeholder.className = 'w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl'
                                  placeholder.textContent = '???'
                                  e.target.parentElement.appendChild(placeholder)
                                }
                              }}
                            />
                          ) : restaurant.image ? (
                            <img
                              src={restaurant.image}
                              alt={restaurant.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                // Show emoji placeholder
                                e.target.style.display = 'none'
                                const placeholder = document.createElement('div')
                                placeholder.className = 'w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl'
                                placeholder.textContent = '???'
                                e.target.parentElement.appendChild(placeholder)
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl">
                              ???
                            </div>
                          )}

                          {/* Offer Badge */}
                          {restaurant.offer && (
                            <div className="absolute top-1.5 left-1.5 rounded-md border border-green-100 bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 sm:text-xs">
                              {restaurant.offer}
                            </div>
                          )}

                          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-gray-900 shadow-sm sm:text-xs">
                            {restaurant.rating}
                            <Star className="h-2.5 w-2.5 fill-green-600 text-green-600 sm:h-3 sm:w-3" />
                          </div>
                        </div>

                        <h3 className="font-semibold text-gray-900 dark:text-white text-xs md:text-sm line-clamp-1">
                          {isCategoryView ? (restaurant.categoryDishName || restaurant.featuredDish || restaurant.name) : restaurant.name}
                        </h3>
                        {isCategoryView && (
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                            {restaurant.name}
                          </p>
                        )}
                        {restaurant.deliveryTime && (
                          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-[10px] md:text-xs">
                            <Clock className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            <span>{restaurant.deliveryTime}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* ALL RESTAURANTS Section */}
          <section className="relative">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 sm:mb-4 md:text-xs">
              All restaurants
            </h2>

            {/* Loading Overlay */}
            {showRestaurantSkeleton && (
              <div className="absolute inset-0 z-10 rounded-lg bg-white/92 backdrop-blur-sm dark:bg-[#1a1a1a]/92">
                <LoadingSkeletonRegion label="Loading restaurants" className="h-full p-1 sm:p-2">
                  <RestaurantGridSkeleton count={4} compact />
                </LoadingSkeletonRegion>
              </div>
            )}

            {/* Large Restaurant Cards */}
            <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5 items-stretch ${showRestaurantSkeleton ? "opacity-50" : "opacity-100"} transition-opacity duration-300`}>
              {filteredAllRestaurants.map((restaurant) => {
                const restaurantSlug = restaurant.name.toLowerCase().replace(/\s+/g, "-")
                const isFavorite = favorites.has(restaurant.id)

                return (
                  <Link key={restaurant.id} to={`/food/user/restaurants/${restaurantSlug}`} className="flex h-full">
                    <Card className={`flex h-full w-full flex-col gap-0 overflow-hidden rounded-2xl border border-gray-100 bg-white py-0 shadow-sm transition-all duration-300 hover:shadow-md dark:border-gray-800 dark:bg-[#1a1a1a] ${shouldShowGrayscale ? "grayscale opacity-75" : ""}`}>
                      <div className="relative h-40 w-full shrink-0 overflow-hidden sm:h-44 md:h-48 lg:h-52">
                        {/* Use category dish image if available, otherwise restaurant image */}
                        {restaurant.categoryDishImage ? (
                          <img
                            src={restaurant.categoryDishImage}
                            alt={restaurant.categoryDishName || restaurant.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              // Fallback to restaurant image if dish image fails
                              if (restaurant.image) {
                                e.target.src = restaurant.image
                              } else {
                                // Show emoji placeholder
                                e.target.style.display = 'none'
                                const placeholder = document.createElement('div')
                                placeholder.className = 'w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl'
                                placeholder.textContent = '???'
                                e.target.parentElement.appendChild(placeholder)
                              }
                            }}
                          />
                        ) : restaurant.image ? (
                          <img
                            src={restaurant.image}
                            alt={restaurant.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              // Show emoji placeholder
                              e.target.style.display = 'none'
                              const placeholder = document.createElement('div')
                              placeholder.className = 'w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl'
                              placeholder.textContent = '???'
                              e.target.parentElement.appendChild(placeholder)
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl">
                            ???
                          </div>
                        )}

                        {/* Category Dish Badge - Top Left (shows category dish if available, otherwise featured dish) */}
                        {(isCategoryView ? restaurant.categoryDishPrice : (restaurant.categoryDishName || restaurant.featuredDish)) && (
                          <div className="absolute top-2.5 left-2.5">
                            <div className="rounded-lg border border-gray-200 bg-white/95 px-2.5 py-1 text-xs font-semibold text-gray-800 shadow-sm backdrop-blur-sm">
                              {isCategoryView
                                ? `₹${restaurant.categoryDishPrice || restaurant.featuredPrice || 0}`
                                : `${restaurant.categoryDishName || restaurant.featuredDish} • ₹${restaurant.categoryDishPrice || restaurant.featuredPrice}`}
                            </div>
                          </div>
                        )}

                        {/* Ad Badge */}
                        {restaurant.isAd && (
                          <div className="absolute top-3 right-14 bg-black/50 text-white text-[10px] md:text-xs px-2 py-0.5 rounded">
                            Ad
                          </div>
                        )}

                        {/* Bookmark Icon - Top Right */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2.5 right-2.5 h-8 w-8 rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm hover:bg-white dark:border-gray-700 dark:bg-[#1a1a1a]/90"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            toggleFavorite(restaurant.id)
                          }}
                        >
                          <Bookmark className={`h-5 w-5 md:h-6 md:w-6 ${isFavorite ? "fill-gray-800 dark:fill-gray-200 text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400"}`} strokeWidth={2} />
                        </Button>
                      </div>

                      {/* Content Section */}
                      <CardContent className="flex flex-1 flex-col gap-0 p-3 sm:p-4">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="line-clamp-1 text-sm font-bold text-gray-900 dark:text-white sm:text-base md:line-clamp-2">
                              {isCategoryView ? (restaurant.categoryDishName || restaurant.featuredDish || restaurant.name) : restaurant.name}
                            </h3>
                            {isCategoryView && (
                              <p className="mt-1 text-sm md:text-base text-gray-500 dark:text-gray-400 line-clamp-1">
                                {restaurant.name}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-green-50 px-2 py-0.5 text-green-700">
                            <span className="text-xs font-bold sm:text-sm">{restaurant.rating}</span>
                            <Star className="h-3 w-3 fill-green-600 text-green-600 sm:h-3.5 sm:w-3.5" />
                          </div>
                        </div>

                        {/* Delivery Time & Distance */}
                        {(restaurant.deliveryTime || restaurant.distance) && (
                          <div className="mb-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                            {restaurant.deliveryTime && (
                              <>
                                <Clock className="h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6" strokeWidth={1.5} />
                                <span className="font-medium">{restaurant.deliveryTime}</span>
                              </>
                            )}
                            {restaurant.deliveryTime && restaurant.distance && <span className="mx-1">|</span>}
                            {restaurant.distance && (
                              <span className="font-medium">{restaurant.distance}</span>
                            )}
                          </div>
                        )}

                        {/* Offer Badge */}
                        {restaurant.offer && (
                          <div className="mt-auto flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 sm:text-sm">
                            <BadgePercent className="h-3.5 w-3.5 text-green-600" strokeWidth={2} />
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{restaurant.offer}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>

            {/* Empty State */}
            {filteredAllRestaurants.length === 0 && (
              <div className="text-center py-12 md:py-16">
                <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">
                  {searchQuery
                    ? `No restaurants found for "${searchQuery}"`
                    : "No restaurants found with selected filters"}
                </p>
                <Button
                  variant="outline"
                  className="mt-4 md:mt-6"
                  onClick={() => {
                    setIsLoadingFilterResults(true)
                    setActiveFilters(new Set())
                    setSearchQuery("")
                    setSortBy(null)
                    // Trigger a gentle refresh to ensure data freshness
                    menuEnrichmentRequestRef.current += 1
                    setIsEnrichingMenus(false)
                    setTimeout(() => setIsLoadingFilterResults(false), 500)
                  }}
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Filter Modal - Bottom Sheet */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isFilterOpen && (
              <div className="fixed inset-0 z-[100]">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-black/50"
                  onClick={() => setIsFilterOpen(false)}
                />

                {/* Modal Content */}
                <div className="absolute bottom-0 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-4xl bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl max-h-[85vh] md:max-h-[90vh] flex flex-col animate-[slideUp_0.3s_ease-out]">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Filters and sorting</h2>
                    <button
                      onClick={() => {
                        setIsLoadingFilterResults(true)
                        setActiveFilters(new Set())
                        setSortBy(null)
                        setTimeout(() => setIsLoadingFilterResults(false), 500)
                      }}
                      className="text-green-700 font-medium text-sm md:text-base hover:underline"
                    >
                      Clear all
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar - Tabs */}
                    <div className="w-24 sm:w-28 md:w-32 bg-gray-50 dark:bg-[#0a0a0a] border-r border-gray-200 dark:border-gray-800 flex flex-col">
                      {[
                        { id: 'sort', label: 'Sort By', icon: ArrowDownUp },
                        { id: 'time', label: 'Time', icon: Timer },
                        { id: 'rating', label: 'Rating', icon: Star },
                        { id: 'distance', label: 'Distance', icon: MapPin },
                        { id: 'price', label: 'Dish Price', icon: IndianRupee },
                        { id: 'offers', label: 'Offers', icon: BadgePercent },
                        { id: 'trust', label: 'Trust', icon: ShieldCheck },
                      ].map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeScrollSection === tab.id || activeFilterTab === tab.id
                        return (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setActiveFilterTab(tab.id)
                              const section = filterSectionRefs.current[tab.id]
                              if (section) {
                                section.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }
                            }}
                            className={`flex flex-col items-center gap-1 py-4 px-2 text-center relative transition-colors ${isActive ? 'bg-white dark:bg-[#1a1a1a] text-green-700' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                              }`}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-600 rounded-r" />
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
                      <div
                        ref={el => filterSectionRefs.current['sort'] = el}
                        data-section-id="sort"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Sort by</h3>
                        <div className="flex flex-col gap-3">
                          {[
                            { id: null, label: 'Relevance' },
                            { id: 'price-low', label: 'Price: Low to High' },
                            { id: 'price-high', label: 'Price: High to Low' },
                            { id: 'rating-high', label: 'Rating: High to Low' },
                            { id: 'rating-low', label: 'Rating: Low to High' },
                          ].map((option) => (
                            <button
                              key={option.id || 'relevance'}
                              onClick={() => setSortBy(option.id)}
                              className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${sortBy === option.id
                                ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-green-200'
                                }`}
                            >
                              <span className={`text-sm md:text-base font-medium ${sortBy === option.id ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                {option.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Time Tab */}
                      <div
                        ref={el => filterSectionRefs.current['time'] = el}
                        data-section-id="time"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Estimated Time</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('under-30-mins')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('under-30-mins')
                              ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-200'
                              }`}
                          >
                            <Timer className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('under-30-mins') ? 'text-green-700' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('under-30-mins') ? 'text-green-700' : 'text-gray-700 dark:text-gray-300'}`}>Under 30 mins</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('delivery-under-45')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('delivery-under-45')
                              ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-200'
                              }`}
                          >
                            <Timer className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('delivery-under-45') ? 'text-green-700' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('delivery-under-45') ? 'text-green-700' : 'text-gray-700 dark:text-gray-300'}`}>Under 45 mins</span>
                          </button>
                        </div>
                      </div>

                      {/* Rating Tab */}
                      <div
                        ref={el => filterSectionRefs.current['rating'] = el}
                        data-section-id="rating"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Restaurant Rating</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('rating-35-plus')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('rating-35-plus')
                              ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-200'
                              }`}
                          >
                            <Star className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('rating-35-plus') ? 'text-green-700 fill-green-600' : 'text-gray-400 dark:text-gray-500'}`} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('rating-35-plus') ? 'text-green-700' : 'text-gray-700 dark:text-gray-300'}`}>Rated 3.5+</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('rating-4-plus')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('rating-4-plus')
                              ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-200'
                              }`}
                          >
                            <Star className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('rating-4-plus') ? 'text-green-700 fill-green-600' : 'text-gray-400 dark:text-gray-500'}`} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('rating-4-plus') ? 'text-green-700' : 'text-gray-700 dark:text-gray-300'}`}>Rated 4.0+</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('rating-45-plus')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('rating-45-plus')
                              ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-200'
                              }`}
                          >
                            <Star className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('rating-45-plus') ? 'text-green-700 fill-green-600' : 'text-gray-400 dark:text-gray-500'}`} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('rating-45-plus') ? 'text-green-700' : 'text-gray-700 dark:text-gray-300'}`}>Rated 4.5+</span>
                          </button>
                        </div>
                      </div>

                      {/* Distance Tab */}
                      <div
                        ref={el => filterSectionRefs.current['distance'] = el}
                        data-section-id="distance"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Distance</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('distance-under-1km')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('distance-under-1km')
                              ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-200'
                              }`}
                          >
                            <MapPin className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('distance-under-1km') ? 'text-green-700' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('distance-under-1km') ? 'text-green-700' : 'text-gray-700 dark:text-gray-300'}`}>Under 1 km</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('distance-under-2km')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('distance-under-2km')
                              ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-200'
                              }`}
                          >
                            <MapPin className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('distance-under-2km') ? 'text-green-700' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('distance-under-2km') ? 'text-green-700' : 'text-gray-700 dark:text-gray-300'}`}>Under 2 km</span>
                          </button>
                        </div>
                      </div>

                      {/* Price Tab */}
                      <div
                        ref={el => filterSectionRefs.current['price'] = el}
                        data-section-id="price"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Dish Price</h3>
                        <div className="flex flex-col gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('price-under-200')}
                            className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${activeFilters.has('price-under-200')
                              ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-200'
                              }`}
                          >
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('price-under-200') ? 'text-green-700' : 'text-gray-700 dark:text-gray-300'}`}>Under ₹200</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('under-250')}
                            className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${activeFilters.has('under-250')
                              ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-200'
                              }`}
                          >
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('under-250') ? 'text-green-700' : 'text-gray-700 dark:text-gray-300'}`}>Under ₹250</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('price-under-500')}
                            className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${activeFilters.has('price-under-500')
                              ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-200'
                              }`}
                          >
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('price-under-500') ? 'text-green-700' : 'text-gray-700 dark:text-gray-300'}`}>Under ₹500</span>
                          </button>
                        </div>
                      </div>

                      {/* Offers Tab */}
                      <div
                        ref={el => filterSectionRefs.current['offers'] = el}
                        data-section-id="offers"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Offers</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('flat-50-off')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('flat-50-off')
                              ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-200'
                              }`}
                          >
                            <BadgePercent className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('flat-50-off') ? 'text-green-700' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('flat-50-off') ? 'text-green-700' : 'text-gray-700 dark:text-gray-300'}`}>Flat 50% OFF</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('price-match')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('price-match')
                              ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-200'
                              }`}
                          >
                            <BadgePercent className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('price-match') ? 'text-green-700' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('price-match') ? 'text-green-700' : 'text-gray-700 dark:text-gray-300'}`}>Price Match</span>
                          </button>
                        </div>
                      </div>

                      {/* Trust Markers Tab */}
                      {activeFilterTab === 'trust' && (
                        <div className="space-y-4">
                          <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">Trust Markers</h3>
                          <div className="flex flex-col gap-3 md:gap-4">
                            <button className="px-4 md:px-5 py-3 md:py-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-green-200 text-left transition-colors">
                              <span className="text-sm md:text-base font-medium text-gray-700 dark:text-gray-300">Top Rated</span>
                            </button>
                            <button className="px-4 md:px-5 py-3 md:py-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-green-200 text-left transition-colors">
                              <span className="text-sm md:text-base font-medium text-gray-700 dark:text-gray-300">Trusted by 1000+ users</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-4 px-4 md:px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a1a]">
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="flex-1 py-3 md:py-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-sm md:text-base"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setIsLoadingFilterResults(true)
                        setIsFilterOpen(false)
                        // Simulate loading for 500ms
                        setTimeout(() => {
                          setIsLoadingFilterResults(false)
                        }, 500)
                      }}
                      className={`flex-1 py-3 md:py-4 font-semibold rounded-xl transition-colors text-sm md:text-base ${activeFilters.size > 0 || sortBy
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                    >
                      {activeFilters.size > 0 || sortBy
                        ? 'Show results'
                        : 'Show results'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      <style>{`
        @keyframes slideUp {
          0% {
            transform: translateY(100%);
          }
          100% {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}


