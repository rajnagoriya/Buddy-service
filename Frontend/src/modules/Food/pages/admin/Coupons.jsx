import { useState, useEffect, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  Search, Plus, MoreVertical, Eye, Pencil, Trash2, CheckCircle, XCircle,
  Tag, Clock, TrendingUp, Ticket, RotateCw,
} from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu"

const toDateInput = (value) => {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const formatDate = (value) => {
  if (!value) return "No expiry"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  const dd = String(d.getDate()).padStart(2, "0")
  const month = d.toLocaleString("en-US", { month: "short" })
  return `${dd} ${month} ${d.getFullYear()}`
}

const emptyForm = {
  couponCode: "",
  couponCategory: "normal",
  discountType: "percentage",
  discountValue: "",
  customerScope: "all",
  restaurantScope: "all",
  restaurantId: "",
  endDate: "",
  startDate: "",
  minOrderValue: "",
  maxDiscount: "",
  usageLimit: "",
  perUserLimit: "",
}

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "active", label: "Active" },
  { id: "expired", label: "Expired" },
  { id: "rejected", label: "Rejected" },
]

const approvalBadge = (status) => {
  const map = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-green-100 text-green-700 border-green-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  }
  return map[status] || "bg-slate-100 text-slate-600 border-slate-200"
}

const isOfferExpired = (offer) => {
  if (!offer?.endDate) return false
  return new Date(offer.endDate).getTime() < new Date(new Date().toDateString()).getTime()
}

const discountLabel = (offer) => {
  if (offer.couponCategory === "free_delivery") return "FREE DELIVERY"
  if (offer.discountType === "flat-price") {
    return `₹${offer.discountValue ?? offer.originalPrice ?? 0} OFF`
  }
  const pct = offer.discountValue ?? offer.discountPercentage ?? 0
  const cap = Number(offer.maxDiscount)
  return `${pct}% OFF${cap ? ` (up to ₹${cap})` : ""}`
}

const customerScopeLabel = (offer) => {
  if (offer.customerScope === "first-time" || offer.customerGroup === "new") return "First-time Users"
  return "All Users"
}

const couponTypeLabel = (offer) => {
  if (offer.couponCategory === "free_delivery") return "Free Delivery"
  return "Normal Coupon"
}

const discountTypeLabel = (offer) => {
  if (offer.couponCategory === "free_delivery") return "—"
  return offer.discountType === "flat-price" ? "Flat Amount" : "Percentage"
}

const discountValueLabel = (offer) => {
  if (offer.couponCategory === "free_delivery") return "—"
  if (offer.discountType === "flat-price") {
    return `₹${offer.discountValue ?? offer.originalPrice ?? 0}`
  }
  return `${offer.discountValue ?? offer.discountPercentage ?? 0}%`
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
      </div>
    </div>
  )
}

