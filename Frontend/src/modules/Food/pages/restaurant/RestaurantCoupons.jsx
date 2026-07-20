import { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Tag, Plus, Trash2, Pencil, BarChart3, Pause, Play, MoreVertical, Eye, RotateCw, Search, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import { PanelSurface } from "@food/components/restaurant/panel/panelUi"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"
import { restaurantAPI } from "@food/api"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"

const emptyForm = {
  couponCode: "",
  discountType: "percentage",
  discountValue: "",
  customerScope: "all",
  endDate: "",
  startDate: "",
  minOrderValue: "",
  maxDiscount: "",
  usageLimit: "",
  perUserLimit: "",
  isFirstOrderOnly: false,
}

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "active", label: "Active" },
  { id: "rejected", label: "Rejected" },
  { id: "expired", label: "Expired" },
]

const isOfferExpired = (offer) => {
  if (!offer?.endDate) return false
  return new Date(offer.endDate).getTime() < new Date(new Date().toDateString()).getTime()
}

const statusLabel = (offer) => {
  const approval = offer.approvalStatus || "pending"
  if (approval === "rejected") return "Rejected"
  if (approval === "pending") return "Pending approval"
  if (isOfferExpired(offer)) return "Expired"
  return offer.status || "inactive"
}

const statusClass = (offer) => {
  const approval = offer.approvalStatus || "pending"
  if (approval === "rejected") return "text-red-600"
  if (approval === "pending") return "text-amber-600"
  if (isOfferExpired(offer)) return "text-slate-500"
  if (offer.status === "active") return "text-green-600"
  return "text-slate-600"
}

const formatDate = (value) => {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  const dd = String(d.getDate()).padStart(2, "0")
  const month = d.toLocaleString("en-US", { month: "short" })
  return `${dd} ${month} ${d.getFullYear()}`
}

const discountLabel = (offer) => {
  if (offer.discountType === "flat-price") return `₹${offer.discountValue} OFF`
  const cap = Number(offer.maxDiscount)
  return `${offer.discountValue}% OFF${cap > 0 ? ` (up to ₹${cap})` : ""}`
}

const discountTypeLabel = (offer) => (
  offer.discountType === "flat-price" ? "Flat Amount" : "Percentage"
)

const discountValueLabel = (offer) => (
  offer.discountType === "flat-price" ? `₹${offer.discountValue}` : `${offer.discountValue}%`
)

const customerScopeLabel = (offer) => (
  offer.customerScope === "first-time" || offer.isFirstOrderOnly ? "First-time users" : "All users"
)

const approvalLabel = (offer) => {
  const approval = offer.approvalStatus || "pending"
  if (approval === "approved") return "Approved"
  if (approval === "rejected") return "Rejected"
  return "Pending approval"
}

