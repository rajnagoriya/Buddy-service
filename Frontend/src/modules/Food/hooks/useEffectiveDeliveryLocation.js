import { useCallback, useEffect, useMemo, useState } from "react"
import { useProfile } from "@food/context/ProfileContext"
import { useLocation } from "@food/hooks/useLocation"

export const formatSavedAddress = (address) => {
  if (!address) return ""

  if (
    address.formattedAddress &&
    address.formattedAddress !== "Select location"
  ) {
    return address.formattedAddress
  }

  const parts = []
  if (address.additionalDetails) parts.push(address.additionalDetails)
  if (address.street) parts.push(address.street)
  if (address.city) parts.push(address.city)
  if (address.state) parts.push(address.state)
  if (address.zipCode) parts.push(address.zipCode)

  if (parts.length > 0) return parts.join(", ")
  if (address.address && address.address !== "Select location") {
    return address.address
  }

  return ""
}

const readDeliveryAddressMode = () => {
  try {
    return localStorage.getItem("deliveryAddressMode") || "saved"
  } catch {
    return "saved"
  }
}

const resolveSavedAddressCoords = (address) => {
  if (!address) return null

  const coords = address?.location?.coordinates
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = Number(coords[0])
    const lat = Number(coords[1])
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng }
    }
  }

  const lat = Number(address?.latitude ?? address?.lat)
  const lng = Number(address?.longitude ?? address?.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { latitude: lat, longitude: lng }
  }

  return null
}

export default function useEffectiveDeliveryLocation() {
  const { location, loading } = useLocation()
  const { getDefaultAddress, addresses } = useProfile()
  const [deliveryAddressMode, setDeliveryAddressMode] = useState(readDeliveryAddressMode)
  const [locationSyncKey, setLocationSyncKey] = useState(0)

  useEffect(() => {
    const sync = () => {
      setDeliveryAddressMode(readDeliveryAddressMode())
      setLocationSyncKey((key) => key + 1)
    }

    window.addEventListener("deliveryAddressModeUpdated", sync)
    window.addEventListener("userLocationUpdated", sync)
    window.addEventListener("userAddressesUpdated", sync)

    return () => {
      window.removeEventListener("deliveryAddressModeUpdated", sync)
      window.removeEventListener("userLocationUpdated", sync)
      window.removeEventListener("userAddressesUpdated", sync)
    }
  }, [])

  const defaultSavedAddress = useMemo(() => {
    void locationSyncKey
    return getDefaultAddress?.() || null
  }, [getDefaultAddress, addresses, locationSyncKey])

  const defaultSavedAddressLocation = useMemo(
    () => resolveSavedAddressCoords(defaultSavedAddress),
    [defaultSavedAddress],
  )

  const savedAddressText = useMemo(
    () => formatSavedAddress(defaultSavedAddress),
    [defaultSavedAddress],
  )

  const effectiveLocation = useMemo(() => {
    if (deliveryAddressMode === "current") {
      return location
    }

    if (
      defaultSavedAddressLocation &&
      Number.isFinite(defaultSavedAddressLocation.latitude) &&
      Number.isFinite(defaultSavedAddressLocation.longitude)
    ) {
      const resolvedAddress = formatSavedAddress(defaultSavedAddress)
      return {
        ...(location || {}),
        latitude: defaultSavedAddressLocation.latitude,
        longitude: defaultSavedAddressLocation.longitude,
        area:
          defaultSavedAddress?.additionalDetails ||
          defaultSavedAddress?.street ||
          defaultSavedAddress?.area ||
          location?.area ||
          "",
        city: defaultSavedAddress?.city || location?.city || "",
        state: defaultSavedAddress?.state || location?.state || "",
        address:
          resolvedAddress ||
          defaultSavedAddress?.address ||
          location?.address ||
          "",
        formattedAddress:
          resolvedAddress ||
          defaultSavedAddress?.formattedAddress ||
          location?.formattedAddress ||
          "",
      }
    }

    return location
  }, [
    deliveryAddressMode,
    defaultSavedAddress,
    defaultSavedAddressLocation,
    location,
    locationSyncKey,
  ])

  const getAreaLabel = useCallback(() => {
    const loc = effectiveLocation
    if (!loc) return "Set location"
    if (deliveryAddressMode === "saved" && savedAddressText) {
      const firstPart = savedAddressText.split(",")[0]?.trim()
      return firstPart || loc.area || loc.city || "Set location"
    }
    return loc.area || loc.city || loc.formattedAddress?.split(",")[0] || "Set location"
  }, [deliveryAddressMode, effectiveLocation, savedAddressText])

  const getCityLabel = useCallback(() => {
    const city = effectiveLocation?.city
    if (!city || city === "Current Location") return ""
    return city
  }, [effectiveLocation?.city])

  return {
    location,
    loading,
    effectiveLocation,
    savedAddressText,
    defaultSavedAddress,
    defaultSavedAddressLocation,
    deliveryAddressMode,
    getAreaLabel,
    getCityLabel,
  }
}
