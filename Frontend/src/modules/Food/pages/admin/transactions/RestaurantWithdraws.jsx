import { useState, useMemo, useEffect } from "react"
import {
  Search,
  Download,
  ChevronDown,
  Eye,
  Settings,
  Building,
  FileSpreadsheet,
  Code,
  CheckCircle,
  XCircle,
  Loader2,
  MoreVertical,
  Clock,
  Wallet,
  IndianRupee,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { exportTransactionsToExcel, exportTransactionsToPDF } from "@food/components/admin/transactions/transactionsExportUtils"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

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

export default function RestaurantWithdraws() {
  const [activeTab, setActiveTab] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [withdraws, setWithdraws] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedWithdraw, setSelectedWithdraw] = useState(null)
  const [processingAction, setProcessingAction] = useState(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectModal, setShowRejectModal] = useState(false)
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
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    amount: true,
    restaurant: true,
    restaurantId: true,
    requestTime: true,
    status: true,
    actions: true,
  })

  useEffect(() => {
    fetchWithdrawals()
  }, [activeTab])

  const fetchWithdrawals = async () => {
    try {
      setLoading(true)
      const status = activeTab === "All" ? undefined : activeTab
      const response = await adminAPI.getWithdrawalRequests({ status, search: searchQuery || undefined })
      if (response.data?.success) {
        const data = response.data.data || {}
        setWithdraws(data.requests || [])
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
        toast.error("Failed to fetch withdrawal requests")
      }
    } catch (error) {
      toast.error("Failed to fetch withdrawal requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWithdrawals()
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const filteredWithdraws = useMemo(() => {
    let result = [...withdraws]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(
        (w) =>
          w.restaurantName?.toLowerCase().includes(query) ||
          w.restaurantIdString?.toLowerCase().includes(query) ||
          w.amount?.toString().includes(query)
      )
    }

    return result
  }, [withdraws, searchQuery])

  const getStatusBadge = (status) => {
    if (status === "Approved") return "bg-green-100 text-green-700"
    if (status === "Pending") return "bg-amber-100 text-amber-700"
    if (status === "Rejected") return "bg-red-100 text-red-700"
    return "bg-slate-100 text-slate-700"
  }

  const handleViewWithdraw = (withdraw) => {
    setSelectedWithdraw(withdraw)
    setIsViewOpen(true)
  }

  const handleApprove = async (id) => {
    if (!confirm("Are you sure you want to approve this withdrawal request?")) {
      return
    }

    try {
      setProcessingAction(id)
      const response = await adminAPI.approveWithdrawalRequest(id)
      if (response.data?.success) {
        toast.success("Withdrawal request approved successfully")
        setIsViewOpen(false)
        fetchWithdrawals()
      } else {
        toast.error(response.data?.message || "Failed to approve withdrawal request")
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to approve withdrawal request")
    } finally {
      setProcessingAction(null)
    }
  }

  const handleReject = async (id) => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason")
      return
    }

    try {
      setProcessingAction(id)
      const response = await adminAPI.rejectWithdrawalRequest(id, rejectionReason)
      if (response.data?.success) {
        toast.success("Withdrawal request rejected successfully")
        setShowRejectModal(false)
        setRejectionReason("")
        setIsViewOpen(false)
        fetchWithdrawals()
      } else {
        toast.error(response.data?.message || "Failed to reject withdrawal request")
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
      const date = new Date(dateString)
      return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    } catch {
      return dateString
    }
  }

  const formatCurrency = (amount) => {
    if (amount == null || amount === "") return "₹0.00"
    return `₹${parseFloat(amount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const getSafeQrUrl = (value) => {
    if (!value) return ""
    if (typeof value === "string") return value
    if (typeof value === "object" && typeof value.url === "string") return value.url
    return ""
  }

  const handleExport = async (format) => {
    if (filteredWithdraws.length === 0) {
      toast.error("No data to export.")
      return
    }
    const headers = [
      { key: "sl", label: "SI" },
      { key: "amount", label: "Amount" },
      { key: "restaurantName", label: "Restaurant Name" },
      { key: "restaurantIdString", label: "Restaurant ID" },
      { key: "requestTime", label: "Request Time" },
      { key: "processedTime", label: "Approved/Rejected Time" },
      { key: "processedBy", label: "Processed By" },
      { key: "status", label: "Status" },
      { key: "rejectionReason", label: "Rejection Reason" },
    ]
    const exportData = filteredWithdraws.map((w, index) => ({
      sl: index + 1,
      amount: formatCurrency(w.amount),
      restaurantName: w.restaurantName || "N/A",
      restaurantIdString: w.restaurantIdString || "N/A",
      requestTime: formatDate(w.requestedAt || w.createdAt),
      processedTime: w.processedAt ? formatDate(w.processedAt) : "",
      processedBy: w.processedBy?.name
        ? `${w.processedBy.name}${w.processedBy.email ? ` (${w.processedBy.email})` : ""}`
        : "",
      status: w.status,
      rejectionReason: w.rejectionReason || "",
    }))
    switch (format) {
      case "excel":
        exportTransactionsToExcel(exportData, headers, "restaurant_withdraws_full_details")
        break
      case "pdf":
        await exportTransactionsToPDF(
          exportData,
          headers,
          "restaurant_withdraws_full_details",
          "Restaurant Withdraws Report"
        )
        break
      default:
        break
    }
  }

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      amount: true,
      restaurant: true,
      restaurantId: true,
      requestTime: true,
      status: true,
      actions: true,
    })
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-100">
                <Building className="w-5 h-5 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Restaurant Withdrawals</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1.5 sm:ml-12">
              Review and process restaurant payout withdrawal requests.
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

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="relative flex-1 sm:max-w-xs">
                <input
                  type="text"
                  placeholder="Search by restaurant name or ID"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="px-3 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all">
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Export</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50"
                  >
                    <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleExport("excel")}
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleExport("pdf")}
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <Code className="w-4 h-4" /> PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
                  title="Table Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-slate-600">Loading withdrawal requests...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {visibleColumns.si && (
                      <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        SI
                      </th>
                    )}
                    {visibleColumns.amount && (
                      <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Amount
                      </th>
                    )}
                    {visibleColumns.restaurant && (
                      <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Restaurant
                      </th>
                    )}
                    {visibleColumns.restaurantId && (
                      <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Restaurant ID
                      </th>
                    )}
                    {visibleColumns.requestTime && (
                      <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Request Time
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                    )}
                    {visibleColumns.actions && (
                      <th className="px-6 py-3.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredWithdraws.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Object.values(visibleColumns).filter(Boolean).length}
                        className="px-6 py-20 text-center"
                      >
                        <div className="flex flex-col items-center justify-center">
                          <Building className="w-14 h-14 text-slate-300 mb-3" />
                          <p className="text-lg font-semibold text-slate-700">No Data Found</p>
                          <p className="text-sm text-slate-500">No withdraw requests match your filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredWithdraws.map((withdraw, index) => (
                      <tr key={withdraw.id} className="hover:bg-slate-50/80 transition-colors">
                        {visibleColumns.si && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {index + 1}
                          </td>
                        )}
                        {visibleColumns.amount && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-semibold text-slate-900 inline-flex items-center gap-1">
                              <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                              {Number(withdraw.amount || 0).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </td>
                        )}
                        {visibleColumns.restaurant && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                            {withdraw.restaurantName || "N/A"}
                          </td>
                        )}
                        {visibleColumns.restaurantId && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">
                            {withdraw.restaurantIdString || "N/A"}
                          </td>
                        )}
                        {visibleColumns.requestTime && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {formatDate(withdraw.requestedAt || withdraw.createdAt)}
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                                withdraw.status
                              )}`}
                            >
                              {withdraw.status}
                            </span>
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  disabled={processingAction === withdraw.id}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                                >
                                  {processingAction === withdraw.id ? (
                                    <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                                  ) : (
                                    <MoreVertical className="w-4 h-4 text-slate-600" />
                                  )}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-50"
                              >
                                <DropdownMenuItem
                                  onClick={() => handleViewWithdraw(withdraw)}
                                  className="cursor-pointer flex items-center gap-2"
                                >
                                  <Eye className="w-4 h-4 text-slate-500" />
                                  View Details
                                </DropdownMenuItem>
                                {withdraw.status === "Pending" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleApprove(withdraw.id)}
                                      className="cursor-pointer flex items-center gap-2 text-green-700 focus:text-green-700"
                                    >
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                      Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedWithdraw(withdraw)
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
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* View Withdraw Dialog */}
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent className="max-w-md bg-white p-0">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>Withdraw Request Details</DialogTitle>
            </DialogHeader>
            {selectedWithdraw && (
              <div className="px-6 pb-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Amount</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">
                    {formatCurrency(selectedWithdraw.amount)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Restaurant Name</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">
                    {selectedWithdraw.restaurantName || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Restaurant ID</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">
                    {selectedWithdraw.restaurantIdString || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Request Time</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">
                    {formatDate(selectedWithdraw.requestedAt || selectedWithdraw.createdAt)}
                  </p>
                </div>
                {(selectedWithdraw.status === "Approved" || selectedWithdraw.status === "Processed") &&
                  selectedWithdraw.processedAt && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Approved Time</label>
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        {formatDate(selectedWithdraw.processedAt)}
                      </p>
                    </div>
                  )}
                {selectedWithdraw.status === "Rejected" && selectedWithdraw.processedAt && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Rejected Time</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {formatDate(selectedWithdraw.processedAt)}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                  <p className="mt-1">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                        selectedWithdraw.status
                      )}`}
                    >
                      {selectedWithdraw.status}
                    </span>
                  </p>
                </div>
                <div className="border-t border-slate-200 pt-4">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Bank Details</label>
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-slate-800">
                      <span className="font-semibold">Account Holder:</span>{" "}
                      {selectedWithdraw.restaurantBankDetails?.accountHolderName ||
                        selectedWithdraw.restaurantId?.accountHolderName ||
                        "N/A"}
                    </p>
                    <p className="text-sm text-slate-800">
                      <span className="font-semibold">Account Number:</span>{" "}
                      {selectedWithdraw.restaurantBankDetails?.accountNumber ||
                        selectedWithdraw.restaurantId?.accountNumber ||
                        "N/A"}
                    </p>
                    <p className="text-sm text-slate-800">
                      <span className="font-semibold">IFSC:</span>{" "}
                      {selectedWithdraw.restaurantBankDetails?.ifscCode ||
                        selectedWithdraw.restaurantId?.ifscCode ||
                        "N/A"}
                    </p>
                    <p className="text-sm text-slate-800">
                      <span className="font-semibold">Account Type:</span>{" "}
                      {selectedWithdraw.restaurantBankDetails?.accountType ||
                        selectedWithdraw.restaurantId?.accountType ||
                        "N/A"}
                    </p>
                    <p className="text-sm text-slate-800">
                      <span className="font-semibold">UPI ID:</span>{" "}
                      {selectedWithdraw.restaurantBankDetails?.upiId ||
                        selectedWithdraw.restaurantId?.upiId ||
                        "N/A"}
                    </p>
                    {getSafeQrUrl(
                      selectedWithdraw.restaurantBankDetails?.upiQrImage ||
                        selectedWithdraw.restaurantId?.upiQrImage
                    ) ? (
                      <div>
                        <p className="text-sm text-slate-800 font-semibold mb-2">UPI QR</p>
                        <img
                          src={getSafeQrUrl(
                            selectedWithdraw.restaurantBankDetails?.upiQrImage ||
                              selectedWithdraw.restaurantId?.upiQrImage
                          )}
                          alt="Restaurant UPI QR"
                          className="w-32 h-32 object-contain border border-slate-200 rounded-md bg-white"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
                {selectedWithdraw.rejectionReason && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      Rejection Reason
                    </label>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {selectedWithdraw.rejectionReason}
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
              {selectedWithdraw?.status === "Pending" && (
                <>
                  <button
                    onClick={() => {
                      setIsViewOpen(false)
                      setShowRejectModal(true)
                    }}
                    disabled={processingAction === selectedWithdraw.id}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(selectedWithdraw.id)}
                    disabled={processingAction === selectedWithdraw.id}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-2"
                  >
                    {processingAction === selectedWithdraw.id ? (
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

        {/* Reject Modal */}
        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <DialogContent className="max-w-md bg-white p-0">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>Reject Withdrawal Request</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            <DialogFooter className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectionReason("")
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedWithdraw && handleReject(selectedWithdraw.id)}
                disabled={!rejectionReason.trim() || processingAction === selectedWithdraw?.id}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingAction === selectedWithdraw?.id ? "Rejecting..." : "Reject"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-md bg-white p-0">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Table Settings
              </DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Toggle Columns</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(visibleColumns).map(([key, isVisible]) => (
                    <div key={key} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`toggle-${key}`}
                        checked={isVisible}
                        onChange={() => toggleColumn(key)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={`toggle-${key}`} className="ml-2 text-sm text-slate-700 capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="px-6 pb-6 flex justify-between">
              <button
                onClick={resetColumns}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset Columns
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all"
              >
                Apply
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
