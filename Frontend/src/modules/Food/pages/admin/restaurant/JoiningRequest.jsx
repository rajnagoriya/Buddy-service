import { useState, useMemo, useEffect, useRef } from "react"
import { 
  Search, Filter, Eye, Check, X, UtensilsCrossed, ArrowUpDown, Loader2,
  FileText, Image as ImageIcon, ExternalLink, CreditCard, Calendar, Star, Building2, User, Phone, Mail, MapPin, Clock, MoreVertical, XCircle, RefreshCw
} from "lucide-react"
import { adminAPI, restaurantAPI } from "@food/api"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@food/components/ui/dropdown-menu"
import { fetchPendingRestaurantsCached, invalidateApprovedRestaurantsCache, invalidatePendingRequestsCache } from "@food/utils/adminRestaurantCache"
import ProfileChangeReviewPanel from "@food/components/admin/restaurant/ProfileChangeReviewPanel"
import { DAY_NAMES, formatTime12Hour as formatOutletTime12Hour } from "@food/utils/outletTimingsUtils"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const formatTime12Hour = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) return "--:-- --"
  const [h, m] = timeStr.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`
}

const formatRestaurantId = (id) => {
  if (!id) return "REST000000"
  const idString = String(id)
  const parts = idString.split(/[-.]/)
  let lastDigits = ""
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1]
    const digits = lastPart.match(/\d+/g)
    if (digits && digits.length > 0) {
      const allDigits = digits.join("")
      lastDigits = allDigits.slice(-6).padStart(6, "0")
    } else {
      const allParts = parts.join("")
      const allDigits = allParts.match(/\d+/g)
      if (allDigits && allDigits.length > 0) {
        const combinedDigits = allDigits.join("")
        lastDigits = combinedDigits.slice(-6).padStart(6, "0")
      }
    }
  }
  if (!lastDigits) {
    const hash = idString.split("").reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0) | 0
    }, 0)
    lastDigits = Math.abs(hash).toString().slice(-6).padStart(6, "0")
  }
  return `REST${lastDigits}`
}


const PLACEHOLDER_40 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect fill='%23e2e8f0' width='40' height='40'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-size='12' font-family='sans-serif'%3E?%3C/text%3E%3C/svg%3E"
const PLACEHOLDER_128 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Crect fill='%23e2e8f0' width='128' height='128'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-size='32' font-family='sans-serif'%3E?%3C/text%3E%3C/svg%3E"



export default function JoiningRequest() {
  const [activeTab, setActiveTab] = useState("pending")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" })
  const [pendingRequests, setPendingRequests] = useState([])
  const [rejectedRequests, setRejectedRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [restaurantDetails, setRestaurantDetails] = useState(null)
  const [outletTimings, setOutletTimings] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showFilterDialog, setShowFilterDialog] = useState(false)
  const [filters, setFilters] = useState({
    zone: "",
    dateFrom: "",
    dateTo: ""
  })

  // Track first render to avoid duplicate fetch in React StrictMode
  const hasFetchedOnceRef = useRef(false)

  // Fetch restaurant join requests
  useEffect(() => {
    fetchRequests(true)
  }, [])

  const fetchRequests = async (force = false) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetchPendingRestaurantsCached({ force })
      const list = response?.data?.data || []
      setPendingRequests(
        list.filter(
          (r) =>
            r.status?.toLowerCase() === "pending" || r.profileReviewStatus === "pending",
        ),
      )
      setRejectedRequests(list.filter((r) => r.status?.toLowerCase() === "rejected"))
    } catch (err) {
      debugError("Error fetching restaurant requests:", err)
      setError(err.message || "Failed to fetch restaurant requests")
      setPendingRequests([])
      setRejectedRequests([])
    } finally {
      setLoading(false)
    }
  }

  const currentRequests = activeTab === "pending" ? pendingRequests : rejectedRequests

  // Get unique zones and business models for filter options
  const filterOptions = useMemo(() => {
    const zones = [...new Set(currentRequests.map(r => r.zone).filter(Boolean))]
    return { zones }
  }, [currentRequests])

  const filteredRequests = useMemo(() => {
    let filtered = currentRequests

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(request =>
        request.restaurantName?.toLowerCase().includes(query) ||
        request.ownerName?.toLowerCase().includes(query) ||
        request.ownerPhone?.includes(query)
      )
    }

    // Apply zone filter
    if (filters.zone) {
      filtered = filtered.filter(request => request.zone === filters.zone)
    }


    // Apply date range filter
    if (filters.dateFrom || filters.dateTo) {
      filtered = filtered.filter(request => {
        if (!request.createdAt) return false
        const requestDate = new Date(request.createdAt).setHours(0, 0, 0, 0)
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom).setHours(0, 0, 0, 0)
          if (requestDate < fromDate) return false
        }
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo).setHours(23, 59, 59, 999)
          if (requestDate > toDate) return false
        }
        return true
      })
    }

    return filtered
  }, [currentRequests, searchQuery, filters])

  const sortedRequests = useMemo(() => {
    const requests = [...filteredRequests]
    const { key, direction } = sortConfig
    const multiplier = direction === "asc" ? 1 : -1

    const getSortValue = (request) => {
      switch (key) {
        case "sl":
          return Number(request.sl || 0)
        case "restaurantName":
          return String(request.restaurantName || "").toLowerCase()
        case "ownerName":
          return String(request.ownerName || "").toLowerCase()
        case "zone":
          return String(request.zone || "").toLowerCase()
        case "status":
          return String(request.status || "").toLowerCase()
        case "createdAt":
        default:
          return new Date(request.createdAt || 0).getTime()
      }
    }

    requests.sort((left, right) => {
      const leftValue = getSortValue(left)
      const rightValue = getSortValue(right)

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * multiplier
      }

      return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true }) * multiplier
    })

    return requests
  }, [filteredRequests, sortConfig])

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }))
  }

  const getSortIconClassName = (key) => {
    if (sortConfig.key !== key) return "w-3 h-3 text-slate-400"
    return sortConfig.direction === "asc" ? "w-3 h-3 text-blue-600" : "w-3 h-3 text-slate-700"
  }

  const clearFilters = () => {
    setFilters({
      zone: "",
      dateFrom: "",
      dateTo: ""
    })
  }

  const hasActiveFilters = filters.zone || filters.dateFrom || filters.dateTo

  const handleApprove = async (request) => {
    if (window.confirm(`Are you sure you want to approve "${request.restaurantName}" restaurant request?`)) {
      try {
        setProcessing(true)
        await adminAPI.approveRestaurant(request._id)
        
        // Soft update: Remove from pending state and clear cached pending requests
        setPendingRequests((prev) => prev.filter((r) => r._id !== request._id))
        invalidatePendingRequestsCache()
        invalidateApprovedRestaurantsCache()
        
        alert(`Successfully approved ${request.restaurantName}'s join request!`)
      } catch (err) {
        debugError("Error approving request:", err)
        alert(err.response?.data?.message || "Failed to approve request. Please try again.")
      } finally {
        setProcessing(false)
      }
    }
  }

  const handleReject = (request) => {
    setSelectedRequest(request)
    setRejectionReason("")
    setShowRejectDialog(true)
  }

  const confirmReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      alert("Please provide a rejection reason")
      return
    }

    try {
      setProcessing(true)
      await adminAPI.rejectRestaurant(selectedRequest._id, rejectionReason)
      
      // Soft update: Remove from pending and append to rejected locally
      setPendingRequests((prev) => prev.filter((r) => r._id !== selectedRequest._id))
      const rejectedObj = {
        ...selectedRequest,
        status: "rejected",
        rejectionReason: rejectionReason,
        rejectedAt: new Date().toISOString()
      }
      setRejectedRequests((prev) => [rejectedObj, ...prev])
      invalidatePendingRequestsCache()
      
      setShowRejectDialog(false)
      setSelectedRequest(null)
      setRejectionReason("")
      
      alert(`Successfully rejected ${selectedRequest.restaurantName}'s join request!`)
    } catch (err) {
      debugError("Error rejecting request:", err)
      alert(err.response?.data?.message || "Failed to reject request. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const formatPhone = (phone) => {
    if (!phone) return "N/A"
    return phone
  }

  // Handle view restaurant details
  const handleViewDetails = async (request) => {
    setSelectedRequest(request)
    setShowDetailsModal(true)
    setLoadingDetails(true)
    setRestaurantDetails(null)
    setOutletTimings(null)
    
    try {
      let details = null
      // First, use fullData if available (has all details from API)
      if (request.fullData) {
        debugLog("Using fullData from request:", request.fullData)
        details = request.fullData
      } else {
        // Try to fetch full restaurant details from API
        const restaurantId = request._id || request.id
        let response = null
        
        if (restaurantId) {
          try {
            // Try admin API first
            if (adminAPI.getRestaurantById) {
              response = await adminAPI.getRestaurantById(restaurantId)
            }
          } catch (err) {
            debugLog("Admin API failed, trying restaurant API:", err)
          }
          
          // Fallback to regular restaurant API
          if (!response || !response?.data?.success) {
            try {
              response = await restaurantAPI.getRestaurantById(restaurantId)
            } catch (err) {
              debugLog("Restaurant API also failed:", err)
            }
          }
        }
        
        // Check response structure
        if (response?.data?.success) {
          const data = response.data.data
          if (data?.restaurant) {
            details = data.restaurant
          } else if (data) {
            details = data
          } else {
            details = request
          }
        } else {
          details = request
        }
      }

      setRestaurantDetails(details)

      const restaurantId = details?._id || details?.id || request._id || request.id
      if (restaurantId) {
        try {
          const timingsRes = await restaurantAPI.getOutletTimingsByRestaurantId(restaurantId)
          const timings =
            timingsRes?.data?.data?.outletTimings ||
            timingsRes?.data?.outletTimings ||
            null
          setOutletTimings(timings)
        } catch (err) {
          debugLog("Failed to load outlet timings:", err)
        }
      }
    } catch (err) {
      debugError("Error fetching restaurant details:", err)
      setRestaurantDetails(request)
    } finally {
      setLoadingDetails(false)
    }
  }

  const closeDetailsModal = () => {
    setShowDetailsModal(false)
    setSelectedRequest(null)
    setRestaurantDetails(null)
    setOutletTimings(null)
  }

  const getNormalizedImageUrl = (image) => {
    if (!image) return ""
    if (typeof image === "string") return image
    return image?.url || ""
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-10px_rgba(0,0,0,0.03)] border border-slate-100 p-3 sm:p-6 mb-3 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <div>
              <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight">New Joining Requests</h1>
              <p className="hidden sm:block text-sm text-slate-500 mt-1">Review and manage onboarding registration requests from new restaurants.</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-5 mb-3 sm:mb-6">
          {/* Total Requests */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-10px_rgba(0,0,0,0.03)] border border-slate-100 p-2.5 sm:p-5 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Total</p>
                <p className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{pendingRequests.length + rejectedRequests.length}</p>
              </div>
              <div className="hidden sm:flex w-12 h-12 rounded-xl bg-blue-50/80 items-center justify-center border border-blue-100/50 shrink-0">
                <UtensilsCrossed className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Pending Approval */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-10px_rgba(0,0,0,0.03)] border border-slate-100 p-2.5 sm:p-5 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Pending</p>
                <p className="text-xl sm:text-3xl font-extrabold text-amber-600 tracking-tight">{pendingRequests.length}</p>
              </div>
              <div className="hidden sm:flex w-12 h-12 rounded-xl bg-amber-50/80 items-center justify-center border border-amber-100/50 shrink-0">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          {/* Rejected */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-10px_rgba(0,0,0,0.03)] border border-slate-100 p-2.5 sm:p-5 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">Rejected</p>
                <p className="text-xl sm:text-3xl font-extrabold text-rose-600 tracking-tight">{rejectedRequests.length}</p>
              </div>
              <div className="hidden sm:flex w-12 h-12 rounded-xl bg-rose-50/80 items-center justify-center border border-rose-100/50 shrink-0">
                <XCircle className="w-6 h-6 text-rose-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Requests Directory Container Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-10px_rgba(0,0,0,0.03)] border border-slate-200 p-3 sm:p-6 overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col gap-2 sm:gap-4 lg:flex-row lg:items-center lg:justify-between mb-3 sm:mb-6 pb-3 sm:pb-6 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Requests Directory</h2>
              {/* Tabs Menu */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "pending"
                      ? "bg-white text-blue-600 shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Pending ({pendingRequests.length})
                </button>
                <button
                  onClick={() => setActiveTab("rejected")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "rejected"
                      ? "bg-white text-blue-600 shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Rejected ({rejectedRequests.length})
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
              {/* Search Bar */}
              <div className="relative w-full sm:max-w-xs lg:ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search restaurant or owner..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400 transition-all text-slate-700"
                />
              </div>

              {/* Filter Button */}
              <button 
                onClick={() => setShowFilterDialog(true)}
                className={`w-full sm:w-auto px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                  hasActiveFilters 
                    ? "border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100" 
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <Filter className="w-4 h-4 text-slate-500" />
                <span>Filter</span>
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded-full font-bold">
                    {[filters.zone, filters.dateFrom, filters.dateTo].filter(Boolean).length}
                  </span>
                )}
              </button>

              {/* Refresh Button */}
              <button
                onClick={() => fetchRequests(true)}
                className="w-full sm:w-auto px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center gap-1.5 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-sm"
                title="Refresh Requests"
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Table Layout */}
          <div className="overflow-x-auto rounded-xl border border-slate-150">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-150 sticky top-0 backdrop-blur-md z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort("sl")}>
                    <div className="flex items-center gap-1.5">
                      <span>SL</span>
                      <ArrowUpDown className={getSortIconClassName("sl")} />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort("restaurantName")}>
                    <div className="flex items-center gap-1.5">
                      <span>Restaurant Info</span>
                      <ArrowUpDown className={getSortIconClassName("restaurantName")} />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort("ownerName")}>
                    <div className="flex items-center gap-1.5">
                      <span>Owner Info</span>
                      <ArrowUpDown className={getSortIconClassName("ownerName")} />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort("zone")}>
                    <div className="flex items-center gap-1.5">
                      <span>Zone</span>
                      <ArrowUpDown className={getSortIconClassName("zone")} />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort("status")}>
                    <div className="flex items-center gap-1.5">
                      <span>Status</span>
                      <ArrowUpDown className={getSortIconClassName("status")} />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                      <p className="text-lg font-semibold text-slate-700">Loading requests...</p>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <p className="text-lg font-semibold text-red-600 mb-1">Error: {error}</p>
                      <p className="text-sm text-slate-500">Failed to load restaurant requests. Please try again.</p>
                    </td>
                  </tr>
                ) : sortedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                        <p className="text-sm text-slate-500 font-medium">No onboarding requests match your filter parameters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedRequests.map((request, index) => (
                    <tr key={request._id || index} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                        {request.sl ?? index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer hover:opacity-90 transition-all border border-slate-150 shadow-sm"
                            onClick={() => handleViewDetails(request)}
                          >
                            <img
                              src={
                                getNormalizedImageUrl(request?.coverImages?.[0]) ||
                                (typeof request.profileImage === "string"
                                  ? request.profileImage
                                  : (request.profileImage?.url || request.profileImageUrl?.url || request.restaurantImage)) ||
                                PLACEHOLDER_40
                              }
                              alt={request.restaurantName || "Restaurant"}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = PLACEHOLDER_40
                              }}
                            />
                          </div>
                          <span 
                            className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => handleViewDetails(request)}
                          >
                            {request.restaurantName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-800">{request.ownerName}</span>
                          <span className="text-xs text-slate-500 font-medium">{formatPhone(request.ownerPhone)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-650 font-medium">
                        {request.zone || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            request.profileReviewStatus === "pending"
                              ? "bg-violet-100 text-violet-700"
                              : request.status?.toLowerCase() === "pending"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {request.profileReviewStatus === "pending"
                              ? "Re-review"
                              : request.status}
                          </span>
                          {(request.profileReviewStatus === "pending" || request.status?.toLowerCase() === "pending") &&
                            (request.pendingUpdateReason || request.pendingProfile?.pendingUpdateReason) && (
                            <span className="text-[10px] font-semibold text-slate-500 italic ml-1">
                              • {request.pendingUpdateReason || request.pendingProfile?.pendingUpdateReason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors shadow-sm"
                              aria-label="Action menu"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleViewDetails(request)} className="cursor-pointer flex items-center gap-2">
                              <Eye className="w-4 h-4 text-slate-400" />
                              <span>View Details</span>
                            </DropdownMenuItem>
                            {activeTab === "pending" && (
                              <>
                                <DropdownMenuItem onClick={() => handleApprove(request)} disabled={processing} className="cursor-pointer flex items-center gap-2 text-emerald-600">
                                  <Check className="w-4 h-4 text-emerald-500" />
                                  <span>Approve Request</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleReject(request)} disabled={processing} className="cursor-pointer flex items-center gap-2 text-rose-600">
                                  <X className="w-4 h-4 text-rose-500" />
                                  <span>Reject Request</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Filter Dialog */}
      {showFilterDialog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowFilterDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Filter className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Filter Requests</h3>
                    <p className="text-xs text-slate-500">Apply filters to refine your search</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFilterDialog(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Zone Filter */}
                {filterOptions.zones.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Zone
                    </label>
                    <select
                      value={filters.zone}
                      onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
                      className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Zones</option>
                      {filterOptions.zones.map((zone) => (
                        <option key={zone} value={zone}>{zone}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Date Range Filters */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                      className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      min={filters.dateFrom}
                      className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-200">
                <button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFilterDialog(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Dialog */}
      {showRejectDialog && selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowRejectDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <X className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Reject Restaurant Request</h3>
                  <p className="text-sm text-slate-600">{selectedRequest.restaurantName}</p>
                </div>
              </div>
              
              <p className="text-sm text-slate-700 mb-4">
                Are you sure you want to reject this restaurant request? Please provide a reason for rejection.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowRejectDialog(false)
                    setSelectedRequest(null)
                    setRejectionReason("")
                  }}
                  disabled={processing}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReject}
                  disabled={processing || !rejectionReason.trim()}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Rejecting...
                    </span>
                  ) : (
                    "Reject Request"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Restaurant Details Side Panel */}
      {showDetailsModal && selectedRequest && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm transition-opacity" onClick={closeDetailsModal} />
          
          <div 
            className="relative w-full max-w-3xl bg-white h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100/30">
                  <UtensilsCrossed className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Restaurant Details</h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">Onboarding application and documentation</p>
                </div>
              </div>
              <button
                onClick={closeDetailsModal}
                className="p-2 rounded-xl hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600 border border-transparent hover:border-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 md:p-6 overflow-y-auto flex-1">
              {loadingDetails && (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-100"></div>
                    <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                  </div>
                  <span className="mt-4 text-xs font-semibold text-slate-500 tracking-wide">Loading restaurant details...</span>
                </div>
              )}
              {!loadingDetails && (restaurantDetails || selectedRequest) && (() => {
                const r = restaurantDetails || selectedRequest
                const restaurantPhotoList = Array.isArray(r?.coverImages) ? r.coverImages.filter(Boolean) : []
                const profileImgUrl =
                  getNormalizedImageUrl(restaurantPhotoList[0]) ||
                  (typeof r?.profileImage === "string" ? r.profileImage : (r?.profileImage?.url || r?.profileImageUrl?.url || r?.restaurantImage))
                
                const addressParts = [
                  r?.addressLine1,
                  r?.addressLine2,
                  r?.area,
                  r?.city,
                  r?.landmark,
                  r?.location?.addressLine1,
                  r?.location?.addressLine2,
                  r?.location?.area,
                  r?.location?.city,
                  r?.onboarding?.step1?.location?.addressLine1,
                  r?.onboarding?.step1?.location?.area,
                  r?.onboarding?.step1?.location?.city
                ].filter(Boolean)
                const hasAddress = addressParts.length > 0 || r?.location || r?.onboarding?.step1?.location
                const openingTime = r?.openingTime || r?.deliveryTimings?.openingTime || r?.onboarding?.step2?.deliveryTimings?.openingTime
                const closingTime = r?.closingTime || r?.deliveryTimings?.closingTime || r?.onboarding?.step2?.deliveryTimings?.closingTime
                const approvalStatus = r?.status || (r?.isActive !== false ? "approved" : "pending")
                const hasFlatDocs = r?.panNumber || r?.panImage || r?.fssaiNumber || r?.accountNumber
                const menuImgList = Array.isArray(r?.menuImages) ? r.menuImages : (r?.onboarding?.step2?.menuImageUrls || [])
                
                const hasPanSection = Boolean(r?.panNumber || r?.nameOnPan || r?.panImage || r?.onboarding?.step3?.pan?.panNumber || r?.onboarding?.step3?.pan?.nameOnPan)
                const hasGstSection = Boolean(
                  r?.gstRegistered != null ||
                  r?.gstNumber ||
                  r?.gstLegalName ||
                  r?.gstAddress ||
                  r?.gstImage ||
                  r?.onboarding?.step3?.gst?.gstNumber ||
                  r?.onboarding?.step3?.gst?.legalName ||
                  r?.onboarding?.step3?.gst?.address
                )
                const hasFssaiSection = Boolean(
                  r?.fssaiNumber ||
                  r?.fssaiExpiry ||
                  r?.fssaiImage ||
                  r?.onboarding?.step3?.fssai?.registrationNumber ||
                  r?.onboarding?.step3?.fssai?.expiryDate
                )
                const hasBankSection = Boolean(
                  r?.accountNumber ||
                  r?.ifscCode ||
                  r?.accountHolderName ||
                  r?.accountType ||
                  r?.onboarding?.step3?.bank?.accountNumber ||
                  r?.onboarding?.step3?.bank?.ifscCode ||
                  r?.onboarding?.step3?.bank?.accountHolderName ||
                  r?.onboarding?.step3?.bank?.accountType
                )
                const hasRegistrationDocuments = hasPanSection || hasGstSection || hasFssaiSection || hasBankSection

                return (
                  <div className="space-y-5">
                    <ProfileChangeReviewPanel restaurant={r} />

                    {/* Restaurant Basic Info */}
                    <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
                      <a
                        href={profileImgUrl || PLACEHOLDER_128}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-50 shrink-0 shadow-inner group block border border-slate-200/60"
                      >
                        <img
                          src={profileImgUrl || PLACEHOLDER_128}
                          alt={r?.restaurantName || r?.name || "Restaurant"}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          onError={(e) => {
                            e.target.src = PLACEHOLDER_128
                          }}
                        />
                      </a>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <h3 className="text-lg font-bold text-slate-900 tracking-tight truncate mr-2">
                            {r?.restaurantName || r?.name || "N/A"}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            approvalStatus === "approved" ? "bg-green-100 text-green-700" : approvalStatus === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {approvalStatus === "approved" ? "Approved" : approvalStatus === "rejected" ? "Rejected" : "Pending"}
                          </span>
                          {r?.pureVegRestaurant != null && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${r.pureVegRestaurant ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                              {r.pureVegRestaurant ? "🟢 Pure Veg" : "Non-Veg / Mixed"}
                            </span>
                          )}
                          {r?.isAcceptingOrders != null && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${r.isAcceptingOrders ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                              {r.isAcceptingOrders ? "Accepting Orders" : "Not Accepting"}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          {r?.rating != null && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-50 rounded-lg border border-yellow-100/50">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-500" />
                              <span className="text-[10px] font-bold text-yellow-700">
                                {Number(r.rating).toFixed(1)}
                              </span>
                              <span className="text-[9px] text-yellow-600/70 font-medium">
                                ({(r.totalRatings || 0)})
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-100">
                            <Building2 className="w-3 h-3" />
                            <span className="text-[9px] font-bold tracking-wider">{formatRestaurantId(r?.restaurantId || r?._id)}</span>
                          </div>
                          {r?.zone && (
                            <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-100">
                              <MapPin className="w-3 h-3" />
                              <span className="text-[9px] font-bold tracking-wider">{r.zone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      {/* Owner Information */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Owner Information</h4>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 shadow-none">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100/30">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Full Name</p>
                              <p className="text-sm font-semibold text-slate-800">{r?.ownerName || "N/A"}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 shadow-none">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100/30">
                              <Phone className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Owner Phone</p>
                              <p className="text-sm font-semibold text-slate-800">{r?.ownerPhone || r?.phone || "N/A"}</p>
                            </div>
                          </div>
                          {(r?.ownerEmail || r?.email) && (
                            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 shadow-none">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100/30">
                                <Mail className="w-4 h-4 text-indigo-600" />
                              </div>
                              <div>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Owner Email</p>
                                <p className="text-sm font-semibold text-slate-800 break-all">{r.ownerEmail || r.email}</p>
                              </div>
                            </div>
                          )}
                          {(r?.primaryContactNumber && r.primaryContactNumber !== r?.ownerPhone) && (
                            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 shadow-none">
                              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 border border-violet-100/30">
                                <Phone className="w-4 h-4 text-violet-600" />
                              </div>
                              <div>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Primary Contact</p>
                                <p className="text-sm font-semibold text-slate-800">{r.primaryContactNumber}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Location & Contact */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</h4>
                        </div>
                        <div className="space-y-2">
                          {(() => {
                            const loc = r?.location || r?.onboarding?.step1?.location
                            const fullAddress = [
                              r?.addressLine1 || loc?.addressLine1,
                              r?.addressLine2 || loc?.addressLine2,
                              r?.area || loc?.area,
                              r?.city || loc?.city,
                              r?.state || loc?.state,
                              r?.pincode || loc?.pincode,
                              r?.landmark || loc?.landmark,
                            ].filter(Boolean).join(", ") || loc?.formattedAddress || loc?.address || r?.zone || null
                            const area = r?.area || loc?.area
                            const city = r?.city || loc?.city
                            const state = r?.state || loc?.state
                            const pincode = r?.pincode || loc?.pincode
                            const landmark = r?.landmark || loc?.landmark

                            return fullAddress ? (
                              <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 space-y-1 shadow-none">
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Full Address</p>
                                <p className="text-sm font-semibold text-slate-800">{fullAddress}</p>
                                {(area || city || state || pincode || landmark) && (
                                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100">
                                    {area && <div><p className="text-[9px] text-slate-400">Area</p><p className="text-xs font-semibold text-slate-700">{area}</p></div>}
                                    {city && <div><p className="text-[9px] text-slate-400">City</p><p className="text-xs font-semibold text-slate-700">{city}</p></div>}
                                    {state && <div><p className="text-[9px] text-slate-400">State</p><p className="text-xs font-semibold text-slate-700">{state}</p></div>}
                                    {pincode && <div><p className="text-[9px] text-slate-400">Pincode</p><p className="text-xs font-semibold text-slate-700">{pincode}</p></div>}
                                    {landmark && <div className="col-span-2"><p className="text-[9px] text-slate-400">Landmark</p><p className="text-xs font-semibold text-slate-700">{landmark}</p></div>}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">No address details available</p>
                            )
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Operational Details */}
                    <div className="pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 mb-3">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operational Details</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2.5">
                          {(openingTime || closingTime) && (
                            <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 shadow-none">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Default Hours</p>
                              <p className="text-sm font-semibold text-slate-800">
                                {formatTime12Hour(openingTime)} – {formatTime12Hour(closingTime)}
                              </p>
                            </div>
                          )}
                          {outletTimings && (
                            <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 shadow-none">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Weekly schedule</p>
                              <div className="space-y-1">
                                {DAY_NAMES.map((day) => {
                                  const slot = outletTimings[day]
                                  if (!slot) return null
                                  const label = slot.isOpen === false
                                    ? "Closed"
                                    : `${formatOutletTime12Hour(slot.openingTime)} – ${formatOutletTime12Hour(slot.closingTime)}`
                                  return (
                                    <div key={day} className="flex items-center justify-between text-xs">
                                      <span className="font-medium text-slate-600">{day.slice(0, 3)}</span>
                                      <span className={`font-semibold ${slot.isOpen === false ? "text-slate-400" : "text-slate-800"}`}>{label}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          {r?.estimatedDeliveryTime && (
                            <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 shadow-none">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Est. Delivery Time</p>
                              <p className="text-sm font-semibold text-slate-800">{r.estimatedDeliveryTime} min</p>
                            </div>
                          )}
                          <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 shadow-none">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Approval Status</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              approvalStatus === "approved" ? "bg-green-100 text-green-700" : approvalStatus === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {approvalStatus === "approved" ? "Approved" : approvalStatus === "rejected" ? "Rejected" : "Pending"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {(() => {
                            const cuisines = Array.isArray(r?.cuisines) && r.cuisines.length ? r.cuisines
                              : Array.isArray(r?.onboarding?.step2?.cuisines) && r.onboarding.step2.cuisines.length ? r.onboarding.step2.cuisines
                              : null
                            return cuisines && cuisines.length > 0 && (
                              <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 shadow-none">
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Cuisines</p>
                                <div className="flex flex-wrap gap-1">
                                  {cuisines.map((c, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-semibold">{c}</span>
                                  ))}
                                </div>
                              </div>
                            )
                          })()}
                          {r?.openDays && Array.isArray(r.openDays) && r.openDays.length > 0 && (
                            <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 shadow-none">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Open Days</p>
                              <div className="flex flex-wrap gap-1">
                                {r.openDays.map((day, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-750 rounded-full text-[10px] font-semibold capitalize">{day}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {r?.offer && (
                            <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 shadow-none">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Offer</p>
                              <p className="text-sm font-semibold text-green-700">{r.offer}</p>
                            </div>
                          )}
                          {r?.featuredDish && (
                            <div className="p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 shadow-none">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Featured Dish</p>
                              <p className="text-sm font-semibold text-slate-800">{r.featuredDish}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Media */}
                    {restaurantPhotoList.length > 0 && (
                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Restaurant Photos</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                          {restaurantPhotoList.map((restaurantImg, idx) => {
                            const imgUrl = getNormalizedImageUrl(restaurantImg)
                            return imgUrl ? (
                              <a
                                key={idx}
                                href={imgUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-50 hover:border-slate-350 shadow-sm"
                                title="Open restaurant photo"
                              >
                                <img
                                  src={imgUrl}
                                  alt={`Restaurant ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.target.src = PLACEHOLDER_128
                                  }}
                                />
                              </a>
                            ) : null
                          })}
                        </div>
                      </div>
                    )}

                    {/* Registration Documents */}
                    {(hasFlatDocs || r?.onboarding?.step3) && (
                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Registration Documents</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* PAN – flat: panNumber, nameOnPan, panImage */}
                          {(r.panNumber || r?.onboarding?.step3?.pan) && (() => {
                            const panNo = r.panNumber || r.onboarding?.step3?.pan?.panNumber
                            const panName = r.nameOnPan || r.onboarding?.step3?.pan?.nameOnPan
                            const panImg = typeof r.panImage === "string" ? r.panImage : (r.panImage?.url || r.onboarding?.step3?.pan?.image?.url)
                            return (
                              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 shadow-none">
                                <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                                  PAN Details
                                </h5>
                                <div className="grid grid-cols-1 gap-2 text-xs">
                                  {panNo && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">PAN Number</p>
                                      <p className="font-semibold text-slate-800">{panNo}</p>
                                    </div>
                                  )}
                                  {panName && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Name on PAN</p>
                                      <p className="font-semibold text-slate-800">{panName}</p>
                                    </div>
                                  )}
                                  {panImg && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">PAN Document</p>
                                      <a href={panImg} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold">
                                        <ImageIcon className="w-3 h-3" />
                                        <span>View PAN Document</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })()}

                          {/* GST – flat: gstRegistered, gstNumber, gstLegalName, gstAddress, gstImage */}
                          {(r.gstRegistered != null || r.gstNumber || r?.onboarding?.step3?.gst) && (() => {
                            const isReg = r.gstRegistered != null ? r.gstRegistered : r?.onboarding?.step3?.gst?.isRegistered
                            const gstNo = r.gstNumber || r?.onboarding?.step3?.gst?.gstNumber
                            const legalName = r.gstLegalName || r?.onboarding?.step3?.gst?.legalName
                            const gstAddr = r.gstAddress || r?.onboarding?.step3?.gst?.address
                            const gstImg = typeof r.gstImage === "string" ? r.gstImage : (r.gstImage?.url || r?.onboarding?.step3?.gst?.image?.url)
                            return (
                              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 shadow-none">
                                <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                                  GST Details
                                </h5>
                                <div className="grid grid-cols-1 gap-2 text-xs">
                                  {isReg != null && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">GST Registered</p>
                                      <p className="font-semibold text-slate-800">{isReg ? "Yes" : "No"}</p>
                                    </div>
                                  )}
                                  {gstNo && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">GST Number</p>
                                      <p className="font-semibold text-slate-800">{gstNo}</p>
                                    </div>
                                  )}
                                  {legalName && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Legal Name</p>
                                      <p className="font-semibold text-slate-800">{legalName}</p>
                                    </div>
                                  )}
                                  {gstAddr && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">GST Address</p>
                                      <p className="font-semibold text-slate-800">{gstAddr}</p>
                                    </div>
                                  )}
                                  {gstImg && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">GST Document</p>
                                      <a href={gstImg} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold">
                                        <ImageIcon className="w-3 h-3" />
                                        <span>View GST Document</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })()}

                          {/* FSSAI – flat: fssaiNumber, fssaiExpiry, fssaiImage */}
                          {(r.fssaiNumber || r.fssaiExpiry || r?.onboarding?.step3?.fssai) && (() => {
                            const fssaiNo = r.fssaiNumber || r?.onboarding?.step3?.fssai?.registrationNumber
                            const fssaiExp = r.fssaiExpiry || r?.onboarding?.step3?.fssai?.expiryDate
                            const fssaiImg = typeof r.fssaiImage === "string" ? r.fssaiImage : (r?.fssaiImage?.url || r?.onboarding?.step3?.fssai?.image?.url)
                            return (
                              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 shadow-none">
                                <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                                  FSSAI Details
                                </h5>
                                <div className="grid grid-cols-1 gap-2 text-xs">
                                  {fssaiNo && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">FSSAI Number</p>
                                      <p className="font-semibold text-slate-800">{fssaiNo}</p>
                                    </div>
                                  )}
                                  {fssaiExp && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">FSSAI Expiry Date</p>
                                      <p className="font-semibold text-slate-800">
                                        {new Date(fssaiExp).toLocaleDateString('en-IN', {
                                          year: 'numeric',
                                          month: 'long',
                                          day: 'numeric'
                                        })}
                                      </p>
                                    </div>
                                  )}
                                  {fssaiImg && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">FSSAI Document</p>
                                      <a href={fssaiImg} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold">
                                        <ImageIcon className="w-3 h-3" />
                                        <span>View FSSAI Document</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })()}

                          {/* Bank – flat: accountNumber, ifscCode, accountHolderName, accountType */}
                          {(r.accountNumber || r.ifscCode || r?.onboarding?.step3?.bank) && (() => {
                            const accNo = r.accountNumber || r?.onboarding?.step3?.bank?.accountNumber
                            const ifsc = r.ifscCode || r?.onboarding?.step3?.bank?.ifscCode
                            const holder = r.accountHolderName || r?.onboarding?.step3?.bank?.accountHolderName
                            const type = r.accountType || r?.onboarding?.step3?.bank?.accountType
                            return (
                              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 shadow-none">
                                <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                                  Bank Details
                                </h5>
                                <div className="grid grid-cols-1 gap-2 text-xs">
                                  {accNo && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Account Number</p>
                                      <p className="font-semibold text-slate-800">{accNo}</p>
                                    </div>
                                  )}
                                  {ifsc && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">IFSC Code</p>
                                      <p className="font-semibold text-slate-800">{ifsc}</p>
                                    </div>
                                  )}
                                  {holder && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Account Holder Name</p>
                                      <p className="font-semibold text-slate-800">{holder}</p>
                                    </div>
                                  )}
                                  {type && (
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Account Type</p>
                                      <p className="font-semibold text-slate-800 capitalize">{type}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Menu Images */}
                    {menuImgList.length > 0 && (
                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Menu Images</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                          {menuImgList.map((menuImg, idx) => {
                            const imgUrl = typeof menuImg === "string" ? menuImg : (menuImg?.url || menuImg)
                            return imgUrl ? (
                              <a
                                key={idx}
                                href={imgUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-50 hover:border-slate-350 shadow-sm"
                                title="Open menu image"
                              >
                                <img
                                  src={imgUrl}
                                  alt={`Menu ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.target.src = PLACEHOLDER_128
                                  }}
                                />
                              </a>
                            ) : null
                          })}
                        </div>
                      </div>
                    )}

                    {/* Registration & Onboarding Steps info */}
                    {(r?.createdAt || r?.restaurantId || r?.businessModel || r?.approvedAt != null) && (
                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Registration Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl">
                          {r.createdAt && (
                            <div className="flex items-center gap-3">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <div>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Registration Date & Time</p>
                                <p className="font-semibold text-slate-800">
                                  {new Date(r.createdAt).toLocaleString('en-IN', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          )}
                          {r.restaurantId && (
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Restaurant ID</p>
                              <p className="font-semibold text-slate-800">{r.restaurantId}</p>
                            </div>
                          )}
                          {r.approvedAt != null && (
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Approved At</p>
                              <p className="font-semibold text-slate-800">{new Date(r.approvedAt).toLocaleString('en-IN')}</p>
                            </div>
                          )}
                          {r.businessModel && (
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Business Model</p>
                              <p className="font-semibold text-slate-800">{r.businessModel}</p>
                            </div>
                          )}
                          {r.phoneVerified !== undefined && (
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Phone Verified</p>
                              <p className="font-semibold text-slate-800">{r.phoneVerified ? "Yes" : "No"}</p>
                            </div>
                          )}
                          {r.signupMethod && (
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Signup Method</p>
                              <p className="font-semibold text-slate-800 capitalize">{r.signupMethod}</p>
                            </div>
                          )}
                          {r?.onboarding?.completedSteps != null && (
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Onboarding Completed Steps</p>
                              <p className="font-semibold text-slate-800">{r.onboarding.completedSteps} / 4</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Rejection Reason (if rejected) */}
                    {r?.rejectionReason && (
                      <div className="pt-4 border-t border-slate-100">
                        <div className="bg-red-50 border border-red-200/60 rounded-xl p-3 shadow-none">
                          <h4 className="text-xs font-bold text-red-900 mb-1">Rejection Reason</h4>
                          <p className="text-xs text-red-800 font-medium">{r.rejectionReason}</p>
                          {r.rejectedAt && (
                            <p className="text-[10px] text-red-650 mt-1.5 font-semibold">
                              Rejected on: {new Date(r.rejectedAt).toLocaleString('en-IN')}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
              {!loadingDetails && !restaurantDetails && !selectedRequest && (
                <div className="flex flex-col items-center justify-center py-20">
                  <p className="text-lg font-semibold text-slate-700 mb-2">No Details Available</p>
                  <p className="text-sm text-slate-500">Unable to load restaurant details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



