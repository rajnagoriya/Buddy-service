import { useState, useEffect, useRef } from "react"
import {
  Building2,
  Clock,
  CreditCard,
  MapPin,
  Phone,
  Settings2,
  Store,
  UtensilsCrossed,
} from "lucide-react"
import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import { PanelSurface } from "@food/components/restaurant/panel/panelUi"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"
import OutletInfoHero from "@food/components/restaurant/outlet-info/OutletInfoHero"
import OutletPhotoGallery from "@food/components/restaurant/outlet-info/OutletPhotoGallery"
import ManageOutletModal from "@food/components/restaurant/outlet-info/ManageOutletModal"
import {
  EditableSection,
  InfoRow,
  QuickLinkRow,
  SectionHeader,
  StatChip,
} from "@food/components/restaurant/outlet-info/outletInfoUi"
import RequestedChangesPanel from "@food/components/restaurant/outlet-info/RequestedChangesPanel"
import { Input } from "@food/components/ui/input"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { isFlutterBridgeAvailable } from "@food/utils/imageUploadUtils"
import {
  invalidateApprovedRestaurantsCache,
  invalidateRestaurantDetailCache,
} from "@food/utils/adminRestaurantCache"

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop"
const FALLBACK_PROFILE =
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop"

const ALL_CUISINES = [
  "Burger", "Chinese", "Momos", "North Indian", "Pizza", "Rolls", "Sandwich",
  "Shawarma", "South Indian", "Biryani", "Desserts", "Ice Cream", "Fast Food",
  "Cafe", "Italian", "Mexican", "Thai", "Seafood", "Salad", "Healthy Food",
  "Juices", "Beverages", "Punjabi", "Gujarati", "Rajasthani", "Mughlai",
  "Street Food", "Bakery",
]

const PENDING_REVIEW_MSG =
  "You are under admin review. Your changes will become visible after approval. You cannot go online until then."

const formatAddress = (location) => {
  if (!location) return ""
  const parts = []
  if (location.addressLine1) parts.push(location.addressLine1.trim())
  if (location.addressLine2) parts.push(location.addressLine2.trim())
  if (location.area) parts.push(location.area.trim())
  if (location.city) {
    const city = location.city.trim()
    if (!location.area || !location.area.includes(city)) parts.push(city)
  }
  if (location.pincode) parts.push(String(location.pincode).trim())
  return parts.join(", ") || location.formattedAddress?.trim() || ""
}