function CouponForm({ formData, errors, restaurants, onChange, onSubmit, isSubmitting, editing, restaurantCouponEdit = false }) {
  const todayYMD = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }
  const ro = (field) => restaurantCouponEdit && field !== "couponCode"
  const isFreeDelivery = formData.couponCategory === "free_delivery"

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {restaurantCouponEdit && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Restaurant coupon: only Coupon Code can be edited by admin.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Coupon Code *</label>
          <input
            type="text"
            value={formData.couponCode}
            onChange={(e) => onChange("couponCode", e.target.value.toUpperCase())}
            placeholder="e.g. NEWUSER50"
            disabled={ro("couponCode")}
            className={`w-full px-3 py-2 text-sm rounded-lg border ${errors.couponCode ? "border-red-500" : "border-slate-300"} focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100`}
          />
          {errors.couponCode && <p className="mt-1 text-xs text-red-600">{errors.couponCode}</p>}
        </div>

        {!restaurantCouponEdit && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Coupon Type</label>
            <select
              value={formData.couponCategory}
              onChange={(e) => onChange("couponCategory", e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="normal">Normal Coupon</option>
              <option value="free_delivery">Free Delivery (Admin bears cost)</option>
            </select>
          </div>
        )}

        {!isFreeDelivery && (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Discount Type</label>
          <select
            value={formData.discountType}
            onChange={(e) => onChange("discountType", e.target.value)}
            disabled={ro("discountType")}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
          >
            <option value="percentage">Percentage</option>
            <option value="flat-price">Flat Amount</option>
          </select>
        </div>
        )}

        {!isFreeDelivery && (
        <>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            {formData.discountType === "percentage" ? "Discount (%)" : "Discount Amount (₹)"} *
          </label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={formData.discountValue}
            onChange={(e) => onChange("discountValue", e.target.value)}
            disabled={ro("discountValue")}
            className={`w-full px-3 py-2 text-sm rounded-lg border ${errors.discountValue ? "border-red-500" : "border-slate-300"} focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100`}
          />
          {errors.discountValue && <p className="mt-1 text-xs text-red-600">{errors.discountValue}</p>}
        </div>

        {formData.discountType === "percentage" && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Max Discount (₹) *</label>
            <input
              type="number"
              min="0"
              value={formData.maxDiscount}
              onChange={(e) => onChange("maxDiscount", e.target.value)}
              placeholder="e.g. 100"
              disabled={ro("maxDiscount")}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${errors.maxDiscount ? "border-red-500" : "border-slate-300"} focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100`}
            />
            {errors.maxDiscount && <p className="mt-1 text-xs text-red-600">{errors.maxDiscount}</p>}
          </div>
        )}
        </>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Min Order (₹)</label>
          <input
            type="number"
            min="0"
            value={formData.minOrderValue}
            onChange={(e) => onChange("minOrderValue", e.target.value)}
            placeholder="e.g. 199"
            disabled={ro("minOrderValue")}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Customer Scope</label>
          <select
            value={formData.customerScope}
            onChange={(e) => onChange("customerScope", e.target.value)}
            disabled={ro("customerScope")}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
          >
            <option value="all">All Users</option>
            <option value="first-time">First-time Users</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Restaurant Scope</label>
          <select
            value={formData.restaurantScope}
            onChange={(e) => onChange("restaurantScope", e.target.value)}
            disabled={ro("restaurantScope")}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
          >
            <option value="all">All Restaurants</option>
            <option value="selected">Selected Restaurant</option>
          </select>
        </div>

        {formData.restaurantScope === "selected" && (
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Restaurant *</label>
            <select
              value={formData.restaurantId}
              onChange={(e) => onChange("restaurantId", e.target.value)}
              disabled={ro("restaurantId")}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
            >
              <option value="">Choose a restaurant</option>
              {restaurants.map((r) => (
                <option key={r._id} value={r._id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => onChange("startDate", e.target.value)}
            min={todayYMD()}
            disabled={ro("startDate")}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date</label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => onChange("endDate", e.target.value)}
            min={formData.startDate || todayYMD()}
            disabled={ro("endDate")}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Usage Limit</label>
          <input
            type="number"
            min="0"
            value={formData.usageLimit}
            onChange={(e) => onChange("usageLimit", e.target.value)}
            placeholder="Unlimited"
            disabled={ro("usageLimit")}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Per User Limit</label>
          <input
            type="number"
            min="0"
            value={formData.perUserLimit}
            onChange={(e) => onChange("perUserLimit", e.target.value)}
            placeholder="Unlimited"
            disabled={ro("perUserLimit")}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
          />
        </div>
      </div>

      {!editing && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          New coupons require admin approval before they appear to users.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting || Object.keys(errors).length > 0}>
          {isSubmitting ? "Saving..." : editing ? "Update Coupon" : "Create Coupon"}
        </Button>
      </div>
    </form>
  )
}

function ViewDetails({ offer }) {
  const rows = [
    ["Coupon Code", offer.couponCode],
    ["Coupon Type", couponTypeLabel(offer)],
    ["Discount Type", discountTypeLabel(offer)],
    ["Discount Value", discountValueLabel(offer)],
    ["Max Discount", offer.couponCategory === "free_delivery" || offer.discountType !== "percentage"
      ? "—"
      : (Number(offer.maxDiscount) > 0 ? `₹${offer.maxDiscount}` : "None")],
    ["Discount Summary", discountLabel(offer)],
    ["Restaurant Scope", offer.restaurantScope === "all" ? "All Restaurants" : "Selected Restaurant"],
    ["Restaurant", offer.restaurantScope === "all" ? "All Restaurants" : (offer.restaurantName || "—")],
    ["Customer Scope", customerScopeLabel(offer)],
    ["Min Order", Number(offer.minOrderValue) ? `₹${offer.minOrderValue}` : "None"],
    ["Usage", `${Number(offer.usedCount || 0)} / ${Number(offer.usageLimit) > 0 ? offer.usageLimit : "∞"}`],
    ["Per User Limit", Number(offer.perUserLimit) > 0 ? offer.perUserLimit : "Unlimited"],
    ["Start Date", formatDate(offer.startDate)],
    ["Expiry Date", formatDate(offer.endDate)],
    ["Approval", offer.approvalStatus || "—"],
    ["Status", isOfferExpired(offer) ? "expired" : (offer.status || "inactive")],
    ["Created By", offer.createdBy === "restaurant" ? "Restaurant" : "Admin"],
  ]
  if (offer.status === "paused" && offer.pausedBy) {
    rows.push(["Paused By", offer.pausedBy === "admin" ? "Admin" : "Restaurant"])
  }
  if (offer.approvalStatus === "rejected" && offer.rejectionReason) {
    rows.push(["Rejection Reason", offer.rejectionReason])
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rows.map(([label, value]) => (
        <div key={label} className="bg-slate-50 rounded-lg px-3 py-2.5">
          <p className="text-xs text-slate-500 font-medium">{label}</p>
          <p className="text-sm font-semibold text-slate-900 capitalize mt-0.5">{value}</p>
        </div>
      ))}
    </div>
  )
}

export default function Coupons() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [offers, setOffers] = useState([])
  const [stats, setStats] = useState({ total: 0, pending: 0, active: 0, totalRedemptions: 0 })
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState(null)
  const [editingOfferId, setEditingOfferId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState({})
  const [errors, setErrors] = useState({})
  const [formData, setFormData] = useState(emptyForm)
  const [editingRestaurantCoupon, setEditingRestaurantCoupon] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectOfferId, setRejectOfferId] = useState(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  const fetchOffers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminAPI.getAllOffers({})
      if (response?.data?.success) {
        setOffers(response.data.data.offers || [])
        setStats(response.data.data.stats || { total: 0, pending: 0, active: 0, totalRedemptions: 0 })
      } else {
        setError("Failed to fetch coupons")
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to fetch coupons")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOffers() }, [fetchOffers])

  useEffect(() => {
    adminAPI.getRestaurants({ page: 1, limit: 200 }).then((response) => {
      if (response?.data?.success) {
        const list = response?.data?.data?.restaurants || []
        setRestaurants(list.map((r) => ({ ...r, name: r?.name || r?.restaurantName || "" })))
      }
    }).catch(() => {})
  }, [])

  const validateForm = (draft) => {
    const e = {}
    const f = draft || formData
    if (!String(f.couponCode || "").trim()) e.couponCode = "Required"
    if (f.couponCategory !== "free_delivery") {
      const value = Number(f.discountValue)
      if (!Number.isFinite(value) || value <= 0) e.discountValue = "Must be > 0"
      if (f.discountType === "percentage" && !f.maxDiscount) e.maxDiscount = "Required for %"
    }
    if (f.restaurantScope === "selected" && !f.restaurantId) e.restaurantId = "Select restaurant"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleFormChange = (field, value) => {
    const next = { ...formData, [field]: value }
    if (field === "discountType" && value === "flat-price") next.maxDiscount = ""
    if (field === "customerScope" && value === "first-time" && !next.perUserLimit) {
      next.perUserLimit = "1"
    }
    setFormData(next)
    validateForm(next)
  }

  const resetForm = () => {
    setEditingOfferId(null)
    setEditingRestaurantCoupon(false)
    setFormData(emptyForm)
    setErrors({})
  }

  const openCreate = () => {
    resetForm()
    setFormDialogOpen(true)
  }

  const openEdit = (offer) => {
    setEditingOfferId(offer.offerId)
    setEditingRestaurantCoupon(offer.createdBy === "restaurant")
    const isPct = offer.discountType === "percentage"
    const rawDiscount = offer.couponCategory === "free_delivery"
      ? ""
      : isPct
        ? String(offer.discountValue ?? offer.discountPercentage ?? "")
        : String(offer.discountValue ?? offer.originalPrice ?? "")
    setFormData({
      couponCode: offer.couponCode || "",
      couponCategory: offer.couponCategory || "normal",
      discountType: offer.couponCategory === "free_delivery" ? "percentage" : (offer.discountType || "percentage"),
      discountValue: rawDiscount,
      customerScope: offer.customerScope === "first-time" || offer.customerGroup === "new" ? "first-time" : "all",
      restaurantScope: offer.restaurantScope || "all",
      restaurantId: offer.restaurantId || "",
      endDate: toDateInput(offer.endDate),
      startDate: toDateInput(offer.startDate),
      minOrderValue: offer.minOrderValue != null ? String(offer.minOrderValue) : "",
      maxDiscount: offer.maxDiscount != null && offer.maxDiscount !== "" ? String(offer.maxDiscount) : "",
      usageLimit: offer.usageLimit != null ? String(offer.usageLimit) : "",
      perUserLimit: offer.perUserLimit != null ? String(offer.perUserLimit) : "",
    })
    setErrors({})
    setFormDialogOpen(true)
  }

  const openView = (offer) => {
    setSelectedOffer(offer)
    setViewDialogOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) {
      toast.error("Please fix the highlighted errors")
      return
    }
    if (formData.restaurantScope === "selected" && !formData.restaurantId) {
      toast.error("Please select a restaurant")
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        couponCode: formData.couponCode.trim(),
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        customerScope: formData.customerScope,
        restaurantScope: formData.restaurantScope,
        restaurantId: formData.restaurantScope === "selected" ? formData.restaurantId : undefined,
        endDate: formData.endDate || undefined,
        startDate: formData.startDate || undefined,
        minOrderValue: formData.minOrderValue !== "" ? Number(formData.minOrderValue) : undefined,
        maxDiscount: formData.discountType === "percentage" && formData.maxDiscount !== ""
          ? Number(formData.maxDiscount) : undefined,
        usageLimit: formData.usageLimit !== "" ? Number(formData.usageLimit) : undefined,
        perUserLimit: formData.perUserLimit !== "" ? Number(formData.perUserLimit) : undefined,
        couponCategory: formData.couponCategory || "normal",
      }

      if (editingOfferId) {
        await adminAPI.updateAdminOffer(editingOfferId, payload)
        toast.success("Coupon updated — pending re-approval")
      } else {
        await adminAPI.createAdminOffer(payload)
        toast.success("Coupon submitted for approval")
      }
      setFormDialogOpen(false)
      resetForm()
      await fetchOffers()
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save coupon")
    } finally {
      setIsSubmitting(false)
    }
  }

  const runAction = async (offerId, action, reason = "") => {
    const key = `${action}-${offerId}`
    if (actionLoading[key]) return
    setActionLoading((p) => ({ ...p, [key]: true }))
    try {
      if (action === "approve") await adminAPI.approveAdminOffer(offerId)
      else if (action === "reject") await adminAPI.rejectAdminOffer(offerId, reason)
      else if (action === "delete") await adminAPI.deleteAdminOffer(offerId)
      toast.success(`Coupon ${action === "delete" ? "deleted" : action + "d"} successfully`)
      await fetchOffers()
    } catch (err) {
      toast.error(err?.response?.data?.message || `Failed to ${action} coupon`)
    } finally {
      setActionLoading((p) => ({ ...p, [key]: false }))
    }
  }

  const openRejectDialog = (offerId) => {
    setRejectOfferId(offerId)
    setRejectionReason("")
    setRejectDialogOpen(true)
  }

  const handleRejectSubmit = async () => {
    if (!rejectOfferId || !rejectionReason.trim()) {
      toast.error("Rejection reason is required")
      return
    }
    try {
      setRejectSubmitting(true)
      await runAction(rejectOfferId, "reject", rejectionReason.trim())
      setRejectDialogOpen(false)
      setRejectOfferId(null)
      setRejectionReason("")
    } finally {
      setRejectSubmitting(false)
    }
  }

  const filteredOffers = useMemo(() => {
    let list = offers
    if (activeTab === "pending") list = list.filter((o) => o.approvalStatus === "pending")
    else if (activeTab === "active") list = list.filter((o) => o.approvalStatus === "approved" && o.status === "active" && !isOfferExpired(o))
    else if (activeTab === "expired") list = list.filter((o) => isOfferExpired(o))
    else if (activeTab === "rejected") list = list.filter((o) => o.approvalStatus === "rejected")

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((o) =>
        o.couponCode?.toLowerCase().includes(q) ||
        o.restaurantName?.toLowerCase().includes(q)
      )
    }
    return list
  }, [offers, activeTab, searchQuery])

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Coupons & Offers</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage discount coupons — new coupons require approval</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={fetchOffers} disabled={loading} className="gap-2">
              <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Add Coupon
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Ticket} label="Total Coupons" value={stats.total} color="bg-blue-100 text-blue-600" />
          <StatCard icon={Clock} label="Pending Approval" value={stats.pending} color="bg-amber-100 text-amber-600" />
          <StatCard icon={CheckCircle} label="Active" value={stats.active} color="bg-green-100 text-green-600" />
          <StatCard icon={TrendingUp} label="Total Redemptions" value={stats.totalRedemptions} color="bg-purple-100 text-purple-600" />
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-100 space-y-3">
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
                  {tab.id === "pending" && stats.pending > 0 && (
                    <span className="ml-1.5 bg-amber-500 text-white rounded-full px-1.5 text-[10px]">{stats.pending}</span>
                  )}
                  {tab.id === "rejected" && stats.rejected > 0 && (
                    <span className="ml-1.5 bg-red-500 text-white rounded-full px-1.5 text-[10px]">{stats.rejected}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by coupon code or restaurant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="text-sm text-slate-500 mt-3">Loading coupons...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16 text-red-600 text-sm">{error}</div>
          ) : filteredOffers.length === 0 ? (
            <div className="text-center py-16">
              <Tag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">No coupons found</p>
              <p className="text-sm text-slate-500 mt-1">
                {searchQuery || activeTab !== "all" ? "Try adjusting your filters" : "Create your first coupon"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {["Code", "Discount", "Restaurant", "Usage", "Valid Until", "Approval", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOffers.map((offer) => {
                    const expired = isOfferExpired(offer)
                    const approval = offer.approvalStatus || "approved"
                    return (
                      <tr key={offer.offerId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {offer.couponCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{discountLabel(offer)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {offer.restaurantScope === "all" ? "All Restaurants" : offer.restaurantName}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                          {Number(offer.usedCount || 0)} / {Number(offer.usageLimit) > 0 ? offer.usageLimit : "∞"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                          <span className={expired ? "text-red-500" : ""}>{formatDate(offer.endDate)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${approvalBadge(approval)}`}>
                            {expired && approval === "approved" ? "expired" : approval}
                          </span>
                          {approval === "rejected" && offer.rejectionReason && (
                            <p className="mt-1 max-w-[180px] truncate text-[11px] text-red-600" title={offer.rejectionReason}>
                              {offer.rejectionReason}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {approval === "approved" && !expired ? (
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
                              <button type="button" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                <MoreVertical className="w-4 h-4 text-slate-600" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => openView(offer)}>
                                <Eye className="w-4 h-4 mr-2" /> View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(offer)}>
                                <Pencil className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/admin/food/coupons/${offer.offerId}/analytics`)}>
                                <TrendingUp className="w-4 h-4 mr-2" /> Analytics
                              </DropdownMenuItem>
                              {offer.approvalStatus === "approved" && !expired && (
                                <DropdownMenuItem
                                  onClick={async () => {
                                    const nextStatus = offer.status === "active" ? "paused" : "active"
                                    try {
                                      await adminAPI.updateAdminOffer(offer.offerId, { status: nextStatus })
                                      toast.success(nextStatus === "active" ? "Coupon resumed" : "Coupon paused")
                                      await fetchOffers()
                                    } catch (err) {
                                      toast.error(err?.response?.data?.message || "Failed to update coupon status")
                                    }
                                  }}
                                >
                                  <Clock className="w-4 h-4 mr-2" />
                                  {offer.status === "active" ? "Pause" : "Resume"}
                                </DropdownMenuItem>
                              )}
                              {approval === "pending" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => runAction(offer.offerId, "approve")}
                                    disabled={actionLoading[`approve-${offer.offerId}`]}
                                    className="text-green-700"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" /> Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => openRejectDialog(offer.offerId)}
                                    disabled={actionLoading[`reject-${offer.offerId}`]}
                                    className="text-red-600"
                                  >
                                    <XCircle className="w-4 h-4 mr-2" /> Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => runAction(offer.offerId, "delete")}
                                disabled={actionLoading[`delete-${offer.offerId}`]}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
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
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={(open) => { setFormDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>{editingOfferId ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
            <DialogDescription>
              {editingOfferId ? "Changes will require re-approval before going live." : "Coupon will be submitted for admin approval."}
            </DialogDescription>
          </DialogHeader>
          <CouponForm
            formData={formData}
            errors={errors}
            restaurants={restaurants}
            onChange={handleFormChange}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            editing={!!editingOfferId}
            restaurantCouponEdit={editingRestaurantCoupon}
          />
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="font-mono">{selectedOffer?.couponCode}</DialogTitle>
            <DialogDescription>Coupon details</DialogDescription>
          </DialogHeader>
          {selectedOffer && <ViewDetails offer={selectedOffer} />}
          {selectedOffer?.approvalStatus === "pending" && (
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => { runAction(selectedOffer.offerId, "approve"); setViewDialogOpen(false) }}
              >
                <CheckCircle className="w-4 h-4 mr-2" /> Approve
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => { setViewDialogOpen(false); openRejectDialog(selectedOffer.offerId) }}
              >
                <XCircle className="w-4 h-4 mr-2" /> Reject
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={(open) => { setRejectDialogOpen(open); if (!open) { setRejectOfferId(null); setRejectionReason("") } }}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>Reject coupon</DialogTitle>
            <DialogDescription>Provide a reason so the restaurant can fix and reapply.</DialogDescription>
          </DialogHeader>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
            placeholder="e.g. Discount too high for current payout terms"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700"
              disabled={rejectSubmitting || !rejectionReason.trim()}
              onClick={handleRejectSubmit}
            >
              {rejectSubmitting ? "Rejecting..." : "Reject coupon"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

