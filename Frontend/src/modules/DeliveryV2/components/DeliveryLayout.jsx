import { useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import BottomNavigation from "./BottomNavigation"
import { getUnreadDeliveryNotificationCount } from "@food/utils/deliveryNotifications"
import { deliveryAPI } from "@food/api"
import { useDeliveryStore } from "../store/useDeliveryStore"

// One auto GPS fetch per app session (DeliveryLayout remounts on route changes).
let hasAutoFetchedDeliveryLocation = false

export default function DeliveryLayout({
  children,
  showGig = false,
  showPocket = false,
  onHomeClick,
  onGigClick
}) {
  const location = useLocation()
  const setRiderLocation = useDeliveryStore((s) => s.setRiderLocation)
  const [requestBadgeCount, setRequestBadgeCount] = useState(() =>
    getUnreadDeliveryNotificationCount()
  )
  const [approvalStatus, setApprovalStatus] = useState("loading")

  useEffect(() => {
    let cancelled = false
    deliveryAPI
      .getMe()
      .then((res) => {
        if (cancelled) return
        const user = res?.data?.data?.user ?? res?.data?.user
        const status = user?.status ?? "approved"
        setApprovalStatus(status)
        if (user && typeof localStorage !== "undefined") {
          try {
            localStorage.setItem("delivery_user", JSON.stringify(user))
          } catch (_) {}
        }
      })
      .catch(() => {
        if (!cancelled) setApprovalStatus("pending")
      })
    return () => { cancelled = true }
  }, [])

  // Auto-fetch current GPS as soon as the delivery app opens (even when offline).
  useEffect(() => {
    if (!navigator?.geolocation || hasAutoFetchedDeliveryLocation) return
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
  }, [setRiderLocation])

  useEffect(() => {
    setRequestBadgeCount(getUnreadDeliveryNotificationCount())
    const handleNotificationUpdate = () => {
      setRequestBadgeCount(getUnreadDeliveryNotificationCount())
    }
    window.addEventListener("deliveryNotificationsUpdated", handleNotificationUpdate)
    window.addEventListener("storage", handleNotificationUpdate)
    return () => {
      window.removeEventListener("deliveryNotificationsUpdated", handleNotificationUpdate)
      window.removeEventListener("storage", handleNotificationUpdate)
    }
  }, [location.pathname])

  const showBottomNav = [
    "/food/delivery",
    "/food/delivery/requests",
    "/food/delivery/trip-history",
    "/driver/profile",
  ].includes(location.pathname)

  if (approvalStatus === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </main>
    )
  }

  if (approvalStatus !== "approved") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center space-y-4 rounded-xl bg-white p-6 shadow-sm border border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Pending Admin Approval</h1>
          <p className="text-gray-600 text-sm">
            Your profile has been submitted. You will get full access once admin approves your account.
          </p>
          <p className="text-gray-500 text-xs">You can log out and sign in again to check status.</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <main>
        {children}
      </main>
      {showBottomNav && (
        <BottomNavigation
          showGig={showGig}
          showPocket={showPocket}
          onHomeClick={onHomeClick}
          onGigClick={onGigClick}
          requestBadgeCount={requestBadgeCount}
        />
      )}
    </>
  )
}


