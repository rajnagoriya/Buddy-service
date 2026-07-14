import { useState, useRef, useEffect } from "react"
import { useNavigate, useParams, useLocation } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Trash2,
  Check,
  ChevronDown,
  Edit as EditIcon,
  Plus,
  X,
  Camera,
  ThumbsUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Utensils
} from "lucide-react"
import { Switch } from "@food/components/ui/switch"
import { Input } from "@food/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
// Removed getAllFoods and saveFood - now using menu API
import api from "@food/api"
import { restaurantAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import RestaurantPanelModal from "@food/components/restaurant/panel/RestaurantPanelModal"
import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import { isFlutterBridgeAvailable } from "@food/utils/imageUploadUtils"
import { getFoodVariants } from "@food/utils/foodVariants"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const INVENTORY_RECOMMENDED_KEY = "restaurant_inventory_recommended_map"
const GST_OPTIONS = ["0.0", "5.0", "12.0", "18.0"]


const getUploadErrorMessage = (error, fileName = "image") => {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Please try again."
  return `Failed to upload ${fileName}: ${message}`
}

const createVariantDraft = (variant = {}) => ({
  localId: String(variant?.id || variant?._id || `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
  persistedId: String(variant?.id || variant?._id || ""),
  name: String(variant?.name || ""),
  price: variant?.price != null ? String(variant.price) : "",
  unit: String(variant?.unit || "piece"),
})

export default function ItemDetailsPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const { id } = useParams()
  const location = useLocation()
  const isNewItem = id === "new"
  const groupId = location.state?.groupId
  const defaultCategory = location.state?.category || "Select category"
  const defaultCategoryId = location.state?.categoryId || ""
  const fileInputRef = useRef(null)

  // Initialize state with empty values - will be populated from API
  const [itemData, setItemData] = useState(null) // Store the full item data for saving
  const [itemName, setItemName] = useState("")
  const [category, setCategory] = useState(defaultCategory)
  const [selectedCategoryId, setSelectedCategoryId] = useState(defaultCategoryId)
  const [subCategory, setSubCategory] = useState("")
  const [servesInfo, setServesInfo] = useState("")
  const [itemSizeQuantity, setItemSizeQuantity] = useState("")
  const [itemSizeUnit, setItemSizeUnit] = useState("piece")
  const [itemDescription, setItemDescription] = useState("")
  const [foodType, setFoodType] = useState("Non-Veg")
  const [basePrice, setBasePrice] = useState("")
  const [variants, setVariants] = useState([])
  const [preparationTime, setPreparationTime] = useState("")
  const [gst, setGst] = useState("5.0")
  const [isRecommended, setIsRecommended] = useState(false)
  const [isInStock, setIsInStock] = useState(true)
  const [weightPerServing, setWeightPerServing] = useState("")
  const [calorieCount, setCalorieCount] = useState("")
  const [proteinCount, setProteinCount] = useState("")
  const [carbohydrates, setCarbohydrates] = useState("")
  const [fatCount, setFatCount] = useState("")
  const [fibreCount, setFibreCount] = useState("")
  const [allergens, setAllergens] = useState("")
  const [showMoreNutrition, setShowMoreNutrition] = useState(false)
  const [selectedTags, setSelectedTags] = useState([])
  const [images, setImages] = useState([])
  const [imageFiles, setImageFiles] = useState(new Map()) // Track File objects by preview URL
  const [uploadingImages, setUploadingImages] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [saveStatus, setSaveStatus] = useState("") // "" | "uploading" | "saving"
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)
  const [direction, setDirection] = useState(0)
  const carouselRef = useRef(null)
  const [isCategoryPopupOpen, setIsCategoryPopupOpen] = useState(false)
  const [isServesPopupOpen, setIsServesPopupOpen] = useState(false)
  const [isItemSizePopupOpen, setIsItemSizePopupOpen] = useState(false)
  const [isGstPopupOpen, setIsGstPopupOpen] = useState(false)
  const [isTagsPopupOpen, setIsTagsPopupOpen] = useState(false)
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [loadingItem, setLoadingItem] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)

  const maxNameLength = 70
  const maxDescriptionLength = 1000
  const descriptionLength = itemDescription.length
  const minDescriptionLength = 5
  const nameLength = itemName.length
  const currentApprovalStatus = String(itemData?.approvalStatus || "").toLowerCase()
  const currentRejectionReason = String(itemData?.rejectionReason || "").trim()

  const populateFormFromItem = (item = {}) => {
    setItemData(item)

    setItemName(item.name || "")
    setCategory(item.category || item.categoryName || defaultCategory)
    setSelectedCategoryId(item.categoryId || "")
    setSubCategory(item.subCategory || item.category || item.categoryName || "Starters")
    setServesInfo(item.servesInfo || "")
    setItemSizeQuantity(item.itemSizeQuantity || "")
    setItemSizeUnit(item.itemSizeUnit || "piece")
    setItemDescription(item.description || "")
    setFoodType(item.foodType === "Veg" ? "Veg" : "Non-Veg")
    const itemVariants = getFoodVariants(item)
    setVariants(itemVariants.map(createVariantDraft))
    setBasePrice(itemVariants.length === 0 ? item.price?.toString() || "" : "")
    setPreparationTime(item.preparationTime || "")
    setGst(item.gst?.toString() || "5.0")
    setIsRecommended(item.isRecommended || false)
    setIsInStock(item.isAvailable !== false)
    setSelectedTags(item.tags || [])

    const existingImages = Array.isArray(item.images) && item.images.length > 0
      ? item.images.filter(Boolean)
      : (item.image ? [item.image] : [])
    setImages(existingImages)

    setWeightPerServing("")
    setCalorieCount("")
    setProteinCount("")
    setCarbohydrates("")
    setFatCount("")
    setFibreCount("")
    setAllergens("")

    if (item.nutrition && Array.isArray(item.nutrition)) {
      item.nutrition.forEach(nut => {
        if (typeof nut === 'string') {
          if (nut.includes('Weight per serving')) {
            const match = nut.match(/(\d+)\s*grams?/i)
            if (match) setWeightPerServing(match[1])
          } else if (nut.includes('Calorie count')) {
            const match = nut.match(/(\d+)\s*Kcal/i)
            if (match) setCalorieCount(match[1])
          } else if (nut.includes('Protein count')) {
            const match = nut.match(/(\d+)\s*mg/i)
            if (match) setProteinCount(match[1])
          } else if (nut.includes('Carbohydrates')) {
            const match = nut.match(/(\d+)\s*mg/i)
            if (match) setCarbohydrates(match[1])
          } else if (nut.includes('Fat count')) {
            const match = nut.match(/(\d+)\s*mg/i)
            if (match) setFatCount(match[1])
          } else if (nut.includes('Fibre count')) {
            const match = nut.match(/(\d+)\s*mg/i)
            if (match) setFibreCount(match[1])
          }
        }
      })
    }

    if (item.allergies && Array.isArray(item.allergies) && item.allergies.length > 0) {
      setAllergens(item.allergies.join(", "))
    }
  }

  // Fetch item data from menu API when editing
  useEffect(() => {
    const fetchItemData = async () => {
      if (location.state?.item) {
        populateFormFromItem(location.state.item)
      }

      if (!isNewItem && id) {
        try {
          setLoadingItem(true)
          const menuResponse = await restaurantAPI.getMenu()
          const menu = menuResponse.data?.data?.menu
          const sections = menu?.sections || []

          // Find the item across all sections
          let foundItem = null
          const searchId = String(id).trim()
          for (const section of sections) {
            // Check items in section
            const item = section.items?.find(i => {
              const itemId = String(i.id || i._id || '').trim()
              return itemId === searchId || itemId === id
            })
            if (item) {
              foundItem = item
              break
            }
            // Check items in subsections
            if (section.subsections) {
              for (const subsection of section.subsections) {
                const subItem = subsection.items?.find(i => {
                  const itemId = String(i.id || i._id || '').trim()
                  return itemId === searchId || itemId === id
                })
                if (subItem) {
                  foundItem = subItem
                  break
                }
              }
              if (foundItem) break
            }
          }

          if (foundItem) {
            populateFormFromItem(foundItem)
          } else {
            toast.error("Item not found")
          }
        } catch (error) {
          debugError('Error fetching item data:', error)
          toast.error("Failed to load item data")
        } finally {
          setLoadingItem(false)
        }
      }
    }

    fetchItemData()
  }, [id, isNewItem, location.state, defaultCategory])

  // Fetch categories from restaurant-specific API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true)
        const response = await restaurantAPI.getCategories()
        if (response.data.success && response.data.data.categories) {
          // Format categories for the UI - flat list, no subcategories
          const formattedCategories = response.data.data.categories.map(cat => ({
            id: cat._id || cat.id,
            name: cat.name,
            foodTypeScope: cat.foodTypeScope || "Both",
          }))

          debugLog('Formatted restaurant categories:', formattedCategories)
          setCategories(formattedCategories)
          if (!selectedCategoryId && formattedCategories.length > 0) {
            const preferredName = String(category || defaultCategory || "").trim()
            const matchedByName = formattedCategories.find((cat) => cat.name === preferredName)
            const nextCategory = matchedByName || (isNewItem ? formattedCategories[0] : null)
            if (nextCategory) {
              setSelectedCategoryId(nextCategory.id)
              setCategory(nextCategory.name)
            }
          }
        } else {
          // If no categories exist, show empty array (user can add categories)
          setCategories([])
        }
      } catch (error) {
        debugError('Error fetching restaurant categories:', error)
        // Show empty array on error - user can add categories
        setCategories([])
      } finally {
        setLoadingCategories(false)
      }
    }

    fetchCategories()
  }, [category, defaultCategory, defaultCategoryId, isNewItem, selectedCategoryId])

  // Keep focused form fields visible above mobile keyboard
  useEffect(() => {
    const ensureFieldVisible = (target) => {
      if (!target) return
      const isFormField = target.matches?.('input, textarea, select, [contenteditable="true"]')
      if (!isFormField) return

      window.setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
      }, 120)
    }

    const handleFocusIn = (event) => {
      ensureFieldVisible(event.target)
    }

    document.addEventListener("focusin", handleFocusIn, true)
    return () => {
      document.removeEventListener("focusin", handleFocusIn, true)
    }
  }, [])

  // Track virtual keyboard height and push footer above keyboard
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const updateKeyboardInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      setKeyboardInset(inset > 60 ? inset : 0)
    }

    viewport.addEventListener("resize", updateKeyboardInset)
    viewport.addEventListener("scroll", updateKeyboardInset)
    updateKeyboardInset()

    return () => {
      viewport.removeEventListener("resize", updateKeyboardInset)
      viewport.removeEventListener("scroll", updateKeyboardInset)
    }
  }, [])

  // Serves info options
  const servesOptions = [
    "Serves eg. 1-2 people",
    "Serves eg. 2-3 people",
    "Serves eg. 3-4 people",
    "Serves eg. 4-5 people",
    "Serves eg. 5-6 people",
  ]

  // Item size unit options
  const itemSizeUnits = [
    "slices",
    "kg",
    "litre",
    "ml",
    "serves",
    "cms",
    "piece"
  ]

  // Item tags organized by categories
  const itemTagsCategories = [
    {
      category: "Speciality",
      tags: ["Freshly Frosted", "Pre Frosted", "Chef's Special"]
    },
    {
      category: "Spice Level",
      tags: ["Medium Spicy", "Very Spicy"]
    },
    {
      category: "Miscellaneous",
      tags: ["Gluten Free", "Sugar Free", "Jain"]
    },
    {
      category: "Dietary Restrictions",
      tags: ["Vegan"]
    }
  ]

  const handleImageAdd = (file) => {
    if (!file) return

    // Single-image mode: keep only the first selected valid file
    const previewUrl = URL.createObjectURL(file)

    images.forEach((img) => {
      if (img && img.startsWith('blob:')) {
        URL.revokeObjectURL(img)
      }
    })

    const newImageFilesMap = new Map()
    newImageFilesMap.set(previewUrl, file)

    setImages([previewUrl])
    setImageFiles(newImageFilesMap)
    setCurrentImageIndex(0)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleCameraClick = () => {
    if (isFlutterBridgeAvailable()) {
      setIsPhotoPickerOpen(true)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleImageDelete = (index) => {
    if (index < 0 || index >= images.length) return

    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return
    }

    const imageToDelete = images[index]
    const newImages = images.filter((_, i) => i !== index)
    const newImageFilesMap = new Map(imageFiles)

    // Remove the file mapping and revoke the blob URL if it's a preview (new upload)
    if (imageToDelete && imageToDelete.startsWith('blob:')) {
      newImageFilesMap.delete(imageToDelete)
      URL.revokeObjectURL(imageToDelete)
      debugLog('Deleted preview image (blob URL):', imageToDelete)
    } else if (imageToDelete && (imageToDelete.startsWith('http://') || imageToDelete.startsWith('https://'))) {
      // For already uploaded images, we need to remove from imageFiles map if it exists
      // Find and remove the file entry if it exists
      for (const [previewUrl, file] of newImageFilesMap.entries()) {
        // This shouldn't happen for HTTP URLs, but just in case
        if (previewUrl === imageToDelete) {
          newImageFilesMap.delete(previewUrl)
          URL.revokeObjectURL(previewUrl)
        }
      }
      debugLog('Deleted uploaded image (HTTP URL):', imageToDelete)
    }

    setImages(newImages)
    setImageFiles(newImageFilesMap)

    // Adjust current image index after deletion
    if (newImages.length === 0) {
      setCurrentImageIndex(0)
    } else if (currentImageIndex >= newImages.length) {
      setCurrentImageIndex(newImages.length - 1)
    } else if (currentImageIndex > index) {
      // If we deleted an image before the current one, no need to change index
      // If we deleted the current one or after, index stays the same (shows next image)
    }

    toast.success('Image deleted successfully')
    debugLog(`Image deleted. Remaining images: ${newImages.length}`)
  }

  // Swipe handlers
  const minSwipeDistance = 50

  const onTouchStart = (e) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && images.length > 0) {
      setDirection(1)
      setCurrentImageIndex((prev) => (prev + 1) % images.length)
    }
    if (isRightSwipe && images.length > 0) {
      setDirection(-1)
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
    }
  }

  const goToNext = () => {
    setDirection(1)
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const goToPrevious = () => {
    setDirection(-1)
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleCategorySelect = (catId, subCat) => {
    const selectedCategory = categories.find(c => c.id === catId)
    setSelectedCategoryId(selectedCategory?.id || "")
    setCategory(selectedCategory?.name || "")
    setSubCategory(subCat)
    setIsCategoryPopupOpen(false)
  }

  const handleServesSelect = (option) => {
    setServesInfo(option)
    setIsServesPopupOpen(false)
  }

  const handleItemSizeUnitSelect = (unit) => {
    setItemSizeUnit(unit)
    setIsItemSizePopupOpen(false)
  }

  const handleGstSelect = (gstValue) => {
    setGst(gstValue)
    setIsGstPopupOpen(false)
  }

  const handleTagToggle = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const handleSave = async () => {
    if (!itemName.trim()) {
      toast.error("Please enter an item name")
      return
    }

    try {
      setUploadingImages(true)
      setSaveStatus("uploading")

      // Upload new images to Cloudinary
      const uploadedImageUrls = []

      // Separate existing URLs (already uploaded) from new files (blob URLs)
      const existingImageUrls = images.filter(img =>
        typeof img === 'string' &&
        (img.startsWith('http://') || img.startsWith('https://')) &&
        !img.startsWith('blob:')
      )

      debugLog('Images state:', images)
      debugLog('Existing image URLs (already uploaded):', existingImageUrls)
      debugLog('Image files map:', imageFiles)

      // Upload new File objects to Cloudinary (files that are blob URLs)
      const filesToUpload = Array.from(imageFiles.values())
      debugLog('Files to upload:', filesToUpload.length, filesToUpload)

      if (filesToUpload.length > 0) {
        for (let i = 0; i < filesToUpload.length; i++) {
          const file = filesToUpload[i]
          try {
            debugLog(`Uploading image ${i + 1}/${filesToUpload.length}:`, file.name)
            let uploadResponse
            try {
              uploadResponse = await uploadAPI.uploadMedia(file, {
                folder: 'appzeto/restaurant/menu-items'
              })
            } catch (folderUploadError) {
              // Fallback: retry without folder in case provider/account rejects custom folder.
              debugWarn(`Retrying upload without folder for ${file.name}:`, folderUploadError)
              uploadResponse = await uploadAPI.uploadMedia(file)
            }
            const imageUrl = uploadResponse?.data?.data?.url || uploadResponse?.data?.url
            if (imageUrl) {
              uploadedImageUrls.push(imageUrl)
              debugLog(`Successfully uploaded image ${i + 1}:`, imageUrl)
            } else {
              debugError('Upload response:', uploadResponse)
              throw new Error("Failed to get uploaded image URL")
            }
          } catch (uploadError) {
            debugError(`Error uploading image ${i + 1} (${file.name}):`, uploadError)
            toast.error(getUploadErrorMessage(uploadError, file.name))
            setUploadingImages(false)
            return
          }
        }
      }

      // Single-image mode: keep only one URL
      const allImageUrls = [
        ...existingImageUrls,
        ...uploadedImageUrls
      ].filter((url, index, self) =>
        url &&
        typeof url === 'string' &&
        url.trim() !== '' &&
        self.indexOf(url) === index
      ).slice(0, 1)

      // Debug: Log image URLs
      debugLog('=== IMAGE UPLOAD SUMMARY ===')
      debugLog('Existing image URLs:', existingImageUrls.length, existingImageUrls)
      debugLog('Newly uploaded URLs:', uploadedImageUrls.length, uploadedImageUrls)
      debugLog('Total image URLs to save:', allImageUrls.length, allImageUrls)
      debugLog('==========================')

      // Resolve categoryId from fetched categories (so FoodItem stores categoryId efficiently).
      const matchedCategory = Array.isArray(categories)
        ? categories.find((c) => String(c?.id || "") === String(selectedCategoryId || ""))
        : null
      const categoryId = matchedCategory?.id || matchedCategory?._id || null
      const categoryName = matchedCategory?.name || category || ""

      if (!categoryId) {
        toast.error("Please select an approved category first")
        setIsCategoryPopupOpen(true)
        setUploadingImages(false)
        return
      }

      if (
        matchedCategory?.foodTypeScope &&
        matchedCategory.foodTypeScope !== "Both" &&
        matchedCategory.foodTypeScope !== foodType
      ) {
        toast.error(`This ${matchedCategory.foodTypeScope} category cannot accept ${foodType} food`)
        setUploadingImages(false)
        return
      }

      const normalizedVariants = variants
        .map((variant) => ({
          persistedId: String(variant.persistedId || "").trim(),
          name: String(variant.name || "").trim(),
          price: Number(variant.price),
          unit: String(variant.unit || "piece").trim(),
        }))
        .filter((variant) => variant.name || variant.persistedId || variant.price)

      if (normalizedVariants.some((variant) => !variant.name)) {
        toast.error("Each variant must have a name")
        setUploadingImages(false)
        return
      }

      if (normalizedVariants.some((variant) => !Number.isFinite(variant.price) || variant.price <= 0)) {
        toast.error("Each variant price must be greater than 0")
        setUploadingImages(false)
        return
      }

      const hasVariants = normalizedVariants.length > 0
      const parsedBasePrice = Number(basePrice)
      if (!hasVariants && (!Number.isFinite(parsedBasePrice) || parsedBasePrice < 0)) {
        toast.error("Please enter a valid base price")
        setUploadingImages(false)
        return
      }

      const variantPayload = normalizedVariants.map((variant) => ({
        ...(variant.persistedId ? { _id: variant.persistedId } : {}),
        name: variant.name,
        price: variant.price,
        unit: variant.unit,
      }))

      // Create/update FoodItem in DB (single call per explicit Save; no autosave spam)
      setSaveStatus("saving")
      let itemId
      if (isNewItem) {
        const createRes = await restaurantAPI.createFood({
          name: itemName.trim(),
          description: itemDescription.trim(),
          price: hasVariants ? undefined : parsedBasePrice,
          variants: variantPayload,
          image: allImageUrls.length > 0 ? allImageUrls[0] : "",
          foodType: foodType,
          isAvailable: isInStock,
          preparationTime: preparationTime || "",
          categoryId: categoryId || undefined,
          categoryName,
        })
        const created = createRes?.data?.data?.food || createRes?.data?.food
        itemId = String(created?._id || created?.id || "")
        if (!itemId) {
          throw new Error("Failed to create item in database")
        }
      } else {
        itemId = String(itemData?.id || id || "")
        if (!itemId) {
          throw new Error("Invalid item id")
        }
        await restaurantAPI.updateFood(itemId, {
          name: itemName.trim(),
          description: itemDescription.trim(),
          price: hasVariants ? undefined : parsedBasePrice,
          variants: variantPayload,
          image: allImageUrls.length > 0 ? allImageUrls[0] : "",
          foodType: foodType,
          isAvailable: isInStock,
          preparationTime: preparationTime || "",
          categoryId: categoryId || undefined,
          categoryName,
        })
      }

      try {
        const nextRecommendedMap = (() => {
          if (typeof window === "undefined") return null
          const raw = window.localStorage.getItem(INVENTORY_RECOMMENDED_KEY)
          const parsed = raw ? JSON.parse(raw) : {}
          const safeMap = parsed && typeof parsed === "object" ? parsed : {}
          return {
            ...safeMap,
            [String(itemId)]: Boolean(isRecommended),
          }
        })()

        if (nextRecommendedMap && typeof window !== "undefined") {
          window.localStorage.setItem(
            INVENTORY_RECOMMENDED_KEY,
            JSON.stringify(nextRecommendedMap),
          )
        }
      } catch (recommendedError) {
        debugWarn("Failed to persist recommended state after save:", recommendedError)
      }

      const imageCount = allImageUrls.length
      toast.success(
        isNewItem
          ? `Item created successfully with ${imageCount} image(s)`
          : `Item updated and sent for approval again with ${imageCount} image(s)`
      )
      await new Promise((resolve) => setTimeout(resolve, 200))
      navigate("/food/restaurant/inventory", { replace: true })
      window.dispatchEvent(new CustomEvent('foodsChanged'))
    } catch (error) {
      debugError('Error saving menu:', error)
      if (error.code === 'ERR_NETWORK') {
        toast.error('Network error. Please check if backend server is running and try again.')
      } else {
        toast.error(error.response?.data?.message || error.message || "Failed to save item. Please try again.")
      }
    } finally {
      setUploadingImages(false)
      setSaveStatus("")
    }
  }

  const handleVariantChange = (localId, field, value) => {
    setVariants((prev) =>
      prev.map((variant) =>
        variant.localId === localId ? { ...variant, [field]: value } : variant,
      ),
    )
  }

  const handleAddVariant = () => {
    setVariants((prev) => [...prev, createVariantDraft()])
  }

  const handleRemoveVariant = (localId) => {
    setVariants((prev) => prev.filter((variant) => variant.localId !== localId))
  }

  const handleDelete = async () => {
    const itemId = String(itemData?.id || itemData?._id || id || "").trim()
    if (!itemId || itemId === "new") {
      toast.error("Invalid item id")
      return
    }

    const dishName = itemName.trim() || "this dish"
    if (!window.confirm(`Are you sure you want to delete "${dishName}"? This action cannot be undone.`)) {
      return
    }

    try {
      setIsDeleting(true)
      await restaurantAPI.deleteFood(itemId)

      try {
        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(INVENTORY_RECOMMENDED_KEY)
          const parsed = raw ? JSON.parse(raw) : {}
          if (parsed && typeof parsed === "object" && Object.prototype.hasOwnProperty.call(parsed, itemId)) {
            const nextRecommendedMap = { ...parsed }
            delete nextRecommendedMap[itemId]
            window.localStorage.setItem(INVENTORY_RECOMMENDED_KEY, JSON.stringify(nextRecommendedMap))
          }
        }
      } catch (recommendedError) {
        debugWarn("Failed to clear recommended state after delete:", recommendedError)
      }

      toast.success("Dish deleted successfully")
      window.dispatchEvent(new CustomEvent("foodsChanged"))
      navigate("/food/restaurant/inventory", { replace: true })
    } catch (error) {
      debugError("Error deleting dish:", error)
      toast.error(error?.response?.data?.message || error?.message || "Failed to delete dish")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <RestaurantSubPageShell
      title={isNewItem ? "Add dish" : "Item details"}
      subtitle={isNewItem ? "Add a new dish to your menu" : "Update dish details, pricing, and variants"}
      backTo="/food/restaurant/inventory"
      showBottomNav={false}
    >
      <style>{`
        [data-slot="switch"][data-state="checked"] {
          background-color: #16a34a !important;
        }
        [data-slot="switch-thumb"][data-state="checked"] {
          background-color: #ffffff !important;
        }
      `}</style>

      {/* Main Grid: Form on left, Media/Actions on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle Column - Form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Rejection Warning Banner */}
          {!isNewItem && currentApprovalStatus === "rejected" && currentRejectionReason ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
              <p className="text-sm font-semibold text-red-700">Approval rejected</p>
              <p className="mt-1 text-sm leading-relaxed text-red-600">Reason: {currentRejectionReason}</p>
              <p className="mt-2.5 text-xs font-bold uppercase tracking-[0.1em] text-red-500">
                Update the dish details below and save to resubmit for approval
              </p>
            </div>
          ) : null}

          {/* Basic Details Section */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 lg:p-6 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-50 pb-2">Basic Info</h2>
            
            {/* Category Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Category
              </label>
              <button
                type="button"
                onClick={() => setIsCategoryPopupOpen(true)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-left flex items-center justify-between bg-white hover:bg-slate-50/50 hover:border-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent"
              >
                <span className="text-sm font-medium text-slate-800">
                  {category || "Select category"}
                </span>
                <ChevronDown className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Item Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Item Name
              </label>
              <div className="relative">
                <Input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  maxLength={maxNameLength}
                  className="w-full pr-12 focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:border-transparent transition-all text-sm font-medium text-slate-800"
                  placeholder="Enter item name"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400">
                  <EditIcon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-right mt-1.5">
                <span className="text-[10px] font-semibold text-slate-400">
                  {nameLength} / {maxNameLength}
                </span>
              </div>
            </div>

            {/* Item Description & Food Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Description
              </label>
              <div className="relative">
                <textarea
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  maxLength={maxDescriptionLength}
                  rows={4}
                  placeholder="Eg: Yummy veg paneer burger with a soft patty, veggies, cheese, and special sauce"
                  className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent transition-all resize-none leading-relaxed"
                />
                <div className="absolute right-3 top-3 p-1 text-slate-400">
                  <EditIcon className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className={`text-xs ${descriptionLength < minDescriptionLength ? "text-red-500" : "text-slate-400"}`}>
                  {descriptionLength < minDescriptionLength ? "Min 5 characters required" : ""}
                </span>
                <span className="text-[10px] font-semibold text-slate-400">
                  {descriptionLength} / {maxDescriptionLength}
                </span>
              </div>
            </div>

            {/* Dietary Options */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Food Type
              </label>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setFoodType("Veg")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${foodType === "Veg"
                    ? "bg-green-50 text-green-700 border-2 border-green-600"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-2 border-transparent"
                    }`}
                >
                  <div className="h-4 w-4 shrink-0 rounded border flex items-center justify-center border-green-600">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
                  </div>
                  <span>Veg</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFoodType("Non-Veg")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${foodType === "Non-Veg"
                    ? "bg-red-50 text-red-700 border-2 border-red-600"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-2 border-transparent"
                    }`}
                >
                  <div className="h-4 w-4 shrink-0 rounded border flex items-center justify-center border-red-600">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                  </div>
                  <span>Non-Veg</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pricing & Variants Section */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 lg:p-6 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-50 pb-2">Pricing & Variations</h2>
            
            {variants.length === 0 ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Base Price</label>
                <div className="relative">
                  <Input
                    type="text"
                    value={basePrice}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[\u20B9\s,]/g, '').replace(/[^0-9.]/g, '')
                      const parts = value.split('.')
                      const cleanedValue = parts.length > 2
                        ? parts[0] + '.' + parts.slice(1).join('')
                        : value
                      setBasePrice(cleanedValue)
                    }}
                    placeholder="Enter price"
                    className="w-full pl-8 pr-12 focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:border-transparent transition-all text-sm font-semibold text-slate-800"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">₹</span>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400">
                    <EditIcon className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3.5 text-xs font-semibold text-amber-800 leading-normal">
                💡 Customers will see the lowest variant price first. Base price is disabled while variants exist.
              </div>
            )}

            {/* Variants Editor */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">Custom Variants</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Add options with custom names and prices (e.g. Half, Full).</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddVariant}
                  className="inline-flex items-center gap-1 rounded-xl bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-2 text-xs font-bold text-green-700 transition-colors shrink-0 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Variant
                </button>
              </div>

              {variants.length > 0 ? (
                <div className="space-y-3">
                  {variants.map((variant, index) => (
                    <div key={variant.localId} className="flex gap-2 items-center bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Variant Name</label>
                          <Input
                            type="text"
                            value={variant.name}
                            onChange={(e) => handleVariantChange(variant.localId, "name", e.target.value)}
                            placeholder={index === 0 ? "e.g., Half" : "e.g., Full"}
                            className="w-full focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:border-transparent transition-all text-sm font-medium text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Price (₹)</label>
                          <div className="relative">
                            <Input
                              type="text"
                              value={variant.price}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[\u20B9\s,]/g, '').replace(/[^0-9.]/g, '')
                                const parts = value.split('.')
                                const cleanedValue = parts.length > 2
                                  ? parts[0] + '.' + parts.slice(1).join('')
                                  : value
                                handleVariantChange(variant.localId, "price", cleanedValue)
                              }}
                              placeholder="Enter price"
                              className="w-full pl-8 pr-3 focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:border-transparent transition-all text-sm font-semibold text-slate-800"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Unit</label>
                          <Select
                            value={variant.unit || "piece"}
                            onValueChange={(val) => handleVariantChange(variant.localId, "unit", val)}
                          >
                            <SelectTrigger className="w-full bg-white text-sm font-medium text-slate-800 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#16A34A] focus:border-transparent h-[40px]">
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                              <SelectItem value="piece">piece</SelectItem>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="gm">gm</SelectItem>
                              <SelectItem value="litre">litre</SelectItem>
                              <SelectItem value="ml">ml</SelectItem>
                              <SelectItem value="plates">plates</SelectItem>
                              <SelectItem value="serves">serves</SelectItem>
                              <SelectItem value="serving">serving</SelectItem>
                              <SelectItem value="portion">portion</SelectItem>
                              <SelectItem value="Plate">Plate</SelectItem>
                              <SelectItem value="Serving">Serving</SelectItem>
                              <SelectItem value="Portion">Portion</SelectItem>
                              {variant.unit && ![
                                "piece", "kg", "gm", "litre", "ml", "plates", "serves",
                                "serving", "portion", "Plate", "Serving", "Portion"
                              ].includes(variant.unit) && (
                                <SelectItem value={variant.unit}>{variant.unit}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(variant.localId)}
                        className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 flex items-center justify-center transition-colors shrink-0 mt-4"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No variants added. This item will use the base price.</p>
              )}
            </div>

            {/* Preparation Time */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Preparation Time</label>
              <Select
                value={preparationTime}
                onValueChange={setPreparationTime}
              >
                <SelectTrigger className="w-full bg-white text-sm font-medium text-slate-800 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#16A34A] focus:border-transparent h-[46px]">
                  <SelectValue placeholder="Select timing" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="10-20 mins">10-20 mins</SelectItem>
                  <SelectItem value="20-25 mins">20-25 mins</SelectItem>
                  <SelectItem value="25-35 mins">25-35 mins</SelectItem>
                  <SelectItem value="35-45 mins">35-45 mins</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Right Column - Media Carousel & Actions */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Media/Image Upload Card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-50 pb-2">Dish Image</h2>
            
            {images.length > 0 ? (
              <div className="relative w-full h-56 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                {/* Carousel container */}
                <div
                  ref={carouselRef}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  className="relative w-full h-full"
                >
                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={currentImageIndex}
                      custom={direction}
                      initial={{ opacity: 0, x: direction > 0 ? 150 : -150 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction > 0 ? -150 : 150 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="absolute inset-0"
                    >
                      {images[currentImageIndex] ? (
                        <img
                          src={images[currentImageIndex]}
                          alt={`${itemName}`}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </motion.div>
                  </AnimatePresence>

                  {/* Nav Arrows */}
                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={goToPrevious}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-md hover:bg-white transition-all z-10"
                      >
                        <ChevronLeft className="w-4 h-4 text-slate-700" />
                      </button>
                      <button
                        type="button"
                        onClick={goToNext}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-md hover:bg-white transition-all z-10"
                      >
                        <ChevronRight className="w-4 h-4 text-slate-700" />
                      </button>
                    </>
                  )}

                  {/* Delete Image */}
                  <button
                    type="button"
                    onClick={() => handleImageDelete(currentImageIndex)}
                    className="absolute top-2 right-2 w-8 h-8 bg-white/95 backdrop-blur-sm text-rose-600 rounded-lg flex items-center justify-center shadow-md hover:bg-rose-50 hover:text-rose-700 transition-all z-10 border border-slate-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Image Counter */}
                  {images.length > 1 && (
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-md z-10">
                      <span className="text-white text-[10px] font-semibold">
                        {currentImageIndex + 1} / {images.length}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative w-full h-48 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center shadow-sm mb-2 text-slate-400">
                  <Camera className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-slate-600">No Image Added</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Upload a picture of your dish</p>
              </div>
            )}

            {/* Upload Button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageAdd(e.target.files?.[0])}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleCameraClick}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Upload Dish Image</span>
              </button>
            </div>
          </div>

          {/* Visibility and Recommendations Card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-50 pb-2">Status & Listing</h2>
            
            {/* In Stock Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">In Stock</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Enable to allow customers to order</p>
              </div>
              <Switch
                checked={isInStock}
                onCheckedChange={setIsInStock}
                className="data-[state=unchecked]:bg-slate-200"
              />
            </div>

            {/* Recommended Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Recommended</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Display in recommended section</p>
              </div>
              <Switch
                checked={isRecommended}
                onCheckedChange={setIsRecommended}
                className="data-[state=unchecked]:bg-slate-200"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex gap-3">
            {!isNewItem && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || uploadingImages}
                className="flex-1 py-3 px-4 border-2 border-rose-200 text-rose-600 rounded-xl text-xs font-bold bg-white hover:bg-rose-50/50 hover:border-rose-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  "Delete Dish"
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={uploadingImages || isDeleting}
              className={`${isNewItem ? 'w-full' : 'flex-1'} py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${!uploadingImages
                ? "bg-[#16A34A] text-white hover:bg-[#15803d]"
                : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                }`}
            >
              {uploadingImages ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {saveStatus === "uploading"
                      ? "Uploading image..."
                      : saveStatus === "saving"
                      ? "Saving dish..."
                      : "Saving changes..."}
                  </span>
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Popups and Modals */}
      <RestaurantPanelModal
        open={isCategoryPopupOpen}
        onClose={() => setIsCategoryPopupOpen(false)}
        title="Select Category"
        mobileMaxHeight="tall"
        bodyClassName="flex-1 overflow-y-auto overscroll-contain p-3"
        headerRight={
          <button
            type="button"
            onClick={() => {
              setIsCategoryPopupOpen(false)
              navigate('/restaurant/menu-categories')
            }}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-white transition-colors hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">New</span>
          </button>
        }
      >
        {loadingCategories ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : categories.length === 0 ? (
          <div className="space-y-4 py-12 text-center">
            <p className="text-xs text-slate-500">No categories found</p>
            <button
              type="button"
              onClick={() => {
                setIsCategoryPopupOpen(false)
                navigate('/restaurant/menu-categories')
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white transition-colors hover:bg-slate-800 text-xs"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat.id, cat.name)}
                className={`w-full rounded-xl px-4 py-3 text-left transition-colors border ${String(selectedCategoryId || "") === String(cat.id)
                  ? "bg-[#16A34A]/5 border-[#16A34A] text-[#16A34A] font-bold"
                  : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100 hover:border-slate-200"
                  }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs sm:text-sm font-semibold">{cat.name}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border shadow-sm ${cat.foodTypeScope === "Veg"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : cat.foodTypeScope === "Non-Veg"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-slate-200 bg-slate-100 text-slate-600"
                    }`}>
                    {cat.foodTypeScope || "Both"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </RestaurantPanelModal>

      <RestaurantPanelModal
        open={isGstPopupOpen}
        onClose={() => setIsGstPopupOpen(false)}
        title="Select GST"
        mobileMaxHeight="medium"
        bodyClassName="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
      >
        <div className="space-y-2">
          {GST_OPTIONS.map((gstValue) => (
            <button
              key={gstValue}
              type="button"
              onClick={() => handleGstSelect(gstValue)}
              className={`w-full rounded-xl px-4 py-3 text-left text-xs font-semibold transition-colors ${
                gst === gstValue
                  ? "bg-[#16A34A] text-white"
                  : "bg-slate-50 border border-slate-100 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {gstValue}%
            </button>
          ))}
        </div>
      </RestaurantPanelModal>
      {/* Photo Picker */}
      <ImageSourcePicker
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onFileSelect={handleImageAdd}
        title="Item Image"
        description="Choose how to upload your item image"
        fileNamePrefix="item-photo"
        galleryInputRef={fileInputRef}
      />
    </RestaurantSubPageShell>
  )
}


