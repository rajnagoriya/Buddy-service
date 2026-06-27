import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import { RestaurantConfirmModal } from "@food/components/restaurant/panel/RestaurantPanelModal"
import OutletOnlineStatusCard from "@food/components/restaurant/outlet-timings/OutletOnlineStatusCard"
import OutletWeeklySchedule from "@food/components/restaurant/outlet-timings/OutletWeeklySchedule"
import {
  evaluateOutletTimingState,
  getDefaultDays,
  getTodayName,
  getTodaySlotLabel,
  timeToString,
} from "@food/utils/outletTimingsUtils"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"

const RESTAURANT_ONLINE_STATUS_KEY = "restaurant_online_status"

const persistRestaurantOnlineStatus = (isOnline) => {
  try {
    localStorage.setItem(RESTAURANT_ONLINE_STATUS_KEY, JSON.stringify(Boolean(isOnline)))
  } catch {}
}

const formatAddress = (location) => {
  if (!location) return ""
  const parts = []
  if (location.area) parts.push(location.area.trim())
  if (location.city) parts.push(location.city.trim())
  return parts.join(", ") || ""
}

export default forwardRef(function OutletTimingsPanel(_props, ref) {
  const scheduleRef = useRef(null)

  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deliveryStatus, setDeliveryStatus] = useState(false)
  const [savedDeliveryStatus, setSavedDeliveryStatus] = useState(false)
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [days, setDays] = useState(getDefaultDays)
  const [savedDays, setSavedDays] = useState(getDefaultDays)
  const [expandedDay, setExpandedDay] = useState(getTodayName())
  const [showOutletClosedDialog, setShowOutletClosedDialog] = useState(false)
  const [showOutsideTimingsDialog, setShowOutsideTimingsDialog] = useState(false)
  const [isUnderReview, setIsUnderReview] = useState(false)

  const todayName = getTodayName()

  const timingState = useMemo(
    () => evaluateOutletTimingState(days, currentDateTime),
    [days, currentDateTime],
  )

  const { isDayClosed, isWithinTimings } = timingState
  const todaySlotLabel = useMemo(() => getTodaySlotLabel(days, currentDateTime), [days, currentDateTime])

  const restaurantMeta = useMemo(() => {
    if (!restaurantData) return ""
    const id = restaurantData.id ? `ID ${String(restaurantData.id).slice(-5)}` : ""
    const address = formatAddress(restaurantData.location)
    return [id, address].filter(Boolean).join(" · ")
  }, [restaurantData])

  const hasUnsavedChanges =
    JSON.stringify(days) !== JSON.stringify(savedDays) || deliveryStatus !== savedDeliveryStatus

  useEffect(() => {
    const interval = setInterval(() => setCurrentDateTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let mounted = true

    const loadPageData = async () => {
      try {
        setLoading(true)
        const [restaurantRes, timingsRes] = await Promise.all([
          restaurantAPI.getCurrentRestaurant(),
          restaurantAPI.getOutletTimings(),
        ])

        if (!mounted) return

        const restaurant =
          restaurantRes?.data?.data?.restaurant || restaurantRes?.data?.restaurant
        if (restaurant) {
          setRestaurantData(restaurant)
          const underReview = Boolean(
            restaurant.hasPendingProfileReview || restaurant.profileReviewStatus === "pending" || restaurant.profileReviewStatus === "rejected" || restaurant.status === "rejected"
          )
          setIsUnderReview(underReview)
          const online = !underReview && restaurant.isAcceptingOrders === true
          setDeliveryStatus(online)
          setSavedDeliveryStatus(online)
          persistRestaurantOnlineStatus(online)
        }

        const outletTimings =
          timingsRes?.data?.data?.outletTimings || timingsRes?.data?.outletTimings
        if (outletTimings && typeof outletTimings === "object") {
          const merged = { ...getDefaultDays(), ...outletTimings }
          setDays(merged)
          setSavedDays(merged)
        }
      } catch {
        // silent
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadPageData()
    return () => {
      mounted = false
    }
  }, [])

  const scrollToSchedule = () => {
    scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    setExpandedDay(todayName)
  }

  const handleDeliveryStatusChange = (checked) => {
    if (isUnderReview) {
      toast.error("You are under admin review and cannot go online until approved.")
      return
    }
    if (checked && isDayClosed) {
      setShowOutletClosedDialog(true)
      return
    }
    if (checked && isWithinTimings === false && !isDayClosed) {
      setShowOutsideTimingsDialog(true)
      return
    }
    setDeliveryStatus(checked)
  }

  const save = async () => {
    if (isUnderReview && deliveryStatus) {
      toast.error("You are under admin review and cannot go online until approved.")
      return false
    }

    try {
      await restaurantAPI.saveOutletTimings(days)
      if (deliveryStatus !== savedDeliveryStatus) {
        await restaurantAPI.updateAcceptingOrders(deliveryStatus)
        persistRestaurantOnlineStatus(deliveryStatus)
        window.dispatchEvent(
          new CustomEvent("restaurantStatusChanged", { detail: { isOnline: deliveryStatus } }),
        )
      }
      setSavedDays(days)
      setSavedDeliveryStatus(deliveryStatus)
      window.dispatchEvent(new Event("outletTimingsUpdated"))
      toast.success("Hours and status saved")
      return true
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save hours")
      return false
    }
  }

  useImperativeHandle(ref, () => ({ save, hasUnsavedChanges }))

  const handleOutsideTimingsConfirm = () => {
    setShowOutsideTimingsDialog(false)
    setDeliveryStatus(true)
  }

  if (loading) {
    return <div className="py-8 text-center text-sm text-gray-500">Loading hours...</div>
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div className="space-y-4">
        {hasUnsavedChanges ? (
          <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            You have unsaved changes. Tap Save to apply.
          </p>
        ) : null}

        <OutletOnlineStatusCard
          restaurantName={restaurantData?.name}
          restaurantMeta={restaurantMeta}
          loading={loading}
          deliveryStatus={deliveryStatus}
          onDeliveryStatusChange={handleDeliveryStatusChange}
          todaySlotLabel={todaySlotLabel}
          isDayClosed={isDayClosed}
          isWithinTimings={isWithinTimings}
          showOutsideWarning={!isWithinTimings && !deliveryStatus}
          isUnderReview={isUnderReview}
        />

        <OutletWeeklySchedule
          ref={scheduleRef}
          days={days}
          expandedDay={expandedDay}
          onToggleDay={(day) => setExpandedDay(expandedDay === day ? null : day)}
          onToggleDayOpen={(day) => {
            setDays((prev) => {
              const newOpen = !prev[day].isOpen
              return {
                ...prev,
                [day]: {
                  ...prev[day],
                  isOpen: newOpen,
                  openingTime: newOpen ? prev[day].openingTime || "09:00" : "",
                  closingTime: newOpen ? prev[day].closingTime || "22:00" : "",
                },
              }
            })
          }}
          onTimeChange={(day, timeType, newTime) => {
            if (!newTime) return
            const timeString = timeToString(newTime)
            if (!timeString.includes(":")) return
            setDays((prev) => ({
              ...prev,
              [day]: { ...prev[day], [timeType]: timeString },
            }))
          }}
          todayName={todayName}
        />
      </div>

      <RestaurantConfirmModal
        open={showOutletClosedDialog}
        onClose={() => setShowOutletClosedDialog(false)}
        onConfirm={() => {
          setShowOutletClosedDialog(false)
          scrollToSchedule()
        }}
        title="Outlet closed today"
        description="Today is marked closed in your weekly schedule."
        confirmLabel="Edit today's hours"
        cancelLabel="Cancel"
        confirmVariant="primary"
      />

      <RestaurantConfirmModal
        open={showOutsideTimingsDialog}
        onClose={() => {
          setShowOutsideTimingsDialog(false)
          scrollToSchedule()
        }}
        onConfirm={handleOutsideTimingsConfirm}
        title="Outside scheduled hours"
        description="You are currently outside today's opening hours."
        confirmLabel="Turn on anyway"
        cancelLabel="Edit hours"
        confirmVariant="warning"
      />

      <div className="pt-4 mt-4">
        <button
          type="button"
          onClick={save}
          disabled={!hasUnsavedChanges}
          className="w-full rounded-xl bg-[var(--rt-primary-strong)] py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          Save Hours & Status
        </button>
      </div>
    </LocalizationProvider>
  )
})
