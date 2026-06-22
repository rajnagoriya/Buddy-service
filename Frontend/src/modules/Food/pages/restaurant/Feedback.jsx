import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { AnimatePresence } from "framer-motion"
import { HelpCircle, Search, SlidersHorizontal, Calendar, Loader2, Star } from "lucide-react"
import { DateRangeCalendar } from "@food/components/ui/date-range-calendar"
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders"
import RestaurantPanelHeader from "@food/components/restaurant/panel/RestaurantPanelHeader"
import RestaurantPanelModal from "@food/components/restaurant/panel/RestaurantPanelModal"
import { PanelPill, PanelSurface } from "@food/components/restaurant/panel/panelUi"
import useMediaQuery from "@food/hooks/useMediaQuery"
import { restaurantAPI } from "@food/api"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const REVIEWS_STORAGE_KEY = "restaurant_reviews_data"

const tabs = [
  { id: "complaints", label: "Complaints" },
  { id: "reviews", label: "Reviews" },
]

const normalizeOrderStatus = (order) =>
  String(order?.status || order?.orderStatus || "").toLowerCase()

const normalizeRating = (value) => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed <= 0) return null
  return Math.min(5, Math.round(parsed * 10) / 10)
}

const extractReviewRating = (order) =>
  normalizeRating(
    order?.review?.rating ??
      order?.ratings?.restaurant?.rating ??
      order?.feedback?.rating ??
      order?.rating
  )

const extractReviewText = (order) => {
  const raw =
    order?.review?.comment ??
    order?.review?.text ??
    order?.ratings?.restaurant?.comment ??
    order?.feedback?.comment ??
    order?.feedback?.text ??
    ""
  const normalized = String(raw || "").trim()
  return normalized || "No review text"
}

const toComparableId = (value) =>
  String(value?._id || value || "").trim()

