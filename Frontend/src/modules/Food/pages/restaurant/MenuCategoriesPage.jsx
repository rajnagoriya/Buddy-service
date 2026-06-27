import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import RestaurantPanelModal from "@food/components/restaurant/panel/RestaurantPanelModal"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@food/components/ui/table"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit2,
  Eye,
  EyeOff,
  Folder,
  Loader2,
  Plus,
  RotateCw,
  Trash2,
  Upload,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { restaurantAPI, uploadAPI } from "@food/api"
import {
  getRestaurantCategoriesCached,
  invalidateRestaurantCategoriesCache,
} from "@food/utils/foodListingsCache"
import { toast } from "sonner"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { isFlutterBridgeAvailable } from "@food/utils/imageUploadUtils"

const PAGE_SIZE = 15

const defaultFormData = {
  name: "",
  type: "",
  image: "",
  isActive: true,
  sortOrder: 0,
  foodTypeScope: "Veg",
}

const approvalBadgeClass = (status) => {
  const value = String(status || "pending").toLowerCase()
  if (value === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (value === "rejected") return "bg-rose-50 text-rose-700 border-rose-200"
  return "bg-amber-50 text-amber-700 border-amber-200"
}

const scopePillClass = (scope) => {
  if (scope === "Veg") return "bg-green-50 text-green-700 border-green-200"
  if (scope === "Non-Veg") return "bg-red-50 text-red-700 border-red-200"
  return "bg-slate-100 text-slate-700 border-slate-200"
}

export default function MenuCategoriesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState({ active: 0, inactive: 0 })
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [formData, setFormData] = useState(defaultFormData)
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false)
  const fileInputRef = useRef(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    fetchCategories(page)
  }, [page])

  useEffect(() => {
    const draftCategoryName = String(location.state?.draftCategoryName || "").trim()
    if (!draftCategoryName) return
    setEditingCategory(null)
    setFormData((prev) => ({ ...prev, ...defaultFormData, name: draftCategoryName }))
    setSelectedImageFile(null)
    setImagePreview(null)
    setShowModal(true)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  const fetchCategories = async (pageNum = page, options = {}) => {
    try {
      setLoading(true)
      const response = await getRestaurantCategoriesCached(
        {
          page: pageNum,
          limit: PAGE_SIZE,
          ownedOnly: true,
          includeInactive: true,
          withCounts: true,
        },
        options,
      )
      const payload = response?.data?.data || {}
      const list = payload?.categories || []
      setCategories(Array.isArray(list) ? list : [])
      setTotal(Number(payload?.total) || 0)
      if (payload?.summary) {
        setSummary({
          active: Number(payload.summary.active) || 0,
          inactive: Number(payload.summary.inactive) || 0,
        })
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load categories")
      setCategories([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const refreshCategories = (options = {}) => {
    invalidateRestaurantCategoriesCache()
    return fetchCategories(page, { force: true, ...options })
  }

  const resetModal = () => {
    setShowModal(false)
    setEditingCategory(null)
    setFormData(defaultFormData)
    setSelectedImageFile(null)
    setImagePreview(null)
    setUploadingImage(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const openCreateModal = () => {
    setEditingCategory(null)
    setFormData(defaultFormData)
    setSelectedImageFile(null)
    setImagePreview(null)
    setShowModal(true)
  }

  const openEditModal = (category) => {
    if (!category?.canEdit) {
      toast.error("Admin controls this category now")
      return
    }
    setEditingCategory(category)
    setFormData({
      name: category?.name || "",
      type: category?.type || "",
      image: category?.image || "",
      isActive: category?.isActive !== false,
      sortOrder: Number.isFinite(Number(category?.sortOrder)) ? Number(category.sortOrder) : 0,
      foodTypeScope: category?.foodTypeScope || "Veg",
    })
    setSelectedImageFile(null)
    setImagePreview(category?.image || null)
    setShowModal(true)
  }

  const handleImageFileChange = (file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size exceeds 5MB limit.")
      return
    }
    setSelectedImageFile(file)
    try {
      setImagePreview(URL.createObjectURL(file))
    } catch {
      setImagePreview(null)
    }
  }

  const handleImageClick = () => {
    if (isFlutterBridgeAvailable()) {
      setIsPhotoPickerOpen(true)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleSaveCategory = async () => {
    if (!String(formData.name || "").trim()) {
      toast.error("Category name is required")
      return
    }

    try {
      setUploadingImage(true)
      let imageUrl = String(formData.image || "").trim()

      if (selectedImageFile) {
        const res = await uploadAPI.uploadMedia(selectedImageFile, { folder: "food/categories" })
        const url = res?.data?.data?.url || res?.data?.url
        if (url) imageUrl = String(url)
      }

      const payload = {
        name: String(formData.name || "").trim(),
        type: String(formData.type || "").trim(),
        image: imageUrl,
        isActive: formData.isActive !== false,
        sortOrder: Number.isFinite(Number(formData.sortOrder)) ? Number(formData.sortOrder) : 0,
        foodTypeScope: formData.foodTypeScope,
      }

      if (editingCategory) {
        await restaurantAPI.updateCategory(editingCategory._id || editingCategory.id, payload)
        toast.success("Category updated and sent for admin approval")
      } else {
        await restaurantAPI.createCategory(payload)
        toast.success("Category created and sent for admin approval")
        setPage(1)
      }

      resetModal()
      await refreshCategories()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save category")
    } finally {
      setUploadingImage(false)
    }
  }

  const handleDeleteCategory = async (category) => {
    if (!category?.canDelete) {
      toast.error(category?.canEdit ? "Remove foods from this category before deleting it" : "Admin controls this category now")
      return
    }
    if (!window.confirm(`Delete "${category.name}"?`)) return

    try {
      await restaurantAPI.deleteCategory(category._id || category.id)
      toast.success("Category deleted successfully")
      if (categories.length === 1 && page > 1) {
        setPage((prev) => prev - 1)
      } else {
        await refreshCategories()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete category")
    }
  }

  const handleToggleActive = async (category) => {
    if (!category?.canEdit) {
      toast.error("Admin controls this category now")
      return
    }
    try {
      await restaurantAPI.updateCategory(category._id || category.id, {
        isActive: !(category?.isActive !== false),
      })
      toast.success("Category updated and sent for admin approval")
      await refreshCategories()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update category")
    }
  }

  return (
    <RestaurantSubPageShell
      title="Menu Categories"
      subtitle="Create categories, track approvals, and resubmit edits safely."
      backTo={`${RESTAURANT_BASE}/explore`}
      contentClassName="space-y-4"
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">How this works</p>
        <p className="mt-2 text-sm text-slate-600">
          New categories stay pending until admin approval. Editing an approved category sends it back for review.
          Only approved categories can be used for food uploads.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">Total</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">{total}</h3>
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <Folder className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-3 sm:p-4 shadow-sm">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-600">Active</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-emerald-700">{summary.active}</h3>
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-white p-3 sm:p-4 shadow-sm">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-rose-600">Inactive</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-rose-700">{summary.inactive}</h3>
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => refreshCategories()}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RotateCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <button
          onClick={openCreateModal}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"
        >
          <Plus className="h-5 w-5" />
          Add Category
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : categories.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-lg font-semibold text-slate-900">No restaurant categories yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Start with a category and choose whether it should accept veg, non-veg, or both kinds of dishes.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="min-w-[140px] px-3 py-3 text-xs font-semibold uppercase text-slate-500">Category</TableHead>
                  <TableHead className="min-w-[90px] px-3 py-3 text-xs font-semibold uppercase text-slate-500">Scope</TableHead>
                  <TableHead className="min-w-[100px] px-3 py-3 text-xs font-semibold uppercase text-slate-500">Status</TableHead>
                  <TableHead className="min-w-[70px] px-3 py-3 text-xs font-semibold uppercase text-slate-500">Items</TableHead>
                  <TableHead className="min-w-[80px] px-3 py-3 text-xs font-semibold uppercase text-slate-500">Active</TableHead>
                  <TableHead className="min-w-[120px] px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => {
                  const status = category?.approvalStatus || "pending"
                  const isEditable = category?.canEdit

                  return (
                    <TableRow key={category._id || category.id} className="border-b border-slate-100">
                      <TableCell className="px-3 py-3 align-top">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {category?.image ? (
                              <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-500">
                                {String(category?.name || "C").slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{category.name}</p>
                            {category?.type ? (
                              <p className="truncate text-xs text-slate-500">{category.type}</p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-3 align-top">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${scopePillClass(category?.foodTypeScope)}`}>
                          {category?.foodTypeScope || "Both"}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3 align-top">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${approvalBadgeClass(status)}`}>
                          {status === "approved" ? <BadgeCheck className="mr-1 h-3 w-3" /> : <Clock3 className="mr-1 h-3 w-3" />}
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        {status === "rejected" && category?.rejectionReason ? (
                          <p className="mt-1 max-w-[160px] truncate text-[11px] text-rose-600" title={category.rejectionReason}>
                            {category.rejectionReason}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="px-3 py-3 align-top text-sm text-slate-600">
                        {category?.itemCount || 0}
                      </TableCell>
                      <TableCell className="px-3 py-3 align-top">
                        <span className={`text-xs font-semibold ${category?.isActive !== false ? "text-emerald-600" : "text-rose-600"}`}>
                          {category?.isActive !== false ? "Yes" : "No"}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3 align-top">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleActive(category)}
                            className="rounded-lg bg-slate-100 p-2 text-slate-700 disabled:opacity-50"
                            disabled={!isEditable}
                            title={category?.isActive !== false ? "Deactivate" : "Activate"}
                          >
                            {category?.isActive !== false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => openEditModal(category)}
                            className="rounded-lg bg-blue-50 p-2 text-blue-700 disabled:opacity-50"
                            disabled={!isEditable}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category)}
                            className="rounded-lg bg-rose-50 p-2 text-rose-700 disabled:opacity-50"
                            disabled={!category?.canDelete}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <p className="text-sm text-slate-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1 || loading}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </button>
                <span className="min-w-[80px] text-center text-sm font-medium text-slate-700">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages || loading}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <RestaurantPanelModal
        open={showModal}
        onClose={resetModal}
        title={editingCategory ? "Edit Category" : "Create Category"}
        description={
          editingCategory
            ? "Any edit sends this category back for admin approval."
            : "Choose the diet scope carefully before sending it for approval."
        }
        size="md"
        mobileMaxHeight="tall"
        bodyClassName="px-4 py-4 lg:px-5"
        footer={
          <div className="flex gap-3">
            <button
              onClick={resetModal}
              className="flex-1 rounded-xl border border-slate-300 py-3 font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCategory}
              disabled={uploadingImage}
              className="flex-1 rounded-xl bg-slate-900 py-3 font-medium text-white disabled:opacity-60"
            >
              {uploadingImage ? "Uploading..." : editingCategory ? "Save & Resubmit" : "Create"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Category Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Enter category name"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Diet Scope</label>
            <select
              value={formData.foodTypeScope}
              onChange={(e) => setFormData((prev) => ({ ...prev, foodTypeScope: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
            >
              <option value="Veg">Veg</option>
              <option value="Non-Veg">Non-Veg</option>
              <option value="Both">Both</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Optional Type Label</label>
            <input
              type="text"
              value={formData.type}
              onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
              placeholder="Examples: Starters, Desserts, Drinks"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {(imagePreview || formData.image) && (
              <img
                src={imagePreview || formData.image}
                alt="Category preview"
                className="h-16 w-16 rounded-2xl object-cover"
              />
            )}
            <button
              type="button"
              onClick={handleImageClick}
              className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
            >
              <Upload className="h-4 w-4" />
              Upload Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => handleImageFileChange(e.target.files?.[0])}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
            />
            Keep category active
          </label>
        </div>
      </RestaurantPanelModal>

      <ImageSourcePicker
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onFileSelect={handleImageFileChange}
        title="Category Image"
        description="Choose how to upload your category image"
        fileNamePrefix="category-photo"
        galleryInputRef={fileInputRef}
      />
    </RestaurantSubPageShell>
  )
}
