import { useState, useMemo, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Search, Download, ChevronDown, Eye, Settings, ArrowUpDown, Loader2, X, MapPin, Phone, Mail, Clock, Star, Building2, User, FileText, CreditCard, Calendar, Image as ImageIcon, ExternalLink, ShieldX, AlertTriangle, Trash2, Plus, MoreVertical, CheckCircle2, XCircle, RefreshCw } from "lucide-react"
import { adminAPI, restaurantAPI, uploadAPI } from "@food/api"
import { clearModuleAuth } from "@food/utils/auth"
import {
  fetchApprovedRestaurantsCached,
  fetchRestaurantDetailCached,
  getZonesCached,
  hasFullRestaurantDetails,
  invalidateApprovedRestaurantsCache,
  invalidateRestaurantDetailCache,
  parseApprovedRestaurantsResponse,
  prefetchRestaurantDetail,
} from "@food/utils/adminRestaurantCache"
import { isRestaurantBanned } from "@food/utils/restaurantBan"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { exportRestaurantsToPDF } from "@food/components/admin/restaurants/restaurantsExportUtils"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import OutletTimingsEditor from "@food/components/admin/OutletTimingsEditor"
import { DAY_NAMES, getDefaultDays } from "@food/utils/outletTimingsUtils"
import { fetchOutletTimingsCached, clearOutletTimingsCache } from "@food/utils/outletTimingsCache"
import { clearRestaurantListCache } from "@food/utils/restaurantListCache"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

// Inline placeholder (no external request, avoids referrer policy / 500 from via.placeholder)
const PLACEHOLDER_40 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect fill='%23e2e8f0' width='40' height='40'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-size='12' font-family='sans-serif'%3E?%3C/text%3E%3C/svg%3E"
const PLACEHOLDER_128 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Crect fill='%23e2e8f0' width='128' height='128'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-size='32' font-family='sans-serif'%3E?%3C/text%3E%3C/svg%3E"
const PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300

const zoneLabelFromRestaurant = (restaurant, zonesList = []) => {
  const zid = restaurant?.zoneId
  const zoneName =
    (typeof zid === "object" ? (zid?.name || zid?.zoneName) : "") ||
    ""
  if (zoneName) return zoneName

  const zoneIdString =
    typeof zid === "string"
      ? zid
      : (zid?._id || zid?.id || "")
  if (zoneIdString && Array.isArray(zonesList) && zonesList.length > 0) {
    const match = zonesList.find((z) => (z?._id || z?.id) === zoneIdString)
    const label = match?.name || match?.zoneName
    if (label) return label
  }

  return (
    restaurant?.zone ||
    restaurant?.location?.area ||
    restaurant?.location?.city ||
    restaurant?.area ||
    restaurant?.city ||
    "N/A"
  )
}

const mapRestaurantRow = (restaurant, index, zonesList = []) => ({
  id: restaurant._id || restaurant.id || index + 1,
  _id: restaurant._id,
  name: restaurant.name || restaurant.restaurantName || "N/A",
  ownerName: restaurant.ownerName || "N/A",
  ownerPhone: restaurant.ownerPhone || restaurant.phone || "N/A",
  zone: zoneLabelFromRestaurant(restaurant, zonesList),
  approvalStatus: normalizeApprovalStatus(restaurant),
  isActive: normalizeApprovalStatus(restaurant) !== "banned" && restaurant.isActive !== false,
  rating: restaurant.ratings?.average || restaurant.rating || 0,
  logo: getPrimaryRestaurantImage(restaurant, PLACEHOLDER_40),
  originalData: restaurant,
})

const normalizeApprovalStatus = (restaurant) => {
  if (isRestaurantBanned(restaurant)) return "banned"
  const raw = String(restaurant?.status || "").trim().toLowerCase()
  if (raw === "approved" || raw === "pending" || raw === "rejected" || raw === "banned") return raw
  return "pending"
}

const approvalStatusLabel = (status) => {
  if (status === "approved") return "Approved"
  if (status === "rejected") return "Rejected"
  if (status === "banned") return "Banned"
  return "Pending"
}

const approvalStatusBadgeClass = (status) => {
  if (status === "approved") return "bg-emerald-100 text-emerald-700"
  if (status === "rejected") return "bg-rose-100 text-rose-700"
  if (status === "banned") return "bg-slate-200 text-slate-800"
  return "bg-amber-100 text-amber-700"
}

const normalizeTimeValue = (value) => {
  const raw = String(value || "").trim()
  if (!raw) return ""
  const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmm) {
    const h = Number(hhmm[1]); const m = Number(hhmm[2])
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return ""
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }
  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/)
  if (ampm) {
    let h = Number(ampm[1]); const m = Number(ampm[2]); const p = ampm[3].toUpperCase()
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 1 || h > 12 || m < 0 || m > 59) return ""
    if (p === "AM") h = h === 12 ? 0 : h
    if (p === "PM") h = h === 12 ? 12 : h + 12
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`
  }
  return ""
}

const timeToMinutes = (value) => {
  const normalized = normalizeTimeValue(value)
  if (!normalized) return null
  const [h, m] = normalized.split(":").map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

const formatTime12Hour = (value) => {
  const normalized = normalizeTimeValue(value)
  if (!normalized) return value || "N/A"
  const [h, m] = normalized.split(":").map(Number)
  const hour12 = h % 12 === 0 ? 12 : h % 12
  const period = h >= 12 ? "PM" : "AM"
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`
}

const normalizeImageUrl = (image) => {
  if (!image) return ""
  if (typeof image === "string") return image
  if (typeof image === "object") return image.url || image.secure_url || ""
  return ""
}

const normalizeFileUrl = (file) => {
  if (!file) return ""
  if (typeof file === "string") return file
  if (typeof file === "object") return file.url || file.secure_url || ""
  return ""
}

const getPrimaryRestaurantImage = (restaurant, fallback = "") => {
  const profileImg = normalizeImageUrl(restaurant?.profileImage)
  if (profileImg) return profileImg

  const logoImg = normalizeImageUrl(restaurant?.logo)
  if (logoImg) return logoImg

  const restaurantImg = normalizeImageUrl(restaurant?.restaurantImage)
  if (restaurantImg) return restaurantImg

  const coverImages = Array.isArray(restaurant?.coverImages) ? restaurant.coverImages : []
  const firstCoverImage = coverImages.map(normalizeImageUrl).find(Boolean)
  if (firstCoverImage) return firstCoverImage

  const menuImages = Array.isArray(restaurant?.menuImages) ? restaurant.menuImages : []
  const firstMenuImage = menuImages.map(normalizeImageUrl).find(Boolean)
  if (firstMenuImage) return firstMenuImage

  return fallback
}