const toDateInput = (value) => {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export default function RestaurantCoupons() {
  const navigate = useNavigate()
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [editingOfferId, setEditingOfferId] = useState(null)
  const [selectedOffer, setSelectedOffer] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [reapplyingId, setReapplyingId] = useState(null)
  const [formData, setFormData] = useState(emptyForm)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const fetchOffers = useCallback(async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getMyOffers()
      if (response?.data?.success) {
        setOffers(response.data.data.offers || [])
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load coupons")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOffers()
  }, [fetchOffers])

  const handleFormChange = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (field === "customerScope" && value === "first-time") {
        next.perUserLimit = prev.perUserLimit || "1"
        next.isFirstOrderOnly = true
      }
      if (field === "customerScope" && value === "all") {
        next.isFirstOrderOnly = false
      }
      return next
    })
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingOfferId(null)
    setFormData(emptyForm)
  }

  const openCreateForm = () => {
    setEditingOfferId(null)
    setFormData(emptyForm)
    setFormOpen(true)
  }

  const handleEdit = (offer) => {
    setEditingOfferId(offer.offerId)
    setFormData({
      couponCode: offer.couponCode || "",
      discountType: offer.discountType || "percentage",
      discountValue: offer.discountValue != null ? String(offer.discountValue) : "",
      customerScope: offer.customerScope || "all",
      endDate: toDateInput(offer.endDate),
      startDate: toDateInput(offer.startDate),
      minOrderValue: offer.minOrderValue != null ? String(offer.minOrderValue) : "",
      maxDiscount: offer.maxDiscount != null ? String(offer.maxDiscount) : "",
      usageLimit: offer.usageLimit != null ? String(offer.usageLimit) : "",
      perUserLimit: offer.perUserLimit != null ? String(offer.perUserLimit) : "",
      isFirstOrderOnly: Boolean(offer.isFirstOrderOnly),
    })
    setFormOpen(true)
  }

  const buildPayload = () => {
    const isFirstTime = formData.customerScope === "first-time"
    return {
      couponCode: formData.couponCode.trim(),
      discountType: formData.discountType,
      discountValue: Number(formData.discountValue),
      customerScope: formData.customerScope,
      minOrderValue: formData.minOrderValue ? Number(formData.minOrderValue) : 0,
      maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : undefined,
      usageLimit: formData.usageLimit !== "" ? Number(formData.usageLimit) : undefined,
      perUserLimit: formData.perUserLimit !== ""
        ? Number(formData.perUserLimit)
        : (isFirstTime ? 1 : undefined),
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
      isFirstOrderOnly: isFirstTime || formData.isFirstOrderOnly,
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.couponCode.trim()) {
      toast.error("Coupon code is required")
      return
    }
    if (!formData.discountValue || Number(formData.discountValue) <= 0) {
      toast.error("Enter a valid discount value")
      return
    }
    if (formData.discountType === "percentage" && !formData.maxDiscount) {
      toast.error("Max discount is required for percentage coupons")
      return
    }

    try {
      setIsSubmitting(true)
      const body = buildPayload()
      const response = editingOfferId
        ? await restaurantAPI.updateMyOffer(editingOfferId, body)
        : await restaurantAPI.createMyOffer(body)

      if (response?.data?.success) {
        toast.success(
          editingOfferId
            ? "Coupon updated and sent for admin approval"
            : "Coupon created and sent for admin approval",
        )
        closeForm()
        fetchOffers()
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || `Failed to ${editingOfferId ? "update" : "create"} coupon`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (offer) => {
    const nextStatus = offer.status === "active" ? "paused" : "active"
    try {
      await restaurantAPI.updateMyOffer(offer.offerId, { status: nextStatus })
      toast.success(nextStatus === "active" ? "Coupon activated" : "Coupon paused")
      fetchOffers()
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update status")
    }
  }

  const handleDelete = async (offerId) => {
    if (!offerId) return
    try {
      setDeletingId(offerId)
      await restaurantAPI.deleteMyOffer(offerId)
      toast.success("Coupon deleted")
      if (editingOfferId === offerId) closeForm()
      fetchOffers()
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete coupon")
    } finally {
      setDeletingId(null)
    }
  }

  const handleReapply = async (offerId) => {
    if (!offerId) return
    try {
      setReapplyingId(offerId)
      await restaurantAPI.reapplyMyOffer(offerId)
      toast.success("Coupon resubmitted for approval")
      fetchOffers()
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to resubmit coupon")
    } finally {
      setReapplyingId(null)
    }
  }

  const filteredOffers = useMemo(() => {
    let list = offers
    if (activeTab === "pending") list = list.filter((o) => (o.approvalStatus || "pending") === "pending")
    else if (activeTab === "active") list = list.filter((o) => o.approvalStatus === "approved" && o.status === "active" && !isOfferExpired(o))
    else if (activeTab === "rejected") list = list.filter((o) => o.approvalStatus === "rejected")
    else if (activeTab === "expired") list = list.filter((o) => isOfferExpired(o))

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((o) => o.couponCode?.toLowerCase().includes(q))
    }
    return list
  }, [offers, activeTab, searchQuery])

  const tabCounts = useMemo(() => ({
    pending: offers.filter((o) => (o.approvalStatus || "pending") === "pending").length,
    rejected: offers.filter((o) => o.approvalStatus === "rejected").length,
  }), [offers])

  return (
    <RestaurantSubPageShell
      title="Coupons & Offers"
      subtitle="Create offers for your outlet. Discount is deducted from your payout."
      backTo={`${RESTAURANT_BASE}/explore`}
      headerRight={
        <button
          type="button"
          onClick={fetchOffers}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
        >
          <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      <PanelSurface className="mb-4 flex items-start gap-3 border-amber-100 bg-amber-50 p-4">
        <Tag className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <p className="text-sm text-amber-900">
          Coupons you create apply only to your restaurant. For orders with items from two restaurants, only admin coupons can be used.
        </p>
      </PanelSurface>

      <div className="mb-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={fetchOffers}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--rt-primary-strong)] px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          Create coupon
        </button>
      </div>

      <PanelSurface className="mb-4 overflow-hidden p-0">
        <div className="border-b border-slate-100 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
                {tab.id === "pending" && tabCounts.pending > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{tabCounts.pending}</span>
                )}
                {tab.id === "rejected" && tabCounts.rejected > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[10px] text-white">{tabCounts.rejected}</span>
                )}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by coupon code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </PanelSurface>

      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) closeForm() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>{editingOfferId ? "Edit coupon" : "Create coupon"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Coupon code</label>
                <input
                  type="text"
                  value={formData.couponCode}
                  onChange={(e) => handleFormChange("couponCode", e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. SAVE50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Discount type</label>
                <select
                  value={formData.discountType}
                  onChange={(e) => handleFormChange("discountType", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="percentage">Percentage</option>
                  <option value="flat-price">Flat amount</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  {formData.discountType === "percentage" ? "Discount (%)" : "Discount (₹)"}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.discountValue}
                  onChange={(e) => handleFormChange("discountValue", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {formData.discountType === "percentage" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Max discount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxDiscount}
                    onChange={(e) => handleFormChange("maxDiscount", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Min order (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.minOrderValue}
                  onChange={(e) => handleFormChange("minOrderValue", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Usage limit</label>
                <input
                  type="number"
                  min="0"
                  value={formData.usageLimit}
                  onChange={(e) => handleFormChange("usageLimit", e.target.value)}
                  placeholder="Unlimited"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Per user limit</label>
                <input
                  type="number"
                  min="0"
                  value={formData.perUserLimit}
                  onChange={(e) => handleFormChange("perUserLimit", e.target.value)}
                  placeholder={formData.customerScope === "first-time" ? "1" : "Unlimited"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Customer scope</label>
                <select
                  value={formData.customerScope}
                  onChange={(e) => handleFormChange("customerScope", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="all">All users</option>
                  <option value="first-time">First-time users</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Start date (optional)</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleFormChange("startDate", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">End date (optional)</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleFormChange("endDate", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : editingOfferId ? "Update coupon" : "Create coupon"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="font-mono">{selectedOffer?.couponCode || "Coupon details"}</DialogTitle>
          </DialogHeader>
          {selectedOffer && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["Coupon Code", selectedOffer.couponCode],
                ["Discount Type", discountTypeLabel(selectedOffer)],
                ["Discount Value", discountValueLabel(selectedOffer)],
                ["Max Discount", selectedOffer.discountType === "percentage" && Number(selectedOffer.maxDiscount) > 0 ? `₹${selectedOffer.maxDiscount}` : "—"],
                ["Discount Summary", discountLabel(selectedOffer)],
                ["Min Order", Number(selectedOffer.minOrderValue) > 0 ? `₹${selectedOffer.minOrderValue}` : "None"],
                ["Customer Scope", customerScopeLabel(selectedOffer)],
                ["Usage", `${selectedOffer.usedCount || 0} / ${Number(selectedOffer.usageLimit) > 0 ? selectedOffer.usageLimit : "∞"}`],
                ["Per User Limit", Number(selectedOffer.perUserLimit) > 0 ? selectedOffer.perUserLimit : "Unlimited"],
                ["Start Date", formatDate(selectedOffer.startDate)],
                ["End Date", formatDate(selectedOffer.endDate)],
                ["Approval", approvalLabel(selectedOffer)],
                ["Status", statusLabel(selectedOffer)],
              ].map(([label, value]) => (
                <div key={label} className="bg-slate-50 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-slate-500 font-medium">{label}</p>
                  <p className={`text-sm font-semibold mt-0.5 capitalize ${label === "Status" ? statusClass(selectedOffer) : "text-slate-900"}`}>{value}</p>
                </div>
              ))}
              {selectedOffer.status === "paused" && selectedOffer.pausedBy && (
                <div className="bg-slate-50 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-slate-500 font-medium">Paused By</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{selectedOffer.pausedBy === "admin" ? "Admin" : "Restaurant"}</p>
                </div>
              )}
              {selectedOffer.approvalStatus === "rejected" && selectedOffer.rejectionReason && (
                <div className="sm:col-span-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                  <p className="text-xs font-medium text-red-700">Rejection reason</p>
                  <p className="text-sm text-red-800 mt-1">{selectedOffer.rejectionReason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PanelSurface className="overflow-hidden p-0">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Loading coupons...</p>
        ) : filteredOffers.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            {searchQuery || activeTab !== "all" ? "No coupons match your filters." : "No coupons yet. Create one to attract more orders."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Code", "Discount", "Usage", "Status", "Active/Paused", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOffers.map((offer) => {
                  const isAdminPaused = offer.status === "paused" && offer.pausedBy === "admin"
                  return (
                  <tr key={offer.offerId}>
                    <td className="px-4 py-3 font-mono text-sm">{offer.couponCode}</td>
                    <td className="px-4 py-3 text-sm">{discountLabel(offer)}{Number(offer.minOrderValue) > 0 ? ` · Min ₹${offer.minOrderValue}` : ""}</td>
                    <td className="px-4 py-3 text-sm">{offer.usedCount || 0}{offer.usageLimit ? ` / ${offer.usageLimit}` : ""}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`font-medium capitalize ${statusClass(offer)}`}>{statusLabel(offer)}</span>
                      {offer.approvalStatus === "rejected" && offer.rejectionReason && (
                        <p className="mt-1 max-w-[200px] truncate text-[11px] text-red-600" title={offer.rejectionReason}>
                          {offer.rejectionReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {offer.approvalStatus === "approved" && !isOfferExpired(offer) ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            offer.status === "active"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {offer.status === "active" ? "Active" : offer.pausedBy === "admin" ? "Paused by admin" : "Paused"}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="p-1.5 rounded-lg hover:bg-slate-100"><MoreVertical className="w-4 h-4 text-slate-600" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => { setSelectedOffer(offer); setViewOpen(true) }}><Eye className="w-4 h-4 mr-2" />View</DropdownMenuItem>
                          {!isAdminPaused && (
                            <DropdownMenuItem onClick={() => handleEdit(offer)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => navigate(`/food/restaurant/coupons/${offer.offerId}/analytics`)}><BarChart3 className="w-4 h-4 mr-2" />Analytics</DropdownMenuItem>
                          {offer.approvalStatus === "rejected" && (
                            <DropdownMenuItem
                              onClick={() => handleReapply(offer.offerId)}
                              disabled={reapplyingId === offer.offerId}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              {reapplyingId === offer.offerId ? "Resubmitting..." : "Reapply for approval"}
                            </DropdownMenuItem>
                          )}
                          {offer.approvalStatus === "approved" && (
                            isAdminPaused ? (
                              <DropdownMenuItem disabled className="text-amber-700 opacity-100">
                                <Pause className="w-4 h-4 mr-2" />
                                Paused by admin
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleToggleStatus(offer)}>
                                {offer.status === "active" ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                                {offer.status === "active" ? "Pause" : "Resume"}
                              </DropdownMenuItem>
                            )
                          )}
                          {!isAdminPaused && (
                          <DropdownMenuItem
                            onClick={() => handleDelete(offer.offerId)}
                            disabled={deletingId === offer.offerId}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />Delete
                          </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </PanelSurface>
    </RestaurantSubPageShell>
  )
}
