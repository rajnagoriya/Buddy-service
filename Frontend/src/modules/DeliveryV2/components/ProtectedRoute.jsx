import { useEffect } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { isModuleAuthenticated } from "@food/utils/auth"
import { deliveryAPI } from "@food/api"
import { useDeliveryStore } from "../store/useDeliveryStore"

// One auto GPS fetch per app session (ProtectedRoute remounts across routes).
let hasAutoFetchedDeliveryLocation = false

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const isAuthenticated = isModuleAuthenticated("delivery")
  const setRiderLocation = useDeliveryStore((s) => s.setRiderLocation)

  useEffect(() => {
    if (!isAuthenticated || !navigator?.geolocation || hasAutoFetchedDeliveryLocation) return
    hasAutoFetchedDeliveryLocation = true

    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const heading = pos.coords.heading || 0
        setRiderLocation({ lat, lng, heading })
        deliveryAPI
          .updateLocation(lat, lng, false, {
            heading,
            speed: pos.coords.speed || 0,
            accuracy: pos.coords.accuracy,
          })
          .catch(() => {})
      },
      () => {
        // Allow a later remount to retry if the first attempt failed.
        hasAutoFetchedDeliveryLocation = false
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, setRiderLocation])

  if (!isAuthenticated) {
    return <Navigate to="/driver/login" state={{ redirect: location.pathname }} replace />
  }

  return children
}