export default function RestaurantsList() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [inactiveCount, setInactiveCount] = useState(0)
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedRestaurant, setSelectedRestaurant] = useState(null)
  const [restaurantDetails, setRestaurantDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [banConfirmDialog, setBanConfirmDialog] = useState(null) // { restaurant, action: 'ban' | 'unban' }
  const [banning, setBanning] = useState(false)
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState(null) // { restaurant }
  const [deleting, setDeleting] = useState(false)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" })
  const [refreshKey, setRefreshKey] = useState(0)
  const isInitialFetchRef = useRef(true)
  const detailsRequestIdRef = useRef(0)
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsForm, setDetailsForm] = useState({
    name: "",
    pureVegRestaurant: false,
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    primaryContactNumber: "",
    email: "",
    estimatedDeliveryTime: "",
    outletTimings: getDefaultDays(),
    isActive: true,
  })
  const [profileImageFile, setProfileImageFile] = useState(null)
  const [profileImagePreview, setProfileImagePreview] = useState("")
  const [isEditingLocation, setIsEditingLocation] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)
  const [locationEditError, setLocationEditError] = useState("")
  const [zones, setZones] = useState([])
  const [zonesLoading, setZonesLoading] = useState(false)
  const [filters, setFilters] = useState({
    all: "All",
    businessModel: "",
    zoneId: "",
  })
  const [locationForm, setLocationForm] = useState({
    zoneId: "",
    latitude: "",
    longitude: "",
    formattedAddress: "",
    addressLine1: "",
    addressLine2: "",
    area: "",
    city: "",
    state: "",
    landmark: "",
    pincode: "",
  })
  const locationSearchInputRef = useRef(null)
  const placesAutocompleteRef = useRef(null)

  // Format Restaurant ID to REST format (e.g., REST422829)
  const formatRestaurantId = (id) => {
    if (!id) return "REST000000"

    const idString = String(id)
    // Extract last 6 digits from the ID
    // Handle formats like "REST-1768045396242-2829" or "1768045396242-2829"
    const parts = idString.split(/[-.]/)
    let lastDigits = ""

    // Get the last part and extract digits
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1]
      // Extract only digits from the last part
      const digits = lastPart.match(/\d+/g)
      if (digits && digits.length > 0) {
        // Get last 6 digits from all digits found
        const allDigits = digits.join("")
        lastDigits = allDigits.slice(-6).padStart(6, "0")
      } else {
        // If no digits in last part, look for digits in all parts
        const allParts = parts.join("")
        const allDigits = allParts.match(/\d+/g)
        if (allDigits && allDigits.length > 0) {
          const combinedDigits = allDigits.join("")
          lastDigits = combinedDigits.slice(-6).padStart(6, "0")
        }
      }
    }

    // If no digits found, use a hash of the ID
    if (!lastDigits) {
      const hash = idString.split("").reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0) | 0
      }, 0)
      lastDigits = Math.abs(hash).toString().slice(-6).padStart(6, "0")
    }

    return `REST${lastDigits}`
  }

  // Debounce search (300ms) before server fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Load zones once per session for filters and labels
  useEffect(() => {
    getZonesCached()
      .then((list) => setZones(Array.isArray(list) ? list : []))
      .catch(() => setZones([]))
  }, [])

  const buildListParams = () => {
    const params = { page, limit: PAGE_SIZE }
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim()
    if (filters.all === "Active") params.isActive = "true"
    if (filters.all === "Inactive") params.isActive = "false"
    if (filters.zoneId) params.zoneId = filters.zoneId
    return params
  }

  // Fetch restaurants from backend API (cached per params)
  useEffect(() => {
    let cancelled = false
    const fetchRestaurants = async () => {
      try {
        setLoading(true)
        setError(null)

        const force = isInitialFetchRef.current || refreshKey > 0
        if (isInitialFetchRef.current) isInitialFetchRef.current = false

        const response = await fetchApprovedRestaurantsCached(buildListParams(), { force })

        if (cancelled) return

        const parsed = parseApprovedRestaurantsResponse(response)
        const mappedRestaurants = parsed.restaurants.map((restaurant, index) =>
          mapRestaurantRow(restaurant, index, zones),
        )

        setRestaurants(mappedRestaurants)
        setTotalCount(parsed.total)
        setActiveCount(parsed.activeCount)
        setInactiveCount(parsed.inactiveCount)
      } catch (err) {
        if (cancelled) return
        debugError("Error fetching restaurants:", err)
        const status = err?.response?.status
        const serverMessage = err?.response?.data?.message || err?.response?.data?.error
        if (status === 401) {
          setError(serverMessage || "Session expired or not logged in. Please log in as admin.")
          setRestaurants([])
          try {
            clearModuleAuth("admin")
          } catch (_) {}
          navigate("/admin/login", { replace: true, state: { from: "/admin/food/restaurants" } })
          return
        }
        setError(serverMessage || err.message || "Failed to fetch restaurants")
        setRestaurants([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchRestaurants()
    return () => { cancelled = true }
  }, [page, debouncedSearch, filters.all, filters.zoneId, zones.length, navigate, refreshKey])

  const [searchParams] = useSearchParams()
  const restaurantIdFromUrl = searchParams.get("restaurantId")

  useEffect(() => {
    if (restaurantIdFromUrl && restaurants.length > 0) {
      const restaurant = restaurants.find(r => r.id === restaurantIdFromUrl || r._id === restaurantIdFromUrl)
      if (restaurant) {
        handleViewDetails(restaurant)
      }
    }
  }, [restaurantIdFromUrl, restaurants])

  const displayedRestaurants = useMemo(() => {
    let result = [...restaurants]

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue, bValue;

        switch (sortConfig.key) {
          case 'sl':
            aValue = restaurants.indexOf(a);
            bValue = restaurants.indexOf(b);
            break;
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'owner':
            aValue = a.ownerName.toLowerCase();
            bValue = b.ownerName.toLowerCase();
            break;
          case 'zone':
            aValue = a.zone.toLowerCase();
            bValue = b.zone.toLowerCase();
            break;
          case 'rating':
            aValue = Number(a.rating) || 0;
            bValue = Number(b.rating) || 0;
            break;
          case 'status':
            aValue = String(a.approvalStatus || "").toLowerCase();
            bValue = String(b.approvalStatus || "").toLowerCase();
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result
  }, [restaurants, sortConfig])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const handleSort = (key) => {
    let direction = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const totalRestaurants = activeCount + inactiveCount
  const activeRestaurants = activeCount
  const inactiveRestaurants = inactiveCount

  const handleRestaurantRowHover = (restaurant) => {
    const restaurantId = restaurant._id || restaurant.id
    const fromList = restaurant.originalData || restaurant
    if (hasFullRestaurantDetails(fromList)) return
    prefetchRestaurantDetail(restaurantId)
  }

  // Show full phone number without masking
  const formatPhone = (phone) => {
    if (!phone) return ""
    return phone
  }

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating || 0);
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i} 
            className={`w-3.5 h-3.5 ${i < fullStars ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} 
          />
        ))}
        <span className="ml-1 text-slate-600">({rating || 0})</span>
      </div>
    )
  }

  const getLocationFromRestaurant = (restaurant) => {
    return (
      restaurant?.onboarding?.step1?.location ||
      restaurant?.location ||
      restaurant?.originalData?.location ||
      {}
    )
  }

  const formatLocationAddress = (location = {}, fallback = "N/A") => {
    if (!location || typeof location !== "object") return fallback
    if (location.formattedAddress) return location.formattedAddress
    if (location.address) return location.address
    const parts = [
      location.addressLine1,
      location.addressLine2,
      location.area,
      location.city,
      location.state,
      location.pincode || location.zipCode || location.postalCode,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(", ") : fallback
  }

  const normalizeLocationFormFromRestaurant = (restaurant) => {
    const loc = getLocationFromRestaurant(restaurant)
    const rawLat = loc.latitude ?? (Array.isArray(loc.coordinates) ? loc.coordinates[1] : "")
    const rawLng = loc.longitude ?? (Array.isArray(loc.coordinates) ? loc.coordinates[0] : "")
    const latNum = typeof rawLat === "number" ? rawLat : parseFloat(String(rawLat))
    const lngNum = typeof rawLng === "number" ? rawLng : parseFloat(String(rawLng))
    const hasValidNumbers = Number.isFinite(latNum) && Number.isFinite(lngNum)
    // Guard against common "unset" coordinates (0,0 or near-zero) that render as blank ocean.
    const looksUnset = hasValidNumbers && Math.abs(latNum) < 1 && Math.abs(lngNum) < 1
    const latitude = (hasValidNumbers && !looksUnset) ? latNum : ""
    const longitude = (hasValidNumbers && !looksUnset) ? lngNum : ""

    return {
      zoneId: restaurant?.zoneId || restaurant?.location?.zoneId || "",
      latitude: latitude || "",
      longitude: longitude || "",
      formattedAddress: loc.formattedAddress || loc.address || "",
      addressLine1: loc.addressLine1 || "",
      addressLine2: loc.addressLine2 || "",
      area: loc.area || "",
      city: loc.city || "",
      state: loc.state || "",
      landmark: loc.landmark || "",
      pincode: loc.pincode || loc.zipCode || loc.postalCode || "",
    }
  }

  const loadGoogleMapsScript = async () => {
    if (window.google?.maps?.places?.Autocomplete) return true

    const apiKey = await getGoogleMapsApiKey()
    if (!apiKey) {
      setLocationEditError("Google Maps API key is missing in Admin Environment Variables.")
      return false
    }

    // Surface auth/key/billing/referrer issues instead of showing a blank map.
    // Google invokes this global when the JS API loads but auth fails.
    window.gm_authFailure = () => {
      setLocationEditError(
        "Google Maps authentication failed. Check: Maps JavaScript API enabled, billing enabled, and HTTP referrer restrictions allow this domain."
      )
    }

    const existingScript = document.getElementById("admin-google-maps-script")
    if (existingScript) {
      await new Promise((resolve, reject) => {
        if (window.google?.maps?.places?.Autocomplete) {
          resolve()
          return
        }
        existingScript.addEventListener("load", resolve, { once: true })
        existingScript.addEventListener("error", reject, { once: true })
      })
      return !!window.google?.maps?.places?.Autocomplete
    }

    await new Promise((resolve, reject) => {
      const script = document.createElement("script")
      script.id = "admin-google-maps-script"
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`
      script.async = true
      script.defer = true
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })

    return !!window.google?.maps?.places?.Autocomplete
  }

  const initPlacesAutocomplete = async () => {
    if (!locationSearchInputRef.current) return
    if (placesAutocompleteRef.current) return
    setLocationEditError("")
    const loaded = await loadGoogleMapsScript()
    if (!loaded || !window.google?.maps?.places?.Autocomplete) {
      setLocationEditError("Unable to load Google Places Autocomplete.")
      return
    }

    placesAutocompleteRef.current = new window.google.maps.places.Autocomplete(
      locationSearchInputRef.current,
      {
        fields: ["formatted_address", "address_components", "geometry"],
        componentRestrictions: { country: "in" },
      }
    )

    const parsePlace = (place) => {
      const formattedAddress = place?.formatted_address || ""
      const comps = Array.isArray(place?.address_components) ? place.address_components : []
      const get = (types) => comps.find((c) => types.some((t) => c.types?.includes(t)))?.long_name || ""
      const area =
        get(["sublocality_level_1", "sublocality", "neighborhood"]) ||
        get(["locality"])
      const city =
        get(["locality"]) ||
        get(["administrative_area_level_2"])
      const state = get(["administrative_area_level_1"])
      const pincode = get(["postal_code"])
      const lat = place?.geometry?.location?.lat?.()
      const lng = place?.geometry?.location?.lng?.()
      return {
        formattedAddress,
        area,
        city,
        state,
        pincode,
        latitude: Number.isFinite(lat) ? Number(lat.toFixed(6)) : "",
        longitude: Number.isFinite(lng) ? Number(lng.toFixed(6)) : "",
      }
    }

    placesAutocompleteRef.current.addListener("place_changed", () => {
      const place = placesAutocompleteRef.current.getPlace()
      const parsed = parsePlace(place)
      setLocationForm((prev) => ({
        ...prev,
        formattedAddress: parsed.formattedAddress || prev.formattedAddress,
        addressLine1: parsed.formattedAddress || prev.addressLine1,
        area: parsed.area || prev.area,
        city: parsed.city || prev.city,
        state: parsed.state || prev.state,
        pincode: parsed.pincode || prev.pincode,
        latitude: parsed.latitude !== "" ? parsed.latitude : prev.latitude,
        longitude: parsed.longitude !== "" ? parsed.longitude : prev.longitude,
      }))
    })
  }

  const normalizeRestaurantTimings = (restaurant) => {
    if (!restaurant || typeof restaurant !== "object") return restaurant
    const outletTimings =
      restaurant.outletTimings && typeof restaurant.outletTimings === "object"
        ? { ...getDefaultDays(), ...restaurant.outletTimings }
        : getDefaultDays()
    return { ...restaurant, outletTimings }
  }

  // Prefer outletTimings from admin API (fresh DB read). Public timings endpoint can be HTTP-cached.
  const mergeOutletTimings = async (restaurant) => {
    if (!restaurant || typeof restaurant !== "object") return restaurant
    if (restaurant.outletTimings && typeof restaurant.outletTimings === "object") {
      return normalizeRestaurantTimings(restaurant)
    }

    const restaurantId = restaurant._id || restaurant.id
    if (!restaurantId) return normalizeRestaurantTimings(restaurant)

    try {
      const outletTimings = await fetchOutletTimingsCached(restaurantId, { force: true })
      return normalizeRestaurantTimings({
        ...restaurant,
        outletTimings: outletTimings && typeof outletTimings === "object" ? outletTimings : null,
      })
    } catch {
      return normalizeRestaurantTimings(restaurant)
    }
  }

  const applyRestaurantDetails = (merged) => {
    if (!merged) return null
    setRestaurantDetails(merged)
    setDetailsForm(buildDetailsFormFromRestaurant(merged))
    setProfileImagePreview(getPrimaryRestaurantImage(merged))
    return merged
  }

  const handleViewDetails = async (restaurant) => {
    const requestId = ++detailsRequestIdRef.current

    setIsEditingDetails(false)
    setProfileImageFile(null)
    setProfileImagePreview("")
    setIsEditingLocation(false)
    setSelectedRestaurant(restaurant)
    setLoadingDetails(true)
    setRestaurantDetails(null)

    const restaurantId = restaurant._id || restaurant.id || restaurant.restaurantId
    const fromList = restaurant.originalData || restaurant

    try {
      if (!restaurantId) {
        const merged = await mergeOutletTimings(fromList)
        if (requestId !== detailsRequestIdRef.current) return null
        return applyRestaurantDetails(merged)
      }

      invalidateRestaurantDetailCache(restaurantId)
      const data = await fetchRestaurantDetailCached(restaurantId, { force: true })
      if (requestId !== detailsRequestIdRef.current) return null

      const merged = await mergeOutletTimings(data || fromList)
      if (requestId !== detailsRequestIdRef.current) return null
      return applyRestaurantDetails(merged)
    } catch (err) {
      debugError("Error fetching restaurant details:", err)
      if (requestId !== detailsRequestIdRef.current) return null
      const merged = await mergeOutletTimings(fromList)
      if (requestId !== detailsRequestIdRef.current) return null
      return applyRestaurantDetails(merged)
    } finally {
      if (requestId === detailsRequestIdRef.current) {
        setLoadingDetails(false)
      }
    }
  }

  const handleEditLocation = async (restaurant) => {
    await handleViewDetails(restaurant)
    setIsEditingLocation(true)
  }

  const handleSaveLocation = async () => {
    if (!selectedRestaurant) return

    const restaurantId = selectedRestaurant._id || selectedRestaurant.id
    const latitude = Number(locationForm.latitude)
    const longitude = Number(locationForm.longitude)

    if (!locationForm.zoneId) {
      alert("Please select a zone")
      return
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !locationForm.formattedAddress) {
      alert("Please select a location from dropdown")
      return
    }

    try {
      setSavingLocation(true)
      const locationPayload = {
        zoneId: locationForm.zoneId,
        latitude,
        longitude,
        coordinates: [longitude, latitude],
        formattedAddress: locationForm.formattedAddress || "",
        address: locationForm.formattedAddress || "",
        addressLine1: locationForm.addressLine1 || locationForm.formattedAddress || "",
        addressLine2: locationForm.addressLine2 || "",
        area: locationForm.area || "",
        city: locationForm.city || "",
        state: locationForm.state || "",
        landmark: locationForm.landmark || "",
        pincode: locationForm.pincode || "",
        zipCode: locationForm.pincode || "",
        postalCode: locationForm.pincode || "",
      }

      const response = await adminAPI.updateRestaurantLocation(restaurantId, locationPayload)
      const updatedRestaurant = response?.data?.data?.restaurant

      if (updatedRestaurant?.location) {
        setRestaurantDetails((prev) => ({
          ...(prev || {}),
          ...updatedRestaurant,
          location: updatedRestaurant.location,
          onboarding: {
            ...(prev?.onboarding || {}),
            step1: {
              ...(prev?.onboarding?.step1 || {}),
              location: updatedRestaurant.location,
            },
          },
        }))

        setRestaurants((prev) =>
          prev.map((item) =>
            (item._id === restaurantId || item.id === restaurantId)
              ? {
                ...item,
                zone:
                  updatedRestaurant.location.area ||
                  updatedRestaurant.location.city ||
                  item.zone,
                originalData: {
                  ...(item.originalData || {}),
                  location: updatedRestaurant.location,
                },
              }
              : item,
          ),
        )
      }

      setIsEditingLocation(false)
      invalidateApprovedRestaurantsCache()
      invalidateRestaurantDetailCache(restaurantId)
      alert("Restaurant location updated successfully")
    } catch (err) {
      debugError("Error saving restaurant location:", err)
      alert(err?.response?.data?.message || "Failed to update restaurant location")
    } finally {
      setSavingLocation(false)
    }
  }

  useEffect(() => {
    if (!isEditingLocation || !selectedRestaurant) return

    const sourceRestaurant = restaurantDetails || selectedRestaurant?.originalData || selectedRestaurant
    const initialForm = normalizeLocationFormFromRestaurant(sourceRestaurant)
    setLocationForm(initialForm)
    setLocationEditError("")

    setZonesLoading(true)
    getZonesCached()
      .then((list) => setZones(Array.isArray(list) ? list : []))
      .catch(() => setZones([]))
      .finally(() => setZonesLoading(false))

    // Init dropdown autocomplete after mount.
    requestAnimationFrame(() => initPlacesAutocomplete())

    return () => {
      placesAutocompleteRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditingLocation, selectedRestaurant, restaurantDetails?._id])

  const getDetailsEditSource = () => {
    return restaurantDetails || selectedRestaurant?.originalData || selectedRestaurant || null
  }

  const buildDetailsFormFromRestaurant = (restaurant) => {
    if (!restaurant) {
      return {
        name: "",
        pureVegRestaurant: false,
        ownerName: "",
        ownerEmail: "",
        ownerPhone: "",
        primaryContactNumber: "",
        email: "",
        estimatedDeliveryTime: "",
        outletTimings: getDefaultDays(),
        isActive: true,
      }
    }

    const estimatedDeliveryTimeValue =
      restaurant.estimatedDeliveryTime ||
      restaurant.onboarding?.step4?.estimatedDeliveryTime ||
      ""

    return {
      name: restaurant.restaurantName || restaurant.name || "",
      pureVegRestaurant:
        typeof restaurant.pureVegRestaurant === "boolean"
          ? restaurant.pureVegRestaurant
          : false,
      ownerName: restaurant.ownerName || "",
      ownerEmail: restaurant.ownerEmail || "",
      ownerPhone: restaurant.ownerPhone || restaurant.phone || "",
      primaryContactNumber: restaurant.primaryContactNumber || restaurant.ownerPhone || "",
      email: restaurant.email || restaurant.ownerEmail || "",
      estimatedDeliveryTime: estimatedDeliveryTimeValue,
      outletTimings: restaurant.outletTimings && typeof restaurant.outletTimings === "object"
        ? { ...getDefaultDays(), ...restaurant.outletTimings }
        : getDefaultDays(),
      isActive: restaurant.isActive !== false,
    }
  }

  const handleStartEditDetails = async () => {
    const source = await mergeOutletTimings(getDetailsEditSource())
    setDetailsForm(buildDetailsFormFromRestaurant(source))
    setProfileImageFile(null)
    setProfileImagePreview(getPrimaryRestaurantImage(source))
    setIsEditingDetails(true)
  }

  // Opens the detail modal for a restaurant and immediately enters edit mode
  const handleEditDetailsFromTable = async (restaurant) => {
    const source = await handleViewDetails(restaurant)
    if (source) {
      setIsEditingDetails(true)
    }
  }

  const handleCancelEditDetails = () => {
    setIsEditingDetails(false)
    setProfileImageFile(null)
    setProfileImagePreview("")
  }

  const handleSaveDetails = async () => {
    if (!selectedRestaurant) return
    const restaurantId = selectedRestaurant._id || selectedRestaurant.id

    try {
      setSavingDetails(true)

      // Validate Phone & Email Uniqueness
      const source = getDetailsEditSource()
      const originalOwnerPhone = source?.ownerPhone || source?.phone || ""
      const originalOwnerEmail = source?.ownerEmail || ""
      const originalEmail = source?.email || source?.ownerEmail || ""

      const newOwnerPhone = detailsForm.ownerPhone.trim()
      const newOwnerEmail = detailsForm.ownerEmail.trim()
      const newEmail = detailsForm.email.trim()

      if (newOwnerPhone && newOwnerPhone !== originalOwnerPhone) {
        const phoneRes = await adminAPI.checkRestaurantPhone(newOwnerPhone)
        const phoneAvailable = phoneRes?.data?.data?.available ?? phoneRes?.data?.available
        if (!phoneAvailable) {
          alert("Owner phone number is already registered to another restaurant.")
          setSavingDetails(false)
          return
        }
      }

      if (newOwnerEmail && newOwnerEmail !== originalOwnerEmail) {
        const emailRes = await adminAPI.checkRestaurantEmail(newOwnerEmail)
        const emailAvailable = emailRes?.data?.data?.available ?? emailRes?.data?.available
        if (!emailAvailable) {
          alert("Owner email is already registered to another restaurant.")
          setSavingDetails(false)
          return
        }
      }

      if (newEmail && newEmail !== newOwnerEmail && newEmail !== originalEmail) {
        const emailRes = await adminAPI.checkRestaurantEmail(newEmail)
        const emailAvailable = emailRes?.data?.data?.available ?? emailRes?.data?.available
        if (!emailAvailable) {
          alert("Restaurant email is already registered to another restaurant.")
          setSavingDetails(false)
          return
        }
      }

      let profileImage = undefined
      if (profileImageFile) {
        const uploadRes = await uploadAPI.uploadMedia(profileImageFile, {
          folder: "appzeto/restaurant/profile",
        })
        const media = uploadRes?.data?.data?.file || uploadRes?.data?.data || uploadRes?.data?.file
        if (media?.url) {
          profileImage = { url: media.url, publicId: media.publicId || media.public_id }
        }
      }

      const payload = {
        name: detailsForm.name.trim(),
        pureVegRestaurant: detailsForm.pureVegRestaurant === true,
        ownerName: detailsForm.ownerName.trim(),
        ownerEmail: detailsForm.ownerEmail.trim(),
        ownerPhone: detailsForm.ownerPhone.trim(),
        primaryContactNumber: detailsForm.primaryContactNumber.trim(),
        email: detailsForm.email.trim(),
        estimatedDeliveryTime: detailsForm.estimatedDeliveryTime.trim(),
        outletTimings: detailsForm.outletTimings,
        isActive: detailsForm.isActive,
      }

      if (profileImage) {
        payload.profileImage = profileImage
      }

      const response = await adminAPI.updateRestaurant(restaurantId, payload)
      const updatedRestaurant =
        response?.data?.data?.restaurant ||
        response?.data?.data ||
        null

      if (updatedRestaurant) {
        const merged = await mergeOutletTimings(updatedRestaurant)
        applyRestaurantDetails(merged)
        setRestaurants((prev) =>
          prev.map((item) =>
            (item._id === restaurantId || item.id === restaurantId)
              ? {
                ...item,
                name: updatedRestaurant.name || item.name,
                ownerName: updatedRestaurant.ownerName || item.ownerName,
                ownerPhone: updatedRestaurant.ownerPhone || updatedRestaurant.phone || item.ownerPhone,
                zone: updatedRestaurant.location?.area || updatedRestaurant.location?.city || item.zone,
                isActive: updatedRestaurant.isActive !== false,
                approvalStatus: normalizeApprovalStatus(updatedRestaurant),
                logo: getPrimaryRestaurantImage(updatedRestaurant, item.logo),
                originalData: {
                  ...(item.originalData || {}),
                  ...updatedRestaurant,
                },
              }
              : item,
          ),
        )
      }

      setIsEditingDetails(false)
      setProfileImageFile(null)
      invalidateApprovedRestaurantsCache()
      invalidateRestaurantDetailCache(restaurantId)
      clearOutletTimingsCache()
      clearRestaurantListCache()
      alert("Restaurant details updated successfully")
    } catch (err) {
      debugError("Error updating restaurant details:", err)
      alert(err?.response?.data?.message || "Failed to update restaurant details")
    } finally {
      setSavingDetails(false)
    }
  }

  const closeDetailsModal = () => {
    setIsEditingDetails(false)
    setProfileImageFile(null)
    setProfileImagePreview("")
    setIsEditingLocation(false)
    setLocationEditError("")
    setSelectedRestaurant(null)
    setRestaurantDetails(null)
  }

  const handleDownloadMenuPdf = async (restaurant) => {
    const restaurantId = restaurant?._id || restaurant?.id
    if (!restaurantId) {
      alert("Restaurant ID not found")
      return
    }

    try {
      // Try method 1: Direct blob download via admin endpoint (auth via axios interceptor)
      try {
        const blobResponse = await adminAPI.downloadRestaurantMenuPdf(restaurantId)
        const blob = blobResponse?.data
        if (!(blob instanceof Blob)) {
          throw new Error('Invalid PDF response from server')
        }

        const blobUrl = window.URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = blobUrl
        link.download = `${restaurant?.restaurantName || "menu"}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(blobUrl)
        return
      } catch (blobError) {
        console.warn('Direct download failed, trying fallback method:', blobError)
        
        // Fallback method 2: Try to get the signed URL from backend
        const response = await adminAPI.getRestaurantMenuPdfUrl(restaurantId)
        let url = response?.data?.data?.url || response?.data?.data?.menuPdfUrl
        
        if (!url) {
          url = restaurant?.originalData?.menuPdf || restaurant?.menuPdf
          if (!url) {
            alert("Menu PDF not available")
            return
          }
        }

        // Try to download from the URL
        const urlResponse = await fetch(url, {
          headers: {
            'Accept': 'application/pdf'
          }
        })
        
        if (!urlResponse.ok) {
          throw new Error(`Failed to fetch PDF from URL: ${urlResponse.status}`)
        }
        
        const urlBlob = await urlResponse.blob()
        const urlBlobUrl = window.URL.createObjectURL(urlBlob)
        const urlLink = document.createElement("a")
        urlLink.href = urlBlobUrl
        urlLink.download = `${restaurant?.restaurantName || "menu"}.pdf`
        document.body.appendChild(urlLink)
        urlLink.click()
        document.body.removeChild(urlLink)
        window.URL.revokeObjectURL(urlBlobUrl)
      }
    } catch (err) {
      console.error('Download error:', err)
      
      // Try to extract meaningful error message
      let errorMsg = 'Failed to download menu PDF. Please try again.'
      
      if (err?.response?.data?.message) {
        errorMsg = err.response.data.message
      } else if (err?.message) {
        errorMsg = err.message
      } else if (typeof err === 'string') {
        errorMsg = err
      }
      
      // Check if it's a 404 - menu PDF not available
      if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('not uploaded')) {
        errorMsg += '\n\nPlease ensure a menu PDF has been uploaded for this restaurant.'
      }
      
      alert(errorMsg)
    }
  }

  // Handle ban/unban restaurant
  const handleBanRestaurant = (restaurant) => {
    const isBanned =
      restaurant.approvalStatus === "banned" ||
      isRestaurantBanned(restaurant.originalData || restaurant)
    setBanConfirmDialog({
      restaurant,
      action: isBanned ? 'unban' : 'ban'
    })
  }

  const confirmBanRestaurant = async () => {
    if (!banConfirmDialog) return

    const { restaurant, action } = banConfirmDialog
    const isBanning = action === 'ban'
    const newStatus = !isBanning
    const restaurantId = restaurant._id || restaurant.id
    const snapshot = {
      restaurants,
      activeCount,
      inactiveCount,
    }

    setRestaurants((prev) =>
      prev.map((r) =>
        r.id === restaurant.id || r._id === restaurant._id
          ? {
              ...r,
              isActive: newStatus,
              approvalStatus: newStatus ? "approved" : "banned",
            }
          : r,
      ),
    )
    if (newStatus) {
      setActiveCount((c) => c + 1)
      setInactiveCount((c) => Math.max(0, c - 1))
    } else {
      setActiveCount((c) => Math.max(0, c - 1))
      setInactiveCount((c) => c + 1)
    }
    setBanConfirmDialog(null)

    try {
      setBanning(true)
      await adminAPI.updateRestaurantStatus(restaurantId, newStatus)
      invalidateApprovedRestaurantsCache()
      invalidateRestaurantDetailCache(restaurantId)
      debugLog(`Restaurant ${isBanning ? 'banned' : 'unbanned'} successfully`)
    } catch (apiErr) {
      debugError("API Error:", apiErr)
      setRestaurants(snapshot.restaurants)
      setActiveCount(snapshot.activeCount)
      setInactiveCount(snapshot.inactiveCount)
      alert(apiErr?.response?.data?.message || `Failed to ${action} restaurant. Please try again.`)
    } finally {
      setBanning(false)
    }
  }

  const cancelBanRestaurant = () => {
    setBanConfirmDialog(null)
  }

  // Handle delete restaurant
  const handleDeleteRestaurant = (restaurant) => {
    setDeleteConfirmDialog({ restaurant })
  }

  const confirmDeleteRestaurant = async () => {
    if (!deleteConfirmDialog) return

    const { restaurant } = deleteConfirmDialog
    const restaurantId = restaurant._id || restaurant.id
    const snapshot = {
      restaurants,
      totalCount,
      activeCount,
      inactiveCount,
    }

    setRestaurants((prev) =>
      prev.filter((r) => r.id !== restaurant.id && r._id !== restaurant._id),
    )
    setTotalCount((c) => Math.max(0, c - 1))
    if (restaurant.isActive) {
      setActiveCount((c) => Math.max(0, c - 1))
    } else {
      setInactiveCount((c) => Math.max(0, c - 1))
    }
    setDeleteConfirmDialog(null)

    try {
      setDeleting(true)
      await adminAPI.deleteRestaurant(restaurantId)
      invalidateApprovedRestaurantsCache()
      invalidateRestaurantDetailCache(restaurantId)
      alert(`Restaurant "${restaurant.name}" deleted successfully!`)
    } catch (apiErr) {
      debugError("API Error:", apiErr)
      setRestaurants(snapshot.restaurants)
      setTotalCount(snapshot.totalCount)
      setActiveCount(snapshot.activeCount)
      setInactiveCount(snapshot.inactiveCount)
      alert(apiErr?.response?.data?.message || "Failed to delete restaurant. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  const cancelDeleteRestaurant = () => {
    setDeleteConfirmDialog(null)
  }

  // Handle export functionality
  const handleExport = () => {
    const dataToExport = displayedRestaurants.length > 0 ? displayedRestaurants : restaurants
    const filename = "restaurants_list"
    exportRestaurantsToPDF(dataToExport, filename)
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-10px_rgba(0,0,0,0.03)] border border-slate-100 p-3 sm:p-6 mb-3 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <div>
              <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight">Restaurants List</h1>
              <p className="hidden sm:block text-sm text-slate-500 mt-1">Manage and monitor all approved restaurants on the platform.</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-5 mb-3 sm:mb-6">
          {/* Total Restaurants */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-10px_rgba(0,0,0,0.03)] border border-slate-100 p-2.5 sm:p-5 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Total</p>
                <p className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{totalRestaurants}</p>
              </div>
              <div className="hidden sm:flex w-12 h-12 rounded-xl bg-blue-50/80 items-center justify-center border border-blue-100/50 shrink-0">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Active Restaurants */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-10px_rgba(0,0,0,0.03)] border border-slate-100 p-2.5 sm:p-5 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Active</p>
                <p className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{activeRestaurants}</p>
              </div>
              <div className="hidden sm:flex w-12 h-12 rounded-xl bg-emerald-50/80 items-center justify-center border border-emerald-100/50 shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* Inactive Restaurants */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-10px_rgba(0,0,0,0.03)] border border-slate-100 p-2.5 sm:p-5 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Inactive</p>
                <p className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{inactiveRestaurants}</p>
              </div>
              <div className="hidden sm:flex w-12 h-12 rounded-xl bg-rose-50/80 items-center justify-center border border-rose-100/50 shrink-0">
                <XCircle className="w-6 h-6 text-rose-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Restaurants List Section Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-10px_rgba(0,0,0,0.03)] border border-slate-200 p-3 sm:p-6 overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col gap-2 sm:gap-4 lg:flex-row lg:items-center lg:justify-between mb-3 sm:mb-6 pb-3 sm:pb-6 border-b border-slate-100">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Restaurants Directory</h2>
            
            <div className="flex flex-col gap-2 w-full lg:w-auto">
              {/* Search Bar */}
              <div className="relative w-full sm:max-w-xs lg:ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search restaurant or owner..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
              {/* Status Filter */}
              <select
                value={filters.all}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, all: e.target.value }))
                  setPage(1)
                }}
                className="shrink-0 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              {/* Zone Filter */}
              <select
                value={filters.zoneId}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, zoneId: e.target.value }))
                  setPage(1)
                }}
                className="shrink-0 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer max-w-[120px] sm:max-w-[150px]"
              >
                <option value="">All Zones</option>
                {zones.map((zone) => (
                  <option key={zone._id || zone.id} value={zone._id || zone.id}>
                    {zone.name || zone.zoneName}
                  </option>
                ))}
              </select>

              {/* Export Button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="shrink-0 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-all">
                    <Download className="w-4 h-4 text-slate-500" />
                    <span className="hidden sm:inline">Export</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                  <DropdownMenuLabel>Format</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExport} className="cursor-pointer flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>PDF Document</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Refresh Button */}
              <button
                onClick={() => {
                  invalidateApprovedRestaurantsCache()
                  setRefreshKey(k => k + 1)
                }}
                className="shrink-0 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-sm"
                title="Refresh List"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden min-[400px]:inline">Refresh</span>
              </button>

              {/* Add Restaurant Button */}
              <button
                onClick={() => navigate("/admin/food/restaurants/add")}
                className="shrink-0 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden min-[400px]:inline">Add Restaurant</span>
                <span className="min-[400px]:hidden">Add</span>
              </button>
              </div>
            </div>
          </div>

          {/* List Area */}
          <div className="w-full">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
                <p className="text-sm font-semibold text-slate-700">Loading restaurants...</p>
                <p className="text-xs text-slate-400 mt-1">Retrieving data from platform database</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <p className="text-base font-bold text-slate-800 mb-1">Failed to load restaurants</p>
                <p className="text-xs text-slate-500 mb-5">{error}</p>
                <button
                  type="button"
                  onClick={() => navigate("/admin/login", { replace: true, state: { from: "/admin/food/restaurants" } })}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Re-authenticate as admin
                </button>
              </div>
            ) : displayedRestaurants.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                  <Search className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">No restaurants match criteria</h3>
                <p className="text-sm text-slate-500 max-w-xs mb-5">
                  We couldn't find any restaurants matching your search query or status/zone filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("")
                    setFilters({ all: "All", businessModel: "", zoneId: "" })
                    setPage(1)
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm"
                >
                  Reset search & filters
                </button>
              </div>
            ) : (
              <>
                {/* Desktop/Tablet Table Layout */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-150">
                  <table className="w-full border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-150 sticky top-0 backdrop-blur-md z-10">
                      <tr>
                        <th
                          className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition-colors"
                          onClick={() => handleSort('sl')}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>SL</span>
                            <ArrowUpDown className={`w-3.5 h-3.5 ${sortConfig.key === 'sl' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </th>
                        <th
                          className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition-colors"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Restaurant Info</span>
                            <ArrowUpDown className={`w-3.5 h-3.5 ${sortConfig.key === 'name' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </th>
                        <th
                          className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition-colors"
                          onClick={() => handleSort('owner')}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Owner Info</span>
                            <ArrowUpDown className={`w-3.5 h-3.5 ${sortConfig.key === 'owner' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </th>
                        <th
                          className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition-colors"
                          onClick={() => handleSort('zone')}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Zone</span>
                            <ArrowUpDown className={`w-3.5 h-3.5 ${sortConfig.key === 'zone' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </th>
                        <th
                          className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition-colors"
                          onClick={() => handleSort('rating')}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Rating</span>
                            <ArrowUpDown className={`w-3.5 h-3.5 ${sortConfig.key === 'rating' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </th>
                        <th
                          className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition-colors"
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Status</span>
                            <ArrowUpDown className={`w-3.5 h-3.5 ${sortConfig.key === 'status' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider pr-10">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {displayedRestaurants.map((restaurant, index) => {
                        const menuPdfUrl = normalizeFileUrl(
                          restaurant.originalData?.menuPdf || restaurant.menuPdf
                        )
                        return (
                          <tr
                            key={restaurant.id}
                            className="hover:bg-slate-50/70 transition-colors"
                            onMouseEnter={() => handleRestaurantRowHover(restaurant)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                              {(page - 1) * PAGE_SIZE + index + 1}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer hover:opacity-90 transition-all border border-slate-150 shadow-sm"
                                  onClick={() => handleViewDetails(restaurant)}
                                >
                                  <img
                                    src={restaurant.logo}
                                    alt={restaurant.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.src = PLACEHOLDER_40
                                    }}
                                  />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span 
                                    className="text-sm font-semibold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors truncate max-w-[200px]"
                                    onClick={() => handleViewDetails(restaurant)}
                                  >
                                    {restaurant.name}
                                  </span>
                                  <span className="text-xs text-slate-400 font-mono mt-0.5">
                                    ID #{formatRestaurantId(restaurant.originalData?.restaurantId || restaurant.originalData?._id || restaurant._id || restaurant.id)}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-800">{restaurant.ownerName}</span>
                                <span className="text-xs text-slate-500 mt-0.5 font-mono">{formatPhone(restaurant.ownerPhone)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                              {restaurant.zone}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200/50 text-xs font-semibold">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                                <span>{(Number(restaurant.rating) || 0).toFixed(1)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col gap-1.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border w-fit ${approvalStatusBadgeClass(restaurant.approvalStatus)}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    restaurant.approvalStatus === "approved"
                                      ? "bg-emerald-500"
                                      : restaurant.approvalStatus === "rejected"
                                        ? "bg-rose-500"
                                        : restaurant.approvalStatus === "banned"
                                          ? "bg-slate-600"
                                          : "bg-amber-500"
                                  }`}></span>
                                  {approvalStatusLabel(restaurant.approvalStatus)}
                                </span>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border w-fit ${
                                  restaurant.isActive 
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/40" 
                                    : "bg-slate-50 text-slate-500 border-slate-200/40"
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    restaurant.isActive ? "bg-emerald-500" : "bg-slate-400"
                                  }`}></span>
                                  Outlet: {restaurant.isActive ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right pr-10">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button 
                                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-all focus-visible:ring-2 focus-visible:ring-blue-500"
                                    aria-label="Action menu"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleViewDetails(restaurant)}
                                    className="cursor-pointer flex items-center gap-2 text-slate-700 hover:bg-slate-50"
                                  >
                                    <Eye className="w-4 h-4 text-slate-400" />
                                    <span>View Details</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleEditDetailsFromTable(restaurant)}
                                    className="cursor-pointer flex items-center gap-2 text-blue-600 hover:bg-blue-50"
                                  >
                                    <Settings className="w-4 h-4 text-blue-400" />
                                    <span>Edit Details</span>
                                  </DropdownMenuItem>
                                  {menuPdfUrl && (
                                    <DropdownMenuItem 
                                      onClick={() => handleDownloadMenuPdf(restaurant)}
                                      className="cursor-pointer flex items-center gap-2 text-slate-700 hover:bg-slate-50"
                                    >
                                      <FileText className="w-4 h-4 text-slate-400" />
                                      <span>Download Menu</span>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem 
                                    onClick={() => handleBanRestaurant(restaurant)}
                                    className={`cursor-pointer flex items-center gap-2 ${
                                      restaurant.isActive ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"
                                    }`}
                                  >
                                    <ShieldX className="w-4 h-4" />
                                    <span>{restaurant.isActive ? "Ban Restaurant" : "Unban Restaurant"}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteRestaurant(restaurant)}
                                    className="cursor-pointer flex items-center gap-2 text-rose-600 hover:bg-rose-50 focus:bg-rose-50 focus:text-rose-700"
                                  >
                                    <Trash2 className="w-4 h-4 text-rose-500" />
                                    <span>Delete Restaurant</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile compact table */}
                <div className="md:hidden -mx-1 overflow-x-auto rounded-lg border border-slate-150">
                  <table className="w-full min-w-[540px] border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-150">
                      <tr>
                        <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">#</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">Restaurant</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">Owner</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">Zone</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                        <th className="px-2 py-2 text-right font-semibold text-slate-500 uppercase tracking-wide">Act</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {displayedRestaurants.map((restaurant, index) => {
                        const menuPdfUrl = normalizeFileUrl(
                          restaurant.originalData?.menuPdf || restaurant.menuPdf
                        )
                        return (
                          <tr
                            key={restaurant.id}
                            className="hover:bg-slate-50/70"
                            onMouseEnter={() => handleRestaurantRowHover(restaurant)}
                          >
                            <td className="px-2 py-2.5 text-slate-500 font-medium whitespace-nowrap">
                              {(page - 1) * PAGE_SIZE + index + 1}
                            </td>
                            <td className="px-2 py-2.5">
                              <div className="flex items-center gap-2 min-w-[140px]">
                                <div
                                  className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-150"
                                  onClick={() => handleViewDetails(restaurant)}
                                >
                                  <img
                                    src={restaurant.logo}
                                    alt={restaurant.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.target.src = PLACEHOLDER_40 }}
                                  />
                                </div>
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => handleViewDetails(restaurant)}
                                    className="text-left font-semibold text-slate-900 truncate max-w-[120px] block"
                                  >
                                    {restaurant.name}
                                  </button>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    #{formatRestaurantId(restaurant.originalData?.restaurantId || restaurant.originalData?._id || restaurant._id || restaurant.id)}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-2.5 min-w-[90px]">
                              <p className="font-medium text-slate-800 truncate max-w-[100px]">{restaurant.ownerName}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{formatPhone(restaurant.ownerPhone)}</p>
                            </td>
                            <td className="px-2 py-2.5 text-slate-600 whitespace-nowrap">{restaurant.zone}</td>
                            <td className="px-2 py-2.5 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border w-fit ${approvalStatusBadgeClass(restaurant.approvalStatus)}`}>
                                  {approvalStatusLabel(restaurant.approvalStatus)}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border w-fit ${
                                  restaurant.isActive
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/40"
                                    : "bg-slate-50 text-slate-500 border-slate-200/40"
                                }`}>
                                  {restaurant.isActive ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-2.5 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className="p-1 rounded-md border border-slate-200 bg-white text-slate-500"
                                    aria-label="Action menu"
                                  >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleViewDetails(restaurant)} className="cursor-pointer flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-slate-400" />
                                    <span>View Details</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditDetailsFromTable(restaurant)} className="cursor-pointer flex items-center gap-2 text-blue-600">
                                    <Settings className="w-4 h-4 text-blue-400" />
                                    <span>Edit Details</span>
                                  </DropdownMenuItem>
                                  {menuPdfUrl && (
                                    <DropdownMenuItem onClick={() => handleDownloadMenuPdf(restaurant)} className="cursor-pointer flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-slate-400" />
                                      <span>Download Menu</span>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => handleBanRestaurant(restaurant)}
                                    className={`cursor-pointer flex items-center gap-2 ${restaurant.isActive ? "text-amber-600" : "text-emerald-600"}`}
                                  >
                                    <ShieldX className="w-4 h-4" />
                                    <span>{restaurant.isActive ? "Ban" : "Unban"}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDeleteRestaurant(restaurant)} className="cursor-pointer flex items-center gap-2 text-rose-600">
                                    <Trash2 className="w-4 h-4 text-rose-500" />
                                    <span>Delete</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
                    <p className="text-sm text-slate-500">
                      Page {page} of {totalPages} ({totalCount} restaurants)
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>


      {/* Restaurant Details Modal */}
      {selectedRestaurant && (
        <div
          className="fixed inset-0 bg-slate-900/10 backdrop-blur-md z-100 flex items-center justify-center p-4 lg:p-8 transition-all duration-300"
          onClick={closeDetailsModal}
        >
          <div
            className="bg-white rounded-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)] border border-slate-200/60 max-w-3xl w-full max-h-[88vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Restaurant Details</h2>
                <p className="text-xs text-slate-500 mt-0.5">Detailed overview and information</p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditingDetails ? (
                  <button
                    onClick={handleStartEditDetails}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-sm"
                  >
                    Edit Details
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCancelEditDetails}
                      disabled={savingDetails}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveDetails}
                      disabled={savingDetails}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-60 flex items-center gap-1.5 shadow-sm"
                    >
                      {savingDetails && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {savingDetails ? "Saving..." : "Save Changes"}
                    </button>
                  </>
                )}
                <button
                  onClick={closeDetailsModal}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all duration-200 bg-slate-50 border border-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content - Scrollable area */}
            <div
              key={selectedRestaurant?._id || selectedRestaurant?.id || "details"}
              className="p-5 md:p-6 overflow-y-auto"
            >
              {loadingDetails && (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-100"></div>
                    <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                  </div>
                  <span className="mt-4 text-slate-500 font-medium tracking-wide">Fetching restaurant data...</span>
                </div>
              )}
              {!loadingDetails && isEditingDetails && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="md:col-span-2 bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-4">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0">
                        {profileImagePreview ? (
                          <img src={profileImagePreview} alt="Profile preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Profile Image</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            setProfileImageFile(file || null)
                            if (file) {
                              const localUrl = URL.createObjectURL(file)
                              setProfileImagePreview(localUrl)
                            }
                          }}
                          className="block w-full text-xs text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 file:font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Restaurant Name</label>
                      <input type="text" value={detailsForm.name} onChange={(e) => setDetailsForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dietary Type</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailsForm((prev) => ({ ...prev, pureVegRestaurant: true }))}
                          className={`px-3 py-1 text-xs rounded-full border font-semibold transition-all ${
                            detailsForm.pureVegRestaurant === true
                              ? "bg-green-600 text-white border-green-600"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          Pure Veg
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailsForm((prev) => ({ ...prev, pureVegRestaurant: false }))}
                          className={`px-3 py-1 text-xs rounded-full border font-semibold transition-all ${
                            detailsForm.pureVegRestaurant === false
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          Non-Veg / Mixed
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Restaurant Email</label>
                      <input type="email" value={detailsForm.email} onChange={(e) => setDetailsForm((prev) => ({ ...prev, email: e.target.value }))} className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Owner Name</label>
                      <input type="text" value={detailsForm.ownerName} onChange={(e) => setDetailsForm((prev) => ({ ...prev, ownerName: e.target.value }))} className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Owner Email</label>
                      <input type="email" value={detailsForm.ownerEmail} onChange={(e) => setDetailsForm((prev) => ({ ...prev, ownerEmail: e.target.value }))} className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Owner Phone</label>
                      <input type="text" value={detailsForm.ownerPhone} onChange={(e) => setDetailsForm((prev) => ({ ...prev, ownerPhone: e.target.value }))} className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Primary Contact Number</label>
                      <input type="text" value={detailsForm.primaryContactNumber} onChange={(e) => setDetailsForm((prev) => ({ ...prev, primaryContactNumber: e.target.value }))} className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                    </div>
                    <div className="md:col-span-2">
                      <OutletTimingsEditor
                        value={detailsForm.outletTimings}
                        onChange={(outletTimings) => setDetailsForm((prev) => ({ ...prev, outletTimings }))}
                        compact
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estimated Delivery Time (mins)</label>
                      <input type="text" value={detailsForm.estimatedDeliveryTime} onChange={(e) => setDetailsForm((prev) => ({ ...prev, estimatedDeliveryTime: e.target.value }))} className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2 bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
                      <input
                        id="restaurant-status-active"
                        type="checkbox"
                        checked={detailsForm.isActive}
                        onChange={(e) => setDetailsForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                      />
                      <label htmlFor="restaurant-status-active" className="text-xs font-semibold text-slate-700 cursor-pointer">
                        Restaurant is Active and visible on platform
                      </label>
                    </div>
                  </div>
                </div>
              )}
              {!loadingDetails && !isEditingDetails && (restaurantDetails || selectedRestaurant) && (() => {
                const r = restaurantDetails || selectedRestaurant?.originalData || selectedRestaurant
                const detailsApprovalStatus = normalizeApprovalStatus(r)
                const profileImgUrl = getPrimaryRestaurantImage(r)
                const coverImages = Array.isArray(r?.coverImages) ? r.coverImages.map(normalizeImageUrl).filter(Boolean) : []
                // Flat address fields (admin-created restaurants store these at top level)
                const hasFlatAddress = r?.addressLine1 || r?.area || r?.city || r?.state || r?.pincode
                const flatAddress = [r?.addressLine1, r?.addressLine2, r?.area, r?.city, r?.state, r?.pincode, r?.landmark].filter(Boolean).join(", ")
                const menuImages = Array.isArray(r?.menuImages) ? r.menuImages.map(normalizeImageUrl).filter(Boolean) : []
                const menuPdfUrl = normalizeFileUrl(r?.menuPdf || r?.onboarding?.step2?.menuPdf)
                const cuisinesList =
                  (Array.isArray(r?.cuisines) && r.cuisines.length ? r.cuisines : null) ||
                  (Array.isArray(r?.onboarding?.step2?.cuisines) && r.onboarding.step2.cuisines.length ? r.onboarding.step2.cuisines : null) ||
                  null
                const outletTimingsVal = r?.outletTimings && typeof r.outletTimings === "object"
                  ? r.outletTimings
                  : null
                const offerVal = r?.offer || r?.onboarding?.step4?.offer || ""
                const estimatedDeliveryTimeVal = r?.estimatedDeliveryTime || r?.onboarding?.step4?.estimatedDeliveryTime || ""
                const featuredDishVal = r?.featuredDish || r?.onboarding?.step4?.featuredDish || ""
                const featuredPriceVal = r?.featuredPrice ?? r?.onboarding?.step4?.featuredPrice
                const diningSettingsVal = r?.diningSettings || r?.onboarding?.step4?.diningSettings || null
                const panDocumentUrl = typeof r?.panImage === "string" ? r.panImage : (r?.panImage?.url || r?.onboarding?.step3?.pan?.image?.url || "")
                const gstDocumentUrl = typeof r?.gstImage === "string" ? r.gstImage : (r?.gstImage?.url || r?.onboarding?.step3?.gst?.image?.url || "")
                const fssaiDocumentUrl = typeof r?.fssaiImage === "string" ? r.fssaiImage : (r?.fssaiImage?.url || r?.onboarding?.step3?.fssai?.image?.url || "")
                const hasPanSection = Boolean(r?.panNumber || r?.nameOnPan || panDocumentUrl || r?.onboarding?.step3?.pan?.panNumber || r?.onboarding?.step3?.pan?.nameOnPan)
                const hasGstSection = Boolean(
                  r?.gstNumber ||
                  r?.gstLegalName ||
                  r?.gstAddress ||
                  gstDocumentUrl ||
                  r?.onboarding?.step3?.gst?.gstNumber ||
                  r?.onboarding?.step3?.gst?.legalName ||
                  r?.onboarding?.step3?.gst?.address
                )
                const hasFssaiSection = Boolean(
                  r?.fssaiNumber ||
                  r?.fssaiExpiry ||
                  fssaiDocumentUrl ||
                  r?.onboarding?.step3?.fssai?.registrationNumber ||
                  r?.onboarding?.step3?.fssai?.expiryDate
                )
                const hasBankSection = Boolean(
                  r?.accountNumber ||
                  r?.ifscCode ||
                  r?.accountHolderName ||
                  r?.accountType ||
                  r?.onboarding?.step3?.bank?.accountNumber ||
                  r?.onboarding?.step3?.bank?.ifscCode ||
                  r?.onboarding?.step3?.bank?.accountHolderName ||
                  r?.onboarding?.step3?.bank?.accountType
                )
                const hasRegistrationDocuments = hasPanSection || hasGstSection || hasFssaiSection || hasBankSection
                // Zone info (can be object or string ID from API)
                const zoneInfo = r?.zoneId
                const zoneName = (typeof zoneInfo === "object" && zoneInfo !== null)
                  ? (zoneInfo.name || zoneInfo.zoneName || zoneInfo.serviceLocation || "")
                  : (selectedRestaurant?.zone || "")
                // Dietary type
                const dietaryType = r?.pureVegRestaurant === true ? "Pure Veg" : r?.pureVegRestaurant === false ? "Non-Veg / Mixed" : null
                // Primary contact
                const primaryContact = r?.primaryContactNumber || r?.onboarding?.step1?.primaryContactNumber || ""
                // Accepting orders
                const isAcceptingOrders = r?.isAcceptingOrders
                return (
                <div className="space-y-6">
                  {/* Restaurant Basic Info */}
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-5">
                    <a
                      href={profileImgUrl || PLACEHOLDER_128}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-50 shrink-0 shadow-inner group block border border-slate-200/60"
                    >
                      <img
                        src={profileImgUrl || PLACEHOLDER_128}
                        alt={r?.restaurantName || r?.name || "Restaurant"}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={(e) => {
                          e.target.src = PLACEHOLDER_128
                        }}
                      />
                    </a>
                    <div className="flex-1 text-center md:text-left pt-1">
                      <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                          {r?.restaurantName || r?.name || "N/A"}
                        </h3>
                        <div className="flex items-center justify-center md:justify-start gap-1.5 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${r?.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {r?.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                          {dietaryType && (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${r?.pureVegRestaurant ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                              {dietaryType}
                            </span>
                          )}
                          {isAcceptingOrders != null && (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isAcceptingOrders ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                              {isAcceptingOrders ? 'Accepting Orders' : 'Not Accepting'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-center md:justify-start gap-4 flex-wrap">
                        {(r?.rating != null || r?.ratings?.average != null) && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-50 rounded-lg border border-yellow-100/50">
                            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-500" />
                            <span className="text-xs font-bold text-yellow-700">
                              {(r.ratings?.average ?? r.rating ?? 0).toFixed(1)}
                            </span>
                            <span className="text-[10px] text-yellow-600/70 font-medium">
                              ({(r.ratings?.count ?? r.totalRatings ?? 0)})
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                          <Building2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold tracking-wider">{formatRestaurantId(r?.restaurantId || r?._id)}</span>
                        </div>
                        {zoneName && (
                          <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold tracking-wider">{zoneName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {/* Owner Information */}
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Owner Information</h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100/30">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Full Name</p>
                            <p className="text-sm font-semibold text-slate-800">{r?.ownerName || "N/A"}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100/30">
                            <Phone className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Owner Phone</p>
                            <p className="text-sm font-semibold text-slate-800">{r?.ownerPhone || r?.phone || "N/A"}</p>
                          </div>
                        </div>
                        {(r?.ownerEmail || r?.email) && (
                          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100/30">
                              <Mail className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Owner Email</p>
                              <p className="text-sm font-semibold text-slate-800 break-all">{r.ownerEmail || r.email}</p>
                            </div>
                          </div>
                        )}
                        {primaryContact && primaryContact !== r?.ownerPhone && (
                          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">
                            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 border border-violet-100/30">
                              <Phone className="w-4 h-4 text-violet-600" />
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Primary Contact</p>
                              <p className="text-sm font-semibold text-slate-800">{primaryContact}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Location & Contact */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</h4>
                        </div>
                        {isEditingLocation ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                            <Settings className="w-2.5 h-2.5" />
                            Editable Below
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        {!isEditingLocation && (r?.location || hasFlatAddress) && (() => {
                          const loc = r?.location
                          const addressDisplay = loc ? formatLocationAddress(loc, selectedRestaurant?.zone) : flatAddress
                          return (
                            <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 space-y-1">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Full Address</p>
                              <p className="text-sm font-semibold text-slate-800">{addressDisplay}</p>
                              {(r?.area || r?.city) && (
                                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100">
                                  {r?.area && <div><p className="text-[9px] text-slate-400">Area</p><p className="text-xs font-semibold text-slate-700">{r.area}</p></div>}
                                  {r?.city && <div><p className="text-[9px] text-slate-400">City</p><p className="text-xs font-semibold text-slate-700">{r.city}</p></div>}
                                  {r?.state && <div><p className="text-[9px] text-slate-400">State</p><p className="text-xs font-semibold text-slate-700">{r.state}</p></div>}
                                  {r?.pincode && <div><p className="text-[9px] text-slate-400">Pincode</p><p className="text-xs font-semibold text-slate-700">{r.pincode}</p></div>}
                                  {r?.landmark && <div className="col-span-2"><p className="text-[9px] text-slate-400">Landmark</p><p className="text-xs font-semibold text-slate-700">{r.landmark}</p></div>}
                                </div>
                              )}
                            </div>
                          )
                        })()}
                        {isEditingLocation && (
                          <p className="text-xs text-indigo-700 font-medium bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                            Location editor is shown at the bottom of this details modal.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Timings, Cuisines & Status */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 mb-3">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operational Details</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2.5">
                        {outletTimingsVal && (
                          <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Weekly Timings</p>
                            <div className="space-y-1">
                              {DAY_NAMES.map((day) => {
                                const slot = outletTimingsVal[day]
                                if (!slot) return null
                                const label = slot.isOpen === false
                                  ? "Closed"
                                  : `${formatTime12Hour(slot.openingTime)} – ${formatTime12Hour(slot.closingTime)}`
                                return (
                                  <p key={day} className="text-[11px] font-medium text-slate-700">
                                    <span className="text-slate-500">{day}:</span> {label}
                                  </p>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {estimatedDeliveryTimeVal && (
                          <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Est. Delivery Time</p>
                            <p className="text-sm font-semibold text-slate-800">{estimatedDeliveryTimeVal} min</p>
                          </div>
                        )}
                        <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Approval Status</p>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${approvalStatusBadgeClass(detailsApprovalStatus)}`}>
                            {approvalStatusLabel(detailsApprovalStatus)}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        {cuisinesList && cuisinesList.length > 0 && (
                          <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Cuisines</p>
                            <div className="flex flex-wrap gap-1">
                              {cuisinesList.map((c, i) => (
                                <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-semibold">{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {offerVal && (
                          <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Offer</p>
                            <p className="text-sm font-semibold text-green-700">{offerVal}</p>
                          </div>
                        )}
                        {featuredDishVal && (
                          <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Featured Dish</p>
                            <p className="text-sm font-semibold text-slate-800">{featuredDishVal}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Media */}
                  {(profileImgUrl || coverImages.length > 0 || menuImages.length > 0 || menuPdfUrl) && (
                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Media</h4>
                      <div className="space-y-3">
                        {profileImgUrl && (
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Profile Image</p>
                            <a
                              href={profileImgUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>View Profile Image</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                        {coverImages.length > 0 && (
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Restaurant Photos</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                              {coverImages.map((url, idx) => (
                                <a
                                  key={`${url}-${idx}`}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="relative aspect-4/5 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 hover:border-slate-300"
                                  title="Open restaurant photo"
                                >
                                  <img
                                    src={url}
                                    alt={`Restaurant ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.target.style.display = "none"
                                    }}
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {menuImages.length > 0 && (
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Menu Images</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                              {menuImages.map((url, idx) => (
                                <a
                                  key={`${url}-${idx}`}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="relative aspect-4/5 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 hover:border-slate-300"
                                  title="Open menu image"
                                >
                                  <img
                                    src={url}
                                    alt={`Menu ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.target.style.display = "none"
                                    }}
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {menuPdfUrl && (
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Menu PDF</p>
                            <button
                              type="button"
                              onClick={() => handleDownloadMenuPdf(r)}
                              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Download menu</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Registration Information */}
                  {(r?.createdAt || r?.updatedAt) && (
                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Registration Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl">
                        {r.createdAt && (
                          <div className="flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Registration Date & Time</p>
                              <p className="font-semibold text-slate-800">
                                {new Date(r.createdAt).toLocaleString('en-IN', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        )}
                        {r.updatedAt && (
                          <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Last Updated</p>
                              <p className="font-medium text-slate-900">
                                {new Date(r.updatedAt).toLocaleString('en-IN', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        )}
                        {r.restaurantId && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Restaurant ID</p>
                            <p className="font-medium text-slate-900">{formatRestaurantId(r.restaurantId)}</p>
                          </div>
                        )}
                        {r.slug && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Slug</p>
                            <p className="font-medium text-slate-900">{r.slug}</p>
                          </div>
                        )}
                        {r.phoneVerified !== undefined && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Phone Verified</p>
                            <p className="font-medium text-slate-900">{r.phoneVerified ? "Yes" : "No"}</p>
                          </div>
                        )}
                        {r.signupMethod && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Signup Method</p>
                            <p className="font-medium text-slate-900 capitalize">{r.signupMethod}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Registration Documents - flat (PAN, GST, FSSAI, Bank) or onboarding.step3 */}
                  {hasRegistrationDocuments && (
                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Registration Documents</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* PAN – flat or onboarding.step3 */}
                        {hasPanSection && (
                          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3">
                            <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              PAN Details
                            </h5>
                            <div className="grid grid-cols-1 gap-2 text-xs">
                              {(r.panNumber || r?.onboarding?.step3?.pan?.panNumber) && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">PAN Number</p>
                                  <p className="font-semibold text-slate-800">{r.panNumber || r.onboarding?.step3?.pan?.panNumber}</p>
                                </div>
                              )}
                              {(r.nameOnPan || r?.onboarding?.step3?.pan?.nameOnPan) && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Name on PAN</p>
                                  <p className="font-semibold text-slate-800">{r.nameOnPan || r.onboarding?.step3?.pan?.nameOnPan}</p>
                                </div>
                              )}
                              {panDocumentUrl && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">PAN Document</p>
                                  <a href={panDocumentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold">
                                    <ImageIcon className="w-3 h-3" />
                                    <span>View PAN Document</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* GST – flat or onboarding.step3 */}
                        {hasGstSection && (
                          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3">
                            <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              GST Details
                            </h5>
                            <div className="grid grid-cols-1 gap-2 text-xs">
                              {(r.gstRegistered != null || r?.onboarding?.step3?.gst?.isRegistered != null) && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">GST Registered</p>
                                  <p className="font-semibold text-slate-800">
                                    {r.gstRegistered != null ? (r.gstRegistered ? "Yes" : "No") : (r?.onboarding?.step3?.gst?.isRegistered ? "Yes" : "No")}
                                  </p>
                                </div>
                              )}
                              {(r.gstNumber || r?.onboarding?.step3?.gst?.gstNumber) && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">GST Number</p>
                                  <p className="font-semibold text-slate-800">{r.gstNumber || r.onboarding?.step3?.gst?.gstNumber}</p>
                                </div>
                              )}
                              {(r.gstLegalName || r?.onboarding?.step3?.gst?.legalName) && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Legal Name</p>
                                  <p className="font-semibold text-slate-800">{r.gstLegalName || r.onboarding?.step3?.gst?.legalName}</p>
                                </div>
                              )}
                              {(r.gstAddress || r?.onboarding?.step3?.gst?.address) && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">GST Address</p>
                                  <p className="font-semibold text-slate-800">{r.gstAddress || r.onboarding?.step3?.gst?.address}</p>
                                </div>
                              )}
                              {gstDocumentUrl && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">GST Document</p>
                                  <a href={gstDocumentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold">
                                    <ImageIcon className="w-3 h-3" />
                                    <span>View GST Document</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* FSSAI – flat or onboarding.step3 */}
                        {hasFssaiSection && (
                          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3">
                            <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              FSSAI Details
                            </h5>
                            <div className="grid grid-cols-1 gap-2 text-xs">
                              {(r.fssaiNumber || r?.onboarding?.step3?.fssai?.registrationNumber) && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">FSSAI Registration Number</p>
                                  <p className="font-semibold text-slate-800">{r.fssaiNumber || r.onboarding?.step3?.fssai?.registrationNumber}</p>
                                </div>
                              )}
                              {(r.fssaiExpiry || r?.onboarding?.step3?.fssai?.expiryDate) && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">FSSAI Expiry Date</p>
                                  <p className="font-semibold text-slate-800">
                                    {new Date(r.fssaiExpiry || r.onboarding?.step3?.fssai?.expiryDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
                                  </p>
                                </div>
                              )}
                              {fssaiDocumentUrl && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">FSSAI Document</p>
                                  <a href={fssaiDocumentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold">
                                    <ImageIcon className="w-3 h-3" />
                                    <span>View FSSAI Document</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Bank – flat or onboarding.step3 */}
                        {hasBankSection && (
                          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3">
                            <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                              <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                              Bank Details
                            </h5>
                            <div className="grid grid-cols-1 gap-2 text-xs">
                              {(r.accountNumber || r?.onboarding?.step3?.bank?.accountNumber) && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Account Number</p>
                                  <p className="font-semibold text-slate-800">{r.accountNumber || r.onboarding?.step3?.bank?.accountNumber}</p>
                                </div>
                              )}
                              {(r.ifscCode || r?.onboarding?.step3?.bank?.ifscCode) && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">IFSC Code</p>
                                  <p className="font-semibold text-slate-800">{r.ifscCode || r.onboarding?.step3?.bank?.ifscCode}</p>
                                </div>
                              )}
                              {(r.accountHolderName || r?.onboarding?.step3?.bank?.accountHolderName) && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Account Holder Name</p>
                                  <p className="font-semibold text-slate-800">{r.accountHolderName || r.onboarding?.step3?.bank?.accountHolderName}</p>
                                </div>
                              )}
                              {(r.accountType || r?.onboarding?.step3?.bank?.accountType) && (
                                <div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Account Type</p>
                                  <p className="font-semibold text-slate-800 capitalize">{r.accountType || r.onboarding?.step3?.bank?.accountType}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Address at registration (flat) */}
                  {hasFlatAddress && !r?.onboarding?.step1?.location && (
                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Address (at registration)</h4>
                      <p className="text-xs font-semibold text-slate-800 bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl">{flatAddress}</p>
                    </div>
                  )}

                  {/* Onboarding Step 1 Details */}
                  {r?.onboarding?.step1 && (
                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Registration Step 1 Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl">
                        {r.onboarding.step1.restaurantName && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Restaurant Name (at registration)</p>
                            <p className="font-semibold text-slate-800">{r.onboarding.step1.restaurantName}</p>
                          </div>
                        )}
                        {r.onboarding.step1.ownerName && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Owner Name (at registration)</p>
                            <p className="font-semibold text-slate-800">{r.onboarding.step1.ownerName}</p>
                          </div>
                        )}
                        {r.onboarding.step1.ownerEmail && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Owner Email (at registration)</p>
                            <p className="font-semibold text-slate-800">{r.onboarding.step1.ownerEmail}</p>
                          </div>
                        )}
                        {r.onboarding.step1.ownerPhone && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Owner Phone (at registration)</p>
                            <p className="font-semibold text-slate-800">{r.onboarding.step1.ownerPhone}</p>
                          </div>
                        )}
                        {r.onboarding.step1.primaryContactNumber && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Primary Contact (at registration)</p>
                            <p className="font-semibold text-slate-800">{r.onboarding.step1.primaryContactNumber}</p>
                          </div>
                        )}
                        {r.onboarding.step1.location && (
                          <div className="md:col-span-2">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Location (at registration)</p>
                            <p className="font-semibold text-slate-800">
                              {r.onboarding.step1.location.addressLine1 || ""}
                              {r.onboarding.step1.location.addressLine2 && `, ${r.onboarding.step1.location.addressLine2}`}
                              {r.onboarding.step1.location.area && `, ${r.onboarding.step1.location.area}`}
                              {r.onboarding.step1.location.city && `, ${r.onboarding.step1.location.city}`}
                              {r.onboarding.step1.location.landmark && `, ${r.onboarding.step1.location.landmark}`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Onboarding Step 2 Details */}
                  {r?.onboarding?.step2 && (
                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Registration Step 2 Details</h4>
                      <div className="space-y-3 bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl">
                        {r.onboarding.step2.cuisines && Array.isArray(r.onboarding.step2.cuisines) && r.onboarding.step2.cuisines.length > 0 && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Cuisines (at registration)</p>
                            <div className="flex flex-wrap gap-1">
                              {r.onboarding.step2.cuisines.map((cuisine, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-semibold">
                                  {cuisine}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(r.onboarding.step2.outletTimings || r.outletTimings) && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Weekly Timings (at registration)</p>
                            <div className="space-y-1">
                              {DAY_NAMES.map((day) => {
                                const slot = (r.onboarding.step2.outletTimings || r.outletTimings)?.[day]
                                if (!slot) return null
                                const label = slot.isOpen === false
                                  ? "Closed"
                                  : `${formatTime12Hour(slot.openingTime)} – ${formatTime12Hour(slot.closingTime)}`
                                return (
                                  <p key={day} className="text-[11px] font-medium text-slate-700">
                                    <span className="text-slate-500">{day}:</span> {label}
                                  </p>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {r.onboarding.step2.profileImageUrl?.url && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Profile Image (at registration)</p>
                            <a
                              href={r.onboarding.step2.profileImageUrl.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block"
                            >
                              <img
                                src={r.onboarding.step2.profileImageUrl.url}
                                alt="Profile"
                                className="w-20 h-20 rounded-xl object-cover border border-slate-200 hover:border-blue-500 transition-all shadow-sm"
                                onError={(e) => {
                                  e.target.src = PLACEHOLDER_128
                                }}
                              />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Onboarding Step 4 Details */}
                  {r?.onboarding?.step4 && (
                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Registration Step 4 Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl">
                        {r.onboarding.step4.estimatedDeliveryTime && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Estimated Delivery Time (at registration)</p>
                            <p className="font-semibold text-slate-800">{r.onboarding.step4.estimatedDeliveryTime} mins</p>
                          </div>
                        )}
                        {r.onboarding.step4.distance && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Distance (at registration)</p>
                            <p className="font-semibold text-slate-800">{r.onboarding.step4.distance} km</p>
                          </div>
                        )}
                        {r.onboarding.step4.featuredDish && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Featured Dish (at registration)</p>
                            <p className="font-semibold text-slate-800">{r.onboarding.step4.featuredDish}</p>
                          </div>
                        )}
                        {r.onboarding.step4.offer && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Offer (at registration)</p>
                            <p className="font-semibold text-green-600">{r.onboarding.step4.offer}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Additional Information */}
                  {(r?.slug || r?.restaurantId || r?.phoneVerified !== undefined || r?.signupMethod) && (
                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Additional Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl">
                        {r?.slug && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Slug</p>
                            <p className="font-semibold text-slate-800">{r.slug}</p>
                          </div>
                        )}
                        {r?.restaurantId && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Restaurant ID</p>
                            <p className="font-semibold text-slate-800">{formatRestaurantId(r.restaurantId)}</p>
                          </div>
                        )}
                        {r?.phoneVerified !== undefined && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Phone Verified</p>
                            <p className="font-semibold text-slate-800">{r.phoneVerified ? "Yes" : "No"}</p>
                          </div>
                        )}
                        {r?.signupMethod && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Signup Method</p>
                            <p className="font-semibold text-slate-800 capitalize">{r.signupMethod}</p>
                          </div>
                        )}
                        {r?.onboarding?.completedSteps !== undefined && (
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Onboarding Steps Completed</p>
                            <p className="font-semibold text-slate-800">{r.onboarding.completedSteps} / 4</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isEditingLocation && (
                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Location Editor</h4>
                      <div className="space-y-3 border border-indigo-100 bg-indigo-50/20 rounded-xl p-3">
                        <p className="text-xs text-indigo-800 font-semibold">
                          Update restaurant location using dropdown (accurate) + select service zone.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Service Zone*</label>
                            <select
                              value={locationForm.zoneId || ""}
                              onChange={(e) => setLocationForm((prev) => ({ ...prev, zoneId: e.target.value }))}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                              <option value="">{zonesLoading ? "Loading zones..." : "Select a zone"}</option>
                              {zones.map((z) => (
                                <option key={z._id || z.id} value={z._id || z.id}>
                                  {z.name || z.zoneName || z.serviceLocation || "Zone"}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Search location*</label>
                            <input
                              ref={locationSearchInputRef}
                              type="text"
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                              placeholder="Start typing and choose from dropdown..."
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                              Select from dropdown to auto-fill address and coordinates.
                            </p>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Formatted Address</label>
                            <input
                              type="text"
                              value={locationForm.formattedAddress}
                              readOnly
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Area</label>
                            <input
                              type="text"
                              value={locationForm.area}
                              readOnly
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">City</label>
                            <input
                              type="text"
                              value={locationForm.city}
                              readOnly
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">State</label>
                            <input
                              type="text"
                              value={locationForm.state}
                              readOnly
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pincode</label>
                            <input
                              type="text"
                              value={locationForm.pincode}
                              readOnly
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Landmark (optional)</label>
                            <input
                              type="text"
                              value={locationForm.landmark}
                              onChange={(e) => setLocationForm((prev) => ({ ...prev, landmark: e.target.value }))}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                        </div>

                        {locationEditError && <p className="text-xs text-red-650">{locationEditError}</p>}
                        <button
                          onClick={handleSaveLocation}
                          disabled={savingLocation}
                          className={`inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition-all ${savingLocation ? "bg-indigo-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"}`}
                        >
                          {savingLocation ? "Saving..." : "Save Location"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                )
              })()}
              {!loadingDetails && !restaurantDetails && !selectedRestaurant && (
                <div className="flex flex-col items-center justify-center py-20">
                  <p className="text-lg font-semibold text-slate-700 mb-2">No Details Available</p>
                  <p className="text-sm text-slate-500">Unable to load restaurant details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ban/Unban Confirmation Dialog */}
      {banConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={cancelBanRestaurant}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${banConfirmDialog.action === 'ban' ? 'bg-red-100' : 'bg-green-100'
                  }`}>
                  <AlertTriangle className={`w-6 h-6 ${banConfirmDialog.action === 'ban' ? 'text-red-600' : 'text-green-600'
                    }`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {banConfirmDialog.action === 'ban' ? 'Ban Restaurant' : 'Unban Restaurant'}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {banConfirmDialog.restaurant.name}
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-700 mb-6">
                {banConfirmDialog.action === 'ban'
                  ? 'Are you sure you want to ban this restaurant? They will not be able to receive orders or access their account.'
                  : 'Are you sure you want to unban this restaurant? They will be able to receive orders and access their account again.'
                }
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={cancelBanRestaurant}
                  disabled={banning}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBanRestaurant}
                  disabled={banning}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${banConfirmDialog.action === 'ban'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                    }`}
                >
                  {banning ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {banConfirmDialog.action === 'ban' ? 'Banning...' : 'Unbanning...'}
                    </span>
                  ) : (
                    banConfirmDialog.action === 'ban' ? 'Ban Restaurant' : 'Unban Restaurant'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={cancelDeleteRestaurant}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Delete Restaurant</h3>
                  <p className="text-sm text-slate-600">
                    {deleteConfirmDialog.restaurant.name}
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-700 mb-6">
                Are you sure you want to delete this restaurant? This action cannot be undone and will permanently remove all restaurant data, including orders, menu items, and settings.
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={cancelDeleteRestaurant}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteRestaurant}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </span>
                  ) : (
                    "Delete Restaurant"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



