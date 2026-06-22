import { useState, useEffect, useRef, useMemo } from "react"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import { RestaurantConfirmModal } from "@food/components/restaurant/panel/RestaurantPanelModal"
import OutletOnlineStatusCard from "@food/components/restaurant/outlet-timings/OutletOnlineStatusCard"
import OutletWeeklySchedule from "@food/components/restaurant/outlet-timings/OutletWeeklySchedule"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"
import {
  evaluateOutletTimingState,
  getDefaultDays,
  getTodayName,
  getTodaySlotLabel,
  timeToString,
} from "@food/utils/outletTimingsUtils"
import { restaurantAPI } from "@food/api"

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

export default function OutletTimings() {
  const scheduleRef = useRef(null)
  const saveTimerRef = useRef(null)

  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deliveryStatus, setDeliveryStatus] = useState(false)
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [days, setDays] = useState(getDefaultDays)
  const [expandedDay, setExpandedDay] = useState(getTodayName())
  const [showOutletClosedDialog, setShowOutletClosedDialog] = useState(false)
  const [showOutsideTimingsDialog, setShowOutsideTimingsDialog] = useState(false)

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
          const online = restaurant.isAcceptingOrders === true
          setDeliveryStatus(online)
          persistRestaurantOnlineStatus(online)
        }

        const outletTimings =
          timingsRes?.data?.data?.outletTimings || timingsRes?.data?.outletTimings
        if (outletTimings && typeof outletTimings === "object") {
          setDays({ ...getDefaultDays(), ...outletTimings })
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

    const onTimingsUpdated = () => {
      restaurantAPI
        .getOutletTimings()
        .then((res) => {
          const outletTimings = res?.data?.data?.outletTimings || res?.data?.outletTimings
          if (outletTimings && typeof outletTimings === "object") {
            setDays({ ...getDefaultDays(), ...outletTimings })
          }
        })
        .catch(() => {})
    }

    window.addEventListener("outletTimingsUpdated", onTimingsUpdated)
    return () => {
      mounted = false
      window.removeEventListener("outletTimingsUpdated", onTimingsUpdated)
    }
  }, [])

  useEffect(() => {
    if (loading) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await restaurantAPI.saveOutletTimings(days)
        window.dispatchEvent(new Event("outletTimingsUpdated"))
      } catch (error) {
        console.error("Error saving outlet timings:", error)
      }
    }, 500)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [days, loading])

  const scrollToSchedule = () => {
    scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    setExpandedDay(todayName)
  }

  const handleDeliveryStatusChange = async (checked) => {
    if (checked && isDayClosed) {
      setShowOutletClosedDialog(true)
      return
    }

    if (checked && isWithinTimings === false && !isDayClosed) {
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
    } catch {
      setDeliveryStatus((prev) => !prev)
      persistRestaurantOnlineStatus(!checked)
    }
  }

  const handleOutsideTimingsConfirm = async () => {
    setShowOutsideTimingsDialog(false)
    setDeliveryStatus(true)
    try {
      await restaurantAPI.updateAcceptingOrders(true)
      persistRestaurantOnlineStatus(true)
      window.dispatchEvent(
        new CustomEvent("restaurantStatusChanged", { detail: { isOnline: true } }),
      )
    } catch {
      setDeliveryStatus(false)
      persistRestaurantOnlineStatus(false)
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
        showBottomNav
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
        showBottomNav
        contentClassName="space-y-5 pb-10"
      >
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
            Open today&apos;s schedule or turn the day on before going online.
          </p>
        </RestaurantConfirmModal>

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
        >
          <p className="text-center text-sm text-gray-600">
            You can still go online, or scroll down to adjust today&apos;s timings.
          </p>
        </RestaurantConfirmModal>
      </RestaurantSubPageShell>
    </LocalizationProvider>
  )
}
