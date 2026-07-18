import { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate, Navigate } from "react-router-dom"
import Lenis from "lenis"
import {
  ArrowLeft,
  Search,
  User,
  UserRound,
  Store,
  ChevronRight,
  Info,
  Clock,
  Settings,
  Bell,
  Truck,
  FileText,
  Star,
  MessageSquare,
  LifeBuoy,
  Lightbulb,
  Edit,
  IndianRupee,
  Receipt,
  FileCheck,
  Building2,
  X,
  CheckCircle,
  Calendar,
  MapPin,
  LogOut,
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { DateRangeCalendar } from "@food/components/ui/date-range-calendar"
import { clearModuleAuth, clearAuthData, getCurrentUser } from "@food/utils/auth"
import { restaurantAPI } from "@food/api"
import { firebaseAuth, ensureFirebaseInitialized } from "@food/firebase"
import RestaurantPanelHeader from "@food/components/restaurant/panel/RestaurantPanelHeader"
import RestaurantPanelModal, { RestaurantConfirmModal } from "@food/components/restaurant/panel/RestaurantPanelModal"
import { EXPLORE_SECTIONS, RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"
import useRestaurantLayout from "@food/hooks/useRestaurantLayout"
import { Switch } from "@food/components/ui/switch"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


// Time Picker Wheel Component
function TimePickerWheel({
  isOpen,
  onClose,
  initialHour,
  initialMinute,
  initialPeriod,
  onConfirm
}) {
  const parsedHour = Math.max(1, Math.min(12, parseInt(initialHour) || 1))
  const parsedMinute = Math.max(0, Math.min(59, parseInt(initialMinute) || 0))
  const parsedPeriod = (initialPeriod === "am" || initialPeriod === "pm") ? initialPeriod : "am"

  const [selectedHour, setSelectedHour] = useState(parsedHour)
  const [selectedMinute, setSelectedMinute] = useState(parsedMinute)
  const [selectedPeriod, setSelectedPeriod] = useState(parsedPeriod)

  const hourRef = useRef(null)
  const minuteRef = useRef(null)
  const periodRef = useRef(null)

  const hours = Array.from({ length: 12 }, (_, i) => i + 1)
  const minutes = Array.from({ length: 60 }, (_, i) => i)
  const periods = ["am", "pm"]

  useEffect(() => {
    if (isOpen) {
      setSelectedHour(parsedHour)
      setSelectedMinute(parsedMinute)
      setSelectedPeriod(parsedPeriod)
    }
  }, [isOpen, initialHour, initialMinute, initialPeriod, parsedHour, parsedMinute, parsedPeriod])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'

      const timer = setTimeout(() => {
        const padding = 80
        const itemHeight = 40

        const hourIndex = parsedHour - 1
        const hourScrollPos = padding + (hourIndex * itemHeight)
        if (hourRef.current) {
          hourRef.current.scrollTop = hourScrollPos
          setSelectedHour(parsedHour)
          setTimeout(() => {
            hourRef.current?.scrollTo({
              top: hourScrollPos,
              behavior: 'smooth'
            })
          }, 50)
        }

        const minuteIndex = parsedMinute
        const minuteScrollPos = padding + (minuteIndex * itemHeight)
        if (minuteRef.current) {
          minuteRef.current.scrollTop = minuteScrollPos
          setSelectedMinute(parsedMinute)
          setTimeout(() => {
            minuteRef.current?.scrollTo({
              top: minuteScrollPos,
              behavior: 'smooth'
            })
          }, 50)
        }

        const periodIndex = periods.indexOf(parsedPeriod)
        const periodScrollPos = padding + (periodIndex * itemHeight)
        if (periodRef.current) {
          periodRef.current.scrollTop = periodScrollPos
          setSelectedPeriod(parsedPeriod)
          setTimeout(() => {
            periodRef.current?.scrollTo({
              top: periodScrollPos,
              behavior: 'smooth'
            })
          }, 50)
        }
      }, 150)

      return () => {
        clearTimeout(timer)
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen, parsedHour, parsedMinute, parsedPeriod])

  const handleScroll = (container, setValue, values, itemHeight) => {
    if (!container) return

    const padding = 80
    const itemCenterOffset = itemHeight / 2
    const scrollTop = container.scrollTop
    const containerCenter = scrollTop + container.clientHeight / 2

    const index = Math.round(
      (containerCenter - padding - itemCenterOffset) / itemHeight
    )

    const clampedIndex = Math.max(0, Math.min(index, values.length - 1))
    const newValue = values[clampedIndex]

    if (newValue !== undefined) {
      setValue(newValue)
    }
  }

  const snapToCenter = (container, setValue, values, itemHeight) => {
    if (!container) return

    const padding = 80
    const itemCenterOffset = itemHeight / 2
    const scrollTop = container.scrollTop
    const containerCenter = scrollTop + container.clientHeight / 2

    const index = Math.round(
      (containerCenter - padding - itemCenterOffset) / itemHeight
    )
    const clampedIndex = Math.max(0, Math.min(index, values.length - 1))

    const snapPosition = padding + clampedIndex * itemHeight
    container.scrollTo({
      top: snapPosition,
      behavior: "smooth",
    })

    if (values[clampedIndex] !== undefined) {
      setValue(values[clampedIndex])
    }
  }

  const handleConfirm = () => {
    const hourStr = selectedHour.toString()
    const minuteStr = selectedMinute.toString().padStart(2, '0')
    onConfirm(hourStr, minuteStr, selectedPeriod)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-lg shadow-2xl w-full max-w-xs overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-center py-8 px-4 relative">
            <style>{`
              .time-picker-scroll::-webkit-scrollbar {
                display: none;
              }
              .time-picker-scroll {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>

            <div className="flex-1 flex flex-col items-center">
              <div
                ref={hourRef}
                className="w-full h-48 overflow-y-scroll time-picker-scroll snap-y snap-mandatory"
                style={{
                  scrollSnapType: 'y mandatory',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch'
                }}
                onScroll={() => handleScroll(hourRef.current, setSelectedHour, hours, 40)}
                onTouchEnd={() => snapToCenter(hourRef.current, setSelectedHour, hours, 40)}
              >
                <div className="h-20"></div>
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="h-10 flex items-center justify-center snap-center"
                    style={{ minHeight: '40px' }}
                  >
                    <span
                      className={`text-lg transition-all duration-200 ${selectedHour === hour
                          ? "font-bold text-gray-900 text-xl"
                          : "font-normal text-gray-400 text-base"
                        }`}
                    >
                      {hour}
                    </span>
                  </div>
                ))}
                <div className="h-20"></div>
              </div>
            </div>

            <div className="px-2">
              <span className="text-2xl font-bold text-gray-900">:</span>
            </div>

            <div className="flex-1 flex flex-col items-center">
              <div
                ref={minuteRef}
                className="w-full h-48 overflow-y-scroll time-picker-scroll snap-y snap-mandatory"
                style={{
                  scrollSnapType: 'y mandatory',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch'
                }}
                onScroll={() => handleScroll(minuteRef.current, setSelectedMinute, minutes, 40)}
                onTouchEnd={() => snapToCenter(minuteRef.current, setSelectedMinute, minutes, 40)}
              >
                <div className="h-20"></div>
                {minutes.map((minute) => (
                  <div
                    key={minute}
                    className="h-10 flex items-center justify-center snap-center"
                    style={{ minHeight: '40px' }}
                  >
                    <span
                      className={`text-lg transition-all duration-200 ${selectedMinute === minute
                          ? "font-bold text-gray-900 text-xl"
                          : "font-normal text-gray-400 text-base"
                        }`}
                    >
                      {minute.toString().padStart(2, "0")}
                    </span>
                  </div>
                ))}
                <div className="h-20"></div>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center">
              <div
                ref={periodRef}
                className="w-full h-48 overflow-y-scroll time-picker-scroll snap-y snap-mandatory"
                style={{
                  scrollSnapType: 'y mandatory',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch'
                }}
                onScroll={() => handleScroll(periodRef.current, setSelectedPeriod, periods, 40)}
                onTouchEnd={() => snapToCenter(periodRef.current, setSelectedPeriod, periods, 40)}
              >
                <div className="h-20"></div>
                {periods.map((period) => (
                  <div
                    key={period}
                    className="h-10 flex items-center justify-center snap-center"
                    style={{ minHeight: '40px' }}
                  >
                    <span
                      className={`text-lg transition-all duration-200 ${selectedPeriod === period
                          ? "font-bold text-gray-900 text-xl"
                          : "font-normal text-gray-400 text-base"
                        }`}
                    >
                      {period.toUpperCase()}
                    </span>
                  </div>
                ))}
                <div className="h-20"></div>
              </div>
            </div>

            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 pointer-events-none">
              <div className="border-t border-gray-300 mx-4"></div>
              <div className="border-b border-gray-300 mx-4 mt-10"></div>
            </div>
          </div>

          <div className="border-t border-gray-200 px-4 py-4 flex justify-center">
            <button
              onClick={handleConfirm}
              className="text-[#16A34A] hover:text-[#1a2614] font-bold text-base transition-colors"
            >
              Okay
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function ExploreMore() {
  const navigate = useNavigate()
  const { isDesktop } = useRestaurantLayout()
  const [deliveryOnline, setDeliveryOnline] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Schedule off states
  const [scheduleOffOpen, setScheduleOffOpen] = useState(false)
  const [dateTimePickerOpen, setDateTimePickerOpen] = useState(false)
  const [successPopupOpen, setSuccessPopupOpen] = useState(false)
  const [existingScheduleOpen, setExistingScheduleOpen] = useState(false)
  const [selectedReason, setSelectedReason] = useState(null)
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [startTime, setStartTime] = useState({ hour: "9", minute: "00", period: "am" })
  const [endTime, setEndTime] = useState({ hour: "5", minute: "00", period: "pm" })
  const [showStartTimePicker, setShowStartTimePicker] = useState(false)
  const [showEndTimePicker, setShowEndTimePicker] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [existingSchedule, setExistingSchedule] = useState(null)

  const STORAGE_KEY = "restaurant_schedule_off"

  // Restaurant data state
  const [restaurantData, setRestaurantData] = useState(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(true)

  // Fetch restaurant data on mount
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoadingRestaurant(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
          setDeliveryOnline(data.isAcceptingOrders === true)
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          debugError("Error fetching restaurant data:", error)
        }
        // Continue with default values if fetch fails
      } finally {
        setLoadingRestaurant(false)
      }
    }

    fetchRestaurantData()
  }, [])

  // Format address from location object
  const formatAddress = (location) => {
    if (!location) return ""

    if (location.formattedAddress && location.formattedAddress.trim() !== "" && location.formattedAddress !== "Select location") {
      return location.formattedAddress.trim()
    }

    if (location.address && location.address.trim() !== "") {
      return location.address.trim()
    }

    const parts = []

    if (location.addressLine1) {
      parts.push(location.addressLine1.trim())
    } else if (location.street) {
      parts.push(location.street.trim())
    }

    if (location.addressLine2) {
      parts.push(location.addressLine2.trim())
    }

    if (location.area) {
      parts.push(location.area.trim())
    }

    if (location.landmark) {
      parts.push(location.landmark.trim())
    }

    if (location.city) {
      const city = location.city.trim()
      if (!parts.some((part) => part.includes(city))) {
        parts.push(city)
      }
    }

    if (location.state) {
      const state = location.state.trim()
      if (!parts.some((part) => part.includes(state))) {
        parts.push(state)
      }
    }

    if (location.zipCode || location.pincode || location.postalCode) {
      parts.push((location.zipCode || location.pincode || location.postalCode).trim())
    }

    return parts.join(", ") || ""
  }

  // Get user data from logged in session and restaurant data
  const userData = useMemo(() => {
    const sessionUser = getCurrentUser("restaurant")
    
    // Priority 1: Data from the currently logged in session user
    if (sessionUser && sessionUser.name && sessionUser.role) {
      return {
        name: sessionUser.name,
        phone: sessionUser.phone || restaurantData?.ownerPhone || restaurantData?.phone || "N/A",
        email: sessionUser.email || restaurantData?.ownerEmail || restaurantData?.email || "N/A",
        role: sessionUser.role.toUpperCase(),
        profileImage: sessionUser.profileImage || restaurantData?.profileImage
      }
    }
    
    // Priority 2: Data from the restaurant document owner fields
    if (restaurantData) {
      return {
        name: restaurantData.ownerName || restaurantData.name || "Restaurant Owner",
        phone: restaurantData.ownerPhone || restaurantData.phone || "N/A",
        email: restaurantData.ownerEmail || restaurantData.email || "N/A",
        role: "OWNER",
        profileImage: restaurantData.profileImage
      }
    }
    
    // Priority 3: Loading / Initial state
    return {
      name: loadingRestaurant ? "Loading..." : "Restaurant Owner",
      phone: "",
      email: "",
      role: "OWNER"
    }
  }, [restaurantData, loadingRestaurant])

  // Get restaurant display data
  const restaurantDisplayName = restaurantData?.name || "Loading..."
  const restaurantDisplayAddress = restaurantData?.location ? formatAddress(restaurantData.location) : ""

  const handleOnlineToggle = async (checked) => {
    setDeliveryOnline(checked)
    setTogglingStatus(true)
    try {
      await restaurantAPI.updateAcceptingOrders(checked)
      localStorage.setItem("restaurant_online_status", JSON.stringify(Boolean(checked)))
      window.dispatchEvent(new CustomEvent("restaurantStatusChanged", { detail: { isOnline: checked } }))
    } catch (error) {
      setDeliveryOnline((prev) => !prev)
      debugError("Error updating online status:", error)
    } finally {
      setTogglingStatus(false)
    }
  }

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return // Prevent multiple clicks

    setIsLoggingOut(true)
    setProfileOpen(false)

    try {
      // Call backend logout API to invalidate refresh token
      try {
        await restaurantAPI.logout()
      } catch (apiError) {
        // Continue with logout even if API call fails (network issues, etc.)
        debugWarn("Logout API call failed, continuing with local cleanup:", apiError)
      }

      // Sign out from Firebase if restaurant logged in via Google
      try {
        const { signOut } = await import("firebase/auth")
        // Firebase Auth is lazy-initialized now; ensure it before accessing firebaseAuth.currentUser
        ensureFirebaseInitialized({ enableAuth: true, enableRealtimeDb: false })
        const currentUser = firebaseAuth.currentUser
        if (currentUser) {
          await signOut(firebaseAuth)
        }
      } catch (firebaseError) {
        // Continue even if Firebase logout fails
        debugWarn("Firebase logout failed, continuing with local cleanup:", firebaseError)
      }

      // Clear restaurant module authentication data
      clearModuleAuth("restaurant")

      // Clear any onboarding data from localStorage
      localStorage.removeItem("restaurant_onboarding")
      localStorage.removeItem("restaurant_accessToken")
      localStorage.removeItem("restaurant_authenticated")
      localStorage.removeItem("restaurant_user")

      // Clear sessionStorage
      sessionStorage.removeItem("restaurantAuthData")

      // Dispatch auth change event to notify other components
      window.dispatchEvent(new Event("restaurantAuthChanged"))

      // Small delay for UX, then navigate to welcome page
      setTimeout(() => {
        navigate("/food/restaurant/login", { replace: true })
      }, 300)
    } catch (error) {
      // Even if there's an error, we should still clear local data and logout
      debugError("Error during logout:", error)
      clearModuleAuth("restaurant")
      localStorage.removeItem("restaurant_onboarding")
      localStorage.removeItem("restaurant_accessToken")
      localStorage.removeItem("restaurant_authenticated")
      localStorage.removeItem("restaurant_user")
      sessionStorage.removeItem("restaurantAuthData")
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      navigate("/food/restaurant/welcome", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleLogoutAllDevices = async () => {
    if (isLoggingOut) return // Prevent multiple clicks

    setIsLoggingOut(true)
    setProfileOpen(false)

    try {
      // Call backend logout API to invalidate refresh token
      try {
        await restaurantAPI.logout()
      } catch (apiError) {
        // Continue with logout even if API call fails (network issues, etc.)
        debugWarn("Logout API call failed, continuing with local cleanup:", apiError)
      }

      // Sign out from Firebase if restaurant logged in via Google
      try {
        const { signOut } = await import("firebase/auth")
        // Firebase Auth is lazy-initialized now; ensure it before accessing firebaseAuth.currentUser
        ensureFirebaseInitialized({ enableAuth: true, enableRealtimeDb: false })
        const currentUser = firebaseAuth.currentUser
        if (currentUser) {
          await signOut(firebaseAuth)
        }
      } catch (firebaseError) {
        // Continue even if Firebase logout fails
        debugWarn("Firebase logout failed, continuing with local cleanup:", firebaseError)
      }

      // Clear auth for all modules (admin, restaurant, delivery, user)
      clearAuthData()

      // Clear any onboarding data from localStorage
      localStorage.removeItem("restaurant_onboarding")

      // Clear sessionStorage for all modules
      sessionStorage.removeItem("restaurantAuthData")
      sessionStorage.removeItem("adminAuthData")
      sessionStorage.removeItem("deliveryAuthData")
      sessionStorage.removeItem("userAuthData")

      // Dispatch auth change events to notify other components
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      window.dispatchEvent(new Event("adminAuthChanged"))
      window.dispatchEvent(new Event("deliveryAuthChanged"))
      window.dispatchEvent(new Event("userAuthChanged"))

      // Small delay for UX, then navigate to welcome page
      setTimeout(() => {
        navigate("/food/restaurant/login", { replace: true })
      }, 300)
    } catch (error) {
      // Even if there's an error, we should still clear local data and logout
      debugError("Error during logout from all devices:", error)
      clearAuthData()
      localStorage.removeItem("restaurant_onboarding")
      sessionStorage.removeItem("restaurantAuthData")
      sessionStorage.removeItem("adminAuthData")
      sessionStorage.removeItem("deliveryAuthData")
      sessionStorage.removeItem("userAuthData")
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      navigate("/food/restaurant/welcome", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const scheduleOffReasons = [
    "renovation or relocation of restaurant",
    "closed dur to festival",
    "permanently shut",
    "staff avaibility issues",
    "going out of station",
    "other"
  ]

  // Load existing schedule from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const schedule = JSON.parse(saved)
        // Convert date strings back to Date objects
        if (schedule.startDate) schedule.startDate = new Date(schedule.startDate)
        if (schedule.endDate) schedule.endDate = new Date(schedule.endDate)
        setExistingSchedule(schedule)
      }
    } catch (error) {
      debugError("Error loading schedule from localStorage:", error)
    }
  }, [])

  const handleScheduleOffClick = () => {
    // Check if there's an existing schedule
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const schedule = JSON.parse(saved)
        // Convert date strings back to Date objects
        if (schedule.startDate) schedule.startDate = new Date(schedule.startDate)
        if (schedule.endDate) schedule.endDate = new Date(schedule.endDate)
        setExistingSchedule(schedule)
        setExistingScheduleOpen(true)
      } else {
        setScheduleOffOpen(true)
      }
    } catch (error) {
      debugError("Error checking schedule:", error)
      setScheduleOffOpen(true)
    }
  }

  const handleDeleteSchedule = () => {
    localStorage.removeItem(STORAGE_KEY)
    setExistingSchedule(null)
    setExistingScheduleOpen(false)
  }

  const handleReasonSelect = (reason) => {
    setSelectedReason(reason)
    setScheduleOffOpen(false)
    setDateTimePickerOpen(true)
  }

  const handleDateRangeChange = (start, end) => {
    setStartDate(start)
    setEndDate(end)
  }

  const handleStartTimeConfirm = (hour, minute, period) => {
    setStartTime({ hour, minute, period })
  }

  const handleEndTimeConfirm = (hour, minute, period) => {
    setEndTime({ hour, minute, period })
  }

  const formatTime = (time) => {
    return `${time.hour}:${time.minute} ${time.period.toUpperCase()}`
  }

  const formatDate = (date) => {
    if (!date) return "Select date"
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const handleSubmitScheduleOff = () => {
    if (!startDate || !endDate) {
      alert("Please select start and end dates")
      return
    }
    setDateTimePickerOpen(false)
    setSuccessPopupOpen(true)
  }

  // Prevent body scroll when popup is open
  useEffect(() => {
    if (profileOpen || scheduleOffOpen || dateTimePickerOpen || successPopupOpen || existingScheduleOpen || searchOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [profileOpen, scheduleOffOpen, dateTimePickerOpen, successPopupOpen, existingScheduleOpen, searchOpen])

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  // All sections — single source of truth (restaurantNavConfig)
  const allSections = EXPLORE_SECTIONS

  // Filter logic
  const getFilteredSections = () => {
    if (!searchQuery.trim()) {
      return allSections
    }

    const query = searchQuery.toLowerCase()
    return allSections
      .map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.label.toLowerCase().includes(query)
        )
      }))
      .filter(section => section.items.length > 0)
  }

  const filteredSections = getFilteredSections()

  if (isDesktop) {
    return <Navigate to={RESTAURANT_BASE} replace />
  }

  const renderSection = (title, items, delay = 0) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      className="mb-8"
    >
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: delay + 0.05 }}
        className="text-base font-bold text-gray-900 mb-4"
      >
        {title}
      </motion.h2>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, index) => {
          const IconComponent = item.icon
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: delay + 0.1 + (index * 0.02),
                ease: [0.25, 0.1, 0.25, 1]
              }}
              className="flex flex-col items-center"
            >
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (item.id === 5) {
                    // Schedule off card
                    handleScheduleOffClick()
                  } else if (item.route) {
                    navigate(item.route)
                  }
                }}
                className="rt-panel-surface flex min-h-[100px] w-full items-center justify-center p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative flex items-center justify-center">
                  {item.customIcon ? (
                    <div className="w-12 h-12 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-900">hp</span>
                    </div>
                  ) : (
                    <IconComponent className="w-8 h-8 text-gray-900" strokeWidth={1.5} />
                  )}
                  {item.badge && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: delay + 0.15 + (index * 0.02), type: "spring", stiffness: 500 }}
                      className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    >
                      {item.badge}
                    </motion.span>
                  )}
                </div>
              </motion.button>
              <span className="text-sm text-gray-700 text-center leading-tight font-normal mt-3">
                {item.label}
              </span>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.2,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      className="rt-panel-bg min-h-screen overflow-x-hidden pb-8"
    >
      <div className="hidden lg:block">
        <RestaurantPanelHeader title="Settings" subtitle={restaurantDisplayName} showSearch />
      </div>

      {/* Mobile header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.25,
          ease: [0.25, 0.1, 0.25, 1]
        }}
        className="sticky top-0 z-50 border-b border-[var(--rt-border)] bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden"
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center gap-3">
            <button
              onClick={() => navigate(RESTAURANT_BASE)}
              className="rounded-lg p-1.5 transition-colors hover:bg-gray-100"
              aria-label="Go back"
            >
              <ArrowLeft className="h-6 w-6 text-gray-900" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">More</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-gray-900" />
            </button>
            <button
              onClick={() => setProfileOpen(true)}
              className={`p-2 transition-all duration-200 rounded-full ${profileOpen ? "bg-[#16A34A] text-white shadow-lg" : "bg-gray-100 hover:bg-gray-200 text-gray-900"}`}
              aria-label="Profile"
            >
              <UserRound className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <Card className="rt-panel-surface-flat mb-6 border-0 py-3">
            <CardContent className="px-4 space-y-4">
              <button
                type="button"
                className="flex w-full items-center justify-between"
                onClick={() => navigate(`${RESTAURANT_BASE}/outlet-info`)}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div className="rounded-lg bg-gray-100 p-2">
                    <Store className="h-5 w-5 text-gray-900" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="mb-0.5 text-base font-semibold text-gray-900">{restaurantDisplayName}</h2>
                    {restaurantDisplayAddress ? (
                      <p className="text-sm text-gray-500 break-words">{restaurantDisplayAddress}</p>
                    ) : null}
                    <p className="mt-1 text-xs font-medium text-[var(--rt-primary-strong)]">View outlet info</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
              </button>

              <div
                className="flex items-center justify-between border-t border-[var(--rt-border)] pt-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">Receiving orders</p>
                  <p className="text-xs text-gray-500">
                    {deliveryOnline ? "Online — accepting delivery orders" : "Offline — not accepting orders"}
                  </p>
                </div>
                <Switch
                  checked={deliveryOnline}
                  onCheckedChange={handleOnlineToggle}
                  disabled={togglingStatus}
                  className="data-[state=checked]:bg-[var(--rt-primary-strong)]"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sections */}
        {filteredSections.length > 0 ? (
          filteredSections.map((section, index) => (
            <div key={section.key}>
              {renderSection(section.title, section.items, 0.1 + (index * 0.05))}
              {index < filteredSections.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 + (index * 0.05), duration: 0.2 }}
                  className="border-t border-gray-200 my-6"
                />
              )}
            </div>
          ))
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12"
          >
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-2">No results found</p>
            <p className="text-sm text-gray-500">Try searching with different keywords</p>
          </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.2 }}
          className="border-t border-gray-200 my-6"
        />

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.25 }}
          onClick={() => setLogoutConfirmOpen(true)}
          className="w-full flex items-center justify-between gap-3 rounded-2xl border border-[#16A34A]/20 bg-[#16A34A]/5 px-4 py-4 text-left hover:bg-[#16A34A]/10 transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#16A34A]/10">
              <LogOut className="w-5 h-5 text-[#16A34A]" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-[#16A34A]">Logout</p>
              <p className="text-sm text-[#16A34A]/60 font-medium">Tap to sign out from this device</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#16A34A]/40 shrink-0" />
        </motion.button>
      </div>

      {/* Search Popup */}
      <RestaurantConfirmModal
        open={logoutConfirmOpen}
        onClose={() => {
          if (!isLoggingOut) setLogoutConfirmOpen(false)
        }}
        onConfirm={async () => {
          await handleLogout()
          setLogoutConfirmOpen(false)
        }}
        title="Logout?"
        description="Are you sure you want to logout?"
        confirmLabel={isLoggingOut ? "Logging out..." : "Yes"}
        cancelLabel="No"
        loading={isLoggingOut}
        confirmVariant="danger"
        zIndex={60}
        icon={
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#16A34A]/10">
            <LogOut className="h-5 w-5 text-[#16A34A]" />
          </div>
        }
      />

      <AnimatePresence>
        {searchOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => {
                setSearchOpen(false)
                setSearchQuery("")
              }}
            />

            {/* Search Modal */}
            <motion.div
              initial={{ y: "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 300
              }}
              className="fixed top-0 left-0 right-0 z-50 h-[100dvh] bg-white shadow-lg lg:inset-auto lg:left-1/2 lg:top-1/2 lg:h-auto lg:max-h-[80vh] lg:w-[calc(100%-2rem)] lg:max-w-xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:border lg:border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                <button
                  onClick={() => {
                    setSearchOpen(false)
                    setSearchQuery("")
                  }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close search"
                >
                  <ArrowLeft className="w-6 h-6 text-gray-900" />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search features..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full px-4 py-2 pr-10 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16A34A] text-gray-900 placeholder-gray-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Results */}
              <div className="max-h-[70vh] overflow-y-auto">
                {searchQuery.trim() ? (
                  getFilteredSections().length > 0 ? (
                    <div className="px-4 py-4">
                      {getFilteredSections().map((section) => (
                        <div key={section.key} className="mb-6 last:mb-0">
                          <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                            {section.title}
                          </h3>
                          <div className="space-y-2">
                            {section.items.map((item) => {
                              const IconComponent = item.icon
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    if (item.id === 5) {
                                      handleScheduleOffClick()
                                    } else if (item.route) {
                                      navigate(item.route)
                                    }
                                    setSearchOpen(false)
                                    setSearchQuery("")
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                                >
                                  <div className="p-2 bg-gray-100 rounded-lg">
                                    <IconComponent className="w-5 h-5 text-gray-900" />
                                  </div>
                                  <span className="flex-1 text-base text-gray-900">{item.label}</span>
                                  {item.badge && (
                                    <span className="bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded">
                                      {item.badge}
                                    </span>
                                  )}
                                  <ChevronRight className="w-5 h-5 text-gray-400" />
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 px-4">
                      <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-lg font-semibold text-gray-900 mb-2">No results found</p>
                      <p className="text-sm text-gray-500">Try searching with different keywords</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-12 px-4">
                    <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-base font-medium text-gray-900 mb-1">Search for features</p>
                    <p className="text-sm text-gray-500">Type to search for outlet settings, orders, and more</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Profile Popup */}
      <RestaurantPanelModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="My profile"
        size="md"
        mobileMaxHeight="tall"
        bodyClassName="px-0 py-0"
      >
        {/* User Information Section */}
        <div className="px-6 py-6">
                <button 
                  onClick={() => {
                    setProfileOpen(false)
                    navigate("/food/restaurant/edit-owner")
                  }}
                  className="w-full flex items-start gap-4 text-left p-2 -m-2 hover:bg-gray-50 rounded-xl transition-colors group"
                >
                  {/* Avatar */}
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center shrink-0 overflow-hidden ring-4 ring-[#16A34A]/10 group-hover:ring-[#16A34A]/20 transition-all">
                    {userData.profileImage?.url ? (
                      <img
                        src={userData.profileImage.url}
                        alt={userData.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#16A34A]/5 to-[#16A34A]/20">
                        <User className="w-8 h-8 text-[#16A34A]" />
                      </div>
                    )}
                  </div>

                  {/* User Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-base font-bold text-gray-900 truncate">
                        {loadingRestaurant ? "Loading..." : userData.name}
                      </h3>
                      <Edit className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {userData.phone && (
                      <p className="text-sm text-gray-600 mb-1">
                        {userData.phone}
                      </p>
                    )}
                    {userData.email && (
                      <p className="text-sm text-gray-600 mb-1">
                        {userData.email}
                      </p>
                    )}
                    <p className="text-[10px] font-bold text-[#16A34A] uppercase tracking-widest mt-2 bg-[#16A34A]/5 w-fit px-2.5 py-1 rounded-full border border-[#16A34A]/10">
                      {userData.role}
                    </p>
                  </div>
                </button>
              </div>

              {/* Logout Buttons */}
              <div className="px-6 pb-6 space-y-3">
                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20 hover:bg-[#16A34A]/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed font-bold py-4 px-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-5 h-5 text-[#16A34A]" />
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </button>

                {/* Logout from all devices Button */}
                <button
                  onClick={handleLogoutAllDevices}
                  disabled={isLoggingOut}
                  className="w-full bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20 hover:bg-[#16A34A]/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed font-bold py-4 px-4 rounded-2xl transition-all"
                >
                  {isLoggingOut ? "Logging out..." : "Logout from all devices"}
                </button>
              </div>

        {/* Footer Links */}
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <a
              href="#"
              className="hover:text-gray-700 transition-colors border-b border-dotted border-gray-400"
              onClick={(e) => {
                e.preventDefault()
                debugLog("Terms of Service clicked")
              }}
            >
              Terms of Service
            </a>
            <span className="text-gray-400">|</span>
            <a
              href="#"
              className="hover:text-gray-700 transition-colors border-b border-dotted border-gray-400"
              onClick={(e) => {
                e.preventDefault()
                debugLog("Privacy Policy clicked")
              }}
            >
              Privacy Policy
            </a>
            <span className="text-gray-400">|</span>
            <a
              href="#"
              className="hover:text-gray-700 transition-colors border-b border-dotted border-gray-400"
              onClick={(e) => {
                e.preventDefault()
                debugLog("Code of Conduct clicked")
              }}
            >
              Code of Conduct
            </a>
          </div>
        </div>
      </RestaurantPanelModal>

      {/* Schedule Off Reason Selection Popup */}
      <RestaurantPanelModal
        open={scheduleOffOpen}
        onClose={() => setScheduleOffOpen(false)}
        title="Select reason"
        size="md"
        mobileMaxHeight="auto"
        bodyClassName="px-6 py-4"
      >
        {scheduleOffReasons.map((reason, index) => (
          <button
            key={index}
            onClick={() => handleReasonSelect(reason)}
            className="w-full text-left py-4 px-4 rounded-lg hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
          >
            <span className="text-base text-gray-900">{reason}</span>
          </button>
        ))}
      </RestaurantPanelModal>

      {/* Date and Time Picker Popup */}
      <RestaurantPanelModal
        open={dateTimePickerOpen}
        onClose={() => setDateTimePickerOpen(false)}
        title="Schedule off"
        size="lg"
        mobileMaxHeight="tall"
        bodyClassName="px-6 py-6 space-y-6"
      >
                {/* Selected Reason */}
                {selectedReason && (
                  <div className="pb-4 border-b border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Reason</p>
                    <p className="text-base font-medium text-gray-900">{selectedReason}</p>
                  </div>
                )}

                {/* Date Selection */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Select dates</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">Start date</label>
                      <button
                        onClick={() => setShowCalendar(true)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-gray-900">{formatDate(startDate)}</span>
                        <Calendar className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">End date</label>
                      <button
                        onClick={() => setShowCalendar(true)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-gray-900">{formatDate(endDate)}</span>
                        <Calendar className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Time Selection */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Select times</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">Start time</label>
                      <button
                        onClick={() => setShowStartTimePicker(true)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-gray-900">{formatTime(startTime)}</span>
                        <Clock className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">End time</label>
                      <button
                        onClick={() => setShowEndTimePicker(true)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-gray-900">{formatTime(endTime)}</span>
                        <Clock className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmitScheduleOff}
          className="w-full bg-[#16A34A] hover:bg-[#1a2614] text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md active:scale-[0.98] mt-4"
        >
          Submit
        </button>
      </RestaurantPanelModal>

      {/* Calendar Popup */}
      {showCalendar && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowCalendar(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg shadow-lg">
            <DateRangeCalendar
              startDate={startDate}
              endDate={endDate}
              onDateRangeChange={handleDateRangeChange}
              onClose={() => setShowCalendar(false)}
            />
          </div>
        </div>
      )}

      {/* Start Time Picker */}
      <TimePickerWheel
        isOpen={showStartTimePicker}
        onClose={() => setShowStartTimePicker(false)}
        initialHour={startTime.hour}
        initialMinute={startTime.minute}
        initialPeriod={startTime.period}
        onConfirm={handleStartTimeConfirm}
      />

      {/* End Time Picker */}
      <TimePickerWheel
        isOpen={showEndTimePicker}
        onClose={() => setShowEndTimePicker(false)}
        initialHour={endTime.hour}
        initialMinute={endTime.minute}
        initialPeriod={endTime.period}
        onConfirm={handleEndTimeConfirm}
      />

      <RestaurantConfirmModal
        open={successPopupOpen}
        onClose={() => setSuccessPopupOpen(false)}
        onConfirm={() => {
          setSuccessPopupOpen(false)
          setSelectedReason(null)
          setStartDate(null)
          setEndDate(null)
          setStartTime({ hour: "9", minute: "00", period: "am" })
          setEndTime({ hour: "5", minute: "00", period: "pm" })
        }}
        title="Success!"
        description="Restaurant is marked offline"
        confirmLabel="Done"
        showCancel={false}
        zIndex={10000}
        icon={
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
        }
      />

      {/* Existing Schedule Popup */}
      <RestaurantPanelModal
        open={existingScheduleOpen && !!existingSchedule}
        onClose={() => setExistingScheduleOpen(false)}
        title="Schedule off"
        size="md"
        mobileMaxHeight="tall"
        bodyClassName="px-6 py-6"
      >
        {existingSchedule ? (
          <>
            {/* Status Message */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-base font-semibold text-gray-900 mb-1">
                Restaurant is scheduled off
              </p>
              <p className="text-sm text-gray-600">
                Your restaurant is currently marked as offline
              </p>
            </div>

            {/* Schedule Details */}
            <div className="space-y-4 mb-6">
              {existingSchedule.reason && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Reason</p>
                  <p className="text-base font-medium text-gray-900">{existingSchedule.reason}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Start date</p>
                  <p className="text-base font-medium text-gray-900">
                    {formatDate(existingSchedule.startDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">End date</p>
                  <p className="text-base font-medium text-gray-900">
                    {formatDate(existingSchedule.endDate)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Start time</p>
                  <p className="text-base font-medium text-gray-900">
                    {formatTime(existingSchedule.startTime)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">End time</p>
                  <p className="text-base font-medium text-gray-900">
                    {formatTime(existingSchedule.endTime)}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleDeleteSchedule}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Delete Schedule
            </button>
          </>
        ) : null}
      </RestaurantPanelModal>
    </motion.div>
  )
}


