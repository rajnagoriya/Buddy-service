import { forwardRef, useState, useEffect, useRef, useImperativeHandle } from "react"
import { MapPin, Search, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"
import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import { PanelSurface } from "@food/components/restaurant/panel/panelUi"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"
import { restaurantAPI, zoneAPI } from "@food/api"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { loadFoodGoogleMaps } from "@food/utils/googleMapsLoader"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const parseCoordinate = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const getSavedLocationCoords = (location) => {
  if (!location) return null

  let lat = null
  let lng = null

  if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
    lng = parseCoordinate(location.coordinates[0])
    lat = parseCoordinate(location.coordinates[1])
  }

  if (lat === null || lng === null) {
    lat = parseCoordinate(location.latitude)
    lng = parseCoordinate(location.longitude)
  }

  if (lat === null || lng === null) return null

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const swappedLat = lng
    const swappedLng = lat

    if (
      swappedLat >= -90 && swappedLat <= 90 &&
      swappedLng >= -180 && swappedLng <= 180
    ) {
      return { lat: swappedLat, lng: swappedLng }
    }

    return null
  }

  return { lat, lng }
}

const parseAddressComponents = (comps = []) => {
  const get = (types) =>
    comps.find((c) => types.some((t) => c.types?.includes(t)))?.long_name || ""
  const route = get(["route"])
  const streetNumber = get(["street_number"])
  return {
    area:
      get(["sublocality_level_1", "sublocality", "neighborhood"]) || get(["locality"]),
    city: get(["locality"]) || get(["administrative_area_level_2"]),
    state: get(["administrative_area_level_1"]),
    pincode: get(["postal_code"]),
    addressLine1: [streetNumber, route].filter(Boolean).join(" ").trim(),
  }
}

const parseGeocoderResult = (result, lat, lng) => {
  const address = result?.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  const parsed = parseAddressComponents(result?.address_components || [])
  return { lat, lng, address, ...parsed }
}

const getCityFromZone = (zone) => {
  if (!zone) return ""
  return String(zone.serviceLocation || zone.zoneName || zone.name || "")
    .trim()
    .replace(/\s+zone$/i, "")
    .replace(/\s+region$/i, "")
    .trim()
}

const getZoneId = (zone) => String(zone?._id || zone?.id || "")

