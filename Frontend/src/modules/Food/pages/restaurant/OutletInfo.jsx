import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  Building2,
  Clock,
  CreditCard,
  MapPin,
  Phone,
  Store,
  UtensilsCrossed,
} from "lucide-react"
import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import RestaurantPanelModal from "@food/components/restaurant/panel/RestaurantPanelModal"
import { PanelSurface } from "@food/components/restaurant/panel/panelUi"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"
import OutletInfoHero from "@food/components/restaurant/outlet-info/OutletInfoHero"
import OutletPhotoGallery from "@food/components/restaurant/outlet-info/OutletPhotoGallery"
import { InfoRow, QuickLinkRow, SectionHeader, StatChip } from "@food/components/restaurant/outlet-info/outletInfoUi"
import { Input } from "@food/components/ui/input"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { isFlutterBridgeAvailable } from "@food/utils/imageUploadUtils"

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop"
const FALLBACK_PROFILE =
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop"

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
  if (location.landmark) parts.push(location.landmark.trim())

  return parts.join(", ") || ""
}

export default function OutletInfo() {
  const navigate = useNavigate()

  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [restaurantName, setRestaurantName] = useState("")
  const [cuisineTags, setCuisineTags] = useState("")
  const [address, setAddress] = useState("")
  const [mainImage, setMainImage] = useState(FALLBACK_COVER)
  const [thumbnailImage, setThumbnailImage] = useState(FALLBACK_PROFILE)
  const [coverImages, setCoverImages] = useState([])
  const [showEditNameDialog, setShowEditNameDialog] = useState(false)
  const [editNameValue, setEditNameValue] = useState("")
  const [restaurantId, setRestaurantId] = useState("")
  const [restaurantMongoId, setRestaurantMongoId] = useState("")
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageType, setImageType] = useState(null)
  const [activePicker, setActivePicker] = useState(null)

  const profileImageInputRef = useRef(null)
  const menuImageInputRef = useRef(null)

  const displayId =
    restaurantMongoId && restaurantMongoId.length >= 5
      ? restaurantMongoId.slice(-5)
      : restaurantId || "N/A"

  const fetchRestaurantData = async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getCurrentRestaurant()
      const data = response?.data?.data?.restaurant || response?.data?.restaurant
      if (!data) return

      setRestaurantData(data)
      setRestaurantName(data.name || "")
      setRestaurantId(data.restaurantId || data.id || "")
      setRestaurantMongoId(String(data.id || data._id || ""))
      setAddress(formatAddress(data.location))

      if (data.cuisines?.length) {
        setCuisineTags(data.cuisines.join(", "))
      } else {
        setCuisineTags("")
      }

      if (data.profileImage?.url) {
        setThumbnailImage(data.profileImage.url)
      }

      const images =
        data.coverImages?.length > 0
          ? data.coverImages
          : data.menuImages?.length > 0
            ? data.menuImages
            : []

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

    const onCuisinesUpdate = () => fetchRestaurantData()
    const onAddressUpdate = () => fetchRestaurantData()

    window.addEventListener("cuisinesUpdated", onCuisinesUpdate)
    window.addEventListener("addressUpdated", onAddressUpdate)

    return () => {
      window.removeEventListener("cuisinesUpdated", onCuisinesUpdate)
      window.removeEventListener("addressUpdated", onAddressUpdate)
    }
  }, [])

  const handleProfileImageReplace = async (file) => {
    if (!file) return

    try {
      setUploadingImage(true)
      setImageType("profile")

      const uploadResponse = await restaurantAPI.uploadProfileImage(file)
      const uploadedImage = uploadResponse?.data?.data?.profileImage

      if (uploadedImage?.url) {
        setThumbnailImage(uploadedImage.url)
      }

      await fetchRestaurantData()
      toast.success("Profile photo updated")
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
      const newCoverImages = uploadResponse?.data?.data?.coverImages || []

      if (newCoverImages.length > 0) {
        await fetchRestaurantData()
        toast.success(`Added ${newCoverImages.length} photo(s)`)
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

      await restaurantAPI.updateProfile({ coverImages: coverImagesForBackend })
      setCoverImages(updatedImages)

      if (updatedImages.length > 0) {
        setMainImage(updatedImages[0].url)
      } else {
        setMainImage(FALLBACK_COVER)
      }

      toast.success("Photo removed")
    } catch {
      toast.error("Failed to delete image.")
    } finally {
      setUploadingImage(false)
      setImageType(null)
    }
  }

  const handleOpenEditDialog = () => {
    setEditNameValue(restaurantName)
    setShowEditNameDialog(true)
  }

  const handleSaveName = async () => {
    const newName = editNameValue.trim()
    if (!newName) return

    try {
      await restaurantAPI.updateProfile({ name: newName })
      setRestaurantName(newName)
      setShowEditNameDialog(false)
      toast.success("Restaurant name updated")
    } catch {
      toast.error("Failed to update name")
    }
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
          <PanelSurface className="p-4 sm:p-5">
            <SectionHeader
              title="Restaurant details"
              description="Tap any field to update your outlet information"
            />
            <div className="divide-y divide-[var(--rt-border)]">
              <InfoRow
                icon={Store}
                label="Restaurant name"
                value={restaurantName}
                loading={loading}
                onClick={handleOpenEditDialog}
              />
              <InfoRow
                icon={UtensilsCrossed}
                label="Cuisines"
                value={cuisineTags || "Add cuisines"}
                loading={loading}
                onClick={() => navigate(`${RESTAURANT_BASE}/edit-cuisines`)}
              />
              <InfoRow
                icon={MapPin}
                label="Address"
                value={address || "Add delivery address"}
                loading={loading}
                onClick={() => navigate(`${RESTAURANT_BASE}/edit-address`)}
              />
            </div>
          </PanelSurface>

          <PanelSurface className="p-4 sm:p-5">
            <OutletPhotoGallery
              coverImages={coverImages}
              uploadingImage={uploadingImage}
              imageType={imageType}
              onAddClick={() => handleImageClick("cover", menuImageInputRef, "Add Photos", true)}
              onDelete={handleCoverImageDelete}
            />
          </PanelSurface>
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
              description="Quick links to related settings"
            />
            <div className="divide-y divide-[var(--rt-border)]">
              <QuickLinkRow
                icon={Clock}
                label="Hours & status"
                description="Online toggle and weekly schedule"
                onClick={() => navigate(`${RESTAURANT_BASE}/outlet-timings`)}
              />
              <QuickLinkRow
                icon={Phone}
                label="Phone numbers"
                description="Customer contact numbers"
                onClick={() => navigate(`${RESTAURANT_BASE}/phone`)}
              />
              <QuickLinkRow
                icon={Building2}
                label="Zone setup"
                description="Delivery area configuration"
                onClick={() => navigate(`${RESTAURANT_BASE}/zone-setup`)}
              />
              <QuickLinkRow
                icon={CreditCard}
                label="Payouts & finance"
                description="Bank details and earnings"
                onClick={() => navigate(`${RESTAURANT_BASE}/hub-finance`)}
              />
            </div>
          </PanelSurface>
        </div>
      </div>

      <RestaurantPanelModal
        open={showEditNameDialog}
        onClose={() => setShowEditNameDialog(false)}
        title="Edit restaurant name"
        description="This name is shown to customers on the app"
        size="sm"
        mobileMaxHeight="auto"
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowEditNameDialog(false)}
              className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveName}
              disabled={!editNameValue.trim()}
              className="flex-1 rounded-xl bg-[var(--rt-primary-strong)] py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
        }
      >
        <Input
          value={editNameValue}
          onChange={(e) => setEditNameValue(e.target.value)}
          placeholder="Restaurant name"
          className="h-12 rounded-xl border-[var(--rt-border)] text-base"
          autoFocus
        />
      </RestaurantPanelModal>

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
