import { useState, useEffect, useRef, useMemo } from "react"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import { RestaurantConfirmModal } from "@food/components/restaurant/panel/RestaurantPanelModal"
import OutletOnlineStatusCard from "@food/components/restaurant/outlet-timings/OutletOnlineStatusCard"
import OutletWeeklySchedule from "@food/components/restaurant/outlet-timings/OutletWeeklySchedule"
import { Button } from "@food/components/ui/button"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"
import {
  evaluateOutletTimingState,
  getDefaultDays,
  getTodayName,
  getTodaySlotLabel,
  timeToString,
} from "@food/utils/outletTimingsUtils"
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const RESTAURANT_ONLINE_STATUS_KEY = "restaurant_online_status"

const persistRestaurantOnlineStatus = (isOnline) => {
  try {
    localStorage.setItem(RESTAURANT_ONLINE_STATUS_KEY, JSON.stringify(Boolean(isOnline)))
  } catch {}
}

const serializeDays = (days) => JSON.stringify(days || {})

const formatAddress = (location) => {
  if (!location) return ""
  const parts = []
  if (location.area) parts.push(location.area.trim())
  if (location.city) parts.push(location.city.trim())
  return parts.join(", ") || ""
}

export default function OutletTimings() {
  const scheduleRef = useRef(null)

  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [deliveryStatus, setDeliveryStatus] = useState(false)
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [days, setDays] = useState(getDefaultDays)
  const [savedDaysKey, setSavedDaysKey] = useState("")
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
  const hasUnsavedChanges = savedDaysKey !== "" && serializeDays(days) !== savedDaysKey

  const canGoOnlineNow = !isUnderReview && !isDayClosed && isWithinTimings

  const isCustomerVisibleOnline = useMemo(() => {
    if (isUnderReview || !deliveryStatus) return false
    return getRestaurantAvailabilityStatus(
      { outletTimings: days, isAcceptingOrders: true },
      currentDateTime,
    ).isOpen
  }, [days, currentDateTime, deliveryStatus, isUnderReview])

  const restaurantMeta = useMemo(() => {
    if (!restaurantData) return ""
    const id = restaurantData.id ? `ID ${String(restaurantData.id).slice(-5)}` : ""
    const address = formatAddress(restaurantData.location)
    return [id, address].filter(Boolean).join(" · ")
  }, [restaurantData])

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
            restaurant.hasPendingProfileReview || restaurant.profileReviewStatus === "pending",
          )
          setIsUnderReview(underReview)
          const online = !underReview && restaurant.isAcceptingOrders === true
          setDeliveryStatus(online)
          persistRestaurantOnlineStatus(online)
        }

        const outletTimings =
          timingsRes?.data?.data?.outletTimings || timingsRes?.data?.outletTimings
        if (outletTimings && typeof outletTimings === "object") {
          const merged = { ...getDefaultDays(), ...outletTimings }
          setDays(merged)
          setSavedDaysKey(serializeDays(merged))
        } else {
          const defaults = getDefaultDays()
          setDays(defaults)
          setSavedDaysKey(serializeDays(defaults))
        }
      } catch (error) {
        if (
          error.code !== "ERR_NETWORK" &&
          error.code !== "ECONNABORTED" &&
          !error.message?.includes("timeout")
        ) {
          console.error("Error loading outlet hours page:", error)
        }
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

  const handleSaveSchedule = async () => {
    try {
      setSavingSchedule(true)
      await restaurantAPI.saveOutletTimings(days)
      setSavedDaysKey(serializeDays(days))
      window.dispatchEvent(
        new CustomEvent("outletTimingsUpdated", { detail: { outletTimings: days } }),
      )
      toast.success("Weekly schedule saved")
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not save schedule")
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleDeliveryStatusChange = async (checked) => {
    if (isUnderReview) {
      toast.error("You are under admin review and cannot go online until approved.")
      return
    }

    if (checked && hasUnsavedChanges) {
      toast.error("Save your schedule changes before going online.")
      scrollToSchedule()
      return
    }

    if (checked && isDayClosed) {
      setShowOutletClosedDialog(true)
      return
    }

    if (checked && !isWithinTimings) {
      setShowOutsideTimingsDialog(true)
      return
    }

    setDeliveryStatus(checked)
    try {
      await restaurantAPI.updateAcceptingOrders(checked)
      persistRestaurantOnlineStatus(checked)
      window.dispatchEvent(
        new CustomEvent("restaurantStatusChanged", { detail: { isOnline: checked } }),
      )
    } catch (error) {
      setDeliveryStatus((prev) => !prev)
      persistRestaurantOnlineStatus(!checked)
      toast.error(error?.response?.data?.message || "Could not update online status")
    }
  }

  const toggleDay = (day) => {
    setExpandedDay(expandedDay === day ? null : day)
  }

  const toggleDayOpen = (day) => {
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
  }

  const handleTimeChange = (day, timeType, newTime) => {
    if (!newTime) return
    const timeString = timeToString(newTime)
    if (!timeString.includes(":")) return

    setDays((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [timeType]: timeString,
      },
    }))
  }

  if (loading) {
    return (
      <RestaurantSubPageShell
        title="Hours & status"
        subtitle="Online availability and weekly schedule"
        backTo={`${RESTAURANT_BASE}/explore`}
      >
        <div className="py-12 text-center text-sm text-gray-500">Loading outlet hours...</div>
      </RestaurantSubPageShell>
    )
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <RestaurantSubPageShell
        title="Hours & status"
        subtitle="Online availability and weekly schedule"
        backTo={`${RESTAURANT_BASE}/explore`}
        contentClassName="space-y-5 pb-10"
      >
        <OutletOnlineStatusCard
          restaurantName={restaurantData?.name}
          restaurantMeta={restaurantMeta}
          loading={loading}
          deliveryStatus={deliveryStatus}
          isCustomerVisibleOnline={isCustomerVisibleOnline}
          onDeliveryStatusChange={handleDeliveryStatusChange}
          todaySlotLabel={todaySlotLabel}
          isDayClosed={isDayClosed}
          isWithinTimings={isWithinTimings}
          isUnderReview={isUnderReview}
        />

        <OutletWeeklySchedule
          ref={scheduleRef}
          days={days}
          expandedDay={expandedDay}
          onToggleDay={toggleDay}
          onToggleDayOpen={toggleDayOpen}
          onTimeChange={handleTimeChange}
          todayName={todayName}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {hasUnsavedChanges ? (
            <p className="text-xs text-amber-700">You have unsaved schedule changes.</p>
          ) : (
            <p className="text-xs text-gray-500">Schedule is saved.</p>
          )}
          <Button
            type="button"
            onClick={handleSaveSchedule}
            disabled={!hasUnsavedChanges || savingSchedule}
            className="w-full sm:w-auto bg-[var(--rt-primary-strong)] hover:opacity-90 text-white"
          >
            {savingSchedule ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save schedule"
            )}
          </Button>
        </div>

        {!canGoOnlineNow && !isUnderReview ? (
          <p className="text-center text-xs text-gray-500">
            {isDayClosed
              ? "Open today in the schedule and save to go online."
              : "Update today's hours to include the current time, save, then turn on accepting orders."}
          </p>
        ) : null}

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
        >
          <p className="text-center text-sm text-gray-600">
            Turn today on in the weekly schedule, save, then you can go online.
          </p>
        </RestaurantConfirmModal>

        <RestaurantConfirmModal
          open={showOutsideTimingsDialog}
          onClose={() => setShowOutsideTimingsDialog(false)}
          onConfirm={() => {
            setShowOutsideTimingsDialog(false)
            scrollToSchedule()
          }}
          title="Outside scheduled hours"
          description={`Current time is outside today's hours (${todaySlotLabel}).`}
          confirmLabel="Update today's hours"
          showCancel={false}
          confirmVariant="primary"
        >
          <p className="text-center text-sm text-gray-600">
            You cannot go online right now. Adjust today&apos;s open and close times so the
            current time falls within your schedule, save the schedule, then turn on accepting
            orders.
          </p>
        </RestaurantConfirmModal>
      </RestaurantSubPageShell>
    </LocalizationProvider>
  )
}