export default forwardRef(function ZoneSetup({ embedded = false, mapActive = true }, ref) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const geocoderRef = useRef(null)
  const mapInitializedRef = useRef(false)
  
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("")
  const [mapLoading, setMapLoading] = useState(true)
  const [mapError, setMapError] = useState("")
  const [saving, setSaving] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)
  const [locationSearch, setLocationSearch] = useState("")
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [selectedAddress, setSelectedAddress] = useState("")
  const [zones, setZones] = useState([])
  const [currentZone, setCurrentZone] = useState(null)
  const [isInZone, setIsInZone] = useState(false)
  const [checkingZone, setCheckingZone] = useState(false)
  const polygonRefs = useRef([])
  const savedSnapshotRef = useRef(null)

  useEffect(() => {
    fetchRestaurantData()
    fetchZones()
  }, [])

  useEffect(() => {
    if (embedded && !mapActive) {
      setMapLoading(false)
      return undefined
    }

    if (mapInitializedRef.current && mapInstanceRef.current && window.google?.maps) {
      window.google.maps.event.trigger(mapInstanceRef.current, "resize")
      setMapLoading(false)
      return undefined
    }

    let cancelled = false
    loadGoogleMaps(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [embedded, mapActive])

  const fetchZones = async () => {
    try {
      const response = await zoneAPI.getPublicZones()
      const list = response?.data?.data?.zones || response?.data?.zones || []
      setZones(Array.isArray(list) ? list : [])
    } catch (error) {
      debugError("Error fetching zones:", error)
    }
  }

  // Initialize Places Autocomplete when map is loaded
  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && autocompleteInputRef.current && window.google?.maps?.places && !autocompleteRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
        componentRestrictions: { country: "in" },
        fields: ["formatted_address", "address_components", "geometry"],
      })
      
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace()
        if (place.geometry && place.geometry.location && mapInstanceRef.current) {
          const location = place.geometry.location
          const lat = location.lat()
          const lng = location.lng()
          const parsed = parseGeocoderResult(place, lat, lng)
          
          mapInstanceRef.current.setCenter(location)
          mapInstanceRef.current.setZoom(17)
          
          setLocationSearch(parsed.address)
          setSelectedAddress(parsed.address)
          setSelectedLocation(parsed)
          updateMarker(lat, lng, parsed.address)
          checkLocationInZone(lat, lng)
        }
      })
      
      autocompleteRef.current = autocomplete
    }
  }, [mapLoading])

  // Load existing restaurant location when data is fetched
  useEffect(() => {
    if (restaurantData?.location && mapInstanceRef.current && !mapLoading && window.google) {
      const location = restaurantData.location
      const savedCoords = getSavedLocationCoords(location)

      if (savedCoords) {
        const { lat, lng } = savedCoords
        const locationObj = new window.google.maps.LatLng(lat, lng)
        mapInstanceRef.current.setCenter(locationObj)
        mapInstanceRef.current.setZoom(17)
        
        const existingAddress = location.formattedAddress || location.address || formatAddress(location) || ""
        const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(existingAddress.trim())
        
        if ((!existingAddress || isCoordinates) && geocoderRef.current) {
          geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results[0]) {
              const parsed = parseGeocoderResult(results[0], lat, lng)
              setLocationSearch(parsed.address)
              setSelectedAddress(parsed.address)
              setSelectedLocation(parsed)
              updateMarker(lat, lng, parsed.address)
              checkLocationInZone(lat, lng)
            } else {
              const fallback = { lat, lng, address: existingAddress }
              setLocationSearch(existingAddress)
              setSelectedAddress(existingAddress)
              setSelectedLocation(fallback)
              updateMarker(lat, lng, existingAddress)
              checkLocationInZone(lat, lng)
            }
          })
        } else {
          const parsed = parseGeocoderResult({ formatted_address: existingAddress }, lat, lng)
          setLocationSearch(existingAddress)
          setSelectedAddress(existingAddress)
          setSelectedLocation(parsed)
          updateMarker(lat, lng, existingAddress)
          checkLocationInZone(lat, lng)
        }
      }
    }
  }, [restaurantData, mapLoading])

  const checkLocationInZone = async (lat, lng) => {
    try {
      setCheckingZone(true)
      const response = await zoneAPI.detectZone(lat, lng)
      const payload = response?.data?.data || response?.data || {}
      const detected = payload.zone || null
      
      if (detected && (payload.status === "IN_SERVICE" || payload.zoneId)) {
        setCurrentZone(detected)
        setIsInZone(true)
      } else {
        setCurrentZone(null)
        setIsInZone(false)
      }
    } catch (error) {
      debugError("Error detecting zone:", error)
      // Fallback: check manually if map is loaded
      if (window.google && polygonRefs.current.length > 0) {
        const point = new window.google.maps.LatLng(lat, lng)
        let found = false
        for (const poly of polygonRefs.current) {
          if (window.google.maps.geometry?.poly?.containsLocation(point, poly.polygon)) {
            setCurrentZone({ name: poly.name, _id: poly.id })
            setIsInZone(true)
            found = true
            break
          }
        }
        if (!found) {
          setCurrentZone(null)
          setIsInZone(false)
        }
      }
    } finally {
      setCheckingZone(false)
    }
  }

  // Draw zones on map whenever they change or map is ready
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !zones.length) return

    // Clear existing polygons
    polygonRefs.current.forEach(p => p.polygon.setMap(null))
    polygonRefs.current = []

    debugLog(`?? Rendering ${zones.length} zones reactively...`)
    zones.forEach((z) => {
      if (!z.coordinates || !Array.isArray(z.coordinates) || z.coordinates.length < 3) return

      const paths = z.coordinates.map((c) => ({
        lat: Number(c.latitude),
        lng: Number(c.longitude),
      }))

      const isAssignedZone = restaurantData?.zoneId === (z._id || z.id)
      
      const polygon = new window.google.maps.Polygon({
        paths: paths,
        strokeColor: isAssignedZone ? "#22c55e" : "#ef4444",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: isAssignedZone ? "#22c55e" : "#ef4444",
        fillOpacity: 0.15,
        map: mapInstanceRef.current,
      })

      polygon.addListener("click", (event) => {
        const lat = event.latLng.lat()
        const lng = event.latLng.lng()
        window.google.maps.event.trigger(mapInstanceRef.current, 'click', event)
      })

      polygonRefs.current.push({
        id: z._id || z.id,
        name: z.name || z.zoneName,
        polygon: polygon
      })
    })
  }, [zones, mapLoading, restaurantData?.zoneId])

  const fetchRestaurantData = async () => {
    try {
      const response = await restaurantAPI.getCurrentRestaurant()
      const data = response?.data?.data?.restaurant || response?.data?.restaurant
      if (data) {
        setRestaurantData(data)
        const coords = getSavedLocationCoords(data.location)
        if (coords) {
          savedSnapshotRef.current = {
            lat: coords.lat,
            lng: coords.lng,
            zoneId: String(data.zoneId || ""),
          }
        }
      }
    } catch (error) {
      debugError("Error fetching restaurant data:", error)
    }
  }

  const reportMapError = (message) => {
    setMapError(message)
    setMapLoading(false)
    if (embedded) {
      toast.error(message)
    } else {
      alert(message)
    }
  }

  const loadGoogleMaps = async (isCancelled = () => false) => {
    try {
      setMapError("")
      debugLog("?? Starting Google Maps load...")
      
      const apiKey = await getGoogleMapsApiKey()
      if (isCancelled()) return

      debugLog("?? API Key received:", apiKey ? `Yes (${apiKey.substring(0, 10)}...)` : "No")
        
      if (!apiKey || apiKey.trim() === "") {
        reportMapError(
          embedded
            ? "Google Maps API key is missing. Set VITE_GOOGLE_MAPS_API_KEY in Frontend/.env"
            : "Google Maps API key not found. Please contact administrator to add the API key in admin panel."
        )
        return
      }
      
      setGoogleMapsApiKey(apiKey)

      let refRetries = 0
      const maxRefRetries = 50
      while (!mapRef.current && refRetries < maxRefRetries) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        refRetries++
        if (isCancelled()) return
      }

      if (!mapRef.current) {
        reportMapError("Failed to initialize map container. Please try opening the Zone setup tab again.")
        return
      }

      const google = await loadFoodGoogleMaps()
      if (isCancelled()) return

      if (!google?.maps) {
        reportMapError("Failed to load Google Maps. Check your API key and enabled APIs.")
        return
      }

      debugLog("? Google Maps loaded, initializing map...")
      initializeMap(google)
    } catch (error) {
      if (isCancelled()) return
      debugError("? Error loading Google Maps:", error)
      reportMapError(
        embedded
          ? (error.message || "Failed to load Google Maps")
          : `Failed to load Google Maps: ${error.message}. Please refresh the page or contact administrator.`
      )
    }
  }

  const initializeMap = (google) => {
    try {
      if (!mapRef.current) {
        debugError("? mapRef.current is null in initializeMap")
        setMapLoading(false)
        return
      }

      debugLog("?? Initializing map...")
      // Initial location (India center)
      const initialLocation = { lat: 20.5937, lng: 78.9629 }

      // Create map
      const map = new google.maps.Map(mapRef.current, {
        center: initialLocation,
        zoom: 5,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_RIGHT,
          mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE]
        },
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        scrollwheel: true,
        gestureHandling: 'greedy',
        disableDoubleClickZoom: false,
      })

      mapInstanceRef.current = map
      geocoderRef.current = new google.maps.Geocoder()
      mapInitializedRef.current = true
      debugLog("? Map and Geocoder initialized successfully")

      // Add click listener to place marker
      map.addListener('click', (event) => {
        const lat = event.latLng.lat()
        const lng = event.latLng.lng()
        
        // Use Geocoder to get address
        if (geocoderRef.current) {
          geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results[0]) {
              const parsed = parseGeocoderResult(results[0], lat, lng)
              setLocationSearch(parsed.address)
              setSelectedAddress(parsed.address)
              setSelectedLocation(parsed)
              updateMarker(lat, lng, parsed.address)
              checkLocationInZone(lat, lng)
            } else {
              const parsed = { lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }
              setLocationSearch(parsed.address)
              setSelectedAddress(parsed.address)
              setSelectedLocation(parsed)
              updateMarker(lat, lng, parsed.address)
              checkLocationInZone(lat, lng)
            }
          })
        } else {
          const parsed = { lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }
          setLocationSearch(parsed.address)
          setSelectedAddress(parsed.address)
          setSelectedLocation(parsed)
          updateMarker(lat, lng, parsed.address)
          checkLocationInZone(lat, lng)
        }
      })

      setMapLoading(false)
      debugLog("? Map loading complete")
    } catch (error) {
      debugError("? Error in initializeMap:", error)
      reportMapError(
        embedded
          ? "Failed to initialize map. Please close and reopen this tab."
          : "Failed to initialize map. Please refresh the page."
      )
    }
  }

  const updateMarker = (lat, lng, address) => {
    if (!mapInstanceRef.current || !window.google) return

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.setMap(null)
    }

    // Create new marker
    const marker = new window.google.maps.Marker({
      position: { lat, lng },
      map: mapInstanceRef.current,
      draggable: true,
      animation: window.google.maps.Animation.DROP,
      title: address || "Restaurant Location"
    })

    // Add info window
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 250px;">
          <strong>Restaurant Location</strong><br/>
          <small>${address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`}</small>
        </div>
      `
    })

    marker.addListener('click', () => {
      infoWindow.open(mapInstanceRef.current, marker)
    })

    // Update location when marker is dragged
    marker.addListener('dragend', (event) => {
      const newLat = event.latLng.lat()
      const newLng = event.latLng.lng()
      
      // Use Geocoder to get address
      if (geocoderRef.current) {
        geocoderRef.current.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
          if (status === "OK" && results[0]) {
            const parsed = parseGeocoderResult(results[0], newLat, newLng)
            setLocationSearch(parsed.address)
            setSelectedAddress(parsed.address)
            setSelectedLocation(parsed)
            
            if (infoWindow) {
              infoWindow.setContent(`
                <div style="padding: 8px; max-width: 250px;">
                  <strong>Restaurant Location</strong><br/>
                  <small>${parsed.address}</small>
                </div>
              `)
            }

            checkLocationInZone(newLat, newLng)
          } else {
            const parsed = { lat: newLat, lng: newLng, address: `${newLat.toFixed(6)}, ${newLng.toFixed(6)}` }
            setLocationSearch(parsed.address)
            setSelectedAddress(parsed.address)
            setSelectedLocation(parsed)
            checkLocationInZone(newLat, newLng)
          }
        })
      } else {
        const newAddress = `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`
        setLocationSearch(newAddress)
        setSelectedAddress(newAddress)
        setSelectedLocation({ lat: newLat, lng: newLng, address: newAddress })
        checkLocationInZone(newLat, newLng)
      }
    })

    markerRef.current = marker
  }

  const formatAddress = (location) => {
    if (!location) return ""
    
    if (location.formattedAddress && location.formattedAddress.trim() !== "") {
      return location.formattedAddress.trim()
    }
    
    if (location.address && location.address.trim() !== "") {
      return location.address.trim()
    }
    
    const parts = []
    if (location.addressLine1) parts.push(location.addressLine1.trim())
    if (location.addressLine2) parts.push(location.addressLine2.trim())
    if (location.area) parts.push(location.area.trim())
    if (location.city) parts.push(location.city.trim())
    if (location.state) parts.push(location.state.trim())
    if (location.zipCode || location.pincode) parts.push((location.zipCode || location.pincode).trim())
    
    return parts.length > 0 ? parts.join(", ") : ""
  }

  const hasUnsavedChanges = () => {
    if (!selectedLocation) return false
    const saved = savedSnapshotRef.current
    if (!saved) return true
    const zoneChanged = getZoneId(currentZone) !== String(saved.zoneId || "")
    const latChanged = Math.abs(selectedLocation.lat - saved.lat) > 0.000001
    const lngChanged = Math.abs(selectedLocation.lng - saved.lng) > 0.000001
    return zoneChanged || latChanged || lngChanged
  }

  const save = async () => {
    if (!selectedLocation) {
      toast.error("Please select a location on the map first")
      return false
    }

    if (!isInZone || !currentZone) {
      toast.error("Selected location is outside our service zone")
      return false
    }

    try {
      setSaving(true)
      
      const { lat, lng, address, area, city: geoCity, state, pincode, addressLine1 } = selectedLocation
      const zoneId = getZoneId(currentZone)
      const city = getCityFromZone(currentZone) || geoCity || ""
      const zoneArea = area || currentZone.zoneName || currentZone.name || ""
      
      const response = await restaurantAPI.updateProfile({
        zoneSelectionUpdate: true,
        zoneId,
        city,
        area: zoneArea,
        location: {
          ...(restaurantData?.location || {}),
          latitude: lat,
          longitude: lng,
          coordinates: [lng, lat],
          formattedAddress: address,
          address,
          addressLine1: addressLine1 || undefined,
          area: zoneArea,
          city,
          state: state || undefined,
          pincode: pincode || undefined,
        },
      })

      if (response?.data?.data?.restaurant) {
        const updated = response.data.data.restaurant
        setRestaurantData(updated)
        savedSnapshotRef.current = { lat, lng, zoneId }
        toast.success("Zone and location saved")
        return true
      }
      throw new Error("Failed to save location")
    } catch (error) {
      debugError("Error saving location:", error)
      toast.error(error.response?.data?.message || "Failed to save location. Please try again.")
      return false
    } finally {
      setSaving(false)
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      save,
      hasUnsavedChanges: hasUnsavedChanges(),
    }),
    [selectedLocation, currentZone, isInZone, restaurantData?.zoneId],
  )

  const handleSaveLocation = () => save()

  const zoneContent = (
    <>
        <p className="text-xs text-gray-500">
          Pin your exact outlet location on the map. City and pincode are set from the selected point when it falls inside a service zone.
        </p>
        <PanelSurface className="mb-6 p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={autocompleteInputRef}
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Search for your restaurant location..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            {!embedded && (
              <button
                onClick={handleSaveLocation}
                disabled={!selectedLocation || saving || !isInZone}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Save Location</span>
                  </>
                )}
              </button>
            )}
          </div>
          {selectedLocation && (
            <div className={`mt-3 p-3 rounded-lg border ${isInZone ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <p className="text-sm text-gray-700">
                <strong>Selected Location:</strong> {selectedAddress}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Coordinates: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
              {(selectedLocation.city || selectedLocation.pincode) && (
                <p className="text-xs text-gray-600 mt-1">
                  {[selectedLocation.city, selectedLocation.state, selectedLocation.pincode].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          )}
        </PanelSurface>

        {selectedLocation && (
          <PanelSurface className={`mb-6 flex items-center justify-between p-4 ${
            isInZone ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isInZone ? "bg-green-100" : "bg-red-100"}`}>
                <MapPin className={`w-5 h-5 ${isInZone ? "text-green-600" : "text-red-600"}`} />
              </div>
              <div>
                <h3 className={`text-sm font-bold ${isInZone ? "text-green-900" : "text-red-900"}`}>
                  {checkingZone ? "Checking service zone..." : isInZone ? `In service zone: ${currentZone?.zoneName || currentZone?.name || "Active zone"}` : "Out of service zone"}
                </h3>
                <p className={`text-xs ${isInZone ? "text-green-700" : "text-red-700"}`}>
                  {isInZone 
                    ? `City: ${getCityFromZone(currentZone) || selectedLocation?.city || "—"}${selectedLocation?.pincode ? ` · Pincode: ${selectedLocation.pincode}` : ""}`
                    : "This location is outside all active service zones. Move the pin or search for an address inside a highlighted zone."}
                </p>
              </div>
            </div>
            {checkingZone && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
          </PanelSurface>
        )}

        <PanelSurface className="relative overflow-hidden p-0">
          {mapError && !mapLoading && (
            <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {mapError}
            </div>
          )}
          <div
            ref={mapRef}
            className={`w-full ${embedded ? "h-[360px]" : "h-[600px]"}`}
            style={{ minHeight: embedded ? "360px" : "600px" }}
          />
          {mapLoading && (
            <div className="absolute inset-0 bg-white flex items-center justify-center z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto mb-2" />
                <p className="text-gray-600">Loading map...</p>
              </div>
            </div>
          )}
        </PanelSurface>
    </>
  )

  if (embedded) {
    return <div className="w-full">{zoneContent}</div>
  }

  return (
    <RestaurantSubPageShell
      title="Zone setup"
      subtitle="Set your restaurant location on the map"
      backTo={`${RESTAURANT_BASE}/explore`}
      contentClassName="max-w-7xl w-full"
    >
      {zoneContent}
    </RestaurantSubPageShell>
  )
})


