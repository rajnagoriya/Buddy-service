import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useLocation as useGeoLocation } from "@food/hooks/useLocation"
import { useProfile } from "@food/context/ProfileContext"
import { toast } from "sonner"
import { Loader } from '@googlemaps/js-api-loader'
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import AddressSelectorView from "@food/components/user/address/AddressSelectorView"
import AddressFormView from "@food/components/user/address/AddressFormView"
import { getAddressId } from "@food/components/user/address/addressUtils"

const debugError = (...args) => {}

const MAPS_ENABLED = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3
  const lat1Rad = lat1 * Math.PI / 180
  const lat2Rad = lat2 * Math.PI / 180
  const deltaLat = (lat2 - lat1) * Math.PI / 180
  const deltaLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const LABEL_BY_SLOT = { home: "Home", work: "Work", other: "Other" }

export default function AddressSelectorPage() {
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const { location, loading: geoLoading, requestLocation } = useGeoLocation()
  const { addresses = [], addAddress, setDefaultAddress, getDefaultAddress, isAuthenticated } = useProfile()

  const [searchQuery, setSearchQuery] = useState("")
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [mapPosition, setMapPosition] = useState([22.7196, 75.8577])
  const [addressFormData, setAddressFormData] = useState({
    street: "",
    city: "",
    state: "",
    zipCode: "",
    additionalDetails: "",
    label: "Home",
    phone: "",
  })
  const [loadingAddress, setLoadingAddress] = useState(false)
  const [mapLoading, setMapLoading] = useState(false)
  const mapContainerRef = useRef(null)
  const googleMapRef = useRef(null)
  const [currentAddress, setCurrentAddress] = useState("")
  const [addressAutocompleteValue, setAddressAutocompleteValue] = useState("")
  const [keywordAddressSuggestions, setKeywordAddressSuggestions] = useState([])
  const [isKeywordSearching, setIsKeywordSearching] = useState(false)
  const [GOOGLE_MAPS_API_KEY, setGOOGLE_MAPS_API_KEY] = useState(null)
  const [formScrollTop, setFormScrollTop] = useState(0)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [baseMapHeight, setBaseMapHeight] = useState(320)
  const formBodyRef = useRef(null)
  const manualFieldRefs = useRef({})
  const [geoActionLoading, setGeoActionLoading] = useState(false)

  const ENABLE_LOCATION_REVERSE_GEOCODE = import.meta.env.VITE_ENABLE_LOCATION_REVERSE_GEOCODE !== "false"
  const ENABLE_NOMINATIM_SEARCH = import.meta.env.VITE_ENABLE_NOMINATIM_SEARCH !== "false"

  const defaultAddress = getDefaultAddress?.()
  const defaultAddressId = getAddressId(defaultAddress)

  const locationPreview = useMemo(() => {
    if (location?.formattedAddress) return location.formattedAddress
    if (location?.area || location?.city) {
      return [location.area, location.city, location.state].filter(Boolean).join(", ")
    }
    return currentAddress
  }, [location, currentAddress])

  useEffect(() => {
    if (location?.formattedAddress || location?.area) {
      setCurrentAddress(
        location.formattedAddress ||
          [location.area, location.city, location.state].filter(Boolean).join(", ")
      )
    }
  }, [location])

  useEffect(() => {
    if (!MAPS_ENABLED) return
    import('@food/utils/googleMapsApiKey.js').then(({ getGoogleMapsApiKey }) => {
      getGoogleMapsApiKey().then(setGOOGLE_MAPS_API_KEY)
    })
  }, [])

  useEffect(() => {
    if (!showAddressForm) return
    const q = String(addressAutocompleteValue || "").trim()
    if (!ENABLE_NOMINATIM_SEARCH || q.length < 3) {
      setKeywordAddressSuggestions([])
      setIsKeywordSearching(false)
      return
    }

    const t = setTimeout(async () => {
      try {
        setIsKeywordSearching(true)
        const refLat = location?.latitude ?? 22.7196
        const refLng = location?.longitude ?? 75.8577
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&q=${encodeURIComponent(q)}`
        const res = await fetch(url, { headers: { Accept: "application/json" } })
        const json = await res.json()
        const mapped = (Array.isArray(json) ? json : []).map(r => ({
          id: r.place_id || r.osm_id,
          display: r.display_name || "",
          lat: Number(r.lat),
          lng: Number(r.lon),
          address: r.address || {},
        }))
        const withDistance = mapped
          .filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng))
          .map(x => ({ ...x, distanceMeters: calculateDistance(refLat, refLng, x.lat, x.lng) }))
          .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
          .slice(0, 4)
        setKeywordAddressSuggestions(withDistance)
      } catch {
        setKeywordAddressSuggestions([])
      } finally {
        setIsKeywordSearching(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [addressAutocompleteValue, showAddressForm, location, ENABLE_NOMINATIM_SEARCH])

  useEffect(() => {
    if (!MAPS_ENABLED || !showAddressForm || !mapContainerRef.current || !GOOGLE_MAPS_API_KEY) return

    let isMounted = true
    setMapLoading(true)

    const initializeGoogleMap = async () => {
      try {
        const loader = new Loader({ apiKey: GOOGLE_MAPS_API_KEY, version: "weekly" })
        const google = await loader.load()
        if (!isMounted || !mapContainerRef.current) return

        const map = new google.maps.Map(mapContainerRef.current, {
          center: { lat: mapPosition[0], lng: mapPosition[1] },
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        })
        googleMapRef.current = map

        map.addListener("idle", () => {
          const center = map.getCenter()
          const lat = center.lat()
          const lng = center.lng()
          setMapPosition([lat, lng])
          handleMapMoveEnd(lat, lng)
        })

        setMapLoading(false)
      } catch (err) {
        debugError("Map init error:", err)
        setMapLoading(false)
      }
    }
    initializeGoogleMap()
    return () => { isMounted = false }
  }, [showAddressForm, GOOGLE_MAPS_API_KEY])

  const handleUseCurrentLocation = async () => {
    try {
      setGeoActionLoading(true)
      toast.loading("Getting location...", { id: "geo" })
      const loc = await requestLocation(true, true)
      if (loc?.latitude) {
        const newPos = [loc.latitude, loc.longitude]
        setMapPosition(newPos)
        const detailedAddress = loc.formattedAddress || loc.address || ""
        setCurrentAddress(detailedAddress)

        if (googleMapRef.current) {
          googleMapRef.current.panTo({ lat: loc.latitude, lng: loc.longitude })
          googleMapRef.current.setZoom(17)
        }

        try {
          localStorage.setItem("deliveryAddressMode", "current")
          localStorage.setItem("userLocation", JSON.stringify(loc))
          window.dispatchEvent(new CustomEvent("deliveryAddressModeUpdated"))
          window.dispatchEvent(
            new CustomEvent("userLocationUpdated", { detail: { location: loc } }),
          )
        } catch {}

        toast.success("Location ready: " + (loc.area || loc.city || "Current Location"), { id: "geo" })

        if (!showAddressForm) {
          setTimeout(() => goBack(), 800)
        }
      }
    } catch {
      toast.error("Failed to get location", { id: "geo" })
    } finally {
      setGeoActionLoading(false)
    }
  }

  const handleSelectSavedAddress = async (address) => {
    const id = getAddressId(address)
    if (id) {
      await setDefaultAddress(id)
      try {
        localStorage.setItem("deliveryAddressMode", "saved")
        window.dispatchEvent(new CustomEvent("deliveryAddressModeUpdated"))
        window.dispatchEvent(new CustomEvent("userAddressesUpdated"))
      } catch {}
      toast.success("Address selected")
      goBack()
    }
  }

  const openAddressForm = (presetLabel = "Home") => {
    if (!isAuthenticated) {
      toast.info("Please login to add an address")
      navigate("/user/auth/login")
      return
    }
    setAddressFormData((prev) => ({
      ...prev,
      label: presetLabel === "Work" ? "Work" : presetLabel === "Other" ? "Other" : "Home",
    }))
    setShowAddressForm(true)
  }

  const handleQuickSlotClick = (slotKey, saved) => {
    if (saved) {
      handleSelectSavedAddress(saved)
      return
    }
    openAddressForm(LABEL_BY_SLOT[slotKey] || "Home")
  }

  const scrollFieldIntoView = useCallback((fieldName) => {
    const el = manualFieldRefs.current?.[fieldName]
    if (!el) return
    setTimeout(() => {
      try {
        const scrollHost = formBodyRef.current
        if (!scrollHost) {
          el.scrollIntoView({ behavior: "smooth", block: "center" })
          return
        }
        const hostRect = scrollHost.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        const viewportHeight =
          typeof window !== "undefined" && window.visualViewport
            ? window.visualViewport.height
            : window.innerHeight
        const safeBottom = viewportHeight - keyboardInset - 90
        const overBy = elRect.bottom - safeBottom
        if (overBy > 0) {
          scrollHost.scrollTo({ top: scrollHost.scrollTop + overBy + 24, behavior: "smooth" })
          return
        }
        if (elRect.top < hostRect.top + 70) {
          scrollHost.scrollTo({ top: Math.max(0, scrollHost.scrollTop - (hostRect.top + 70 - elRect.top) - 12), behavior: "smooth" })
          return
        }
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      } catch {
        // ignore
      }
    }, 120)
  }, [keyboardInset])

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

  const handleMapMoveEnd = async (lat, lng) => {
    if (!ENABLE_LOCATION_REVERSE_GEOCODE) return
    try {
      if (GOOGLE_MAPS_API_KEY) {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
        const response = await fetch(url)
        const data = await response.json()

        if (data.status === "OK" && data.results?.length > 0) {
          const result = data.results[0]
          const components = result.address_components
          const area = components.find(c => c.types.includes("sublocality_level_1"))?.long_name ||
            components.find(c => c.types.includes("sublocality"))?.long_name ||
            components.find(c => c.types.includes("neighborhood"))?.long_name || ""
          const city = components.find(c => c.types.includes("locality"))?.long_name || ""
          const state = components.find(c => c.types.includes("administrative_area_level_1"))?.long_name || ""
          const zip = components.find(c => c.types.includes("postal_code"))?.long_name || ""

          setCurrentAddress(result.formatted_address)
          setAddressFormData(prev => ({
            ...prev,
            street: result.formatted_address.split(',')[0] || "",
            additionalDetails: area,
            city,
            state,
            zipCode: zip,
          }))
          return
        }
      }

      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
      const response = await fetch(url, {
        headers: { "Accept-Language": "en", "User-Agent": "Foodelo-App" },
      })
      const json = await response.json()

      if (json?.address) {
        const addr = json.address
        const formatted = json.display_name
        const street = [addr.road, addr.suburb, addr.neighbourhood, addr.house_number]
          .filter(Boolean).slice(0, 2).join(", ") || addr.amenity || addr.industrial || ""
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || ""
        const state = addr.state || ""
        const postcode = addr.postcode || ""

        setCurrentAddress(formatted)
        setAddressFormData(prev => ({
          ...prev,
          street: street || formatted.split(",")[0] || prev.street,
          city: city || prev.city,
          state: state || prev.state,
          zipCode: postcode || prev.zipCode,
        }))
      }
    } catch (error) {
      debugError("Reverse geocoding failed:", error)
    }
  }

  const handleAddressFormSubmit = async (e) => {
    e?.preventDefault?.()
    if (!isAuthenticated) {
      toast.info("Please login to save an address")
      navigate("/user/auth/login")
      return
    }
    if (!addressFormData.street || !addressFormData.city) {
      toast.error("Please fill required fields")
      return
    }
    setLoadingAddress(true)
    try {
      const payload = {
        ...addressFormData,
        label: addressFormData.label === "Work" ? "Office" : addressFormData.label,
        location: { type: "Point", coordinates: [mapPosition[1], mapPosition[0]] },
        latitude: mapPosition[0],
        longitude: mapPosition[1],
      }
      const created = await addAddress(payload)
      if (created) {
        const id = getAddressId(created)
        if (id) await setDefaultAddress(id, created)
        try {
          localStorage.setItem("deliveryAddressMode", "saved")
          window.dispatchEvent(new CustomEvent("deliveryAddressModeUpdated"))
          window.dispatchEvent(new CustomEvent("userAddressesUpdated"))
        } catch {}
        toast.success("Address saved")
        goBack()
      }
    } catch {
      toast.error("Failed to save address")
    } finally {
      setLoadingAddress(false)
    }
  }

  const handlePickSuggestion = (s) => {
    const { lat, lng, display, address: a } = s
    setMapPosition([lat, lng])
    if (googleMapRef.current) {
      googleMapRef.current.panTo({ lat, lng })
      googleMapRef.current.setZoom(17)
    }
    setAddressAutocompleteValue(display)
    const city = a.city || a.town || a.village || a.county || ""
    const state = a.state || ""
    const zipCode = a.postcode || ""
    setAddressFormData((prev) => ({
      ...prev,
      street: display || prev.street,
      city: city || prev.city,
      state: state || prev.state,
      zipCode: zipCode || prev.zipCode,
    }))
    setKeywordAddressSuggestions([])
  }

  useEffect(() => {
    if (!showAddressForm) return
    const updateBaseMapHeight = () => {
      const vh = typeof window !== "undefined" ? window.innerHeight : 800
      setBaseMapHeight(Math.max(260, Math.min(420, Math.round(vh * 0.45))))
    }
    updateBaseMapHeight()
    window.addEventListener("resize", updateBaseMapHeight)
    return () => window.removeEventListener("resize", updateBaseMapHeight)
  }, [showAddressForm])

  useEffect(() => {
    if (!showAddressForm) return
    setFormScrollTop(0)
  }, [showAddressForm])

  useEffect(() => {
    if (!showAddressForm || typeof window === "undefined" || !window.visualViewport) return
    const viewport = window.visualViewport
    const updateKeyboardInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      setKeyboardInset(inset > 0 ? inset : 0)
    }
    updateKeyboardInset()
    viewport.addEventListener("resize", updateKeyboardInset)
    viewport.addEventListener("scroll", updateKeyboardInset)
    return () => {
      viewport.removeEventListener("resize", updateKeyboardInset)
      viewport.removeEventListener("scroll", updateKeyboardInset)
    }
  }, [showAddressForm])

  if (showAddressForm) {
    return (
      <AddressFormView
        onCancel={() => setShowAddressForm(false)}
        formBodyRef={formBodyRef}
        scrollTop={formScrollTop}
        onFormScroll={setFormScrollTop}
        keyboardInset={keyboardInset}
        baseMapHeight={baseMapHeight}
        mapContainerRef={mapContainerRef}
        mapLoading={mapLoading}
        addressAutocompleteValue={addressAutocompleteValue}
        onAutocompleteChange={setAddressAutocompleteValue}
        isKeywordSearching={isKeywordSearching}
        keywordSuggestions={keywordAddressSuggestions}
        onPickSuggestion={handlePickSuggestion}
        onUseCurrentLocation={handleUseCurrentLocation}
        currentAddress={currentAddress}
        addressFormData={addressFormData}
        onFormChange={(field, value) => setAddressFormData((prev) => ({ ...prev, [field]: value }))}
        onLabelChange={(label) => setAddressFormData((prev) => ({ ...prev, label }))}
        manualFieldRefs={manualFieldRefs}
        scrollFieldIntoView={scrollFieldIntoView}
        loadingAddress={loadingAddress}
        onSubmit={handleAddressFormSubmit}
        clamp={clamp}
      />
    )
  }

  return (
    <AddressSelectorView
      onBack={goBack}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      locationPreview={locationPreview}
      geoLoading={geoLoading || geoActionLoading}
      onUseCurrentLocation={handleUseCurrentLocation}
      addresses={addresses}
      defaultAddressId={defaultAddressId}
      onSelectAddress={handleSelectSavedAddress}
      onAddNew={() => openAddressForm("Home")}
      onQuickSlotClick={handleQuickSlotClick}
    />
  )
}
