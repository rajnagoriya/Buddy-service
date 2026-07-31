import { useEffect, useMemo, useRef, useState } from "react"
import { MapPin, Search, Loader2 } from "lucide-react"
import { zoneAPI } from "@food/api"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { loadFoodGoogleMaps } from "@food/utils/googleMapsLoader"

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

const parseCoordinate = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const getZonePaths = (zone) => {
  if (!zone?.coordinates || !Array.isArray(zone.coordinates) || zone.coordinates.length < 3) {
    return []
  }
  return zone.coordinates
    .map((c) => ({
      lat: Number(c.latitude),
      lng: Number(c.longitude),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
}

const getZoneBounds = (zone) => {
  if (!window.google?.maps) return null
  const paths = getZonePaths(zone)
  if (paths.length < 3) return null
  const bounds = new window.google.maps.LatLngBounds()
  paths.forEach((p) => bounds.extend(p))
  return bounds
}

const placeMatchesZoneCity = (place, zoneCity) => {
  const city = String(zoneCity || "").trim().toLowerCase()
  if (!city) return true
  const comps = Array.isArray(place?.address_components) ? place.address_components : []
  const names = comps
    .filter((c) =>
      (c.types || []).some((t) =>
        ["locality", "administrative_area_level_2", "sublocality", "postal_town"].includes(t),
      ),
    )
    .map((c) => String(c.long_name || "").trim().toLowerCase())
  const formatted = String(place?.formatted_address || "").toLowerCase()
  return names.some((n) => n === city || n.includes(city) || city.includes(n)) || formatted.includes(city)
}

const isPointInZonePolygon = (lat, lng, zone) => {
  if (!window.google?.maps?.geometry?.poly) return null
  const paths = getZonePaths(zone)
  if (paths.length < 3) return null
  const polygon = new window.google.maps.Polygon({ paths })
  return window.google.maps.geometry.poly.containsLocation(
    new window.google.maps.LatLng(lat, lng),
    polygon,
  )
}

/**
 * Flow: select service zone → map opens for that zone → pin location inside it.
 */
export default function RestaurantLocationMapPicker({
  value = null,
  onChange,
  disabled = false,
  className = "",
  mapHeight = 320,
}) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const geocoderRef = useRef(null)
  const mapInitializedRef = useRef(false)
  const polygonRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const disabledRef = useRef(disabled)
  const selectedZoneIdRef = useRef("")
  const selectedZoneRef = useRef(null)
  const lastEmittedKeyRef = useRef("")
  const applyLocationRef = useRef(() => {})
  const reverseGeocodeRef = useRef(() => {})

  const [zones, setZones] = useState([])
  const [zonesLoading, setZonesLoading] = useState(true)
  const [selectedZoneId, setSelectedZoneId] = useState(String(value?.zoneId || ""))
  const [mapLoading, setMapLoading] = useState(false)
  const [mapError, setMapError] = useState("")
  const [locationSearch, setLocationSearch] = useState("")
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [isInZone, setIsInZone] = useState(false)
  const [checkingZone, setCheckingZone] = useState(false)

  const selectedZone = useMemo(
    () => zones.find((z) => getZoneId(z) === String(selectedZoneId)) || null,
    [zones, selectedZoneId],
  )

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    disabledRef.current = disabled
    if (markerRef.current) {
      markerRef.current.setDraggable(!disabled)
    }
  }, [disabled])

  useEffect(() => {
    selectedZoneIdRef.current = String(selectedZoneId || "")
    selectedZoneRef.current = selectedZone
  }, [selectedZoneId, selectedZone])

  // Sync zone from parent when hydrating saved onboarding data
  useEffect(() => {
    const next = String(value?.zoneId || "")
    if (next && next !== selectedZoneId) {
      setSelectedZoneId(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.zoneId])

  const emitChange = (location, zone, inZone) => {
    if (!onChangeRef.current) return
    const zoneId = getZoneId(zone) || String(selectedZoneIdRef.current || "")
    const city = getCityFromZone(zone) || location?.city || ""
    const payload = {
      zoneId,
      isInZone: Boolean(inZone && zoneId && location),
      zone: zone || null,
      location: location
        ? {
            formattedAddress: location.address || "",
            addressLine1: location.addressLine1 || location.address || "",
            area: location.area || "",
            city,
            state: location.state || "",
            pincode: location.pincode || "",
            latitude: location.lat,
            longitude: location.lng,
          }
        : {
            formattedAddress: "",
            addressLine1: "",
            area: "",
            city,
            state: "",
            pincode: "",
            latitude: "",
            longitude: "",
          },
    }
    const key = JSON.stringify({
      zoneId: payload.zoneId,
      isInZone: payload.isInZone,
      lat: payload.location.latitude,
      lng: payload.location.longitude,
      address: payload.location.formattedAddress,
      area: payload.location.area,
      city: payload.location.city,
      pincode: payload.location.pincode,
    })
    if (key === lastEmittedKeyRef.current) return
    lastEmittedKeyRef.current = key
    onChangeRef.current(payload)
  }

  const clearMarker = () => {
    if (markerRef.current) {
      markerRef.current.setMap(null)
      markerRef.current = null
    }
  }

  const fitMapToZone = (zone) => {
    if (!mapInstanceRef.current || !window.google || !zone) return
    const paths = getZonePaths(zone)
    if (paths.length < 3) return
    const bounds = new window.google.maps.LatLngBounds()
    paths.forEach((p) => bounds.extend(p))
    mapInstanceRef.current.fitBounds(bounds, 48)
  }

  const drawSelectedZone = (zone) => {
    if (!mapInstanceRef.current || !window.google) return
    if (polygonRef.current) {
      polygonRef.current.setMap(null)
      polygonRef.current = null
    }
    const paths = getZonePaths(zone)
    if (paths.length < 3) return

    const polygon = new window.google.maps.Polygon({
      paths,
      strokeColor: "#22c55e",
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: "#22c55e",
      fillOpacity: 0.18,
      map: mapInstanceRef.current,
    })

    polygon.addListener("click", (event) => {
      if (disabledRef.current) return
      reverseGeocodeRef.current(event.latLng.lat(), event.latLng.lng())
    })

    polygonRef.current = polygon
    fitMapToZone(zone)
  }

  const checkLocationInSelectedZone = async (lat, lng, location, zone) => {
    const activeZone = zone || selectedZoneRef.current
    if (!activeZone) {
      setIsInZone(false)
      emitChange(location, null, false)
      return
    }

    try {
      setCheckingZone(true)

      const clientHit = isPointInZonePolygon(lat, lng, activeZone)
      if (clientHit === true) {
        setIsInZone(true)
        emitChange(location, activeZone, true)
        return
      }
      if (clientHit === false) {
        setIsInZone(false)
        emitChange(location, activeZone, false)
        return
      }

      // Fallback: server detect, then confirm it matches selected zone
      const response = await zoneAPI.detectZone(lat, lng)
      const payload = response?.data?.data || response?.data || {}
      const detected = payload.zone || null
      const detectedId = getZoneId(detected)
      const selectedId = getZoneId(activeZone)
      const inSelected =
        Boolean(detected) &&
        (payload.status === "IN_SERVICE" || payload.zoneId) &&
        detectedId === selectedId

      setIsInZone(inSelected)
      emitChange(location, activeZone, inSelected)
    } catch {
      setIsInZone(false)
      emitChange(location, activeZone, false)
    } finally {
      setCheckingZone(false)
    }
  }

  const updateMarker = (lat, lng, address) => {
    if (!mapInstanceRef.current || !window.google) return

    clearMarker()

    const marker = new window.google.maps.Marker({
      position: { lat, lng },
      map: mapInstanceRef.current,
      draggable: !disabledRef.current,
      animation: window.google.maps.Animation.DROP,
      title: address || "Restaurant location",
    })

    marker.addListener("dragend", (event) => {
      if (disabledRef.current) return
      reverseGeocodeRef.current(event.latLng.lat(), event.latLng.lng())
    })

    markerRef.current = marker
  }

  const applyLocation = (parsed, zoneOverride = null) => {
    if (!parsed || !Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) return
    const zone = zoneOverride || selectedZoneRef.current
    setLocationSearch(parsed.address || "")
    setSelectedLocation(parsed)
    updateMarker(parsed.lat, parsed.lng, parsed.address)
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat: parsed.lat, lng: parsed.lng })
      mapInstanceRef.current.setZoom(17)
    }
    checkLocationInSelectedZone(parsed.lat, parsed.lng, parsed, zone)
  }

  const reverseGeocodeAndApply = (lat, lng) => {
    if (geocoderRef.current) {
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results[0]) {
          applyLocation(parseGeocoderResult(results[0], lat, lng))
        } else {
          applyLocation({ lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` })
        }
      })
      return
    }
    applyLocation({ lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` })
  }

  applyLocationRef.current = applyLocation
  reverseGeocodeRef.current = reverseGeocodeAndApply

  useEffect(() => {
    let cancelled = false
    setZonesLoading(true)
    zoneAPI
      .getPublicZones()
      .then((res) => {
        if (cancelled) return
        const list = res?.data?.data?.zones || res?.data?.zones || []
        setZones(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!cancelled) setZones([])
      })
      .finally(() => {
        if (!cancelled) setZonesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleZoneSelect = (zoneId) => {
    if (disabled) return
    const nextId = String(zoneId || "")
    setSelectedZoneId(nextId)
    selectedZoneIdRef.current = nextId

    const zone = zones.find((z) => getZoneId(z) === nextId) || null

    // Reset pin when zone changes — user must place a pin in the new zone
    setSelectedLocation(null)
    setIsInZone(false)
    setLocationSearch("")
    clearMarker()
    lastEmittedKeyRef.current = ""

    emitChange(null, zone, false)

    if (zone && mapInstanceRef.current && window.google) {
      drawSelectedZone(zone)
    }
  }

  // Boot map only after a zone is selected
  useEffect(() => {
    if (!selectedZoneId) {
      mapInitializedRef.current = false
      mapInstanceRef.current = null
      clearMarker()
      if (polygonRef.current) {
        polygonRef.current.setMap(null)
        polygonRef.current = null
      }
      setMapLoading(false)
      setMapError("")
      return undefined
    }

    let cancelled = false
    setMapLoading(true)

    const boot = async () => {
      try {
        setMapError("")
        const apiKey = await getGoogleMapsApiKey()
        if (cancelled) return
        if (!apiKey) {
          setMapError("Google Maps API key is missing. Please contact support.")
          setMapLoading(false)
          return
        }

        let retries = 0
        while (!mapRef.current && retries < 50) {
          await new Promise((r) => setTimeout(r, 100))
          retries += 1
          if (cancelled) return
        }
        if (!mapRef.current) {
          setMapError("Failed to initialize map. Please refresh and try again.")
          setMapLoading(false)
          return
        }

        const google = await loadFoodGoogleMaps()
        if (cancelled) return
        if (!google?.maps) {
          setMapError("Failed to load Google Maps. Check your API key.")
          setMapLoading(false)
          return
        }

        if (mapInitializedRef.current && mapInstanceRef.current) {
          window.google.maps.event.trigger(mapInstanceRef.current, "resize")
          const zone = zones.find((z) => getZoneId(z) === String(selectedZoneId))
          if (zone) drawSelectedZone(zone)
          setMapLoading(false)
          return
        }

        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 20.5937, lng: 78.9629 },
          zoom: 5,
          mapTypeControl: false,
          zoomControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          scrollwheel: true,
          gestureHandling: "greedy",
        })

        mapInstanceRef.current = map
        geocoderRef.current = new google.maps.Geocoder()
        mapInitializedRef.current = true

        map.addListener("click", (event) => {
          if (disabledRef.current) return
          reverseGeocodeRef.current(event.latLng.lat(), event.latLng.lng())
        })

        const zone = zones.find((z) => getZoneId(z) === String(selectedZoneId))
        if (zone) drawSelectedZone(zone)

        setMapLoading(false)
      } catch (error) {
        if (cancelled) return
        setMapError(error?.message || "Failed to load Google Maps")
        setMapLoading(false)
      }
    }

    boot()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZoneId])

  // When zones finish loading after zone already selected, fit/draw polygon
  useEffect(() => {
    if (!selectedZoneId || !selectedZone || mapLoading || !mapInstanceRef.current) return
    drawSelectedZone(selectedZone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZone, mapLoading])

  // Places autocomplete restricted to the selected zone city / polygon bounds
  useEffect(() => {
    if (
      !selectedZoneId ||
      !selectedZone ||
      mapLoading ||
      !mapInstanceRef.current ||
      !autocompleteInputRef.current ||
      !window.google?.maps?.places
    ) {
      return
    }

    if (autocompleteRef.current) {
      try {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
      } catch {
        // ignore
      }
      autocompleteRef.current = null
    }

    const zoneCity = getCityFromZone(selectedZone)
    const bounds = getZoneBounds(selectedZone)
    const options = {
      componentRestrictions: { country: "in" },
      fields: ["formatted_address", "address_components", "geometry"],
    }

    if (bounds) {
      options.bounds = bounds
      // Keep suggestions inside the selected zone city area
      options.strictBounds = true
    }

    const autocomplete = new window.google.maps.places.Autocomplete(
      autocompleteInputRef.current,
      options,
    )

    if (bounds) {
      autocomplete.setBounds(bounds)
    }

    autocomplete.addListener("place_changed", () => {
      if (disabledRef.current) return
      const place = autocomplete.getPlace()
      if (!place?.geometry?.location) return

      const lat = place.geometry.location.lat()
      const lng = place.geometry.location.lng()
      const insidePolygon = isPointInZonePolygon(lat, lng, selectedZoneRef.current)
      const cityOk = placeMatchesZoneCity(place, zoneCity)

      // Only accept places in the zone city / zone polygon
      if (insidePolygon === false || (!cityOk && insidePolygon !== true)) {
        setIsInZone(false)
        setSelectedLocation(null)
        setLocationSearch("")
        clearMarker()
        emitChange(null, selectedZoneRef.current, false)
        return
      }

      applyLocationRef.current(parseGeocoderResult(place, lat, lng))
    })

    autocompleteRef.current = autocomplete
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZoneId, selectedZone, mapLoading])

  // Hydrate saved pin after map + zone are ready
  useEffect(() => {
    if (!selectedZoneId || mapLoading || !mapInstanceRef.current || selectedLocation) return
    const lat = parseCoordinate(value?.location?.latitude ?? value?.latitude)
    const lng = parseCoordinate(value?.location?.longitude ?? value?.longitude)
    if (lat === null || lng === null) return

    const address =
      value?.location?.formattedAddress ||
      value?.location?.addressLine1 ||
      value?.formattedAddress ||
      ""
    applyLocation({
      lat,
      lng,
      address,
      area: value?.location?.area || "",
      city: value?.location?.city || "",
      state: value?.location?.state || "",
      pincode: value?.location?.pincode || "",
      addressLine1: value?.location?.addressLine1 || "",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZoneId, mapLoading, value?.location?.latitude, value?.location?.longitude])

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600">Service zone</label>
        <select
          value={selectedZoneId}
          onChange={(e) => handleZoneSelect(e.target.value)}
          disabled={disabled || zonesLoading}
          className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 disabled:bg-gray-50"
        >
          <option value="">{zonesLoading ? "Loading zones..." : "Select service zone first"}</option>
          {zones.map((z) => {
            const id = getZoneId(z)
            const label = z?.name || z?.zoneName || z?.serviceLocation || id
            return (
              <option key={id} value={id}>
                {label}
              </option>
            )
          })}
        </select>
      </div>

      {!selectedZoneId ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
          <MapPin className="mx-auto mb-2 h-6 w-6 text-gray-400" />
          <p className="text-sm font-medium text-gray-700">Select a service zone</p>
          <p className="mt-1 text-xs text-gray-500">
            The map will open for that zone so you can pin your exact outlet location.
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={autocompleteInputRef}
              type="text"
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              placeholder={
                getCityFromZone(selectedZone)
                  ? `Search address in ${getCityFromZone(selectedZone)}`
                  : "Search address inside this zone"
              }
              disabled={disabled}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-800 outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 disabled:bg-gray-50"
            />
          </div>

          {selectedLocation && (
            <div
              className={`flex items-start gap-3 rounded-xl border p-3 ${
                isInZone ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
              }`}
            >
              <div className={`rounded-full p-2 ${isInZone ? "bg-green-100" : "bg-red-100"}`}>
                <MapPin className={`h-4 w-4 ${isInZone ? "text-green-600" : "text-red-600"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${isInZone ? "text-green-900" : "text-red-900"}`}>
                  {checkingZone
                    ? "Checking location..."
                    : isInZone
                      ? `Inside ${selectedZone?.zoneName || selectedZone?.name || "selected zone"}`
                      : "Outside selected zone"}
                </p>
                <p className={`mt-0.5 text-xs ${isInZone ? "text-green-700" : "text-red-700"}`}>
                  {isInZone
                    ? selectedLocation.address
                    : "Move the pin inside the green zone boundary to continue."}
                </p>
              </div>
              {checkingZone && <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-gray-400" />}
            </div>
          )}

          <div className="relative overflow-hidden rounded-xl border border-gray-200">
            {mapError && !mapLoading && (
              <div className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                {mapError}
              </div>
            )}
            <div
              ref={mapRef}
              className="w-full"
              style={{ height: mapHeight, minHeight: mapHeight }}
            />
            {mapLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
                <div className="text-center">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary-orange" />
                  <p className="text-xs text-gray-600">Loading zone map...</p>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Search shows places in{" "}
            {getCityFromZone(selectedZone) || "the selected zone"} only. Tap or drag the pin inside
            the green boundary.
          </p>
        </>
      )}
    </div>
  )
}