export default function OutletInfo() {
  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [restaurantName, setRestaurantName] = useState("")
  const [cuisineTags, setCuisineTags] = useState("")
  const [selectedCuisines, setSelectedCuisines] = useState([])
  const [address, setAddress] = useState("")
  const [pendingFieldLabels, setPendingFieldLabels] = useState([])
  const [mainImage, setMainImage] = useState(FALLBACK_COVER)
  const [thumbnailImage, setThumbnailImage] = useState(FALLBACK_PROFILE)
  const [coverImages, setCoverImages] = useState([])
  const [restaurantId, setRestaurantId] = useState("")
  const [restaurantMongoId, setRestaurantMongoId] = useState("")
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageType, setImageType] = useState(null)
  const [activePicker, setActivePicker] = useState(null)
  const [editingSection, setEditingSection] = useState(null)
  const [savingSection, setSavingSection] = useState(false)
  const [editNameValue, setEditNameValue] = useState("")
  const [showManageOutlet, setShowManageOutlet] = useState(false)
  const [manageOutletTab, setManageOutletTab] = useState("hours")
  const [hasPendingReview, setHasPendingReview] = useState(false)

  const profileImageInputRef = useRef(null)
  const menuImageInputRef = useRef(null)
  const snapshotRef = useRef(null)

  const displayId =
    restaurantMongoId && restaurantMongoId.length >= 5
      ? restaurantMongoId.slice(-5)
      : restaurantId || "N/A"

  const applyRestaurantData = (data) => {
    if (!data) return
    setRestaurantData(data)
    const pending = data.pendingProfile
    const isPending = data.hasPendingProfileReview || data.profileReviewStatus === "pending"
    const isRejected = data.profileReviewStatus === "rejected" || data.status === "rejected"
    const isActivePending = isPending || isRejected

    setRestaurantName((isActivePending && pending?.restaurantName) ? pending.restaurantName : data.name || "")
    setRestaurantId(data.restaurantId || data.id || "")
    setRestaurantMongoId(String(data.id || data._id || ""))
    
    const addressToFormat = (isActivePending && pending?.location) ? { ...data.location, ...pending.location } : data.location
    setAddress(formatAddress(addressToFormat))
    
    setHasPendingReview(Boolean(isActivePending))
    setPendingFieldLabels(
      Array.isArray(data.pendingSubmittedFieldLabels) ? data.pendingSubmittedFieldLabels : [],
    )

    const cuisinesToUse = (isActivePending && pending?.cuisines?.length) ? pending.cuisines : data.cuisines
    if (cuisinesToUse?.length) {
      setSelectedCuisines(cuisinesToUse)
      setCuisineTags(cuisinesToUse.join(", "))
    } else {
      setSelectedCuisines([])
      setCuisineTags("")
    }

    const pendingProfileUrl =
      typeof pending?.profileImage === "string"
        ? pending.profileImage
        : pending?.profileImage?.url

    const liveProfileUrl = 
      typeof data.profileImage === "string" 
        ? data.profileImage 
        : data.profileImage?.url

    const snapshotProfileUrl =
      typeof pending?._approvedSnapshot?.profileImage === "string"
        ? pending._approvedSnapshot.profileImage
        : pending?._approvedSnapshot?.profileImage?.url

    if (pendingProfileUrl && isActivePending) {
      setThumbnailImage(pendingProfileUrl)
    } else if (liveProfileUrl) {
      setThumbnailImage(liveProfileUrl)
    } else if (snapshotProfileUrl) {
      setThumbnailImage(snapshotProfileUrl)
    }

    const pendingCovers = Array.isArray(pending?.coverImages) ? pending.coverImages : null
    const liveCovers =
      data.coverImages?.length > 0
        ? data.coverImages
        : data.menuImages?.length > 0
          ? data.menuImages
          : []
    const images =
      pendingCovers !== null && isActivePending ? pendingCovers : liveCovers

    if (images.length > 0) {
      const formatted = images.map((img) => ({
        url: img.url || img,
        publicId: img.publicId,
      }))
      setCoverImages(formatted)
      setMainImage(formatted[0].url)
    } else {
      setCoverImages([])
      setMainImage(FALLBACK_COVER)
    }
  }

  const fetchRestaurantData = async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getCurrentRestaurant()
      const data = response?.data?.data?.restaurant || response?.data?.restaurant
      applyRestaurantData(data)
    } catch (error) {
      if (
        error.code !== "ERR_NETWORK" &&
        error.code !== "ECONNABORTED" &&
        !error.message?.includes("timeout")
      ) {
        toast.error("Failed to load outlet information")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRestaurantData()
  }, [])

  const startEditing = (section) => {
    if (editingSection && editingSection !== section) return
    snapshotRef.current = {
      restaurantName,
      selectedCuisines: [...selectedCuisines],
      cuisineTags,
      address,
    }
    setEditNameValue(restaurantName)
    setEditingSection(section)
  }

  const cancelEditing = () => {
    const snap = snapshotRef.current
    if (snap) {
      setRestaurantName(snap.restaurantName)
      setSelectedCuisines(snap.selectedCuisines)
      setCuisineTags(snap.cuisineTags)
      setAddress(snap.address)
    }
    setEditingSection(null)
    snapshotRef.current = null
  }

  const invalidateAdminCache = () => {
    invalidateApprovedRestaurantsCache()
    if (restaurantMongoId) invalidateRestaurantDetailCache(restaurantMongoId)
  }

  const handleApprovalResponse = (res) => {
    const restaurant = res?.data?.data?.restaurant
    if (restaurant) {
      applyRestaurantData(restaurant)
    }
    invalidateAdminCache()
    const needsApproval =
      restaurant?.requiresApproval || restaurant?.hasPendingProfileReview
    if (needsApproval) {
      setHasPendingReview(true)
      const labels =
        restaurant?.lastSubmittedFieldLabels ||
        restaurant?.pendingSubmittedFieldLabels ||
        []
      if (labels.length) {
        setPendingFieldLabels((prev) => [...new Set([...prev, ...labels])])
      }
      toast.success(
        labels.length
          ? `Submitted for admin review: ${labels.join(", ")}`
          : PENDING_REVIEW_MSG,
      )
      window.dispatchEvent(new Event("restaurantProfileRefresh"))
    } else {
      toast.success("Changes saved")
    }
    return needsApproval
  }

  const handleSaveDetails = async () => {
    const newName = editNameValue.trim()
    if (!newName) {
      toast.error("Restaurant name is required")
      return
    }

    try {
      setSavingSection(true)
      const res = await restaurantAPI.updateProfile({
        name: newName,
        cuisines: selectedCuisines,
      })
      setRestaurantName(newName)
      setCuisineTags(selectedCuisines.join(", "))
      handleApprovalResponse(res)
      setEditingSection(null)
      snapshotRef.current = null
    } catch {
      toast.error("Failed to save restaurant details")
    } finally {
      setSavingSection(false)
    }
  }

  const toggleCuisine = (name) => {
    setSelectedCuisines((prev) => {
      if (prev.includes(name)) return prev.filter((c) => c !== name)
      if (prev.length >= 8) {
        toast.error("You can select up to 8 cuisines")
        return prev
      }
      return [...prev, name]
    })
  }

  const handleProfileImageReplace = async (file) => {
    if (!file) return
    try {
      setUploadingImage(true)
      setImageType("profile")
      const uploadResponse = await restaurantAPI.uploadProfileImage(file)
      const requiresApproval = uploadResponse?.data?.data?.requiresApproval
      if (requiresApproval) {
        setHasPendingReview(true)
        const labels = uploadResponse?.data?.data?.lastSubmittedFieldLabels || ["Profile Image"]
        setPendingFieldLabels((prev) => [...new Set([...prev, ...labels])])
        toast.success(`Submitted for admin review: ${labels.join(", ")}`)
        await fetchRestaurantData()
        invalidateAdminCache()
        window.dispatchEvent(new Event("restaurantProfileRefresh"))
      } else {
        const uploadedImage = uploadResponse?.data?.data?.profileImage
        if (uploadedImage?.url) setThumbnailImage(uploadedImage.url)
        await fetchRestaurantData()
        invalidateAdminCache()
        toast.success("Profile photo updated")
      }
    } catch {
      toast.error("Failed to upload image. Please try again.")
    } finally {
      setUploadingImage(false)
      setImageType(null)
    }
  }

  const handleCoverImageAdd = async (files) => {
    if (!files || (Array.isArray(files) && files.length === 0)) return
    const fileArray = Array.isArray(files) ? files : [files]
    try {
      setUploadingImage(true)
      setImageType("menu")
      const uploadResponse = await restaurantAPI.uploadCoverImages(fileArray)
      const requiresApproval = uploadResponse?.data?.data?.requiresApproval
      if (requiresApproval) {
        setHasPendingReview(true)
        const labels = uploadResponse?.data?.data?.lastSubmittedFieldLabels || ["Outlet Photos"]
        setPendingFieldLabels((prev) => [...new Set([...prev, ...labels])])
        toast.success(`Submitted for admin review: ${labels.join(", ")}`)
        await fetchRestaurantData()
        invalidateAdminCache()
        window.dispatchEvent(new Event("restaurantProfileRefresh"))
      } else {
        await fetchRestaurantData()
        invalidateAdminCache()
        toast.success(`Added ${fileArray.length} photo(s)`)
      }
    } catch {
      toast.error("Failed to upload images. Please try again.")
    } finally {
      setUploadingImage(false)
      setImageType(null)
    }
  }

  const handleImageClick = (type, ref, title, multiple = false) => {
    if (isFlutterBridgeAvailable()) {
      setActivePicker({ type, ref, title, multiple })
    } else {
      ref.current?.click()
    }
  }

  const handleCoverImageDelete = async (indexToDelete) => {
    if (!window.confirm("Delete this cover photo?")) return
    try {
      setUploadingImage(true)
      setImageType("menu")
      const updatedImages = coverImages.filter((_, index) => index !== indexToDelete)
      const coverImagesForBackend = updatedImages.map((img) => ({
        url: img.url,
        publicId: img.publicId || null,
      }))
      const res = await restaurantAPI.updateProfile({ coverImages: coverImagesForBackend })
      const restaurant = res?.data?.data?.restaurant
      if (restaurant) {
        applyRestaurantData(restaurant)
      } else {
        setCoverImages(updatedImages)
        setMainImage(updatedImages.length > 0 ? updatedImages[0].url : FALLBACK_COVER)
      }
      invalidateAdminCache()
      if (restaurant?.requiresApproval || restaurant?.hasPendingProfileReview) {
        const labels = restaurant?.lastSubmittedFieldLabels || []
        if (labels.length) {
          toast.success(`Submitted for admin review: ${labels.join(", ")}`)
        }
      } else {
        toast.success("Photo removed")
      }
    } catch {
      toast.error("Failed to delete image.")
    } finally {
      setUploadingImage(false)
      setImageType(null)
    }
  }

  const openManageOutlet = (tab = "hours") => {
    setManageOutletTab(tab)
    setShowManageOutlet(true)
  }

  const idBadge = (
    <span className="rounded-full border border-[var(--rt-border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600">
      ID · {loading ? "..." : displayId}
    </span>
  )

  return (
    <RestaurantSubPageShell
      title="Outlet info"
      subtitle="Profile, photos, and restaurant details"
      backTo={`${RESTAURANT_BASE}/explore`}
      headerRight={idBadge}
      contentClassName="space-y-5 pb-10"
    >
      {hasPendingReview && restaurantData && (
        <RequestedChangesPanel restaurant={restaurantData} />
      )}

      <OutletInfoHero
        mainImage={mainImage}
        thumbnailImage={thumbnailImage}
        restaurantName={restaurantName}
        rating={restaurantData?.rating}
        totalRatings={restaurantData?.totalRatings}
        loading={loading}
        uploadingImage={uploadingImage}
        imageType={imageType}
        onCoverClick={() => handleImageClick("cover", menuImageInputRef, "Add Cover Image", true)}
        onProfileClick={() => handleImageClick("profile", profileImageInputRef, "Update Profile Photo")}
        menuImageInputRef={menuImageInputRef}
        profileImageInputRef={profileImageInputRef}
        onCoverFiles={handleCoverImageAdd}
        onProfileFile={handleProfileImageReplace}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <EditableSection
            title="Restaurant details"
            description="Business information shown to customers"
            isEditing={editingSection === "details"}
            onEdit={() => startEditing("details")}
            editDisabled={Boolean(editingSection && editingSection !== "details")}
            onCancel={cancelEditing}
            onSave={handleSaveDetails}
            saving={savingSection}
            saveDisabled={!editNameValue.trim()}
            readContent={
              <div className="divide-y divide-[var(--rt-border)]">
                <InfoRow icon={Store} label="Restaurant name" value={restaurantName} loading={loading} />
                <InfoRow
                  icon={UtensilsCrossed}
                  label="Cuisines"
                  value={cuisineTags || "Add cuisines"}
                  loading={loading}
                />
              <InfoRow
                icon={MapPin}
                label="Location"
                value={address || "Set in Manage outlet → Zone setup"}
                loading={loading}
              />
              </div>
            }
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Restaurant name</label>
                <Input
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  className="h-11 rounded-xl border-[var(--rt-border)]"
                  placeholder="Restaurant name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Cuisines (max 8)
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_CUISINES.map((cuisine) => {
                    const selected = selectedCuisines.includes(cuisine)
                    return (
                      <button
                        key={cuisine}
                        type="button"
                        onClick={() => toggleCuisine(cuisine)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          selected
                            ? "bg-[var(--rt-primary-strong)] text-white"
                            : "border border-[var(--rt-border)] bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {cuisine}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </EditableSection>

          <EditableSection
            title="Outlet photos"
            description="Cover photos and gallery images"
            isEditing={editingSection === "photos"}
            onEdit={() => startEditing("photos")}
            editDisabled={Boolean(editingSection && editingSection !== "photos")}
            onCancel={cancelEditing}
            onSave={() => setEditingSection(null)}
            saving={false}
            readContent={
              <OutletPhotoGallery
                coverImages={coverImages}
                uploadingImage={uploadingImage}
                imageType={imageType}
                onAddClick={() => handleImageClick("cover", menuImageInputRef, "Add Photos", true)}
                onDelete={handleCoverImageDelete}
                readOnly
                hideSectionHeader
              />
            }
          >
            <OutletPhotoGallery
              coverImages={coverImages}
              uploadingImage={uploadingImage}
              imageType={imageType}
              onAddClick={() => handleImageClick("cover", menuImageInputRef, "Add Photos", true)}
              onDelete={handleCoverImageDelete}
              hideSectionHeader
            />
            <p className="text-xs text-gray-500">
              Adding photos requires admin approval. Removing photos is applied immediately.
            </p>
          </EditableSection>
        </div>

        <div className="space-y-5">
          <PanelSurface className="p-4 sm:p-5">
            <SectionHeader title="Overview" />
            <div className="grid grid-cols-2 gap-2">
              <StatChip label="Rating" value={restaurantData?.rating?.toFixed(1) || "0.0"} />
              <StatChip label="Reviews" value={restaurantData?.totalRatings || 0} />
              <StatChip label="Outlet ID" value={loading ? "..." : displayId} />
              <StatChip
                label="Status"
                value={restaurantData?.isAcceptingOrders ? "Online" : "Offline"}
              />
            </div>
          </PanelSurface>

          <PanelSurface className="p-4 sm:p-5">
            <SectionHeader
              title="Manage outlet"
              description="Hours, contact, zone, and payouts"
            />
            <button
              type="button"
              onClick={() => openManageOutlet("hours")}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--rt-border)] bg-[var(--rt-primary-soft)] px-4 py-3.5 text-left transition hover:border-[var(--rt-primary-strong)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
                <Settings2 className="h-5 w-5 text-[var(--rt-primary-strong)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">Open manage outlet</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Hours, phone, zone setup, and bank details
                </p>
              </div>
            </button>
            <div className="mt-3 divide-y divide-[var(--rt-border)]">
              <QuickLinkRow
                icon={Clock}
                label="Hours & status"
                description="Updates instantly"
                onClick={() => openManageOutlet("hours")}
              />
              <QuickLinkRow
                icon={Phone}
                label="Phone numbers"
                description="Contact number only"
                onClick={() => openManageOutlet("phone")}
              />
              <QuickLinkRow
                icon={Building2}
                label="Zone setup"
                description="Map pin, city & pincode"
                onClick={() => openManageOutlet("zone")}
              />
              <QuickLinkRow
                icon={CreditCard}
                label="Payouts & finance"
                description="Bank details (admin review)"
                onClick={() => openManageOutlet("finance")}
              />
            </div>
          </PanelSurface>
        </div>
      </div>

      <ManageOutletModal
        open={showManageOutlet}
        onClose={() => {
          setShowManageOutlet(false)
          fetchRestaurantData()
        }}
        initialTab={manageOutletTab}
      />

      <ImageSourcePicker
        isOpen={!!activePicker}
        onClose={() => setActivePicker(null)}
        onFileSelect={(file) => {
          if (activePicker?.type === "profile") {
            handleProfileImageReplace(file)
          } else {
            handleCoverImageAdd(file)
          }
        }}
        title={activePicker?.title}
        description={`Choose how to upload your ${activePicker?.type} photo`}
        fileNamePrefix={`outlet-${activePicker?.type}`}
        galleryInputRef={activePicker?.ref}
      />
    </RestaurantSubPageShell>
  )
}
