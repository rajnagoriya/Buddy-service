import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import {
  Search,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  X,
  Mail,
  Phone,
  MapPin,
  Package,
  IndianRupee,
  Calendar as CalendarIcon,
  User,
  CheckCircle,
  XCircle,
  MoreVertical,
  History,
  Filter,
  RotateCcw,
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Banknote,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu"
import {
  exportCustomersToCSV,
  exportCustomersToExcel,
  exportCustomersToPDF,
} from "@food/components/admin/customers/customersExportUtils"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { extractPagination } from "@food/utils/pagination"

const PAGE_SIZE = 30

const EMPTY_FILTERS = {
  orderDate: "",
  joiningDate: "",
  status: "",
  codStatus: "",
  sortBy: "",
}

const EMPTY_STATS = {
  total: 0,
  active: 0,
  inactive: 0,
  newToday: 0,
  codEnabled: 0,
}

export default function Customers() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const userIdFromUrl = searchParams.get("userId")

  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [stats, setStats] = useState({ ...EMPTY_STATS })

  const [draftFilters, setDraftFilters] = useState({ ...EMPTY_FILTERS })
  const [appliedFilters, setAppliedFilters] = useState({ ...EMPTY_FILTERS })

  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [userDetails, setUserDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showUserDetails, setShowUserDetails] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true)
      const params = {
        limit: PAGE_SIZE,
        page: currentPage,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(appliedFilters.status && { status: appliedFilters.status }),
        ...(appliedFilters.codStatus && { codStatus: appliedFilters.codStatus }),
        ...(appliedFilters.joiningDate && { joiningDate: appliedFilters.joiningDate }),
        ...(appliedFilters.orderDate && { orderDate: appliedFilters.orderDate }),
        ...(appliedFilters.sortBy && { sortBy: appliedFilters.sortBy }),
      }

      const response = await adminAPI.getCustomers(params)
      const data = response?.data?.data || response?.data
      const list = data?.customers || data?.users || []
      const pagination = extractPagination(data)

      setCustomers(Array.isArray(list) ? list : [])
      setTotalCustomers(pagination.total || data?.total || 0)
      setTotalPages(
        pagination.totalPages ||
          Math.ceil((pagination.total || data?.total || 0) / PAGE_SIZE) ||
          0
      )
      if (data?.stats) {
        setStats({
          total: Number(data.stats.total || 0),
          active: Number(data.stats.active || 0),
          inactive: Number(data.stats.inactive || 0),
          newToday: Number(data.stats.newToday || 0),
          codEnabled: Number(data.stats.codEnabled || 0),
        })
      }
    } catch (error) {
      toast.error("Failed to load customers")
      setCustomers([])
      setTotalCustomers(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [currentPage, debouncedSearch, appliedFilters])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    if (userIdFromUrl && customers.length > 0) {
      const customer = customers.find(
        (c) => c.id === userIdFromUrl || c._id === userIdFromUrl
      )
      if (customer) {
        handleViewDetails(customer._id || customer.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdFromUrl, customers])

  const formatDateTime = (value) => {
    if (!value) return "—"
    try {
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return String(value)
      const day = String(d.getDate()).padStart(2, "0")
      const month = d.toLocaleString("en-GB", { month: "short" })
      const year = d.getFullYear()
      const time = d.toLocaleString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      return `${day} ${month} ${year}, ${time}`
    } catch {
      return String(value)
    }
  }

  const formatCurrency = (amount) =>
    `₹${Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const getInitials = (name) => {
    if (!name) return "NA"
    return (
      name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "NA"
    )
  }

  const getCustomerId = (customer) => customer?._id || customer?.id

  const handleDraftFilterChange = (field, value) => {
    setDraftFilters((prev) => ({ ...prev, [field]: value }))
  }

  const handleApplyFilters = () => {
    setAppliedFilters({ ...draftFilters })
    setCurrentPage(1)
    setSelectedIds([])
  }

  const handleResetFilters = () => {
    setDraftFilters({ ...EMPTY_FILTERS })
    setAppliedFilters({ ...EMPTY_FILTERS })
    setSearchQuery("")
    setDebouncedSearch("")
    setCurrentPage(1)
    setSelectedIds([])
  }

  const activeFilterCount = [
    appliedFilters.orderDate,
    appliedFilters.joiningDate,
    appliedFilters.status,
    appliedFilters.codStatus,
    appliedFilters.sortBy,
    debouncedSearch,
  ].filter(Boolean).length

  const handleToggleStatus = async (customerId) => {
    try {
      const customer = customers.find((c) => getCustomerId(c) === customerId)
      if (!customer) return

      const newStatus = !customer.status
      setCustomers((prev) =>
        prev.map((c) =>
          getCustomerId(c) === customerId ? { ...c, status: newStatus, isActive: newStatus } : c
        )
      )
      setStats((prev) => ({
        ...prev,
        active: Math.max(0, prev.active + (newStatus ? 1 : -1)),
        inactive: Math.max(0, prev.inactive + (newStatus ? -1 : 1)),
      }))

      await adminAPI.updateCustomerStatus(customerId, newStatus)
      toast.success(`User ${newStatus ? "activated" : "deactivated"} successfully`)
    } catch {
      toast.error("Failed to update status")
      fetchCustomers()
    }
  }

  const handleViewDetails = async (customerId) => {
    try {
      setLoadingDetails(true)
      setShowUserDetails(true)
      setSelectedCustomer(customerId)

      const response = await adminAPI.getCustomerById(customerId)
      const data = response?.data?.data || response?.data

      if (data?.user || data?.customer) {
        setUserDetails(data.user || data.customer)
      } else {
        toast.error("Failed to load user details")
        setShowUserDetails(false)
      }
    } catch {
      toast.error("Failed to load user details")
      setShowUserDetails(false)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleViewOrderHistory = (customerId) => {
    if (!customerId) {
      toast.error("Customer ID not found")
      return
    }
    navigate(`/admin/food/orders/all?userId=${customerId}`)
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(customers.map(getCustomerId).filter(Boolean))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleBulkToggleCod = async (status) => {
    try {
      setBulkLoading(true)
      const response = await adminAPI.bulkToggleCod(selectedIds, status)

      if (response?.data?.success) {
        toast.success(
          `User Code ${status ? "enabled" : "disabled"} for ${selectedIds.length} users`
        )
        const affected = selectedIds.length
        setCustomers((prev) =>
          prev.map((c) =>
            selectedIds.includes(getCustomerId(c)) ? { ...c, isCodEnabled: status } : c
          )
        )
        setStats((prev) => {
          const previouslyEnabled = customers.filter(
            (c) => selectedIds.includes(getCustomerId(c)) && c.isCodEnabled !== false
          ).length
          const previouslyDisabled = affected - previouslyEnabled
          const delta = status
            ? previouslyDisabled
            : -previouslyEnabled
          return {
            ...prev,
            codEnabled: Math.max(0, prev.codEnabled + delta),
          }
        })
        setSelectedIds([])
      }
    } catch {
      toast.error("Failed to update User Code status")
    } finally {
      setBulkLoading(false)
    }
  }

  const handleExport = (format) => {
    if (customers.length === 0) {
      toast.error("No customers to export")
      return
    }

    const filename = "customers"
    try {
      switch (format) {
        case "csv":
          exportCustomersToCSV(customers, filename)
          toast.success("CSV export started")
          break
        case "excel":
          exportCustomersToExcel(customers, filename)
          toast.success("Excel export started")
          break
        case "pdf":
          exportCustomersToPDF(customers, filename)
          toast.success("PDF download started")
          break
        default:
          toast.error("Invalid export format")
      }
    } catch {
      toast.error("Failed to export customers")
    }
  }

  const fromItem = totalCustomers === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const toItem = Math.min(currentPage * PAGE_SIZE, totalCustomers)

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Customers</h1>
                <p className="text-sm text-slate-500">
                  {loading ? "Loading…" : `${totalCustomers.toLocaleString()} total customers`}
                </p>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">
                <Download className="w-4 h-4" />
                Export
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
              <DropdownMenuLabel>Export page data</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer">
                <FileDown className="w-4 h-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer">
                <FileText className="w-4 h-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              label: "Total customers",
              value: stats.total,
              icon: Users,
              iconBg: "bg-blue-50",
              iconColor: "text-blue-600",
            },
            {
              label: "Active",
              value: stats.active,
              icon: UserCheck,
              iconBg: "bg-emerald-50",
              iconColor: "text-emerald-600",
            },
            {
              label: "Inactive",
              value: stats.inactive,
              icon: UserX,
              iconBg: "bg-rose-50",
              iconColor: "text-rose-600",
            },
            {
              label: "New today",
              value: stats.newToday,
              icon: UserPlus,
              iconBg: "bg-amber-50",
              iconColor: "text-amber-600",
            },
            {
              label: "COD enabled",
              value: stats.codEnabled,
              icon: Banknote,
              iconBg: "bg-slate-100",
              iconColor: "text-slate-700",
            },
          ].map((card) => {
            const Icon = card.icon
            return (
              <div
                key={card.label}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500 truncate">{card.label}</p>
                    <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
                      {loading ? "—" : Number(card.value || 0).toLocaleString()}
                    </p>
                  </div>
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${card.iconBg}`}
                  >
                    <Icon className={`w-4 h-4 ${card.iconColor}`} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Filters</h2>
              {activeFilterCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
                  {activeFilterCount} active
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email or phone…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Order date</label>
                <input
                  type="date"
                  value={draftFilters.orderDate}
                  onChange={(e) => handleDraftFilterChange("orderDate", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Joining date</label>
                <input
                  type="date"
                  value={draftFilters.joiningDate}
                  onChange={(e) => handleDraftFilterChange("joiningDate", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
                <select
                  value={draftFilters.status}
                  onChange={(e) => handleDraftFilterChange("status", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">User Code (COD)</label>
                <select
                  value={draftFilters.codStatus}
                  onChange={(e) => handleDraftFilterChange("codStatus", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                >
                  <option value="">All</option>
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Sort by</label>
                <select
                  value={draftFilters.sortBy}
                  onChange={(e) => handleDraftFilterChange("sortBy", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                >
                  <option value="">Newest first</option>
                  <option value="joined-asc">Oldest first</option>
                  <option value="name-asc">Name (A–Z)</option>
                  <option value="name-desc">Name (Z–A)</option>
                  <option value="orders-desc">Orders (High–Low)</option>
                  <option value="orders-asc">Orders (Low–High)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleApplyFilters}
                className="px-5 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Apply filters
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-5 py-2.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Customer list</h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                {customers.length}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {loading
                ? "Loading…"
                : totalCustomers > 0
                  ? `Showing ${fromItem}–${toItem} of ${totalCustomers.toLocaleString()}`
                  : "No results"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={
                        customers.length > 0 &&
                        selectedIds.length === customers.length
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider w-12">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-4" colSpan={7}>
                        <div className="h-10 bg-slate-100 rounded-lg" />
                      </td>
                    </tr>
                  ))
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                          <Users className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-700">No customers found</p>
                        <p className="text-xs text-slate-500">
                          Try adjusting search or filters
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  customers.map((customer, index) => {
                    const id = getCustomerId(customer)
                    const isSelected = selectedIds.includes(id)
                    return (
                      <tr
                        key={id}
                        className={`${isSelected ? "bg-blue-50/60" : "hover:bg-slate-50/80"} transition-colors`}
                      >
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectOne(id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm text-slate-500">
                            {(currentPage - 1) * PAGE_SIZE + index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => handleViewDetails(id)}
                            className="flex items-center gap-3 text-left group"
                          >
                            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 overflow-hidden border border-slate-100">
                              {customer.profileImage ? (
                                <img
                                  src={customer.profileImage}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none"
                                  }}
                                />
                              ) : (
                                <span className="text-[11px] font-semibold">
                                  {getInitials(customer.name)}
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                              {customer.name || "Unnamed"}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm text-slate-700">
                            {customer.phone || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800">
                            <Package className="w-3.5 h-3.5 text-slate-400" />
                            {customer.totalOrder || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(id)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              customer.status ? "bg-blue-600" : "bg-slate-300"
                            }`}
                            title={customer.status ? "Active — click to deactivate" : "Inactive — click to activate"}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                customer.status ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50"
                            >
                              <DropdownMenuItem
                                onClick={() => handleViewDetails(id)}
                                className="cursor-pointer flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4 text-blue-600" />
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleViewOrderHistory(id)}
                                className="cursor-pointer flex items-center gap-2"
                              >
                                <History className="w-4 h-4 text-emerald-600" />
                                Order history
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Server-side pagination */}
          {totalPages > 0 && (
            <div className="px-5 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                Page <span className="font-semibold text-slate-700">{currentPage}</span> of{" "}
                <span className="font-semibold text-slate-700">{totalPages}</span>
                <span className="text-slate-400"> · {PAGE_SIZE} per page</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1 || loading}
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1))
                    setSelectedIds([])
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = idx + 1
                  } else if (currentPage <= 3) {
                    pageNum = idx + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + idx
                  } else {
                    pageNum = currentPage - 2 + idx
                  }

                  return (
                    <button
                      key={pageNum}
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setCurrentPage(pageNum)
                        setSelectedIds([])
                      }}
                      className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                        currentPage === pageNum
                          ? "bg-blue-600 text-white font-semibold"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}

                <button
                  type="button"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                    setSelectedIds([])
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Details Modal */}
      <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto mx-auto p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <DialogTitle className="pr-12 text-xl font-bold text-slate-900">
              Customer details
            </DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              Loading details…
            </div>
          ) : userDetails ? (
            <div className="space-y-4 px-6 py-5">
              <div className="bg-slate-50 rounded-xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {userDetails.profileImage ? (
                      <img
                        src={userDetails.profileImage}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-slate-900">
                        {userDetails.name}
                      </h3>
                      {userDetails.isActive !== false ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          userDetails.isCodEnabled !== false
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        COD {userDetails.isCodEnabled !== false ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-3">
                      <div className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
                        <Mail className="w-4 h-4 shrink-0 text-slate-400" />
                        <span className="truncate">{userDetails.email || "NA"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
                        <Phone className="w-4 h-4 shrink-0 text-slate-400" />
                        <span>
                          {userDetails.countryCode ? `${userDetails.countryCode} ` : ""}
                          {userDetails.phone || "—"}
                        </span>
                        {userDetails.phoneVerified && (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <CalendarIcon className="w-4 h-4 shrink-0 text-slate-400" />
                        <span>Joined {formatDateTime(userDetails.joiningDate)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-slate-500">Total orders</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900">
                    {userDetails.totalOrders || userDetails.totalOrder || 0}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <IndianRupee className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-medium text-slate-500">Total spent</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900">
                    {formatCurrency(userDetails.totalOrderAmount)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarIcon className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-medium text-slate-500">Member since</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 leading-snug">
                    {formatDateTime(userDetails.joiningDate)}
                  </p>
                </div>
              </div>

              {(userDetails.gender || userDetails.dateOfBirth) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {userDetails.gender && (
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                      <p className="text-xs font-medium text-slate-500 mb-1">Gender</p>
                      <p className="text-sm text-slate-800 capitalize">{userDetails.gender}</p>
                    </div>
                  )}
                  {userDetails.dateOfBirth && (
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                      <p className="text-xs font-medium text-slate-500 mb-1">Date of birth</p>
                      <p className="text-sm text-slate-800">
                        {new Date(userDetails.dateOfBirth).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {userDetails.addresses?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    Addresses
                  </h4>
                  <div className="space-y-2">
                    {userDetails.addresses.map((address, index) => (
                      <div
                        key={address._id || index}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-semibold text-slate-700">
                            {address.label || "Address"}
                          </span>
                          {address.isDefault && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">
                          {[
                            address.street,
                            address.additionalDetails,
                            address.city,
                            address.state,
                            address.zipCode,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {userDetails.orders?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <Package className="w-4 h-4 text-slate-500" />
                      Recent orders
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        handleViewOrderHistory(userDetails._id || userDetails.id || selectedCustomer)
                      }
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      View all
                    </button>
                  </div>
                  <div className="space-y-2">
                    {userDetails.orders.slice(0, 5).map((order, index) => (
                      <div
                        key={order.orderId || index}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {order.orderId}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {order.restaurantName}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrency(order.total)}
                          </p>
                          <p className="text-xs text-slate-500 capitalize">{order.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-slate-500">
              No details available
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-5 border border-slate-700/50">
          <div className="flex items-center gap-3 pr-5 border-r border-slate-700">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
              {selectedIds.length}
            </div>
            <span className="text-sm font-medium">Selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={bulkLoading}
              onClick={() => handleBulkToggleCod(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Enable User Code
            </button>
            <button
              disabled={bulkLoading}
              onClick={() => handleBulkToggleCod(false)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              Disable User Code
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="p-1.5 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}
    </div>
  )
}