export default function Feedback() {
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab")
  const [activeTab, setActiveTab] = useState(tabFromUrl === "complaints" ? "complaints" : "reviews")
  const navigate = useNavigate()
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  // Update active tab when URL param changes
  useEffect(() => {
    if (tabFromUrl === "complaints") {
      setActiveTab("complaints")
    } else {
      setActiveTab("reviews")
    }
  }, [tabFromUrl])
  
  // Swipe gesture refs
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)
  
  const feedbackTabs = ["complaints", "reviews"]
  const [reviews, setReviews] = useState([])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedFilterCategory, setSelectedFilterCategory] = useState("duration")
  const [filterValues, setFilterValues] = useState({
    duration: null,
    sortBy: "newest",
    reviewType: []
  })
  const [isFilterLoading, setIsFilterLoading] = useState(false)
  const [displayedReviews, setDisplayedReviews] = useState([])
  
  const [isComplaintsFilterOpen, setIsComplaintsFilterOpen] = useState(false)
  const [selectedComplaintsFilterCategory, setSelectedComplaintsFilterCategory] = useState("issueType")
  const [complaintsFilterValues, setComplaintsFilterValues] = useState({
    issueType: [],
    reasons: []
  })
  const [complaintsSearchQuery, setComplaintsSearchQuery] = useState("")
  
  const [isDateSelectorOpen, setIsDateSelectorOpen] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState("last5days") 
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null })
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false)
  const [isComplaintsLoading, setIsComplaintsLoading] = useState(false)
  const [complaints, setComplaints] = useState([])
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [selectedReview, setSelectedReview] = useState(null)

  const [restaurantData, setRestaurantData] = useState(null)
  const [isLoadingRestaurant, setIsLoadingRestaurant] = useState(true)
  const [isLoadingReviews, setIsLoadingReviews] = useState(true)
  const [ratingSummary, setRatingSummary] = useState({
    averageRating: 0,
    totalRatings: 0,
    totalReviews: 0
  })

  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setIsLoadingRestaurant(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        if (response.data?.success && response.data.data?.restaurant) {
          setRestaurantData(response.data.data.restaurant)
        }
      } catch (error) {
        debugError("Error fetching restaurant data:", error)
      } finally {
        setIsLoadingRestaurant(false)
      }
    }
    fetchRestaurantData()
  }, [])

  useEffect(() => {
    const fetchComplaints = async () => {
      if (activeTab !== 'complaints') return
      
      try {
        setIsComplaintsLoading(true)
        const dateRanges = getDateRanges()
        let fromDate = null
        let toDate = null

        switch (selectedDateRange) {
          case 'today':
            fromDate = dateRanges.today
            toDate = new Date()
            break
          case 'yesterday':
            fromDate = dateRanges.yesterday
            toDate = new Date(dateRanges.yesterday)
            toDate.setHours(23, 59, 59, 999)
            break
          case 'thisWeek':
            fromDate = dateRanges.thisWeekStart
            toDate = dateRanges.thisWeekEnd
            break
          case 'lastWeek':
            fromDate = dateRanges.lastWeekStart
            toDate = dateRanges.lastWeekEnd
            break
          case 'thisMonth':
            fromDate = dateRanges.thisMonthStart
            toDate = dateRanges.thisMonthEnd
            break
          case 'lastMonth':
            fromDate = dateRanges.lastMonthStart
            toDate = dateRanges.lastMonthEnd
            break
          case 'last5days':
            fromDate = dateRanges.last5DaysStart
            toDate = dateRanges.last5DaysEnd
            break
          case 'custom':
            if (customDateRange.start && customDateRange.end) {
              fromDate = customDateRange.start
              toDate = customDateRange.end
            }
            break
        }

        const params = {}
        if (fromDate) params.fromDate = fromDate.toISOString()
        if (toDate) params.toDate = toDate.toISOString()
        if (complaintsFilterValues.issueType?.length > 0) {
          params.complaintType = complaintsFilterValues.issueType[0]
        }
        if (complaintsSearchQuery) params.search = complaintsSearchQuery

        const response = await restaurantAPI.getComplaints(params)
        if (response?.data?.success && response.data.data?.complaints) {
          setComplaints(response.data.data.complaints)
        } else {
          setComplaints([])
        }
      } catch (error) {
        debugError('Error fetching complaints:', error)
        setComplaints([])
      } finally {
        setIsComplaintsLoading(false)
      }
    }

    fetchComplaints()
  }, [activeTab, selectedDateRange, customDateRange, complaintsFilterValues, complaintsSearchQuery])

  useEffect(() => {
    if (!isDesktop) return
    if (complaints.length === 0) {
      setSelectedComplaint(null)
      return
    }
    setSelectedComplaint((prev) =>
      prev && complaints.some((c) => c._id === prev._id) ? prev : complaints[0]
    )
  }, [complaints, isDesktop])

  useEffect(() => {
    if (!isDesktop) return
    if (displayedReviews.length === 0) {
      setSelectedReview(null)
      return
    }
    setSelectedReview((prev) =>
      prev && displayedReviews.some((r) => r.id === prev.id) ? prev : displayedReviews[0]
    )
  }, [displayedReviews, isDesktop])

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setIsLoadingReviews(true)
        let allOrders = []
        let page = 1
        let hasMore = true
        const limit = 1000
        const maxPages = 50

        while (hasMore && page <= maxPages) {
          try {
            const response = await restaurantAPI.getOrders({ 
              page, 
              limit,
              status: 'delivered'
            })
            
            if (response.data?.success && response.data.data?.orders) {
              const orders = response.data.data.orders
              allOrders = [...allOrders, ...orders]
              const totalPages = response.data.data.pagination?.totalPages || response.data.data.totalPages || 1
              if (orders.length < limit || (totalPages > 0 && page >= totalPages)) {
                hasMore = false
              } else {
                page++
              }
            } else {
              hasMore = false
            }
          } catch (pageError) {
            hasMore = false
          }
        }

        const transformedReviews = allOrders
          .filter(order => normalizeOrderStatus(order) === 'delivered')
          .map((order, index) => {
            const orderDate = new Date(order.createdAt || order.deliveredAt || Date.now())
            const day = orderDate.getDate()
            const month = orderDate.toLocaleDateString('en-GB', { month: 'short' })
            const year = orderDate.getFullYear()
            const formattedDate = `${day} ${month}, ${year}`

            const userName = order.userId?.name || order.customerName || 'Customer'
            const userImage = order.userId?.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`
            const outlet = order.restaurantName || (restaurantData?.name) || 'Restaurant'

            const rating = extractReviewRating(order)
            const reviewText = extractReviewText(order)

            const userOrdersCount = allOrders.filter(o => toComparableId(o.userId) === toComparableId(order.userId)).length

            return {
              id: order._id || order.orderId || `review-${index}`,
              orderNumber: order.orderId || order.orderNumber || String(index),
              outlet: outlet,
              userName: userName,
              userImage: userImage,
              ordersCount: userOrdersCount,
              rating: rating,
              date: formattedDate,
              reviewText: reviewText,
              orderData: order
            }
          })
          .filter(review => review.rating !== null || (review.reviewText && review.reviewText !== 'No review text'))

        const ratings = transformedReviews.map(r => r.rating).filter(r => r !== null)
        const averageRating = ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1) : 0
        
        setRatingSummary({
          averageRating: parseFloat(averageRating),
          totalRatings: ratings.length,
          totalReviews: transformedReviews.length
        })
        setReviews(transformedReviews)
      } catch (error) {
        debugError("Error fetching reviews:", error)
      } finally {
        setIsLoadingReviews(false)
      }
    }

    if (!isLoadingRestaurant) fetchReviews()
  }, [isLoadingRestaurant, restaurantData])

  useEffect(() => {
    let filtered = [...reviews]
    if (filterValues.sortBy) {
      filtered.sort((a, b) => {
        const dateA = new Date(a.date); const dateB = new Date(b.date)
        if (filterValues.sortBy === "newest") return dateB - dateA
        if (filterValues.sortBy === "oldest") return dateA - dateB
        if (filterValues.sortBy === "bestRated") return (b.rating ?? 0) - (a.rating ?? 0)
        if (filterValues.sortBy === "worstRated") return (a.rating ?? 0) - (b.rating ?? 0)
        return 0
      })
    }
    setDisplayedReviews(filtered)
  }, [reviews, filterValues])

  const handleFilterReset = () => { setFilterValues({ duration: null, sortBy: "newest", reviewType: [] }); setIsFilterOpen(false) }
  const handleFilterApply = () => { setIsFilterLoading(true); setIsFilterOpen(false); setTimeout(() => setIsFilterLoading(false), 200) }

  const formatDate = (date) => {
    const day = date.getDate()
    const month = date.toLocaleString('en-US', { month: 'short' })
    const year = date.getFullYear()
    return `${day} ${month} ${year}`
  }
  const formatDateShort = (date) => {
    const day = date.getDate()
    const month = date.toLocaleString('en-US', { month: 'short' })
    return `${day} ${month}`
  }

  const getDateRanges = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const last5DaysStart = new Date(today)
    last5DaysStart.setDate(last5DaysStart.getDate() - 4)
    
    const thisWeekStart = new Date(today)
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    thisWeekStart.setDate(diff)
    
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const lastWeekEnd = new Date(thisWeekStart)
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1)
    lastWeekEnd.setHours(23, 59, 59, 999)
    
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    lastMonthEnd.setHours(23, 59, 59, 999)
    
    return { 
      today, 
      yesterday, 
      thisWeekStart, 
      thisWeekEnd: new Date(), 
      lastWeekStart, 
      lastWeekEnd, 
      thisMonthStart, 
      thisMonthEnd: new Date(), 
      lastMonthStart, 
      lastMonthEnd, 
      last5DaysStart, 
      last5DaysEnd: new Date() 
    }
  }

  const handleComplaintsFilterApply = () => { setIsComplaintsLoading(true); setIsComplaintsFilterOpen(false); setTimeout(() => setIsComplaintsLoading(false), 200) }
  const handleComplaintsFilterReset = () => { setComplaintsFilterValues({ issueType: [], reasons: [] }); setComplaintsSearchQuery(""); setIsComplaintsLoading(true); setTimeout(() => setIsComplaintsLoading(false), 200) }

  const handleDateRangeSelect = (range) => {
    setSelectedDateRange(range)
    if (range === "custom") setIsCustomDateOpen(true)
    else { setIsDateSelectorOpen(false); setIsComplaintsLoading(true); setTimeout(() => setIsComplaintsLoading(false), 200) }
  }

  const handleCustomDateApply = () => { setIsCustomDateOpen(false); setIsDateSelectorOpen(false); setIsComplaintsLoading(true); setTimeout(() => setIsComplaintsLoading(false), 200) }

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; isSwiping.current = false }
  const handleTouchMove = (e) => {
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current)
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (deltaX > deltaY && deltaX > 10) isSwiping.current = true
    if (isSwiping.current) touchEndX.current = e.touches[0].clientX
  }
  const handleTouchEnd = () => {
    if (!isSwiping.current) return
    const swipeDistance = touchStartX.current - touchEndX.current
    if (Math.abs(swipeDistance) > 50) {
      if (swipeDistance > 0) setActiveTab("reviews")
      else setActiveTab("complaints")
    }
  }

  return (
    <div className="rt-panel-bg flex min-h-screen flex-col pb-24 lg:pb-8" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className="hidden lg:block">
        <RestaurantPanelHeader
          title="Feedback"
          subtitle={restaurantData?.name || restaurantData?.restaurantName || "Reviews and complaints"}
        />
      </div>

      <div className="sticky top-0 z-40 border-b border-[var(--rt-border)] bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Showing data for</p>
            <p className="text-base font-bold text-gray-900">{restaurantData?.name || restaurantData?.restaurantName || "Restaurant"}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/food/restaurant/help-centre/support")}
            className="rounded-xl border border-[var(--rt-border)] p-2 hover:bg-gray-50"
            aria-label="Open support"
          >
            <HelpCircle className="h-5 w-5 text-gray-700" />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          {tabs.map((tab) => (
            <PanelPill
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setSearchParams(tab.id === "complaints" ? { tab: "complaints" } : {})
              }}
              className="relative flex-1"
            >
              {tab.label}
              {tab.id === "complaints" && complaints.length > 0 && activeTab !== "complaints" ? (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
              ) : null}
            </PanelPill>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 p-4 lg:px-6">
        <div className="mb-4 hidden gap-2 lg:flex">
          {tabs.map((tab) => (
            <PanelPill
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setSearchParams(tab.id === "complaints" ? { tab: "complaints" } : {})
              }}
            >
              {tab.label}
            </PanelPill>
          ))}
        </div>

        {!isLoadingRestaurant && ratingSummary.totalReviews > 0 ? (
          <PanelSurface className="mb-4 grid grid-cols-3 gap-3 p-4 lg:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">Average rating</p>
              <p className="text-2xl font-bold text-gray-900">{ratingSummary.averageRating.toFixed(1)} ★</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total reviews</p>
              <p className="text-2xl font-bold text-gray-900">{ratingSummary.totalReviews}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Open complaints</p>
              <p className="text-2xl font-bold text-gray-900">{complaints.filter((c) => String(c.status || "").toLowerCase() === "open").length}</p>
            </div>
          </PanelSurface>
        ) : null}
        {activeTab === "complaints" ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setIsDateSelectorOpen(true)} className="rt-panel-surface-flat flex flex-1 items-center justify-between p-3">
                <div className="text-left">
                  <p className="text-xs font-bold text-gray-900">{selectedDateRange}</p>
                  <p className="text-[10px] text-gray-500">Select date range</p>
                </div>
                <Calendar className="h-4 w-4 text-gray-400" />
              </button>
              <button onClick={() => setIsComplaintsFilterOpen(true)} className="rt-panel-surface-flat p-3">
                <SlidersHorizontal className="h-4 w-4 text-gray-900" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {isComplaintsLoading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-400" /></div>
              ) : complaints.length === 0 ? (
                <div className="rt-panel-surface-flat py-20 text-center">
                  <p className="text-sm font-medium text-gray-500">No complaints found</p>
                </div>
              ) : isDesktop ? (
                <div className="flex min-h-[480px] gap-4 pb-8">
                  <div className="w-[360px] shrink-0 space-y-2 overflow-y-auto">
                    {complaints.map((complaint) => (
                      <button
                        key={complaint._id}
                        type="button"
                        onClick={() => setSelectedComplaint(complaint)}
                        className={`rt-panel-surface w-full p-3 text-left transition ${
                          selectedComplaint?._id === complaint._id ? "ring-2 ring-[var(--rt-primary-strong)]" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-gray-900">
                            {complaint.userId?.name || "Customer"}
                          </span>
                          <span className={`text-[9px] font-bold uppercase ${
                            complaint.status === "open" ? "text-orange-600" : "text-green-600"
                          }`}>
                            {complaint.status || "open"}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-600">{complaint.description}</p>
                      </button>
                    ))}
                  </div>
                  <PanelSurface className="flex-1 space-y-4 p-4">
                    {selectedComplaint ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                            selectedComplaint.status === "open" ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"
                          }`}>
                            {selectedComplaint.status || "open"}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(selectedComplaint.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-400">
                            {selectedComplaint.userId?.name?.[0] || "U"}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{selectedComplaint.userId?.name || "Customer"}</p>
                            <p className="text-[10px] font-bold uppercase text-gray-500">
                              Order #{selectedComplaint.orderId?.orderId || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="mb-1 text-[10px] font-black uppercase text-red-500">{selectedComplaint.issueType}</p>
                          <p className="text-sm font-semibold leading-relaxed text-gray-800">{selectedComplaint.description}</p>
                        </div>
                        {selectedComplaint.adminResponse ? (
                          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                            <p className="mb-1 text-[9px] font-black uppercase text-blue-600">Admin response</p>
                            <p className="text-sm font-medium text-blue-900">{selectedComplaint.adminResponse}</p>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">Select a complaint to view details</p>
                    )}
                  </PanelSurface>
                </div>
              ) : (
                <div className="grid gap-4 pb-8">
                  {complaints.map((complaint) => (
                    <PanelSurface key={complaint._id} className="space-y-3 p-4">
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                          complaint.status === 'open' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-green-100 dark:bg-green-900/30 text-green-600'
                        }`}>{complaint.status || 'open'}</span>
                        <span className="text-[10px] text-gray-400 font-bold">{new Date(complaint.createdAt).toLocaleDateString()}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-400">
                          {complaint.userId?.name?.[0] || 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">{complaint.userId?.name || 'Customer'}</p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase">Order #{complaint.orderId?.orderId || 'N/A'}</p>
                        </div>
                      </div>
 
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 relative">
                        <p className="text-[10px] font-black text-red-500 uppercase mb-1">{complaint.issueType}</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200 font-semibold leading-relaxed">{complaint.description}</p>
                      </div>
 
                      {complaint.adminResponse && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-900/30">
                          <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase mb-1">Admin Response</p>
                          <p className="text-sm text-blue-900 dark:text-blue-200 font-medium">{complaint.adminResponse}</p>
                        </div>
                      )}
                    </PanelSurface>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="rt-panel-surface-flat flex flex-1 items-center gap-2 p-3">
                <Search className="h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Search reviews" className="flex-1 bg-transparent text-sm focus:outline-none" />
              </div>
              <button onClick={() => setIsFilterOpen(true)} className="rt-panel-surface-flat p-3">
                <SlidersHorizontal className="h-4 w-4 text-gray-900" />
              </button>
            </div>

            <div className="grid gap-4 pb-8 lg:hidden">
              {displayedReviews.map((review) => (
                <PanelSurface key={review.id} className="space-y-3 p-4">
                  <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase">
                    <span>Order #{review.orderNumber}</span>
                    <span>{review.date}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <img src={review.userImage} className="w-8 h-8 rounded-full border border-gray-100 dark:border-gray-800" />
                    <p className="font-bold text-gray-900 dark:text-white text-sm">{review.userName}</p>
                    <div className="ml-auto flex items-center gap-1 bg-green-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                      {review.rating} <Star className="w-2 h-2 fill-current" />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[var(--rt-surface-muted)] p-3">
                    <p className="text-sm font-medium italic text-gray-800">"{review.reviewText}"</p>
                  </div>
                </PanelSurface>
              ))}
            </div>

            {isDesktop ? (
              <div className="hidden lg:flex min-h-[480px] gap-4 pb-8">
                <div className="w-[360px] shrink-0 space-y-2 overflow-y-auto">
                  {displayedReviews.map((review) => (
                    <button
                      key={review.id}
                      type="button"
                      onClick={() => setSelectedReview(review)}
                      className={`rt-panel-surface w-full p-3 text-left transition ${
                        selectedReview?.id === review.id ? "ring-2 ring-[var(--rt-primary-strong)]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900">{review.userName}</p>
                        <span className="rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {review.rating} ★
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-600">{review.reviewText}</p>
                    </button>
                  ))}
                </div>
                <PanelSurface className="flex-1 space-y-4 p-4">
                  {selectedReview ? (
                    <>
                      <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase">
                        <span>Order #{selectedReview.orderNumber}</span>
                        <span>{selectedReview.date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src={selectedReview.userImage} alt="" className="h-10 w-10 rounded-full border border-gray-100" />
                        <p className="text-sm font-bold text-gray-900">{selectedReview.userName}</p>
                        <div className="ml-auto flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-bold text-white">
                          {selectedReview.rating} <Star className="h-3 w-3 fill-current" />
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[var(--rt-surface-muted)] p-4">
                        <p className="text-sm font-medium italic text-gray-800">&ldquo;{selectedReview.reviewText}&rdquo;</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Select a review to view details</p>
                  )}
                </PanelSurface>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <RestaurantPanelModal
        open={isDateSelectorOpen}
        onClose={() => setIsDateSelectorOpen(false)}
        title="Select Date Range"
        size="md"
        mobileMaxHeight="auto"
        bodyClassName="px-4 py-4 lg:px-5 lg:py-5"
      >
        <div className="grid grid-cols-2 gap-3">
          {["today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "last5days", "custom"].map((range) => (
            <button
              key={range}
              onClick={() => handleDateRangeSelect(range)}
              className={`rounded-xl border-2 py-3 text-sm font-bold capitalize transition-all ${
                selectedDateRange === range
                  ? "border-black bg-black text-white"
                  : "border-gray-100 bg-white text-gray-600"
              }`}
            >
              {range === "last5days" ? "Last 5 Days" : range.replace(/([A-Z])/g, " $1").trim()}
            </button>
          ))}
        </div>
      </RestaurantPanelModal>

      <RestaurantPanelModal
        open={isCustomDateOpen}
        onClose={() => setIsCustomDateOpen(false)}
        size="sm"
        mobileMaxHeight="auto"
        showDragHandle={false}
        hideHeader
        zIndex={60}
        bodyClassName="px-6 py-6 lg:px-6 lg:py-6"
        footer={
          <button
            onClick={handleCustomDateApply}
            className="w-full rounded-2xl bg-black py-4 font-bold text-white shadow-xl transition-all active:scale-[0.98]"
          >
            Apply Custom Range
          </button>
        }
      >
        <DateRangeCalendar
          startDate={customDateRange.start}
          endDate={customDateRange.end}
          onDateRangeChange={(start, end) => {
            setCustomDateRange({ start, end })
          }}
          onClose={() => setIsCustomDateOpen(false)}
        />
      </RestaurantPanelModal>

      <RestaurantPanelModal
        open={isComplaintsFilterOpen}
        onClose={() => setIsComplaintsFilterOpen(false)}
        title="Filters"
        size="lg"
        mobileMaxHeight="tall"
        bodyClassName="space-y-6 px-6 py-4 lg:px-5 lg:py-5"
        footer={
          <div className="flex gap-3">
            <button
              onClick={handleComplaintsFilterReset}
              className="flex-1 rounded-2xl py-4 font-bold text-slate-400 transition-colors hover:text-slate-900"
            >
              Reset
            </button>
            <button
              onClick={handleComplaintsFilterApply}
              className="flex-[2] rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-xl shadow-slate-200 transition-all active:scale-[0.98]"
            >
              Apply Filters
            </button>
          </div>
        }
      >
        <div>
          <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Issue Type</h4>
          <div className="flex flex-wrap gap-2">
            {["Missing Item", "Wrong Item", "Quality Issue", "Delivery Delay", "Other"].map((type) => (
              <button
                key={type}
                onClick={() => {
                  const current = complaintsFilterValues.issueType || []
                  setComplaintsFilterValues({
                    ...complaintsFilterValues,
                    issueType: current.includes(type) ? [] : [type],
                  })
                }}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  complaintsFilterValues.issueType?.includes(type)
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </RestaurantPanelModal>
      <BottomNavOrders />
    </div>
  )
}

