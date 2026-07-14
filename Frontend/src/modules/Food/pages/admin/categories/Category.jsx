import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  Download,
  Globe,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
  Eye,
  Folder,
  CheckCircle2,
  XCircle,
  Store,
  ShieldCheck,
  ShieldX,
} from "lucide-react"
import { adminAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20
const RESTRO_PAGE_SIZE = 15
const SEARCH_DEBOUNCE_MS = 300

const defaultFormData = {
  name: "",
  image: "",
  status: true,
  type: "",
  foodTypeScope: "Both",
}

// ─── Helper fns ───────────────────────────────────────────────────────────────
const approvalBadgeClass = (status) => {
  const v = String(status || "pending").toLowerCase()
  if (v === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (v === "rejected") return "bg-rose-50 text-rose-700 border-rose-200"
  return "bg-amber-50 text-amber-700 border-amber-200"
}

const scopeBadgeClass = (scope) => {
  if (scope === "Veg") return "bg-green-50 text-green-700 border-green-200"
  if (scope === "Non-Veg") return "bg-red-50 text-red-700 border-red-200"
  return "bg-slate-100 text-slate-700 border-slate-200"
}

const formatAdminDate = (value) => {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

const toShortDisplayId = (value) => {
  const s = String(value || "").trim()
  if (!s) return "—"
  return s.length >= 5 ? s.slice(-5) : s
}

const displayValue = (value) => {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}

function DetailField({ label, value, full = false }) {
  return (
    <div className={full ? "col-span-full" : ""}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="break-all whitespace-pre-wrap text-sm text-slate-900">{displayValue(value)}</p>
    </div>
  )
}

function CategoryViewModal({ category, onClose }) {
  if (!category) return null

  const restaurant = category?.createdByRestaurant || category?.restaurant || null
  const restaurantDisplayId = toShortDisplayId(
    restaurant?._id || category?.createdByRestaurantId || category?.restaurantId,
  )
  const isActive = category?.isActive !== false && category?.status !== false

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[min(90vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Category Details</h2>
            <p className="mt-0.5 text-xs text-slate-500">{category?.name || "Category"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {category?.image ? (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Image</p>
              <img
                src={category.image}
                alt={category.name || "Category"}
                className="h-32 w-32 rounded-2xl border border-slate-200 object-cover"
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailField label="Name" value={category?.name} />
            <DetailField label="Type" value={category?.type} />
            <DetailField label="Diet Scope" value={category?.foodTypeScope} />
            <DetailField label="Sort Order" value={category?.sortOrder} />
            <DetailField label="Visibility" value={category?.isGlobal ? "Global" : "Restaurant-specific"} />
            <DetailField label="Status" value={isActive ? "Active" : "Inactive"} />
            {category?.adminDeactivated ? (
              <DetailField label="Admin Note" value="Disabled by admin" />
            ) : null}
            <DetailField label="Approval Status" value={category?.approvalStatus} />
            <DetailField label="Total Items" value={category?.itemCount} />
            <DetailField label="Approved Items" value={category?.approvedFoodCount} />
            <DetailField label="Created" value={formatAdminDate(category?.createdAt)} />
            <DetailField label="Last Updated" value={formatAdminDate(category?.updatedAt)} />
            {category?.requestedAt ? (
              <DetailField label="Requested On" value={formatAdminDate(category?.requestedAt)} />
            ) : null}
            {category?.approvedAt ? (
              <DetailField label="Approved On" value={formatAdminDate(category?.approvedAt)} />
            ) : null}
            {category?.rejectedAt ? (
              <DetailField label="Rejected On" value={formatAdminDate(category?.rejectedAt)} />
            ) : null}
            {category?.rejectionReason ? (
              <DetailField label="Rejection Reason" value={category?.rejectionReason} full />
            ) : null}
          </div>

          {restaurant ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Restaurant</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailField label="Restaurant ID" value={restaurantDisplayId} />
                <DetailField label="Restaurant Name" value={restaurant?.name} />
                <DetailField label="Owner Name" value={restaurant?.ownerName} />
                <DetailField label="Owner Phone" value={restaurant?.ownerPhone} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Row Actions Dropdown ─────────────────────────────────────────────────────
function RowActions({ category, onView, onEdit, onDelete, onApprove, onReject, onMakeGlobal, onToggleStatus }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const approvalStatus = category?.approvalStatus || "pending"
  const isRestaurantCategory = Boolean(category?.createdByRestaurantId || category?.restaurantId)
  const catId = String(category?.id || category?._id || "")

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  const close = () => setOpen(false)

  const items = [
    {
      label: "View",
      icon: <Eye className="h-3.5 w-3.5" />,
      onClick: () => { close(); onView(category) },
      className: "text-slate-700",
    },
    {
      label: "Edit",
      icon: <Pencil className="h-3.5 w-3.5" />,
      onClick: () => { close(); onEdit(category) },
      className: "text-slate-700",
    },
    {
      label: category?.status !== false ? "Deactivate" : "Activate",
      icon: category?.status !== false
        ? <XCircle className="h-3.5 w-3.5" />
        : <CheckCircle2 className="h-3.5 w-3.5" />,
      onClick: () => { close(); onToggleStatus(catId) },
      className: "text-slate-700",
    },
    ...(approvalStatus !== "approved"
      ? [{ label: "Approve", icon: <ShieldCheck className="h-3.5 w-3.5" />, onClick: () => { close(); onApprove(catId) }, className: "text-emerald-700" }]
      : []),
    ...(isRestaurantCategory && approvalStatus !== "rejected"
      ? [{ label: "Reject", icon: <ShieldX className="h-3.5 w-3.5" />, onClick: () => { close(); onReject(category) }, className: "text-rose-700" }]
      : []),
    ...(isRestaurantCategory && !category?.isGlobal && approvalStatus === "approved"
      ? [{ label: "Make Global", icon: <Globe className="h-3.5 w-3.5" />, onClick: () => { close(); onMakeGlobal(category) }, className: "text-sky-700" }]
      : []),
    ...(category?.canDelete !== false
      ? [{
          label: "Delete",
          icon: <Trash2 className="h-3.5 w-3.5" />,
          onClick: () => { close(); onDelete(catId) },
          className: "text-rose-600",
          divider: true,
        }]
      : []),
  ]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        title="Actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: -4 }}
            transition={{ duration: 0.13 }}
            className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          >
            {items.map((item, i) => (
              <div key={i}>
                {item.divider && <div className="my-1 border-t border-slate-100" />}
                <button
                  type="button"
                  onClick={item.onClick}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-slate-50 ${item.className}`}
                >
                  {item.icon}
                  {item.label}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Restaurant Filter Dropdown ───────────────────────────────────────────────
function RestaurantDropdown({ value, valueName, onChange, onClear }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(false)
  const [restroPage, setRestroPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setRestroPage(1) }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search])

  // Fetch when open or debounced search changes
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    adminAPI
      .getApprovedRestaurants({ page: 1, limit: RESTRO_PAGE_SIZE, search: debouncedSearch })
      .then((res) => {
        if (cancelled) return
        const data = res?.data?.data
        const list = Array.isArray(data?.restaurants) ? data.restaurants : []
        const total = Number(data?.total) || list.length
        setRestaurants(list)
        setHasMore(list.length < total)
        setRestroPage(1)
      })
      .catch(() => { if (!cancelled) setRestaurants([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, debouncedSearch])

  const loadMore = () => {
    const next = restroPage + 1
    setLoading(true)
    adminAPI
      .getApprovedRestaurants({ page: next, limit: RESTRO_PAGE_SIZE, search: debouncedSearch })
      .then((res) => {
        const data = res?.data?.data
        const list = Array.isArray(data?.restaurants) ? data.restaurants : []
        const total = Number(data?.total) || 0
        setRestaurants((prev) => {
          const merged = [...prev, ...list]
          setHasMore(merged.length < total)
          return merged
        })
        setRestroPage(next)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handle = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => searchInputRef.current?.focus(), 50)
    else setSearch("")
  }, [open])

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
          value
            ? "border-blue-300 bg-blue-50 text-blue-700"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <Store className="h-4 w-4 shrink-0" />
        <span className="max-w-[150px] truncate">{value ? valueName : "By Restaurant"}</span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onClear() }}
            onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), onClear())}
            className="ml-0.5 rounded-full p-0.5 hover:bg-blue-100"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="border-b border-slate-100 p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search restaurant..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto">
              {loading && restaurants.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                </div>
              ) : restaurants.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  {debouncedSearch ? `No results for "${debouncedSearch}"` : "No restaurants found"}
                </div>
              ) : (
                <>
                  {restaurants.map((r) => {
                    const rId = r._id || r.id
                    const rName = r.name || r.restaurantName || "Restaurant"
                    const rLogo =
                      typeof r.profileImage === "string"
                        ? r.profileImage
                        : r.profileImage?.url || r.logo?.url || r.logo || ""
                    return (
                      <button
                        key={rId}
                        type="button"
                        onClick={() => { onChange(rId, rName); setOpen(false) }}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 ${value === rId ? "bg-blue-50" : ""}`}
                      >
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-100">
                          {rLogo ? (
                            <img src={rLogo} alt={rName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                              {rName.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{rName}</p>
                          {r.location?.city && (
                            <p className="truncate text-xs text-slate-400">{r.location.city}</p>
                          )}
                        </div>
                        {value === rId && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-blue-500" />}
                      </button>
                    )
                  })}
                  {hasMore && (
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 border-t border-slate-100 py-3 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                    >
                      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Load More
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Category() {
  // ── Search & filter state ──
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [filterMode, setFilterMode] = useState("all") // 'all' | 'global' | 'restaurant'
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null)
  const [selectedRestaurantName, setSelectedRestaurantName] = useState("")
  const [showPendingOnly, setShowPendingOnly] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all") // 'all' | 'active' | 'inactive'

  // ── Category list state ──
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [catPage, setCatPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  // ── Modal / form state ──
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [formData, setFormData] = useState(defaultFormData)
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [viewCategory, setViewCategory] = useState(null)
  const fileInputRef = useRef(null)

  // ── Split order threshold ──
  const [splitThreshold, setSplitThreshold] = useState(20)
  const [isSavingThreshold, setIsSavingThreshold] = useState(false)

  // ─── Debounce search ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchQuery])

  // ─── Core fetch (always force-bypasses cache when filters change) ─────────────
  const fetchCategories = useCallback(async (pg = 1, forceFlag = true) => {
    try {
      setLoading(true)
      const params = { page: pg, limit: PAGE_SIZE }
      if (debouncedSearch) params.search = debouncedSearch
      if (showPendingOnly) params.approvalStatus = "pending"
      if (filterMode === "global") params.isGlobal = true
      if (filterMode === "restaurant" && selectedRestaurantId) params.restaurantId = selectedRestaurantId
      // Status filter: send to API so the response is already filtered
      if (statusFilter === "active") params.status = true
      if (statusFilter === "inactive") params.status = false

      // Always call the API directly to avoid stale cache on filter changes
      const response = await adminAPI.getCategories(params)
      const data = response?.data?.data || response?.data || {}
      const list = Array.isArray(data?.categories) ? data.categories : []
      const total = Number(data?.total) || 0

      if (pg === 1) {
        setCategories(list)
      } else {
        setCategories((prev) => [...prev, ...list])
      }
      setTotalCount(total || list.length)
      setHasMore(pg * PAGE_SIZE < (total || list.length))
      setCatPage(pg)
    } catch (error) {
      if (error?.response?.status === 401) toast.error("Authentication required. Please login again.")
      else if (error?.response?.status === 403) toast.error("Access denied.")
      else if (error?.code === "ERR_NETWORK") toast.error("Cannot connect to server.")
      else toast.error(error?.response?.data?.message || "Failed to load categories")
      if (pg === 1) setCategories([])
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, showPendingOnly, filterMode, selectedRestaurantId, statusFilter])

  // ─── Auth check + initial load ────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("admin_accessToken")
    if (!token) { toast.error("Please login to access categories"); setLoading(false); return }
    fetchSplitSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Re-fetch on any filter/search change — always fresh ─────────────────────
  useEffect(() => {
    fetchCategories(1, true)
  }, [fetchCategories])

  // ─── Split threshold ──────────────────────────────────────────────────────────
  const fetchSplitSettings = async () => {
    try {
      const response = await adminAPI.getDeliveryBoySettings()
      const settings = response?.data?.data || response?.data || {}
      if (settings.splitOrderThreshold) setSplitThreshold(settings.splitOrderThreshold)
    } catch (_) {}
  }

  const handleUpdateThreshold = async () => {
    try {
      setIsSavingThreshold(true)
      await adminAPI.updateDeliveryBoySettings({ splitOrderThreshold: splitThreshold })
      toast.success("Split order threshold updated successfully")
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update threshold")
    } finally {
      setIsSavingThreshold(false)
    }
  }

  // ─── Filter helpers ───────────────────────────────────────────────────────────
  const handleFilterMode = (mode) => {
    setFilterMode(mode)
    if (mode !== "restaurant") {
      setSelectedRestaurantId(null)
      setSelectedRestaurantName("")
    }
  }

  const handleRestaurantSelect = (id, name) => {
    setSelectedRestaurantId(id)
    setSelectedRestaurantName(name)
    setFilterMode("restaurant")
  }

  const handleRestaurantClear = () => {
    setSelectedRestaurantId(null)
    setSelectedRestaurantName("")
    setFilterMode("all")
  }

  // ─── Modal helpers ─────────────────────────────────────────────────────────────
  const resetModal = () => {
    setIsModalOpen(false)
    setEditingCategory(null)
    setFormData(defaultFormData)
    setSelectedImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleEdit = (category) => {
    setEditingCategory(category)
    setFormData({
      name: category?.name || "",
      image: category?.image || "",
      status: category?.status !== false,
      type: category?.type || "",
      foodTypeScope: category?.foodTypeScope || "Both",
    })
    setSelectedImageFile(null)
    setImagePreview(category?.image || null)
    setIsModalOpen(true)
  }

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if (!allowed.includes(file.type)) { toast.error("Invalid file type. Use PNG, JPG, or WEBP."); return }
    if (file.size > 5 * 1024 * 1024) { toast.error("File size exceeds 5MB."); return }
    setSelectedImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  // ─── Soft UI update helpers ────────────────────────────────────────────────────
  const updateCategoryInState = useCallback((id, patch) => {
    setCategories((prev) =>
      prev.map((c) => {
        const cId = String(c?.id || c?._id || "")
        return cId === String(id) ? { ...c, ...patch } : c
      }),
    )
  }, [])

  const removeCategoryFromState = useCallback((id) => {
    setCategories((prev) => prev.filter((c) => String(c?.id || c?._id || "") !== String(id)))
    setTotalCount((n) => Math.max(0, n - 1))
  }, [])

  // ─── CRUD handlers ─────────────────────────────────────────────────────────────
  const handleToggleStatus = async (id) => {
    try {
      const response = await adminAPI.toggleCategoryStatus(String(id))
      if (response?.data?.success) {
        const updated = response?.data?.data?.category || {}
        const isActive = updated?.isActive !== false
        const patch = {
          status: isActive,
          isActive,
          adminDeactivated: updated?.adminDeactivated === true,
        }
        if ((statusFilter === "active" && !isActive) || (statusFilter === "inactive" && isActive)) {
          removeCategoryFromState(id)
        } else {
          updateCategoryInState(id, patch)
        }
        toast.success(`Category ${isActive ? "activated" : "deactivated"}`)
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update status")
    }
  }

  const handleApprove = async (id) => {
    try {
      const response = await adminAPI.approveCategory(String(id))
      if (response?.data?.success) {
        updateCategoryInState(id, { approvalStatus: "approved" })
        toast.success("Category approved")
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to approve")
    }
  }

  const handleReject = async (category) => {
    const reason = window.prompt(`Reject "${category?.name}" with a reason:`)
    if (reason == null) return
    if (!String(reason).trim()) { toast.error("Rejection reason is required"); return }
    const id = String(category?.id || category?._id)
    try {
      const response = await adminAPI.rejectCategory(id, reason)
      if (response?.data?.success) {
        updateCategoryInState(id, { approvalStatus: "rejected", rejectionReason: reason })
        toast.success("Category rejected")
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to reject")
    }
  }

  const handleMakeGlobal = async (category) => {
    if (!window.confirm(`Make "${category?.name}" global for every restaurant?`)) return
    const id = String(category?.id || category?._id)
    try {
      const response = await adminAPI.makeCategoryGlobal(id)
      if (response?.data?.success) {
        updateCategoryInState(id, { isGlobal: true })
        toast.success("Category is now global")
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed")
    }
  }

  const handleDelete = async (id) => {
    const category = categories.find((c) => String(c?.id || c?._id) === String(id))
    if (category?.canDelete === false) {
      toast.error("This category has items. Deactivate it instead of deleting.")
      return
    }
    const name = category?.name || "this category"
    if (!window.confirm(`Delete "${name}"? This action cannot be undone.`)) return
    try {
      const response = await adminAPI.deleteCategory(String(id))
      if (response?.data?.success) {
        removeCategoryFromState(id)
        toast.success("Category deleted")
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete")
    }
  }

  // ─── Submit (create / update) ─────────────────────────────────────────────────
  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setUploadingImage(true)
      let imageUrl = String(formData.image || "").trim()

      if (selectedImageFile) {
        const uploadRes = await uploadAPI.uploadMedia(selectedImageFile, { folder: "appzeto/categories" })
        const up = uploadRes?.data?.data || uploadRes?.data
        imageUrl = up?.url || imageUrl
      }

      const payload = {
        name: String(formData.name || "").trim(),
        type: String(formData.type || "").trim(),
        status: Boolean(formData.status),
        image: imageUrl || undefined,
        foodTypeScope: formData.foodTypeScope,
      }

      if (editingCategory) {
        const catId = editingCategory.id || editingCategory._id
        const response = await adminAPI.updateCategory(catId, payload)
        if (response?.data?.success) {
          const updated = response?.data?.data?.category || response?.data?.data
          updateCategoryInState(catId, {
            ...payload,
            image: imageUrl || editingCategory.image,
            ...(updated && typeof updated === "object" ? updated : {}),
          })
          toast.success("Category updated successfully")
        }
      } else {
        // Admin-created categories are always global and immediately approved
        const createPayload = { ...payload, isGlobal: true, approvalStatus: "approved" }
        const response = await adminAPI.createCategory(createPayload)
        if (response?.data?.success) {
          const newCat =
            response?.data?.data?.category ||
            response?.data?.data ||
            { ...createPayload, id: `temp_${Date.now()}` }
          // Ensure isGlobal & approvalStatus are set on the optimistic item
          const optimisticCat = { isGlobal: true, approvalStatus: "approved", ...newCat }
          setCategories((prev) => [optimisticCat, ...prev])
          setTotalCount((n) => n + 1)
          toast.success("Category created successfully")
        }
      }

      resetModal()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save category")
    } finally {
      setUploadingImage(false)
    }
  }

  // ─── Export PDF ───────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.setTextColor(30, 30, 30)
      doc.text("Category List", 14, 20)
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(
        `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
        14,
        28,
      )
      autoTable(doc, {
        startY: 35,
        head: [["SL", "Category", "Diet", "Visibility", "Approval"]],
        body: categories.map((c, i) => [
          i + 1,
          c?.name || "N/A",
          c?.foodTypeScope || "Both",
          c?.isGlobal ? "Global" : "Private",
          c?.approvalStatus || "pending",
        ]),
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold", fontSize: 10 },
        bodyStyles: { fontSize: 9, textColor: [30, 30, 30] },
      })
      doc.save(`Categories_${new Date().toISOString().split("T")[0]}.pdf`)
      toast.success("PDF exported!")
    } catch {
      toast.error("Failed to export PDF")
    }
  }

  // ─── Derived stats ─────────────────────────────────────────────────────────────
  const activeCount = useMemo(() => categories.filter((c) => c.status !== false).length, [categories])
  const inactiveCount = useMemo(() => categories.filter((c) => c.status === false).length, [categories])

  // ─── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      {/* ── Header ── */}
      <div className="mb-3 sm:mb-6 rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight">Categories</h1>
            <p className="hidden sm:block text-sm text-slate-500 mt-1">
              Admin categories are global. Restaurant categories go through approval before going live.
            </p>
            {/* Split threshold */}
            <div className="mt-3 sm:mt-4 flex flex-col min-[450px]:flex-row min-[450px]:items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-2 sm:py-2.5 sm:px-4">
              <div className="min-w-0">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-700">
                  Split Order Threshold
                </span>
                <p className="hidden sm:block text-[11px] text-blue-500">Items count after which order sharing is allowed</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <input
                  type="number"
                  value={splitThreshold}
                  onChange={(e) => setSplitThreshold(parseInt(e.target.value) || 1)}
                  className="w-16 sm:w-20 rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs sm:text-sm font-bold outline-none focus:border-blue-500"
                  min="1"
                />
                <button
                  onClick={handleUpdateThreshold}
                  disabled={isSavingThreshold}
                  className="rounded-lg bg-blue-600 px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSavingThreshold ? "Saving..." : "Update"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-end mt-2 sm:mt-0">
            <button
              onClick={() => fetchCategories(1, true)}
              disabled={loading}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Refresh List"
            >
              <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={categories.length === 0}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Export PDF"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => { setEditingCategory(null); setFormData(defaultFormData); setSelectedImageFile(null); setImagePreview(null); setIsModalOpen(true) }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden min-[400px]:inline">Add Category</span>
              <span className="min-[400px]:hidden">Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="mb-3 sm:mb-6 grid grid-cols-3 gap-2 sm:gap-5">
        {[
          { label: "Total", value: totalCount, icon: <Folder className="h-5 w-5" />, color: "slate" },
          { label: "Active", value: activeCount, icon: <CheckCircle2 className="h-5 w-5" />, color: "emerald" },
          { label: "Inactive", value: inactiveCount, icon: <XCircle className="h-5 w-5" />, color: "rose" },
        ].map(({ label, value, icon, color }) => (
          <div
            key={label}
            className={`flex items-center justify-between rounded-xl sm:rounded-2xl border bg-white p-2.5 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_20px_-10px_rgba(0,0,0,0.03)] border-${color}-100 transition-shadow duration-300 hover:shadow-md`}
          >
            <div className="min-w-0">
              <p className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-${color}-500 truncate mb-0.5 sm:mb-1`}>{label}</p>
              <h3 className={`text-xl sm:text-3xl font-extrabold text-${color}-700 tracking-tight`}>{value}</h3>
            </div>
            <div className={`hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-${color}-50 text-${color}-500 border border-${color}-100/50`}>
              {icon}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="mb-3 sm:mb-4 rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:px-4 sm:py-3 shadow-sm">
        {/* Row 1: Visibility + Status + Pending filters (Horizontally scrollable on mobile) */}
        <div 
          className="flex items-center gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* All / Global pills */}
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 p-1">
            <button
              type="button"
              onClick={() => handleFilterMode("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterMode === "all" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => handleFilterMode("global")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterMode === "global" ? "bg-sky-600 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              Global
            </button>
          </div>

          {/* Status pills: Active / Inactive */}
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 p-1">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === "all" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All Status
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === "active" ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === "inactive" ? "bg-rose-600 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <XCircle className="h-3.5 w-3.5" />
              Inactive
            </button>
          </div>

          {/* Pending toggle */}
          <button
            type="button"
            onClick={() => setShowPendingOnly((p) => !p)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
              showPendingOnly
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {showPendingOnly && <XCircle className="h-3.5 w-3.5" />}
            {showPendingOnly ? "Pending Only" : "Pending"}
          </button>
        </div>

        {/* Row 2: Restaurant filter + Search */}
        <div className="mt-2 sm:mt-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Restaurant Dropdown & Active restaurant chip */}
          <div className="flex items-center gap-2 shrink-0">
            <RestaurantDropdown
              value={selectedRestaurantId}
              valueName={selectedRestaurantName}
              onChange={handleRestaurantSelect}
              onClear={handleRestaurantClear}
            />

            {filterMode === "restaurant" && selectedRestaurantName && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 max-w-[150px] truncate">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{selectedRestaurantName}</span>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-9 text-sm outline-none focus:border-blue-400 focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-3 sm:p-6">
        <div className="w-full">
          {loading && categories.length === 0 ? (
            <div className="py-20 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
              <p className="mt-2 text-sm text-slate-500">Loading categories...</p>
            </div>
          ) : !loading && categories.length === 0 ? (
            <div className="py-20 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <Folder className="h-7 w-7 text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700">No categories found</p>
              <p className="mt-1 text-sm text-slate-400">
                {filterMode === "global"
                  ? "No global categories yet."
                  : filterMode === "restaurant"
                    ? `No categories for ${selectedRestaurantName}.`
                    : "Try a different search or add a new category."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop/Tablet Table Layout */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-150">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50/80 border-b border-slate-150 sticky top-0 backdrop-blur-md z-10">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-[6%]">SL</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-[26%]">Category</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-[22%]">Owner</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-[12%]">Diet</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-[12%]">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-[16%]">Approval</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-[6%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {categories.map((category, index) => {
                      const catId = String(category?.id || category?._id || "")
                      const creatorName =
                        category?.createdByRestaurant?.name || category?.restaurant?.name || "Admin"
                      const approvalStatus = category?.approvalStatus || "pending"

                      return (
                        <tr key={catId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                            {(catPage - 1) * PAGE_SIZE + index + 1}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-100">
                                {category?.image ? (
                                  <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-400">
                                    {String(category?.name || "C").slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">{category?.name || "—"}</p>
                                <p className="truncate text-xs text-slate-400 mt-0.5">
                                  {[category?.type, `${category?.itemCount || 0} items`].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-slate-800">{creatorName}</p>
                            {category?.isGlobal ? (
                              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                                <Globe className="h-3 w-3" />
                                Global
                              </span>
                            ) : (
                              <span className="mt-1 text-xs text-slate-400 block">Private</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${scopeBadgeClass(category?.foodTypeScope)}`}>
                              {category?.foodTypeScope || "Both"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleToggleStatus(catId)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${category?.status !== false ? "bg-blue-600" : "bg-slate-300"}`}
                              title={category?.status !== false ? "Deactivate" : "Activate"}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${category?.status !== false ? "translate-x-6" : "translate-x-1"}`}
                              />
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${approvalBadgeClass(approvalStatus)}`}>
                              {approvalStatus === "approved" && <BadgeCheck className="h-3 w-3" />}
                              {approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1)}
                            </span>
                            {category?.rejectionReason && (
                              <p className="mt-1 max-w-[160px] text-[11px] text-rose-500 leading-4">
                                {category.rejectionReason}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <RowActions
                              category={category}
                              onView={setViewCategory}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              onApprove={handleApprove}
                              onReject={handleReject}
                              onMakeGlobal={handleMakeGlobal}
                              onToggleStatus={handleToggleStatus}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile compact table */}
              <div className="md:hidden -mx-1 overflow-x-auto rounded-lg border border-slate-150">
                <table className="w-full min-w-[540px] border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-150">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide w-[5%]">#</th>
                      <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide w-[30%]">Category</th>
                      <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide w-[22%]">Owner</th>
                      <th className="px-2 py-2 text-center font-semibold text-slate-500 uppercase tracking-wide w-[12%]">Diet</th>
                      <th className="px-2 py-2 text-center font-semibold text-slate-500 uppercase tracking-wide w-[12%]">Status</th>
                      <th className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide w-[14%]">Approval</th>
                      <th className="px-2 py-2 text-right font-semibold text-slate-500 uppercase tracking-wide w-[5%]">Act</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {categories.map((category, index) => {
                      const catId = String(category?.id || category?._id || "")
                      const creatorName =
                        category?.createdByRestaurant?.name || category?.restaurant?.name || "Admin"
                      const approvalStatus = category?.approvalStatus || "pending"

                      return (
                        <tr key={catId} className="hover:bg-slate-50/70">
                          <td className="px-2 py-2.5 text-slate-500 font-medium whitespace-nowrap">
                            {(catPage - 1) * PAGE_SIZE + index + 1}
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-2 min-w-[130px]">
                              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-100">
                                {category?.image ? (
                                  <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400">
                                    {String(category?.name || "C").slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900 leading-tight">{category?.name || "—"}</p>
                                <p className="truncate text-[10px] text-slate-400 mt-0.5">
                                  {[category?.type, `${category?.itemCount || 0} items`].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2.5 min-w-[90px]">
                            <p className="font-medium text-slate-800 truncate max-w-[85px] leading-tight">{creatorName}</p>
                            {category?.isGlobal ? (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-sky-100 bg-sky-50 px-1.5 py-0.2 text-[9px] font-semibold text-sky-700 mt-0.5">
                                Global
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 block mt-0.5">Private</span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-center whitespace-nowrap">
                            <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${scopeBadgeClass(category?.foodTypeScope)}`}>
                              {category?.foodTypeScope || "Both"}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleToggleStatus(catId)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${category?.status !== false ? "bg-blue-600" : "bg-slate-300"}`}
                              title={category?.status !== false ? "Deactivate" : "Activate"}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${category?.status !== false ? "translate-x-5" : "translate-x-1"}`}
                              />
                            </button>
                          </td>
                          <td className="px-2 py-2.5 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold w-fit ${approvalBadgeClass(approvalStatus)}`}>
                                {approvalStatus === "approved" && <BadgeCheck className="h-2.5 w-2.5" />}
                                {approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1)}
                              </span>
                              {category?.rejectionReason && (
                                <p className="max-w-[100px] truncate text-[9px] text-rose-500" title={category.rejectionReason}>
                                  {category.rejectionReason}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-right whitespace-nowrap">
                            <RowActions
                              category={category}
                              onView={setViewCategory}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              onApprove={handleApprove}
                              onReject={handleReject}
                              onMakeGlobal={handleMakeGlobal}
                              onToggleStatus={handleToggleStatus}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {categories.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
            <p className="text-sm text-slate-500">
              Showing <span className="font-semibold text-slate-800">{categories.length}</span> of{" "}
              <span className="font-semibold text-slate-800">{totalCount}</span> categories
              {filterMode === "global" && " (Global)"}
              {filterMode === "restaurant" && selectedRestaurantName && ` · ${selectedRestaurantName}`}
            </p>
            {hasMore && (
              <button
                type="button"
                onClick={() => fetchCategories(catPage + 1, true)}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Load More
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isModalOpen && (
              <div className="fixed inset-0 z-[200]">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={resetModal} />
                <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    transition={{ duration: 0.18 }}
                    className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[min(700px,calc(100vh-32px))]"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">
                          {editingCategory ? "Edit Category" : "Add Category"}
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Admin categories are automatically marked as{" "}
                          <span className="font-semibold text-sky-600">Global</span> and approved.
                        </p>
                        {/* Global badge — always shown for admin-created categories */}
                        {!editingCategory && (
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
                            <Globe className="h-3 w-3" />
                            Global
                          </span>
                        )}
                      </div>
                      <button onClick={resetModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                        {/* Diet Scope */}
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Diet Scope</label>
                          <select
                            value={formData.foodTypeScope}
                            onChange={(e) => setFormData((p) => ({ ...p, foodTypeScope: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
                          >
                            <option value="Veg">Veg</option>
                            <option value="Non-Veg">Non-Veg</option>
                            <option value="Both">Both</option>
                          </select>
                        </div>

                        {/* Category Type */}
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Category Type</label>
                          <input
                            type="text"
                            value={formData.type}
                            onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
                            placeholder="e.g. Starters, Desserts, Drinks"
                          />
                        </div>

                        {/* Category Name */}
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Category Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
                            placeholder="Enter category name"
                          />
                        </div>

                        {/* Image */}
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Category Image</label>
                          <div className="space-y-3">
                            {(imagePreview || formData.image) && (
                              <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-slate-200">
                                <img src={imagePreview || formData.image} alt="Preview" className="h-full w-full object-cover" />
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                onChange={handleImageSelect}
                                className="hidden"
                                id="category-image-upload"
                              />
                              <label
                                htmlFor="category-image-upload"
                                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <Upload className="h-4 w-4" />
                                {imagePreview ? "Change Image" : "Upload Image"}
                              </label>
                              {uploadingImage && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
                            </div>
                          </div>
                        </div>

                        {/* Active */}
                        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={formData.status}
                            onChange={(e) => setFormData((p) => ({ ...p, status: e.target.checked }))}
                            className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                          />
                          Active
                        </label>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                        <button
                          type="button"
                          onClick={resetModal}
                          className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={uploadingImage}
                          className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {uploadingImage ? (
                            <span className="flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                            </span>
                          ) : editingCategory ? "Update" : "Create"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      <CategoryViewModal category={viewCategory} onClose={() => setViewCategory(null)} />
    </div>
  )
}
