import { useState, useEffect, useMemo } from "react"
import {
  Search,
  Wallet,
  Eye,
  CheckCircle,
  XCircle,
  Loader2,
  Package,
  QrCode,
  ChevronLeft,
  ChevronRight,
  Filter,
  MoreVertical,
  Clock,
  IndianRupee,
} from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@food/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu"

const PAGE_SIZE = 30

const TABS = [
  { key: "All", label: "All", countKey: "all" },
  { key: "Pending", label: "Pending", countKey: "pending" },
  { key: "Approved", label: "Approved", countKey: "approved" },
  { key: "Rejected", label: "Rejected", countKey: "rejected" },
]

function StatCard({ icon: Icon, label, value, color, subValue }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900 truncate">{value}</p>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        {subValue != null && (
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{subValue}</p>
        )}
      </div>
    </div>
  )
}

export default function DeliveryWithdrawal() {
  const [activeTab, setActiveTab] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [page, setPage] = useState(1)
  const [requests, setRequests] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  })
  const [amountTotals, setAmountTotals] = useState({
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  })
  const [loading, setLoading] = useState(true)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [processingAction, setProcessingAction] = useState(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    setPage(1)
  }, [activeTab, fromDate, toDate])

  useEffect(() => {
    fetchRequests()
  }, [activeTab, debouncedSearch, fromDate, toDate, page])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getDeliveryWithdrawals({
        status: activeTab,
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      })

      if (response?.data?.success) {
        const data = response.data.data || {}
        setRequests(data.requests || [])
        setTotal(Number(data.total ?? data.pagination?.total) || 0)
        setPages(Number(data.pages ?? data.pagination?.pages) || 1)
        setStatusCounts({
          all: Number(data.statusCounts?.all) || 0,
          pending: Number(data.statusCounts?.pending) || 0,
          approved: Number(data.statusCounts?.approved) || 0,
          rejected: Number(data.statusCounts?.rejected) || 0,
        })
        setAmountTotals({
          all: Number(data.amountTotals?.all) || 0,
          pending: Number(data.amountTotals?.pending) || 0,
          approved: Number(data.amountTotals?.approved) || 0,
          rejected: Number(data.amountTotals?.rejected) || 0,
        })
      } else {
        toast.error(response?.data?.message || "Failed to fetch delivery withdrawal requests")
        setRequests([])
        setTotal(0)
        setPages(1)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch delivery withdrawal requests")
      setRequests([])
      setTotal(0)
      setPages(1)
    } finally {
      setLoading(false)
    }
  }

  const pageRequests = useMemo(() => requests.slice(0, PAGE_SIZE), [requests])

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  const getStatusBadge = (status) => {
    if (status === "Approved" || status === "Processed") return "bg-green-100 text-green-700"
    if (status === "Pending") return "bg-amber-100 text-amber-700"
    if (status === "Rejected") return "bg-red-100 text-red-700"
    return "bg-slate-100 text-slate-700"
  }

  const handleView = (req) => {
    setSelectedRequest(req)
    setIsViewOpen(true)
  }

  const handleApprove = async (id) => {
    if (!confirm("Approve this withdrawal? The amount will be deducted from the driver wallet.")) {
      return
    }
    try {
      setProcessingAction(id)
      const response = await adminAPI.updateDeliveryWithdrawalStatus(id, { status: "Approved" })
      if (response?.data?.success) {
        toast.success("Withdrawal approved. Amount deducted from driver wallet.")
        setIsViewOpen(false)
        fetchRequests()
      } else {
        toast.error(response?.data?.message || "Failed to approve")
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Failed to approve withdrawal request")
    } finally {
      setProcessingAction(null)
    }
  }

  const handleReject = async (id) => {
    try {
      setProcessingAction(id)
      const response = await adminAPI.updateDeliveryWithdrawalStatus(id, {
        status: "Rejected",
        rejectionReason,
      })
      if (response?.data?.success) {
        toast.success("Withdrawal request rejected")
        setShowRejectModal(false)
        setRejectionReason("")
        setSelectedRequest(null)
        setIsViewOpen(false)
        fetchRequests()
      } else {
        toast.error(response?.data?.message || "Failed to reject")
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reject withdrawal request")
    } finally {
      setProcessingAction(null)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    try {
      return new Date(dateString).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    } catch {
      return String(dateString)
    }
  }

  const formatCurrency = (amount) => {
    if (amount == null) return "₹0.00"
    return `₹${Number(amount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const clearFilters = () => {
    setSearchQuery("")
    setDebouncedSearch("")
    setFromDate("")
    setToDate("")
    setActiveTab("All")
    setPage(1)
  }

  const hasFilters = searchQuery || fromDate || toDate || activeTab !== "All"

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-100">
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Delivery Withdrawal</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1.5 sm:ml-12">
              Review driver withdrawal requests. Approving deducts the amount from the driver wallet.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Wallet}
            label="Total Requests"
            value={statusCounts.all}
            color="bg-slate-100 text-slate-600"
            subValue={formatCurrency(amountTotals.all)}
          />
          <StatCard
            icon={Clock}
            label="Pending"
            value={statusCounts.pending}
            color="bg-amber-100 text-amber-600"
            subValue={formatCurrency(amountTotals.pending)}
          />
          <StatCard
            icon={CheckCircle}
            label="Approved"
            value={statusCounts.approved}
            color="bg-green-100 text-green-600"
            subValue={formatCurrency(amountTotals.approved)}
          />
          <StatCard
            icon={XCircle}
            label="Rejected"
            value={statusCounts.rejected}
            color="bg-red-100 text-red-600"
            subValue={formatCurrency(amountTotals.rejected)}
          />
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-100 space-y-4">
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => {
                const count = statusCounts[tab.countKey] ?? 0
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? "bg-white/20 text-white" : "bg-white text-slate-600"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1 lg:max-w-xs">
                <input
                  type="text"
                  placeholder="Search name, phone, ID, amount"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="hidden sm:flex items-center gap-1.5 text-slate-400 mb-2">
                  <Filter className="w-3.5 h-3.5" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="text-slate-600">Loading withdrawal requests…</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">#</th>
                      <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Delivery Boy</th>
                      <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Request Time</th>
                      <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {pageRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <Package className="w-14 h-14 text-slate-300 mb-3" />
                            <p className="text-lg font-semibold text-slate-700">No requests</p>
                            <p className="text-sm text-slate-500">
                              No {activeTab.toLowerCase()} withdrawal requests found.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      pageRequests.map((req, index) => (
                        <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {(page - 1) * PAGE_SIZE + index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-semibold text-slate-900 inline-flex items-center gap-1">
                              <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                              {Number(req.amount || 0).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-slate-800">{req.deliveryName || "N/A"}</div>
                            <div className="text-xs text-slate-400">{req.deliveryPhone || ""}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">
                            {req.deliveryIdString || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {formatDate(req.requestedAt || req.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadge(req.status)}`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  disabled={processingAction === req.id}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                                >
                                  {processingAction === req.id ? (
                                    <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                                  ) : (
                                    <MoreVertical className="w-4 h-4 text-slate-600" />
                                  )}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                                <DropdownMenuItem
                                  onClick={() => handleView(req)}
                                  className="cursor-pointer flex items-center gap-2"
                                >
                                  <Eye className="w-4 h-4 text-slate-500" />
                                  View Details
                                </DropdownMenuItem>
                                {req.status === "Pending" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleApprove(req.id)}
                                      className="cursor-pointer flex items-center gap-2 text-green-700 focus:text-green-700"
                                    >
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                      Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedRequest(req)
                                        setShowRejectModal(true)
                                      }}
                                      className="cursor-pointer flex items-center gap-2 text-red-600 focus:text-red-600"
                                    >
                                      <XCircle className="w-4 h-4 text-red-500" />
                                      Reject
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

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-4 border-t border-slate-100">
                <p className="text-sm text-slate-600">
                  Showing <span className="font-semibold text-slate-800">{rangeStart}</span>–
                  <span className="font-semibold text-slate-800">{rangeEnd}</span> of{" "}
                  <span className="font-semibold text-slate-800">{total}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <span className="px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg min-w-[90px] text-center">
                    {page} / {pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={page >= pages || loading}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* View details dialog */}
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent className="max-w-md bg-white p-0">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>Withdrawal request details</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="px-6 pb-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Amount</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">
                    {formatCurrency(selectedRequest.amount)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Delivery boy</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">
                    {selectedRequest.deliveryName || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Delivery ID</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">
                    {selectedRequest.deliveryIdString || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Phone</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">
                    {selectedRequest.deliveryPhone || "N/A"}
                  </p>
                </div>
                {selectedRequest.upiId && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <QrCode className="w-4 h-4 text-emerald-600" />
                      <label className="text-xs font-bold text-emerald-800 uppercase">
                        UPI Information
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">{selectedRequest.upiId}</p>
                      {selectedRequest.upiQrCode && (
                        <button
                          onClick={() => window.open(selectedRequest.upiQrCode, "_blank")}
                          className="text-[10px] bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700 transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View QR
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Bank Name</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {selectedRequest.bankDetails?.bankName || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      Account Number
                    </label>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {selectedRequest.bankDetails?.accountNumber || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">IFSC Code</label>
                    <p className="text-sm font-medium text-slate-900 mt-1 uppercase text-emerald-600">
                      {selectedRequest.bankDetails?.ifscCode || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Holder Name</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {selectedRequest.bankDetails?.accountHolderName || "N/A"}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Request time</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">
                    {formatDate(selectedRequest.requestedAt || selectedRequest.createdAt)}
                  </p>
                </div>
                {(selectedRequest.status === "Approved" || selectedRequest.status === "Processed") &&
                  selectedRequest.processedAt && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">
                        Processed at
                      </label>
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        {formatDate(selectedRequest.processedAt)}
                      </p>
                    </div>
                  )}
                {selectedRequest.status === "Rejected" && selectedRequest.processedAt && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Rejected at</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {formatDate(selectedRequest.processedAt)}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                  <p className="mt-1">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                        selectedRequest.status
                      )}`}
                    >
                      {selectedRequest.status}
                    </span>
                  </p>
                </div>
                {selectedRequest.rejectionReason && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      Rejection reason
                    </label>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {selectedRequest.rejectionReason}
                    </p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="px-6 pb-6 flex gap-2 justify-end">
              <button
                onClick={() => setIsViewOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Close
              </button>
              {selectedRequest?.status === "Pending" && (
                <>
                  <button
                    onClick={() => {
                      setIsViewOpen(false)
                      setShowRejectModal(true)
                    }}
                    disabled={processingAction === selectedRequest.id}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(selectedRequest.id)}
                    disabled={processingAction === selectedRequest.id}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center gap-2"
                  >
                    {processingAction === selectedRequest.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Approve
                  </button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject modal */}
        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <DialogContent className="max-w-md bg-white p-0">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>Reject withdrawal request</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rejection reason (optional)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection…"
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
            <DialogFooter className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectionReason("")
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedRequest && handleReject(selectedRequest.id)}
                disabled={processingAction === selectedRequest?.id}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingAction === selectedRequest?.id ? "Rejecting…" : "Reject"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
