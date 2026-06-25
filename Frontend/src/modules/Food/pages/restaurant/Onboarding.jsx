import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams, useLocation } from "react-router-dom"
import { Input } from "@food/components/ui/input"
import { Button } from "@food/components/ui/button"
import { Label } from "@food/components/ui/label"
import { Image as ImageIcon, Upload, Clock, Calendar as CalendarIcon, X, FileText } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@food/components/ui/popover"
import { Calendar } from "@food/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import { restaurantAPI, zoneAPI, uploadAPI } from "@food/api"
import { MobileTimePicker } from "@mui/x-date-pickers/MobileTimePicker"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import {
  determineStepToShow,
  getCompletedOnboardingSteps,
  getOnboardingStorageKey,
} from "@food/utils/onboardingUtils"
import OnboardingShell from "@food/components/restaurant/onboarding/OnboardingShell"
import OnboardingField, {
  OnboardingSection,
  onboardingInputClass,
  onboardingSelectClass,
} from "@food/components/restaurant/onboarding/OnboardingField"
import { CUISINE_OPTIONS } from "@food/components/restaurant/onboarding/onboardingSteps"
import { toast } from "sonner"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { clearModuleAuth, clearAuthData } from "@food/utils/auth"
import { invalidateRestaurantAccessGuardCache } from "@food/components/restaurant/RestaurantAccessGuard"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { EMAIL_REGEX } from "@/shared/utils/emailValidation"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const DRAFT_NAME_VALUES = new Set([
  "",
  "pending",
  "pending registration",
  "__draft__",
  "draft",
  "new restaurant",
])

const sanitizeDraftDisplayValue = (value) => {
  const trimmed = String(value || "").trim()
  if (!trimmed || DRAFT_NAME_VALUES.has(trimmed.toLowerCase())) return ""
  return trimmed
}

const getCityFromZone = (zone) => {
  if (!zone) return ""
  const raw = String(zone.serviceLocation || zone.zoneName || zone.name || "").trim()
  return raw.replace(/\s+zone$/i, "").replace(/\s+region$/i, "").trim()
}

const resolveDietaryType = (source = {}, fallback = {}) => {
  const explicit = source.dietaryType || fallback.dietaryType
  if (explicit === "veg" || explicit === "non_veg" || explicit === "mixed") return explicit
  if (typeof source.pureVegRestaurant === "boolean") {
    return source.pureVegRestaurant ? "veg" : "non_veg"
  }
  if (typeof fallback.pureVegRestaurant === "boolean") {
    return fallback.pureVegRestaurant ? "veg" : null
  }
  return null
}

const DIETARY_OPTIONS = [
  { value: "veg", label: "Veg" },
  { value: "non_veg", label: "Non veg" },
  { value: "mixed", label: "Mixed" },
]

function DietTypeIcon({ type, size = "sm", className = "" }) {
  const box = size === "lg" ? "h-5 w-5" : "h-4 w-4"
  const dot = size === "lg" ? "h-2.5 w-2.5" : "h-2 w-2"

  if (type === "mixed") {
    return (
      <div className={`flex flex-shrink-0 items-center gap-0.5 ${className}`}>
        <div className={`${box} flex items-center justify-center rounded-sm border-2 border-green-600 bg-green-50`}>
          <div className={`${dot} rounded-full bg-green-600`} />
        </div>
        <div className={`${box} flex items-center justify-center rounded-sm border-2 border-red-600 bg-red-50`}>
          <div className={`${dot} rounded-full bg-red-600`} />
        </div>
      </div>
    )
  }

  const isVeg = type === "veg"
  return (
    <div
      className={`${box} flex flex-shrink-0 items-center justify-center rounded-sm border-2 ${className} ${
        isVeg ? "border-green-600 bg-green-50" : "border-red-600 bg-red-50"
      }`}
    >
      <div className={`${dot} rounded-full ${isVeg ? "bg-green-600" : "bg-red-600"}`} />
    </div>
  )
}

const ONBOARDING_STORAGE_KEY = () => getOnboardingStorageKey()
const PAN_NUMBER_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const GST_NUMBER_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const FSSAI_NUMBER_REGEX = /^\d{14}$/
const BANK_ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/
const IFSC_CODE_REGEX = /^[A-Z0-9]{11}$/
const OWNER_NAME_REGEX = /^[A-Za-z ]+$/
const ACCOUNT_HOLDER_NAME_REGEX = /^[A-Za-z ]+$/
const GST_LEGAL_NAME_REGEX = /^[A-Za-z ]+$/
const LOCAL_IMAGE_FILE_ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif"
const LOCAL_PDF_FILE_ACCEPT = ".pdf,application/pdf"
const GALLERY_IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
let onboardingFileCache = {
  step2: {
    menuImages: [],
    profileImage: null,
    menuPdf: null,
  },
  step3: {
    panImage: null,
    gstImage: null,
    fssaiImage: null,
  },
}

// IndexedDB helpers for persistent file storage
const ONBOARDING_FILES_DB = "RestaurantOnboardingFiles"
const FILES_STORE = "files"

const openOnboardingFilesDB = () => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(ONBOARDING_FILES_DB, 1)
      request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(FILES_STORE)) {
          db.createObjectStore(FILES_STORE)
        }
      }
      request.onsuccess = (e) => resolve(e.target.result)
      request.onerror = (e) => reject(e.target.error)
    } catch (err) {
      reject(err)
    }
  })
}

const saveFileToDB = async (key, file) => {
  if (!file || !isUploadableFile(file)) return
  try {
    const db = await openOnboardingFilesDB()
    const tx = db.transaction(FILES_STORE, "readwrite")
    tx.objectStore(FILES_STORE).put(file, key)
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error || new Error("IndexedDB write transaction failed"))
      tx.onabort = () => reject(tx.error || new Error("IndexedDB write transaction aborted"))
    })
  } catch (err) {
    debugError("IndexedDB save failed:", err)
  }
}

const getFileFromDB = async (key) => {
  try {
    const db = await openOnboardingFilesDB()
    const tx = db.transaction(FILES_STORE, "readonly")
    const request = tx.objectStore(FILES_STORE).get(key)
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    })
  } catch (err) {
    debugError("IndexedDB load failed:", err)
    return null
  }
}

const deleteFileFromDB = async (key) => {
  try {
    const db = await openOnboardingFilesDB()
    const tx = db.transaction(FILES_STORE, "readwrite")
    tx.objectStore(FILES_STORE).delete(key)
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error || new Error("IndexedDB delete transaction failed"))
      tx.onabort = () => reject(tx.error || new Error("IndexedDB delete transaction aborted"))
    })
  } catch (err) {
    debugError("IndexedDB delete failed:", err)
  }
}

const clearAllFilesFromDB = async () => {
  try {
    const db = await openOnboardingFilesDB()
    const tx = db.transaction(FILES_STORE, "readwrite")
    tx.objectStore(FILES_STORE).clear()
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error || new Error("IndexedDB clear transaction failed"))
      tx.onabort = () => reject(tx.error || new Error("IndexedDB clear transaction aborted"))
    })
  } catch (err) {
    debugError("IndexedDB clear failed:", err)
  }
}

const getUploadableMenuFiles = (menuImages = []) =>
  (Array.isArray(menuImages) ? menuImages : [])
    .filter((img) => isUploadableFile(img))
    .slice(0, 10)

const persistMenuImagesToDB = async (menuImages = []) => {
  const uploadableMenuFiles = getUploadableMenuFiles(menuImages)
  for (let i = 0; i < 10; i++) {
    const file = uploadableMenuFiles[i]
    if (file) {
      await saveFileToDB(`menuImage_${i}`, file)
    } else {
      await deleteFileFromDB(`menuImage_${i}`)
    }
  }
}

const persistMenuPdfToDB = async (menuPdf) => {
  if (menuPdf && isUploadableFile(menuPdf)) {
    await saveFileToDB("menuPdf", menuPdf)
  } else {
    await deleteFileFromDB("menuPdf")
  }
}

const isUploadableFile = (value) => {
  if (!value || typeof value !== "object") return false

  if (typeof File !== "undefined" && value instanceof File) return true
  if (typeof Blob !== "undefined" && value instanceof Blob) return true

  return (
    typeof value.size === "number" &&
    (typeof value.slice === "function" || typeof value.arrayBuffer === "function")
  )
}

const normalizePhoneDigits = (value) => {
  const digits = String(value || "").replace(/\D/g, "")
  // For India, users often provide 12 digits (starting with 91). 
  // We strictly need the last 10 digits for the national mobile number.
  return digits.slice(-10)
}

const normalizePincode = (value) => String(value || "").replace(/\D/g, "").slice(0, 6)

const getVerifiedPhoneFromStoredRestaurant = () => {
  try {
    const pending = localStorage.getItem("restaurant_pendingPhone")
    if (pending && pending.trim()) {
      return pending.trim()
    }

    const storedUser = localStorage.getItem("restaurant_user")
    if (!storedUser) return ""
    const user = JSON.parse(storedUser)
    const candidates = [
      user?.ownerPhone,
      user?.primaryContactNumber,
      user?.phone,
      user?.phoneNumber,
      user?.mobile,
      user?.contactNumber,
      user?.contact?.phone,
      user?.owner?.phone,
      user?.restaurant?.phone,
    ]
    const phone = candidates.find((value) => typeof value === "string" && value.trim())
    return phone ? phone.trim() : ""
  } catch {
    return ""
  }
}

const normalizeEmail = (val) => {
  let email = String(val || "").toLowerCase().trim()
  // Auto-correct common Gmail typos
  email = email.replace(/@(gnail|gamil|gimail|gnil)\.com$/i, "@gmail.com")
  return email
}

const normalizeAccountTypeValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "saving" || normalized === "savings") return "Saving"
  if (normalized === "current") return "Current"
  return ""
}

const formatNameToCapital = (str) => {
  if (!str) return ""
  return str.split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ")
}

const normalizeIFSC = (val) => String(val || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11)
const normalizePAN = (val) => String(val || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
const normalizeGST = (val) => String(val || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15)
const normalizeBankAcc = (val) => String(val || "").replace(/\D/g, "").slice(0, 18)

const getTodayLocalYMD = () => formatDateToLocalYMD(new Date())

// Helper functions for localStorage
const saveOnboardingToLocalStorage = (step1, step2, step3, currentStep) => {
  try {
    // Persist only stable URL-based values. File/Blob objects are not serializable and
    // restoring metadata-only placeholders breaks preview/upload flows.
    const serializableStep2 = {
      ...step2,
      menuImages: (step2.menuImages || []).filter(
        (img) => !isUploadableFile(img) && (img?.url || (typeof img === "string" && img.trim()))
      ),
      profileImage:
        !isUploadableFile(step2.profileImage) &&
        (step2.profileImage?.url || (typeof step2.profileImage === "string" && step2.profileImage.trim()))
          ? step2.profileImage
          : null,
      menuPdf:
        !isUploadableFile(step2.menuPdf) &&
        (step2.menuPdf?.url || (typeof step2.menuPdf === "string" && step2.menuPdf.trim()))
          ? step2.menuPdf
          : null,
    }

    const serializableStep3 = {
      ...step3,
      panImage:
        !isUploadableFile(step3.panImage) &&
        (step3.panImage?.url || (typeof step3.panImage === "string" && step3.panImage.trim()))
          ? step3.panImage
          : null,
      gstImage:
        !isUploadableFile(step3.gstImage) &&
        (step3.gstImage?.url || (typeof step3.gstImage === "string" && step3.gstImage.trim()))
          ? step3.gstImage
          : null,
      fssaiImage:
        !isUploadableFile(step3.fssaiImage) &&
        (step3.fssaiImage?.url || (typeof step3.fssaiImage === "string" && step3.fssaiImage.trim()))
          ? step3.fssaiImage
          : null,
    }

    const dataToSave = {
      step1,
      step2: serializableStep2,
      step3: serializableStep3,
      currentStep,
      timestamp: Date.now(),
    }
    localStorage.setItem(ONBOARDING_STORAGE_KEY(), JSON.stringify(dataToSave))
  } catch (error) {
    debugError("Failed to save onboarding data to localStorage:", error)
  }
}

const loadOnboardingFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY())
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    debugError("Failed to load onboarding data from localStorage:", error)
  }
  return null
}

const clearOnboardingFromLocalStorage = () => {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY())
  } catch (error) {
    debugError("Failed to clear onboarding data from localStorage:", error)
  }
}

const syncOnboardingFileCache = (step2, step3) => {
  onboardingFileCache = {
    step2: {
      menuImages: (step2?.menuImages || []).filter((img) => isUploadableFile(img)),
      profileImage: isUploadableFile(step2?.profileImage) ? step2.profileImage : null,
      menuPdf: isUploadableFile(step2?.menuPdf) ? step2.menuPdf : null,
    },
    step3: {
      panImage: isUploadableFile(step3?.panImage) ? step3.panImage : null,
      gstImage: isUploadableFile(step3?.gstImage) ? step3.gstImage : null,
      fssaiImage: isUploadableFile(step3?.fssaiImage) ? step3.fssaiImage : null,
    },
  }
}

const clearOnboardingFileCache = () => {
  onboardingFileCache = {
    step2: {
      menuImages: [],
      profileImage: null,
      menuPdf: null,
    },
    step3: {
      panImage: null,
      gstImage: null,
      fssaiImage: null,
    },
  }
}

// Helper function to convert "HH:mm" string to Date object
const stringToTime = (timeString) => {
  const normalized = normalizeTimeValue(timeString)
  if (!normalized || !normalized.includes(":")) {
    return null
  }
  const [hours, minutes] = normalized.split(":").map(Number)
  return new Date(2000, 0, 1, hours || 0, minutes || 0)
}

// Helper function to convert Date object to "HH:mm" string
const timeToString = (date) => {
  if (!date) return ""
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

const normalizeTimeValue = (value) => {
  if (!value) return ""

  const raw = String(value).trim()
  if (!raw) return ""

  const to24Hour = (h, m, period) => {
    let hours = Number(h)
    const minutes = Number(m)
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return ""
    if (minutes < 0 || minutes > 59) return ""
    const p = String(period || "").toUpperCase()
    if (p === "AM") {
      if (hours === 12) hours = 0
    } else if (p === "PM") {
      if (hours !== 12) hours += 12
    }
    if (hours < 0 || hours > 23) return ""
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  }

  // Already in HH:mm format
  if (/^\d{2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":").map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      return ""
    }
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }

  // Handle H:mm by zero-padding hour
  if (/^\d{1}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":")
    return to24Hour(h, m, "")
  }

  // Handle 12-hour format (e.g. "10:00 AM", "9:30pm")
  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/)
  if (ampm) {
    return to24Hour(ampm[1], ampm[2], ampm[3])
  }

  // Fallback for ISO / Date-like strings
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return timeToString(parsed)
  }

  return ""
}

const timeStringToMinutes = (value) => {
  const normalized = normalizeTimeValue(value)
  if (!normalized || !/^\d{2}:\d{2}$/.test(normalized)) return null
  const [hours, minutes] = normalized.split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

const formatTime12Hour = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) return "--:-- --"
  const [h, m] = timeStr.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${period}`
}

const formatDateToLocalYMD = (date) => {
  if (!date || Number.isNaN(date.getTime?.())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const parseLocalYMDDate = (value) => {
  if (!value || typeof value !== "string") return undefined
  const parts = value.split("-").map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return undefined
  const [year, month, day] = parts
  return new Date(year, month - 1, day)
}

function TimeSelector({ label, value, onChange }) {
  const committedValue = stringToTime(value)
  const [pickerValue, setPickerValue] = useState(committedValue)

  useEffect(() => {
    setPickerValue(committedValue)
  }, [value])

  const handleTimeAccept = (newValue) => {
    setPickerValue(newValue || null)
    if (!newValue) {
      onChange("")
      return
    }
    const timeString = timeToString(newValue)
    if (timeString) {
      onChange(timeString)
    }
  }

  return (
    <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50/60">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-4 h-4 text-gray-800" />
        <span className="text-xs font-medium text-gray-900">{label}</span>
      </div>
      <MobileTimePicker ampm={true}
        value={pickerValue}
        onChange={(newValue) => setPickerValue(newValue)}
        onAccept={handleTimeAccept}
        slotProps={{
          textField: {
            variant: "outlined",
            size: "small",
            placeholder: "Select time",
            sx: {
              "& .MuiOutlinedInput-root": {
                height: "36px",
                fontSize: "12px",
                backgroundColor: "white",
                "& fieldset": {
                  borderColor: "#e5e7eb",
                },
                "&:hover fieldset": {
                  borderColor: "#d1d5db",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#000",
                },
              },
              "& .MuiInputBase-input": {
                padding: "8px 12px",
                fontSize: "12px",
              },
            },
            onBlur: (event) => {
              const normalized = normalizeTimeValue(event?.target?.value)
              if (normalized) {
                onChange(normalized)
              }
            },
          },
        }}
        format="hh:mm a"
      />
    </div>
  )
}

export default function RestaurantOnboarding() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const location = useLocation()
  const rejectionNotice = location.state?.isRejected
    ? String(location.state?.rejectionReason || "").trim()
    : ""
  const [searchParams, setSearchParams] = useSearchParams()
  const [step, setStep] = useState(1)
  const [maxAllowedStep, setMaxAllowedStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await restaurantAPI.logout()
      clearModuleAuth("restaurant")
      clearAuthData()
      // Clear onboarding data and files
      clearOnboardingFromLocalStorage()
      await clearAllFilesFromDB()
      
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      navigate("/food/restaurant/login", { replace: true })
    } catch (error) {
      debugError("Logout failed:", error)
      clearModuleAuth("restaurant")
      navigate("/food/restaurant/login", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState("")
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [isEditing, setIsEditing] = useState(true)
  const [hasExistingRestaurantProfile, setHasExistingRestaurantProfile] = useState(false)
  const [isFssaiCalendarOpen, setIsFssaiCalendarOpen] = useState(false)
  const [zones, setZones] = useState([])
  const [zonesLoading, setZonesLoading] = useState(false)
  const [isOnboardingHydrated, setIsOnboardingHydrated] = useState(false)

  const goToStep = (nextStep, { replaceUrl = true, maxStep } = {}) => {
    const requested = Math.min(3, Math.max(1, Number(nextStep) || 1))
    const allowedCap = maxStep ?? maxAllowedStep
    const safeStep = requested > allowedCap ? allowedCap : requested
    setStep(safeStep)
    if (replaceUrl) {
      setSearchParams({ step: String(safeStep) }, { replace: true })
    }
    window.scrollTo({ top: 0, behavior: "instant" })
  }

  const [step1, setStep1] = useState({
    restaurantName: "",
    dietaryType: null,
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    primaryContactNumber: "",
    zoneId: "",
    location: {
      formattedAddress: "",
      addressLine1: "",
      addressLine2: "",
      area: "",
      city: "",
      state: "",
      pincode: "",
      landmark: "",
      latitude: "",
      longitude: "",
    },
  })

  const [step2, setStep2] = useState({
    menuImages: [],
    menuPdf: null,
    profileImage: null,
    cuisines: [],
    estimatedDeliveryTime: "",
    openingTime: "",
    closingTime: "",
    openDays: [],
  })

  const [step3, setStep3] = useState({
    panNumber: "",
    nameOnPan: "",
    panImage: null,
    gstRegistered: false,
    gstNumber: "",
    gstLegalName: "",
    gstAddress: "",
    gstImage: null,
    fssaiNumber: "",
    fssaiExpiry: "",
    fssaiImage: null,
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    accountHolderName: "",
    accountType: "",
  })

  const completedSteps = useMemo(
    () => getCompletedOnboardingSteps(step1, step2, step3),
    [step1, step2, step3],
  )

  // Lightweight check to disable the Continue button until minimum required fields are filled.
  // This does NOT replace the full validateStep*() logic — it only gates the button visually.
  const isCurrentStepValid = useMemo(() => {
    if (step === 1) {
      return (
        Boolean(step1.restaurantName?.trim()) &&
        Boolean(step1.dietaryType) &&
        Boolean(step1.ownerName?.trim()) &&
        Boolean(step1.ownerEmail?.trim()) &&
        Boolean(step1.ownerPhone?.trim()) &&
        Boolean(step1.primaryContactNumber?.trim()) &&
        Boolean(step1.zoneId?.trim()) &&
        Boolean(step1.location?.area?.trim()) &&
        Boolean(step1.location?.city?.trim()) &&
        Boolean(step1.location?.pincode?.trim())
      )
    }
    if (step === 2) {
      const hasMenuImages =
        (step2.menuImages || []).filter(
          (img) =>
            isUploadableFile(img) ||
            (img?.url && typeof img.url === "string") ||
            (typeof img === "string" && img.trim()),
        ).length > 0
      const hasProfileImage =
        Boolean(step2.profileImage) &&
        (isUploadableFile(step2.profileImage) ||
          (step2.profileImage?.url && typeof step2.profileImage.url === "string") ||
          (typeof step2.profileImage === "string" && step2.profileImage.trim()))
      const hasMenuPdf =
        Boolean(step2.menuPdf) &&
        (isUploadableFile(step2.menuPdf) ||
          (step2.menuPdf?.url && typeof step2.menuPdf.url === "string") ||
          (typeof step2.menuPdf === "string" && step2.menuPdf.trim()))
      return (
        (step2.cuisines || []).length > 0 &&
        hasMenuImages &&
        hasProfileImage &&
        hasMenuPdf &&
        timeStringToMinutes(step2.openingTime) !== null &&
        timeStringToMinutes(step2.closingTime) !== null &&
        (step2.openDays || []).length > 0 &&
        Boolean(step2.estimatedDeliveryTime?.trim())
      )
    }
    if (step === 3) {
      const baseValid =
        Boolean(step3.panNumber?.trim()) &&
        Boolean(step3.nameOnPan?.trim()) &&
        Boolean(step3.panImage) &&
        Boolean(step3.fssaiNumber?.trim()) &&
        Boolean(step3.fssaiExpiry?.trim()) &&
        Boolean(step3.fssaiImage) &&
        Boolean(step3.accountNumber?.trim()) &&
        Boolean(step3.confirmAccountNumber?.trim()) &&
        Boolean(step3.ifscCode?.trim()) &&
        Boolean(step3.accountHolderName?.trim()) &&
        Boolean(step3.accountType?.trim())
      if (!baseValid) return false
      if (step3.gstRegistered) {
        return (
          Boolean(step3.gstNumber?.trim()) &&
          Boolean(step3.gstLegalName?.trim()) &&
          Boolean(step3.gstAddress?.trim()) &&
          Boolean(step3.gstImage)
        )
      }
      return true
    }
    return true
  }, [step, step1, step2, step3])

  const previewUrlCacheRef = useRef(new Map())
  const locationSearchInputRef = useRef(null)
  const placesAutocompleteRef = useRef(null)
  const mapsScriptLoadedRef = useRef(false)
  const menuImagesInputRef = useRef(null)
  const menuPdfInputRef = useRef(null)
  const profileImageInputRef = useRef(null)
  const panImageInputRef = useRef(null)
  const gstImageInputRef = useRef(null)
  const fssaiImageInputRef = useRef(null)
  const [sourcePicker, setSourcePicker] = useState({
    isOpen: false,
    title: "",
    onSelectFile: null,
    fileNamePrefix: "camera-image",
    fallbackInputRef: null,
  })

  // Manual search states for fallback
  const [locationSearchValue, setLocationSearchValue] = useState("")
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)

  const getPreviewImageUrl = (value) => {
    if (!value) return null
    if (typeof value === "string") return value
    if (value?.url && typeof value.url === "string") return value.url

    if (isUploadableFile(value)) {
      const cache = previewUrlCacheRef.current
      const cached = cache.get(value)
      if (cached) return cached
      try {
        const objectUrl = URL.createObjectURL(value)
        cache.set(value, objectUrl)
        return objectUrl
      } catch {
        return null
      }
    }

    return null
  }

  const openImageSourcePicker = ({ title, onSelectFile, fileNamePrefix, fallbackInputRef }) => {
    setSourcePicker({
      isOpen: true,
      title: title || "Select image source",
      onSelectFile,
      fileNamePrefix: fileNamePrefix || "camera-image",
      fallbackInputRef: fallbackInputRef || null,
    })
  }

  const closeImageSourcePicker = () => {
    setSourcePicker((prev) => ({ ...prev, isOpen: false }))
  }

  const handleMenuImagesSelected = (files = []) => {
    if (!files.length) return
    const nextMenuImages = [...(step2.menuImages || []), ...files]
    setStep2((prev) => ({
      ...prev,
      menuImages: nextMenuImages,
    }))
    void persistMenuImagesToDB(nextMenuImages)
  }

  const isPdfFile = (file) => {
    if (!isUploadableFile(file)) return false
    const type = String(file.type || "").toLowerCase()
    if (type === "application/pdf") return true
    const name = String(file.name || "").toLowerCase()
    return name.endsWith(".pdf")
  }

  const handleMenuPdfSelected = async (file) => {
    if (!file) return
    if (!isPdfFile(file)) {
      toast.error("Only PDF files are allowed for menu upload")
      return
    }
    setStep2((prev) => ({ ...prev, menuPdf: file }))
    await persistMenuPdfToDB(file)
  }

  const handleRemoveMenuPdf = async () => {
    setStep2((prev) => ({ ...prev, menuPdf: null }))
    await persistMenuPdfToDB(null)
  }

  const handleProfileImageSelected = (file) => {
    if (!file) return
    setStep2((prev) => ({
      ...prev,
      profileImage: file,
    }))
    void saveFileToDB("profileImage", file)
  }

  const handlePanImageSelected = (file) => {
    if (!file) return
    setStep3((prev) => ({ ...prev, panImage: file }))
  }

  const handleGstImageSelected = (file) => {
    if (!file) return
    setStep3((prev) => ({ ...prev, gstImage: file }))
  }

  const handleFssaiImageSelected = (file) => {
    if (!file) return
    setStep3((prev) => ({ ...prev, fssaiImage: file }))
  }

  const isPersistedImageValue = (value) =>
    !isUploadableFile(value) &&
    ((typeof value === "string" && value.trim()) ||
      (value?.url && typeof value.url === "string"))

  const getPersistedImagePayload = (value) => {
    if (typeof value === "string" && value.trim()) {
      return { url: value.trim(), publicId: null }
    }

    if (value?.url && typeof value.url === "string" && value.url.trim()) {
      return {
        url: value.url.trim(),
        publicId: value.publicId || null,
      }
    }

    return null
  }

  const toPersistedMenuImagesPayload = (menuImages = []) =>
    (Array.isArray(menuImages) ? menuImages : [])
      .filter((img) => isPersistedImageValue(img))
      .map((img) =>
        typeof img === "string"
          ? img
          : {
              url: img.url,
              publicId: img.publicId || null,
            },
      )

  const handleRemoveMenuImage = async (indexToRemove) => {
    const currentMenuImages = step2.menuImages || []
    const imageToRemove = currentMenuImages[indexToRemove]
    const nextMenuImages = currentMenuImages.filter((_, i) => i !== indexToRemove)

    setStep2((prev) => ({
      ...prev,
      menuImages: nextMenuImages,
    }))
    await persistMenuImagesToDB(nextMenuImages)

    if (!isPersistedImageValue(imageToRemove) || !hasExistingRestaurantProfile) {
      return
    }

    try {
      await restaurantAPI.updateProfile({
        menuImages: toPersistedMenuImagesPayload(nextMenuImages),
      })
      toast.success("Menu image removed")
    } catch (error) {
      setStep2((prev) => ({
        ...prev,
        menuImages: currentMenuImages,
      }))
      await persistMenuImagesToDB(currentMenuImages)
      toast.error(error?.response?.data?.message || "Failed to remove menu image")
    }
  }

  const handleRemoveProfileImage = async () => {
    const currentProfileImage = step2.profileImage
    setStep2((prev) => ({
      ...prev,
      profileImage: null,
    }))

    if (!isPersistedImageValue(currentProfileImage) || !hasExistingRestaurantProfile) {
      return
    }

    try {
      await restaurantAPI.updateProfile({ profileImage: "" })
      toast.success("Profile image removed")
    } catch (error) {
      setStep2((prev) => ({
        ...prev,
        profileImage: currentProfileImage,
      }))
      toast.error(error?.response?.data?.message || "Failed to remove profile image")
    }
  }

  const resolveImageForProfileUpdate = async (value, folder) => {
    if (!value) return null

    if (isUploadableFile(value)) {
      const uploaded = await handleUpload(value, folder)
      return uploaded || null
    }

    return getPersistedImagePayload(value)
  }

  const resolveMenuPdfForProfileUpdate = async (value) => {
    if (!value) return null

    if (isUploadableFile(value)) {
      if (!isPdfFile(value)) {
        throw new Error("Only PDF files are allowed for menu upload")
      }
      const uploaded = await handleFileUpload(value, "food/restaurants/menu-pdf")
      return uploaded || null
    }

    return getPersistedImagePayload(value)
  }

  const resolveMenuImagesForProfileUpdate = async (menuImages = []) => {
    const items = Array.isArray(menuImages) ? menuImages : []
    const resolved = await Promise.all(
      items.map(async (image) => {
        if (isUploadableFile(image)) {
          return handleUpload(image, "food/restaurants/menu")
        }

        return getPersistedImagePayload(image)
      }),
    )

    return resolved.filter((image) => image?.url)
  }


  // Load from localStorage on mount and check URL parameter
  useEffect(() => {
    setVerifiedPhoneNumber(getVerifiedPhoneFromStoredRestaurant())

    // Check if step is specified in URL (from OTP login redirect)
    // NOTE: Read searchParams via window.location to avoid adding searchParams as a dependency.
    // Adding searchParams as a dep causes this effect to re-run every time setSearchParams is
    // called inside the effect, which creates an infinite load loop and double API calls.
    const urlParams = new URLSearchParams(window.location.search)
    const stepParam = urlParams.get("step")
    if (stepParam) {
      const stepNum = parseInt(stepParam, 10)
      if (stepNum >= 1 && stepNum <= 3) {
        setStep(stepNum)
      }
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const currentPhone = getVerifiedPhoneFromStoredRestaurant()
        const localData = loadOnboardingFromLocalStorage()
        
        // 1. Fetch onboarding progress from API
        let progressPayload = null
        let apiData = null
        try {
          const progressRes = await restaurantAPI.getOnboardingProgress()
          progressPayload =
            progressRes?.data?.data?.onboarding || progressRes?.data?.onboarding
          const currentRes = await restaurantAPI.getCurrentRestaurant()
          apiData =
            currentRes?.data?.data?.restaurant || currentRes?.data?.restaurant
        } catch (err) {
          debugError("API fetch skipped/failed:", err)
        }

        const onboardingStatus = String(
          progressPayload?.onboardingStatus || apiData?.onboardingStatus || "",
        ).toUpperCase()
        const allowedStep = Math.min(
          3,
          Math.max(1, Number(progressPayload?.currentStep) || 1),
        )
        setMaxAllowedStep(allowedStep)
        setHasExistingRestaurantProfile(onboardingStatus === "APPROVED")

        const onboardingData = progressPayload?.onboarding || apiData?.onboarding || {}
        if (apiData || progressPayload) {
          const onboarding = onboardingData
          const s1 = onboarding.step1 || {}
          const s2 = onboarding.step2 || {}
          const s3 = onboarding.step3 || {}
          const loc = s1.location || apiData?.location || {}
          const pay = s3.bank || apiData?.bankAccount || {}

          setStep1(prev => ({
            ...prev,
            restaurantName: sanitizeDraftDisplayValue(s1.restaurantName || apiData?.name),
            dietaryType: resolveDietaryType(s1, apiData || {}),
            ownerName: sanitizeDraftDisplayValue(s1.ownerName || apiData?.ownerName),
            ownerEmail: s1.ownerEmail || apiData?.email || "",
            ownerPhone: s1.ownerPhone || apiData?.phone || "",
            primaryContactNumber: s1.primaryContactNumber || apiData?.primaryContactNumber || "",
            zoneId: s1.zoneId || apiData?.zoneId || "",
            location: {
              ...prev.location,
              formattedAddress: loc.formattedAddress || loc.address || apiData?.address || "",
              addressLine1: loc.addressLine1 || "",
              addressLine2: loc.addressLine2 || "",
              area: loc.area || apiData?.area || "",
              city: loc.city || apiData?.city || "",
              state: loc.state || apiData?.state || "",
              pincode: loc.pincode || apiData?.pincode || "",
              landmark: loc.landmark || "",
              latitude: loc.latitude || "",
              longitude: loc.longitude || "",
            }
          }))

          setStep2(prev => ({
            ...prev,
            menuImages: s2.menuImageUrls || apiData?.menuImages || [],
            menuPdf: s2.menuPdfUrl || apiData?.menuPdf || null,
            profileImage: s2.profileImageUrl || apiData?.profileImage || null,
            cuisines: s2.cuisines || apiData?.cuisines || [],
            estimatedDeliveryTime: s2.estimatedDeliveryTime || apiData?.estimatedDeliveryTime || "",
            openingTime: normalizeTimeValue(s2.openingTime || apiData?.openingTime),
            closingTime: normalizeTimeValue(s2.closingTime || apiData?.closingTime),
            openDays: s2.openDays || apiData?.openDays || [],
          }))

          setStep3(prev => ({
            ...prev,
            panNumber: s3.pan?.panNumber || apiData?.panNumber || "",
            nameOnPan: s3.pan?.nameOnPan || apiData?.nameOnPan || "",
            panImage: s3.pan?.image || apiData?.panImage || null,
            gstRegistered: s3.gst?.isRegistered ?? apiData?.gstRegistered ?? false,
            gstNumber: s3.gst?.gstNumber || apiData?.gstNumber || "",
            gstLegalName: s3.gst?.legalName || apiData?.gstLegalName || "",
            gstAddress: s3.gst?.address || apiData?.gstAddress || "",
            gstImage: s3.gst?.image || apiData?.gstImage || null,
            fssaiNumber: s3.fssai?.registrationNumber || apiData?.fssaiNumber || "",
            fssaiExpiry: s3.fssai?.expiryDate ? String(s3.fssai.expiryDate).split('T')[0] : (apiData?.fssaiExpiry ? String(apiData.fssaiExpiry).split('T')[0] : ""),
            fssaiImage: s3.fssai?.image || apiData?.fssaiImage || null,
            accountNumber: pay.accountNumber || apiData?.accountNumber || "",
            confirmAccountNumber: pay.accountNumber || apiData?.accountNumber || "",
            ifscCode: normalizeIFSC(pay.ifscCode || apiData?.ifscCode),
            accountHolderName: pay.accountHolderName || apiData?.accountHolderName || "",
            accountType: normalizeAccountTypeValue(pay.accountType || apiData?.accountType),
          }))
        }

        // 3. APPLY LOCAL OVERRIDES (The "Persistence" fix)
        // If localStorage has unsaved changes for this user, apply them over the API/Initial state.
        if (localData) {
          const savedPhone = normalizePhoneDigits(localData.step1?.ownerPhone || "")
          const normalizedCurrent = normalizePhoneDigits(currentPhone)
          
          // Only use local data if it belongs to the same user
          if (savedPhone && normalizedCurrent && savedPhone === normalizedCurrent) {
            debugLog("? Matching local session found. Resuming with unsaved changes.")
            
            if (localData.step1) {
              const mergedStep1 = { ...localData.step1 }
              mergedStep1.restaurantName = sanitizeDraftDisplayValue(mergedStep1.restaurantName)
              mergedStep1.ownerName = sanitizeDraftDisplayValue(mergedStep1.ownerName)
              if (!mergedStep1.dietaryType) {
                mergedStep1.dietaryType = resolveDietaryType(mergedStep1, {})
              }
              setStep1((prev) => ({
                ...prev,
                ...mergedStep1,
                location: { ...prev.location, ...mergedStep1.location },
              }))
            }
            if (localData.step2) {
              // Note: Files/Images must be re-hydrated from IndexedDB (handled below)
              setStep2(prev => ({ 
                ...prev, 
                ...localData.step2,
                openingTime: normalizeTimeValue(localData.step2.openingTime),
                closingTime: normalizeTimeValue(localData.step2.closingTime),
              }));
            }
            if (localData.step3) {
              setStep3(prev => ({ ...prev, ...localData.step3 }));
            }
          } else if (savedPhone && normalizedCurrent && savedPhone !== normalizedCurrent) {
             debugLog("? Phone mismatch, data belongs to different user. Clearing local cache.")
             clearOnboardingFromLocalStorage()
             await clearAllFilesFromDB()
          }
        }

        // 4. Finally re-hydrate heavy files from IndexedDB if they exist 
        // (IndexedDB is reliable for large files which don't fit in localStorage)
        const [prof, pan, gst, fs, pdf] = await Promise.all([
          getFileFromDB("profileImage"),
          getFileFromDB("panImage"),
          getFileFromDB("gstImage"),
          getFileFromDB("fssaiImage"),
          getFileFromDB("menuPdf")
        ]);

        if (prof) setStep2(p => ({ ...p, profileImage: prof }));
        if (pan) setStep3(p => ({ ...p, panImage: pan }));
        if (gst) setStep3(p => ({ ...p, gstImage: gst }));
        if (fs) setStep3(p => ({ ...p, fssaiImage: fs }));
        if (pdf) setStep2(p => ({ ...p, menuPdf: pdf }));

        const restoredMenuImages = []
        for (let i = 0; i < 10; i++) {
          const img = await getFileFromDB(`menuImage_${i}`)
          if (img) restoredMenuImages.push(img)
        }
        if (restoredMenuImages.length) {
          setStep2(p => ({ ...p, menuImages: [...p.menuImages.filter(im => !isUploadableFile(im)), ...restoredMenuImages] }));
        }

        const savedPhone = normalizePhoneDigits(localData?.step1?.ownerPhone || "")
        const normalizedCurrent = normalizePhoneDigits(currentPhone)
        const hasMatchingLocalSession =
          Boolean(localData) &&
          savedPhone &&
          normalizedCurrent &&
          savedPhone === normalizedCurrent

        // Resolve step from URL, local cache, or server progress (never ahead of allowed step)
        let desiredStep = allowedStep
        if (stepParam) {
          const parsed = parseInt(stepParam, 10)
          if (parsed >= 1 && parsed <= 3) desiredStep = parsed
        } else if (hasMatchingLocalSession && localData?.currentStep) {
          desiredStep = Number(localData.currentStep)
        } else if (progressPayload?.currentStep) {
          desiredStep = Number(progressPayload.currentStep)
        } else if (onboardingData) {
          const suggestedStep = determineStepToShow(onboardingData)
          if (suggestedStep) desiredStep = suggestedStep
        }

        desiredStep = Math.min(allowedStep, Math.max(1, Number(desiredStep) || 1))
        setStep(desiredStep)
        setSearchParams({ step: String(desiredStep) }, { replace: true })

      } catch (err) {
        debugError("Onboarding hydration failed:", err)
      } finally {
        setIsOnboardingHydrated(true)
        setLoading(false)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run only once on mount — do NOT add searchParams here.

  useEffect(() => {
    if (!verifiedPhoneNumber) return
    setStep1((prev) => ({
      ...prev,
      ownerPhone: verifiedPhoneNumber,
    }))
  }, [verifiedPhoneNumber])

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return undefined

    const updateInset = () => {
      const vv = window.visualViewport
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height))
      setKeyboardInset(inset > 120 ? inset : 0)
    }

    updateInset()
    window.visualViewport.addEventListener("resize", updateInset)
    window.visualViewport.addEventListener("scroll", updateInset)
    return () => {
      window.visualViewport.removeEventListener("resize", updateInset)
      window.visualViewport.removeEventListener("scroll", updateInset)
    }
  }, [])

  // Save to localStorage whenever step data changes
  useEffect(() => {
    if (!isOnboardingHydrated) return
    saveOnboardingToLocalStorage(step1, step2, step3, step)
    
    // Save images to IndexedDB
    const saveFiles = async () => {
      if (step2.profileImage && isUploadableFile(step2.profileImage)) {
        await saveFileToDB("profileImage", step2.profileImage)
      } else if (!step2.profileImage) {
        await deleteFileFromDB("profileImage")
      }
      if (step3.panImage && isUploadableFile(step3.panImage)) {
        await saveFileToDB("panImage", step3.panImage)
      }
      if (step3.gstImage && isUploadableFile(step3.gstImage)) {
        await saveFileToDB("gstImage", step3.gstImage)
      }
      if (step3.fssaiImage && isUploadableFile(step3.fssaiImage)) {
        await saveFileToDB("fssaiImage", step3.fssaiImage)
      }
      
      await persistMenuImagesToDB(step2.menuImages || [])
      await persistMenuPdfToDB(step2.menuPdf || null)
    }
    saveFiles()
  }, [isOnboardingHydrated, step1, step2, step3, step])

  useEffect(() => {
    syncOnboardingFileCache(step2, step3)
  }, [step2, step3])

  useEffect(() => {
    return () => {
      previewUrlCacheRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url)
        } catch {
          // Ignore revoke errors
        }
      })
      previewUrlCacheRef.current.clear()
    }
  }, [])

  // REMOVED redundancy: The hydration is now handled in a single loadData effect above 
  // to avoid race conditions between localStorage and API data.

  const handleUpload = async (file, folder) => {
    try {
      if (!isUploadableFile(file)) {
        throw new Error("Invalid image file")
      }

      const response = await uploadAPI.uploadMedia(file, { folder })
      const uploadedImage = response?.data?.data

      if (!uploadedImage?.url) {
        throw new Error("Uploaded image URL was not returned")
      }

      return uploadedImage
    } catch (err) {
      // Provide more informative error message for upload failures
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to upload image"
      debugError("Upload error:", errorMsg, err)
      throw new Error(`Image upload failed: ${errorMsg}`)
    }
  }

  const handleFileUpload = async (file, folder) => {
    try {
      if (!isUploadableFile(file)) {
        throw new Error("Invalid file")
      }

      const response = await uploadAPI.uploadFile(file, { folder })
      const uploadedFile = response?.data?.data

      if (!uploadedFile?.url) {
        throw new Error("Uploaded file URL was not returned")
      }

      return uploadedFile
    } catch (err) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to upload file"
      debugError("Upload error:", errorMsg, err)
      throw new Error(`File upload failed: ${errorMsg}`)
    }
  }

  // Validation functions for each step
  const validateStep1 = () => {
    const errors = []

    if (!step1.restaurantName?.trim()) {
      errors.push("Restaurant name is required")
    }
    if (!step1.dietaryType) {
      errors.push("Please select restaurant type (Veg, Non veg, or Mixed)")
    }
    if (!step1.ownerName?.trim()) {
      errors.push("Owner name is required")
    } else if (!OWNER_NAME_REGEX.test(step1.ownerName.trim())) {
      errors.push("Owner name must contain only letters")
    }
    if (!step1.ownerEmail?.trim()) {
      errors.push("Owner email is required")
    } else if (!EMAIL_REGEX.test(step1.ownerEmail.trim())) {
      errors.push("Please enter a valid email address")
    } else if (step1.ownerEmail.toLowerCase().includes("@gnail.com") || step1.ownerEmail.toLowerCase().includes("@gnil.com")) {
      errors.push("Invalid email domain. Did you mean '@gmail.com'?")
    }
    if (!step1.ownerPhone?.trim()) {
      errors.push("Owner phone number is required")
    } else if (!/^\d{10}$/.test(normalizePhoneDigits(step1.ownerPhone))) {
      errors.push("Owner phone number must be exactly 10 digits")
    }
    if (!step1.primaryContactNumber?.trim()) {
      errors.push("Primary contact number is required")
    } else if (!/^\d{10}$/.test(normalizePhoneDigits(step1.primaryContactNumber))) {
       errors.push("Primary contact number must be exactly 10 digits")
    }
    if (!step1.zoneId?.trim()) {
      errors.push("Service zone is required")
    }
    if (!step1.location?.area?.trim()) {
      errors.push("Area/Sector/Locality is required")
    }
    if (!step1.location?.city?.trim()) {
      errors.push("City is required")
    }
    if (!step1.location?.pincode?.trim()) {
      errors.push("Pincode is required")
    } else if (!/^\d{6}$/.test(normalizePincode(step1.location.pincode))) {
      errors.push("Pincode must be exactly 6 digits")
    }

    return errors
  }

  const validateStep2 = () => {
    const errors = []

    if (!step2.cuisines || step2.cuisines.length === 0) {
      errors.push("Select at least one cuisine")
    }

    // Check menu images - must have at least one File or existing URL
    const hasMenuImages = step2.menuImages && step2.menuImages.length > 0
    if (!hasMenuImages) {
      errors.push("At least one menu image is required")
    } else {
      // Verify that menu images are either File objects or have valid URLs
      const validMenuImages = step2.menuImages.filter(img => {
        if (isUploadableFile(img)) return true
        if (img?.url && typeof img.url === 'string') return true
        if (typeof img === 'string' && img.trim()) return true
        return false
      })
      if (validMenuImages.length === 0) {
        errors.push("Please upload at least one valid menu image")
      }
    }

    // Check profile image - must be a File or existing URL
    if (!step2.profileImage) {
      errors.push("Restaurant profile image is required")
    } else {
      // Verify profile image is either a File or has a valid URL
      const isValidProfileImage =
        isUploadableFile(step2.profileImage) ||
        (step2.profileImage?.url && typeof step2.profileImage.url === 'string') ||
        (typeof step2.profileImage === 'string' && step2.profileImage.trim())
      if (!isValidProfileImage) {
        errors.push("Please upload a valid restaurant profile image")
      }
    }

    if (!step2.menuPdf) {
      errors.push("Menu PDF is required")
    } else {
      const isValidMenuPdf =
        isUploadableFile(step2.menuPdf) ||
        (step2.menuPdf?.url && typeof step2.menuPdf.url === "string") ||
        (typeof step2.menuPdf === "string" && step2.menuPdf.trim())
      if (!isValidMenuPdf) {
        errors.push("Please upload a valid menu PDF")
      }
    }

    if (!step2.openingTime?.trim()) {
      errors.push("Opening time is required")
    }
    if (!step2.closingTime?.trim()) {
      errors.push("Closing time is required")
    }
    const openingMinutes = timeStringToMinutes(step2.openingTime)
    const closingMinutes = timeStringToMinutes(step2.closingTime)
    if (openingMinutes !== null && closingMinutes !== null) {
      if (openingMinutes === closingMinutes) {
        errors.push("Opening time and closing time cannot be same")
      } else if (closingMinutes < openingMinutes) {
        errors.push("Closing time cannot be less than opening time")
      }
    }
    if (!step2.openDays || step2.openDays.length === 0) {
      errors.push("Please select at least one open day")
    }
    if (!step2.estimatedDeliveryTime?.trim()) {
      errors.push("Estimated delivery time is required")
    }

    return errors
  }

  const validateStep3 = () => {
    const errors = []

    if (!step3.panNumber?.trim()) {
      errors.push("PAN number is required")
    } else if (!PAN_NUMBER_REGEX.test(step3.panNumber.trim().toUpperCase())) {
      errors.push("PAN number must be valid (e.g., ABCDE1234F)")
    }
    if (!step3.nameOnPan?.trim()) {
      errors.push("Name on PAN is required")
    }
    // Validate PAN image - must be a File or existing URL
    if (!step3.panImage) {
      errors.push("PAN image is required")
    } else {
      const isValidPanImage =
        isUploadableFile(step3.panImage) ||
        (step3.panImage?.url && typeof step3.panImage.url === 'string') ||
        (typeof step3.panImage === 'string' && step3.panImage.trim())
      if (!isValidPanImage) {
        errors.push("Please upload a valid PAN image")
      }
    }

    if (!step3.fssaiNumber?.trim()) {
      errors.push("FSSAI number is required")
    } else if (!FSSAI_NUMBER_REGEX.test(step3.fssaiNumber.trim())) {
      errors.push("FSSAI number must contain exactly 14 digits")
    }
    if (!step3.fssaiExpiry?.trim()) {
      errors.push("FSSAI expiry date is required")
    } else if (step3.fssaiExpiry < getTodayLocalYMD()) {
      errors.push("FSSAI expiry date cannot be in the past")
    }
    // Validate FSSAI image - must be a File or existing URL
    if (!step3.fssaiImage) {
      errors.push("FSSAI image is required")
    } else {
      const isValidFssaiImage =
        isUploadableFile(step3.fssaiImage) ||
        (step3.fssaiImage?.url && typeof step3.fssaiImage.url === 'string') ||
        (typeof step3.fssaiImage === 'string' && step3.fssaiImage.trim())
      if (!isValidFssaiImage) {
        errors.push("Please upload a valid FSSAI image")
      }
    }

    // Validate GST details if GST registered
    if (step3.gstRegistered) {
      if (!step3.gstNumber?.trim()) {
        errors.push("GST number is required when GST registered")
      } else if (!GST_NUMBER_REGEX.test(step3.gstNumber.trim().toUpperCase())) {
        errors.push("GST number must be a valid 15-character GSTIN")
      }
      if (!step3.gstLegalName?.trim()) {
        errors.push("GST legal name is required when GST registered")
      } else if (!GST_LEGAL_NAME_REGEX.test(step3.gstLegalName.trim())) {
        errors.push("GST legal name must contain only letters")
      }
      if (!step3.gstAddress?.trim()) {
        errors.push("GST registered address is required when GST registered")
      }
      // Validate GST image if GST registered
      if (!step3.gstImage) {
        errors.push("GST image is required when GST registered")
      } else {
        const isValidGstImage =
          isUploadableFile(step3.gstImage) ||
          (step3.gstImage?.url && typeof step3.gstImage.url === 'string') ||
          (typeof step3.gstImage === 'string' && step3.gstImage.trim())
        if (!isValidGstImage) {
          errors.push("Please upload a valid GST image")
        }
      }
    }

    if (!step3.accountNumber?.trim()) {
      errors.push("Account number is required")
    } else if (!BANK_ACCOUNT_NUMBER_REGEX.test(step3.accountNumber.trim())) {
      errors.push("Account number must contain 9 to 18 digits only")
    }
    if (!step3.confirmAccountNumber?.trim()) {
      errors.push("Please confirm your account number")
    } else if (!BANK_ACCOUNT_NUMBER_REGEX.test(step3.confirmAccountNumber.trim())) {
      errors.push("Confirm account number must contain 9 to 18 digits only")
    }
    if (step3.accountNumber && step3.confirmAccountNumber && step3.accountNumber !== step3.confirmAccountNumber) {
      errors.push("Account number and confirmation do not match")
    }
    if (!step3.ifscCode?.trim()) {
      errors.push("IFSC code is required")
    } else if (!IFSC_CODE_REGEX.test(step3.ifscCode.trim().toUpperCase())) {
      errors.push("IFSC code must contain exactly 11 alphanumeric characters")
    }
    if (!step3.accountHolderName?.trim()) {
      errors.push("Account holder name is required")
    } else if (!ACCOUNT_HOLDER_NAME_REGEX.test(step3.accountHolderName.trim())) {
      errors.push("Account holder name must contain only letters")
    }
    if (!step3.accountType?.trim()) {
      errors.push("Account type is required")
    } else if (!["Saving", "Current"].includes(step3.accountType.trim())) {
      errors.push("Account type must be either Saving or Current")
    }

    return errors
  }

  // Fill dummy data for testing (development mode only)




  const appendStep1ToFormData = (formData) => {
    formData.append("restaurantName", step1.restaurantName || "")
    formData.append("dietaryType", step1.dietaryType || "")
    formData.append(
      "pureVegRestaurant",
      step1.dietaryType === "veg" ? "true" : "false",
    )
    formData.append("ownerName", step1.ownerName || "")
    formData.append("ownerEmail", (step1.ownerEmail || "").trim())
    formData.append("ownerPhone", normalizePhoneDigits(step1.ownerPhone))
    formData.append(
      "primaryContactNumber",
      normalizePhoneDigits(step1.primaryContactNumber),
    )
    formData.append("zoneId", step1.zoneId || "")
    formData.append("addressLine1", step1.location?.addressLine1 || "")
    formData.append("addressLine2", step1.location?.addressLine2 || "")
    formData.append("area", step1.location?.area || "")
    formData.append("city", step1.location?.city || "")
    formData.append("state", step1.location?.state || "")
    formData.append("pincode", step1.location?.pincode || "")
    formData.append("landmark", step1.location?.landmark || "")
    formData.append("formattedAddress", step1.location?.formattedAddress || "")
    formData.append("latitude", String(step1.location?.latitude || ""))
    formData.append("longitude", String(step1.location?.longitude || ""))
  }

  const appendStep2ToFormData = (formData) => {
    formData.append("cuisines", (step2.cuisines || []).join(","))
    formData.append("estimatedDeliveryTime", (step2.estimatedDeliveryTime || "").trim())
    formData.append("openingTime", normalizeTimeValue(step2.openingTime) || "")
    formData.append("closingTime", normalizeTimeValue(step2.closingTime) || "")
    formData.append("openDays", (step2.openDays || []).join(","))

    const menuFiles = (step2.menuImages || []).filter((f) => isUploadableFile(f))
    menuFiles.forEach((file) => formData.append("menuImages", file))

    if (isUploadableFile(step2.menuPdf)) {
      formData.append("menuPdf", step2.menuPdf)
    }
    if (isUploadableFile(step2.profileImage)) {
      formData.append("profileImage", step2.profileImage)
    }
  }

  const appendStep3ToFormData = (formData) => {
    formData.append("panNumber", step3.panNumber || "")
    formData.append("nameOnPan", step3.nameOnPan || "")
    if (isUploadableFile(step3.panImage)) {
      formData.append("panImage", step3.panImage)
    }

    formData.append("gstRegistered", step3.gstRegistered ? "true" : "false")
    if (step3.gstRegistered) {
      formData.append("gstNumber", step3.gstNumber || "")
      formData.append("gstLegalName", step3.gstLegalName || "")
      formData.append("gstAddress", step3.gstAddress || "")
      if (isUploadableFile(step3.gstImage)) {
        formData.append("gstImage", step3.gstImage)
      }
    }

    formData.append("fssaiNumber", step3.fssaiNumber || "")
    formData.append("fssaiExpiry", step3.fssaiExpiry || "")
    if (isUploadableFile(step3.fssaiImage)) {
      formData.append("fssaiImage", step3.fssaiImage)
    }

    formData.append("accountNumber", step3.accountNumber || "")
    formData.append("ifscCode", (step3.ifscCode || "").toUpperCase())
    formData.append("accountHolderName", step3.accountHolderName || "")
    formData.append("accountType", step3.accountType || "")
  }

  const handleNext = async () => {
    setError("")

    // Validate current step before proceeding
    let validationErrors = []
    if (step === 1) {
      validationErrors = validateStep1()
    } else if (step === 2) {
      validationErrors = validateStep2()
    } else if (step === 3) {
      validationErrors = validateStep3()
    }

    if (validationErrors.length > 0) {
      // Surface only the first error so validation proceeds top-to-bottom.
      toast.error(validationErrors[0], {
        duration: 4000,
      })
      debugLog('? Validation failed:', validationErrors)
      return
    }

    setSaving(true)
    try {
      if (step === 1) {
        const formData = new FormData()
        appendStep1ToFormData(formData)
        const res = await restaurantAPI.saveOnboardingStep(1, formData)
        const nextAllowed = Math.min(
          3,
          Math.max(2, Number(res?.data?.data?.onboarding?.currentStep) || 2),
        )
        setMaxAllowedStep(nextAllowed)
        invalidateRestaurantAccessGuardCache()
        goToStep(2, { maxStep: nextAllowed })
        return
      }

      if (step === 2) {
        const formData = new FormData()
        appendStep2ToFormData(formData)
        const res = await restaurantAPI.saveOnboardingStep(2, formData)
        const nextAllowed = Math.min(
          3,
          Math.max(3, Number(res?.data?.data?.onboarding?.currentStep) || 3),
        )
        setMaxAllowedStep(nextAllowed)
        invalidateRestaurantAccessGuardCache()
        goToStep(3, { maxStep: nextAllowed })
        return
      }

      if (step === 3) {
        if (hasExistingRestaurantProfile) {
          const [
            menuImagesPayload,
            profileImagePayload,
            panImagePayload,
            gstImagePayload,
            fssaiImagePayload,
            menuPdfPayload,
          ] = await Promise.all([
            resolveMenuImagesForProfileUpdate(step2.menuImages || []),
            resolveImageForProfileUpdate(step2.profileImage, "food/restaurants/profile"),
            resolveImageForProfileUpdate(step3.panImage, "food/restaurants/pan"),
            step3.gstRegistered
              ? resolveImageForProfileUpdate(step3.gstImage, "food/restaurants/gst")
              : Promise.resolve(null),
            resolveImageForProfileUpdate(step3.fssaiImage, "food/restaurants/fssai"),
            resolveMenuPdfForProfileUpdate(step2.menuPdf),
          ])

          const updatePayload = {
            restaurantName: step1.restaurantName || "",
            dietaryType: step1.dietaryType || "",
            pureVegRestaurant: step1.dietaryType === "veg",
            ownerName: step1.ownerName || "",
            ownerEmail: (step1.ownerEmail || "").trim(),
            ownerPhone: normalizePhoneDigits(step1.ownerPhone),
            primaryContactNumber: normalizePhoneDigits(step1.primaryContactNumber),
            zoneId: step1.zoneId || "",
            location: {
              formattedAddress: step1.location?.formattedAddress || "",
              addressLine1: step1.location?.addressLine1 || "",
              addressLine2: step1.location?.addressLine2 || "",
              area: step1.location?.area || "",
              city: step1.location?.city || "",
              state: step1.location?.state || "",
              pincode: step1.location?.pincode || "",
              landmark: step1.location?.landmark || "",
              latitude: step1.location?.latitude || "",
              longitude: step1.location?.longitude || "",
            },
            cuisines: Array.isArray(step2.cuisines) ? step2.cuisines : [],
            estimatedDeliveryTime: (step2.estimatedDeliveryTime || "").trim(),
            openingTime: normalizeTimeValue(step2.openingTime) || "",
            closingTime: normalizeTimeValue(step2.closingTime) || "",
            openDays: Array.isArray(step2.openDays) ? step2.openDays : [],
            menuImages: menuImagesPayload,
            profileImage: profileImagePayload || "",
            panNumber: step3.panNumber || "",
            nameOnPan: step3.nameOnPan || "",
            panImage: panImagePayload || "",
            gstRegistered: Boolean(step3.gstRegistered),
            gstNumber: step3.gstRegistered ? step3.gstNumber || "" : "",
            gstLegalName: step3.gstRegistered ? step3.gstLegalName || "" : "",
            gstAddress: step3.gstRegistered ? step3.gstAddress || "" : "",
            gstImage: step3.gstRegistered ? (gstImagePayload || "") : "",
            fssaiNumber: step3.fssaiNumber || "",
            fssaiExpiry: step3.fssaiExpiry || "",
            fssaiImage: fssaiImagePayload || "",
            accountNumber: step3.accountNumber || "",
            ifscCode: (step3.ifscCode || "").toUpperCase(),
            accountHolderName: step3.accountHolderName || "",
            accountType: step3.accountType || "",
          }

          if (menuPdfPayload) {
            updatePayload.menuPdf = menuPdfPayload
          }

          await restaurantAPI.updateProfile(updatePayload)

          clearOnboardingFromLocalStorage()
          clearOnboardingFileCache()
          await clearAllFilesFromDB()

          toast.success("Profile updated successfully", { duration: 4000 })
          navigate("/food/restaurant/explore", { replace: true })
          return
        }

        const formData = new FormData()
        appendStep3ToFormData(formData)
        await restaurantAPI.submitOnboarding(formData)

        clearOnboardingFromLocalStorage()
        clearOnboardingFileCache()
        await clearAllFilesFromDB()
        invalidateRestaurantAccessGuardCache()

        try {
          localStorage.setItem(
            "restaurant_pendingPhone",
            normalizePhoneDigits(step1.ownerPhone),
          )
        } catch {}

        toast.success("Registration submitted. Awaiting admin approval.", {
          duration: 4000,
        })
        navigate("/food/restaurant/pending-verification", {
          replace: true,
          state: {
            phone: normalizePhoneDigits(step1.ownerPhone),
          },
        })
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to save onboarding data"
      setError(msg)
    } finally {
      setSaving(false)
    }
  }



  const toggleDay = (day) => {
    setStep2((prev) => {
      const exists = prev.openDays.includes(day)
      if (exists) {
        return { ...prev, openDays: prev.openDays.filter((d) => d !== day) }
      }
      return { ...prev, openDays: [...prev.openDays, day] }
    })
  }

  const toggleCuisine = (cuisine) => {
    setStep2((prev) => {
      const exists = prev.cuisines.includes(cuisine)
      return {
        ...prev,
        cuisines: exists
          ? prev.cuisines.filter((item) => item !== cuisine)
          : [...prev.cuisines, cuisine],
      }
    })
  }

  const handleStepSelect = (targetStep) => {
    if (targetStep === step) return
    if (targetStep > maxAllowedStep) return
    if (targetStep < step || completedSteps.has(targetStep)) {
      goToStep(targetStep)
    }
  }

  const handleZoneChange = (zoneId) => {
    const zone = zones.find((z) => String(z?._id || z?.id || "") === String(zoneId))
    const zoneCity = getCityFromZone(zone)
    setStep1((prev) => ({
      ...prev,
      zoneId,
      location: {
        ...prev.location,
        city: zoneCity || prev.location?.city || "",
      },
    }))
  }

  useEffect(() => {
    if (!step1.zoneId || !zones.length) return
    const zone = zones.find((z) => String(z?._id || z?.id || "") === String(step1.zoneId))
    const zoneCity = getCityFromZone(zone)
    if (!zoneCity) return
    setStep1((prev) => {
      if (prev.location?.city === zoneCity) return prev
      return {
        ...prev,
        location: { ...prev.location, city: zoneCity },
      }
    })
  }, [zones, step1.zoneId])

  const renderStep1 = () => (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
      <OnboardingSection title="Restaurant">
        <OnboardingField label="Restaurant type" required>
          <div className="grid grid-cols-3 gap-2">
            {DIETARY_OPTIONS.map((option) => {
              const selected = step1.dietaryType === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => isEditing && setStep1({ ...step1, dietaryType: option.value })}
                  disabled={!isEditing}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl border-2 px-2 text-xs font-semibold transition-colors ${
                    selected
                      ? "border-primary-orange bg-primary-orange text-white"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  <DietTypeIcon type={option.value} />
                  {option.label}
                </button>
              )
            })}
          </div>
        </OnboardingField>

        <OnboardingField label="Restaurant name" required>
          <div className="flex items-center gap-2">
            {step1.dietaryType ? (
              <DietTypeIcon type={step1.dietaryType} size="lg" />
            ) : null}
            <Input
              value={step1.restaurantName || ""}
              onChange={(e) =>
                setStep1({ ...step1, restaurantName: formatNameToCapital(e.target.value) })
              }
              className={onboardingInputClass}
              placeholder="Name shown to customers"
              disabled={!isEditing}
            />
          </div>
        </OnboardingField>
      </OnboardingSection>

      <div className="my-5 h-px bg-gray-100" />

      <OnboardingSection title="Owner">
        <OnboardingField label="Full name" required>
          <Input
            value={step1.ownerName || ""}
            onChange={(e) =>
              setStep1({
                ...step1,
                ownerName: formatNameToCapital(e.target.value.replace(/[^A-Za-z ]/g, "")),
              })
            }
            className={onboardingInputClass}
            placeholder="Owner name"
            disabled={!isEditing}
          />
        </OnboardingField>
        <OnboardingField label="Email" required>
          <Input
            type="email"
            value={step1.ownerEmail || ""}
            onChange={(e) => setStep1({ ...step1, ownerEmail: normalizeEmail(e.target.value) })}
            className={onboardingInputClass}
            placeholder="email@example.com"
            disabled={!isEditing}
          />
        </OnboardingField>
        <OnboardingField label="Phone" required>
          <Input
            value={step1.ownerPhone || ""}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 10)
              setStep1({ ...step1, ownerPhone: val })
            }}
            readOnly={Boolean(verifiedPhoneNumber)}
            className={onboardingInputClass}
            placeholder="10-digit mobile"
            disabled={!isEditing}
          />
        </OnboardingField>
      </OnboardingSection>

      <div className="my-5 h-px bg-gray-100" />

      <OnboardingSection title="Location">
        <OnboardingField label="Contact number" required>
          <Input
            value={step1.primaryContactNumber || ""}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 10)
              setStep1({ ...step1, primaryContactNumber: val })
            }}
            onKeyDown={(e) => {
              const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"]
              if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault()
              if (/^\d$/.test(e.key) && (step1.primaryContactNumber || "").length >= 10) e.preventDefault()
            }}
            onPaste={(e) => {
              e.preventDefault()
              const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 10)
              setStep1({ ...step1, primaryContactNumber: pasted })
            }}
            inputMode="numeric"
            className={onboardingInputClass}
            placeholder="Restaurant contact"
            disabled={!isEditing}
          />
        </OnboardingField>

        <OnboardingField label="Service zone" required>
          <select
            value={step1.zoneId || ""}
            onChange={(e) => handleZoneChange(e.target.value)}
            className={onboardingSelectClass}
            disabled={zonesLoading || !isEditing}
          >
            <option value="">{zonesLoading ? "Loading..." : "Select zone"}</option>
            {zones.map((z) => {
              const id = String(z?._id || z?.id || "")
              const label = z?.name || z?.zoneName || z?.serviceLocation || id
              return (
                <option key={id} value={id}>
                  {label}
                </option>
              )
            })}
          </select>
        </OnboardingField>

        <OnboardingField label="Search address" required>
          <div className="relative">
            <Input
              ref={locationSearchInputRef}
              value={locationSearchValue}
              onChange={(e) => setLocationSearchValue(e.target.value)}
              className={onboardingInputClass}
              placeholder="Type restaurant address"
            />
            {isSearchingLocation && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-orange border-t-transparent" />
              </div>
            )}
            {locationSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                {locationSuggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const { lat, lng, display, addr } = s
                      const area = addr.suburb || addr.neighbourhood || addr.city_district || addr.locality || ""
                      const city = addr.city || addr.town || addr.village || ""
                      const state = addr.state || ""
                      const pincode = addr.postcode || ""

                      setStep1((prev) => ({
                        ...prev,
                        location: {
                          ...prev.location,
                          formattedAddress: display,
                          addressLine1: display,
                          area: area || prev.location.area,
                          city: city || prev.location.city,
                          state: state || prev.location.state,
                          pincode: pincode || prev.location.pincode,
                          latitude: lat,
                          longitude: lng,
                        },
                      }))
                      setLocationSearchValue(display)
                      setLocationSuggestions([])
                    }}
                    className="w-full border-b border-gray-50 px-3 py-2.5 text-left text-sm text-gray-700 last:border-none hover:bg-primary-orange/5"
                  >
                    <span className="line-clamp-2">{s.display}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </OnboardingField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OnboardingField label="Area" required className="sm:col-span-2">
            <Input
              value={step1.location?.area || ""}
              onChange={(e) =>
                setStep1({
                  ...step1,
                  location: { ...step1.location, area: e.target.value },
                })
              }
              className={onboardingInputClass}
              placeholder="Locality"
            />
          </OnboardingField>
          <OnboardingField label="City" required>
            <Input
              value={step1.location?.city || ""}
              readOnly={Boolean(step1.zoneId)}
              onChange={(e) =>
                setStep1({
                  ...step1,
                  location: { ...step1.location, city: e.target.value },
                })
              }
              className={`${onboardingInputClass}${step1.zoneId ? " bg-gray-50" : ""}`}
              placeholder={step1.zoneId ? "Set by selected zone" : "City"}
              disabled={!isEditing}
            />
          </OnboardingField>
          <OnboardingField label="Pincode" required>
            <Input
              value={step1.location?.pincode || ""}
              onChange={(e) =>
                setStep1({
                  ...step1,
                  location: { ...step1.location, pincode: normalizePincode(e.target.value) },
                })
              }
              className={onboardingInputClass}
              placeholder="Pincode"
            />
          </OnboardingField>
          <OnboardingField label="State" className="sm:col-span-2">
            <Input
              value={step1.location?.state || ""}
              onChange={(e) =>
                setStep1({
                  ...step1,
                  location: { ...step1.location, state: e.target.value },
                })
              }
              className={onboardingInputClass}
              placeholder="State"
            />
          </OnboardingField>
        </div>
      </OnboardingSection>
    </div>
  )


  // Initialize Google Places Autocomplete for Step 1 location search.
  useEffect(() => {
    if (step !== 1) return

    let cancelled = false
    let autocomplete = null

    const init = async () => {
      // Wait for the input ref to be attached
      let inputElement = null
      for (let i = 0; i < 50; i++) {
        if (locationSearchInputRef.current) {
          inputElement = locationSearchInputRef.current
          break
        }
        await new Promise((r) => setTimeout(r, 100))
      }

      if (!inputElement || cancelled) return

      const loadMaps = async () => {
        // 1. If already available with places, return true
        if (window.google?.maps?.places?.Autocomplete) {
          mapsScriptLoadedRef.current = true
          return true
        }

        // 2. Load API Key
        const apiKey = await getGoogleMapsApiKey()
        if (!apiKey) {
          debugError("Google Maps API Key missing or invalid")
          return false
        }

        // 3. Handle Auth Failure
        window.gm_authFailure = () => {
          debugError("Google Maps authentication failed.")
          // Don't show toast here as we have Nominatim fallback
        }

        // 4. Check for existing script and force libraries=places if needed
        const scripts = Array.from(document.getElementsByTagName("script"))
        const mapsScript = scripts.find(s => s.src?.includes("maps.googleapis.com/maps/api/js"))
        
        if (mapsScript && !mapsScript.src.includes("libraries=places")) {
          debugLog("Found maps script without places, removing to reload properly.")
          mapsScript.remove()
        } else if (mapsScript && mapsScript.src.includes("libraries=places")) {
           // Wait if it's still loading
           for (let i = 0; i < 60; i++) {
             if (window.google?.maps?.places?.Autocomplete) return true
             if (cancelled) return false
             await new Promise(r => setTimeout(r, 100))
           }
        }

        // 5. Create and append new script
        return new Promise((resolve) => {
          const script = document.createElement("script")
          script.id = "google-maps-sdk"
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`
          script.async = true
          script.defer = true
          script.onload = () => {
            setTimeout(() => {
              const ok = !!window.google?.maps?.places?.Autocomplete
              mapsScriptLoadedRef.current = ok
              resolve(ok)
            }, 200)
          }
          script.onerror = () => resolve(false)
          document.head.appendChild(script)
        })
      }

      const parsePlace = (place) => {
        const formattedAddress = place?.formatted_address || ""
        const comps = Array.isArray(place?.address_components) ? place.address_components : []
        const get = (types) => comps.find((c) => types.some((t) => c.types?.includes(t)))?.long_name || ""

        const area = get(["sublocality_level_1", "sublocality", "neighborhood"]) || get(["locality"])
        const city = get(["locality"]) || get(["administrative_area_level_2"])
        const state = get(["administrative_area_level_1"]) || get(["administrative_area_level_2"])
        const pincode = get(["postal_code"])
        const lat = place?.geometry?.location?.lat?.()
        const lng = place?.geometry?.location?.lng?.()

        return {
          formattedAddress,
          area,
          city,
          state,
          pincode,
          latitude: typeof lat === "number" ? Number(lat.toFixed(6)) : "",
          longitude: typeof lng === "number" ? Number(lng.toFixed(6)) : "",
        }
      }

      const ok = await loadMaps()
      if (!ok || cancelled || !inputElement) return

      if (inputElement.hasAttribute("data-google-places-initialized")) return

      try {
        autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
          fields: ["formatted_address", "address_components", "geometry"],
          componentRestrictions: { country: "in" },
          types: ["geocode", "establishment"]
        })

        inputElement.setAttribute("data-google-places-initialized", "true")
        placesAutocompleteRef.current = autocomplete

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace()
          if (!place?.geometry) return

          const parsed = parsePlace(place)
          setStep1((prev) => ({
            ...prev,
            location: {
              ...prev.location,
              formattedAddress: parsed.formattedAddress || prev.location.formattedAddress,
              addressLine1: parsed.formattedAddress || prev.location.addressLine1 || "",
              area: parsed.area || prev.location.area,
              city: parsed.city || prev.location.city,
              state: parsed.state || prev.location.state,
              pincode: parsed.pincode || prev.location.pincode,
              latitude: parsed.latitude !== "" ? parsed.latitude : prev.location.latitude,
              longitude: parsed.longitude !== "" ? parsed.longitude : prev.location.longitude,
            },
          }))
          
          setLocationSearchValue(parsed.formattedAddress)
          inputElement.blur()
        })

        const pacContainerFix = () => {
          const applyFix = () => {
            const containers = document.querySelectorAll(".pac-container")
            if (containers.length > 0) {
              containers.forEach((container) => {
                container.style.zIndex = "999999"
                container.style.pointerEvents = "auto"
                container.style.visibility = "visible"
                container.style.display = "block"
              })
            }
          }
          applyFix()
          setTimeout(applyFix, 100)
          setTimeout(applyFix, 300)
        }

        inputElement.addEventListener("focus", pacContainerFix)
        inputElement.addEventListener("input", pacContainerFix)
      } catch (e) {
        debugError("Autocomplete error:", e)
      }
    }

    init().catch(() => {})

    return () => {
      cancelled = true
      if (autocomplete) {
        try { window.google?.maps?.event?.clearInstanceListeners(autocomplete) } catch {}
      }
      if (locationSearchInputRef.current) {
        locationSearchInputRef.current.removeAttribute("data-google-places-initialized")
      }
      placesAutocompleteRef.current = null
    }
  }, [step])

  // Hybrid Search Fallback (Nominatim)
  useEffect(() => {
    if (step !== 1) return
    const q = String(locationSearchValue || "").trim()
    if (q.length < 3) {
      setLocationSuggestions([])
      setIsSearchingLocation(false)
      return
    }

    const t = setTimeout(async () => {
      try {
        setIsSearchingLocation(true)
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=4&q=${encodeURIComponent(q)}&countrycodes=in`
        const res = await fetch(url, { headers: { Accept: "application/json" } })
        const json = await res.json()
        const mapped = (Array.isArray(json) ? json : []).map(r => ({
          id: r.place_id,
          display: r.display_name || "",
          lat: Number(r.lat),
          lng: Number(r.lon),
          addr: r.address || {},
        }))
        setLocationSuggestions(mapped)
      } catch (e) {
        debugError("Nominatim search failed:", e)
      } finally {
        setIsSearchingLocation(false)
      }
    }, 400)

    return () => clearTimeout(t)
  }, [locationSearchValue, step])

  // Load zones for onboarding dropdown (public endpoint).
  useEffect(() => {
    if (step !== 1) return
    let cancelled = false
    setZonesLoading(true)
    zoneAPI.getPublicZones()
      .then((res) => {
        const list = res?.data?.data?.zones || res?.data?.zones || []
        if (!cancelled) setZones(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!cancelled) setZones([])
      })
      .finally(() => {
        if (!cancelled) setZonesLoading(false)
      })
    return () => { cancelled = true }
  }, [step])


  const renderStep2 = () => (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
      <OnboardingSection title="Menu & photos">
        <OnboardingField label="Menu images" required>
        <div className="space-y-2">
          <div className="mt-1 border border-dashed border-gray-300 rounded-md bg-gray-50/70 px-4 py-3 flex items-center justify-between flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-white flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-gray-700" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-900">Upload menu images</span>
                <span className="text-[11px] text-gray-500">
                  JPG, PNG, WebP ? You can select multiple files
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs"
              onClick={() =>
                openImageSourcePicker({
                  title: "Add menu image",
                  fileNamePrefix: "menu-image",
                  fallbackInputRef: menuImagesInputRef,
                  onSelectFile: (file) => handleMenuImagesSelected(file ? [file] : []),
                })
              }
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Upload
            </Button>
            <input
              id="menuImagesInput"
              type="file"
              multiple
              accept={LOCAL_IMAGE_FILE_ACCEPT}
              className="hidden"
              ref={menuImagesInputRef}
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (!files.length) return
                debugLog('?? Menu images selected:', files.length, 'files')
                handleMenuImagesSelected(files)
                // Reset input to allow selecting same file again
                e.target.value = ''
              }}
            />
          </div>

          {/* Menu image previews */}
          {!!step2.menuImages.length && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {step2.menuImages.map((file, idx) => {
                // Handle both File objects and URL objects
                let imageUrl = null
                let imageName = `Image ${idx + 1}`

                if (isUploadableFile(file)) {
                  imageUrl = getPreviewImageUrl(file)
                  imageName = file.name || imageName
                } else if (file?.url) {
                  // If it's an object with url property (from backend)
                  imageUrl = file.url
                  imageName = file.name || `Image ${idx + 1}`
                } else if (typeof file === 'string') {
                  // If it's a direct URL string
                  imageUrl = file
                }

                return (
                  <div
                    key={idx}
                    className="relative aspect-4/5 rounded-md overflow-hidden bg-gray-100"
                  >
                    <div className="absolute top-1 right-1 z-30">
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          await handleRemoveMenuImage(idx)
                        }}
                        className="bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={`Menu ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[11px] text-gray-500 px-2 text-center">
                        Preview unavailable
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-emerald-950/55 px-2 py-1">
                      <p className="text-[10px] text-white truncate">
                        {imageName}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        </OnboardingField>

        {/* Menu PDF */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Menu PDF <span className="text-red-500">*</span></Label>
          <div className="mt-1 border border-dashed border-gray-300 rounded-md bg-gray-50/70 px-4 py-3 flex items-center justify-between flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-white flex items-center justify-center">
                <FileText className="w-5 h-5 text-gray-700" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-900">Upload menu PDF</span>
                <span className="text-[11px] text-gray-500">PDF only, max 1 file</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs"
              onClick={() => menuPdfInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Upload PDF
            </Button>
            <input
              id="menuPdfInput"
              type="file"
              accept={LOCAL_PDF_FILE_ACCEPT}
              className="hidden"
              ref={menuPdfInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                if (file) {
                  handleMenuPdfSelected(file)
                }
                e.target.value = ""
              }}
            />
          </div>
          {step2.menuPdf && (
            <div className="mt-2 flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-600" />
                <span className="text-xs text-gray-700">
                  {typeof step2.menuPdf === "object" ? step2.menuPdf.name || "Menu.pdf" : "Menu.pdf"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveMenuPdf}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Profile image */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Restaurant profile image</Label>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                {step2.profileImage ? (
                  (() => {
                    const imageSrc = getPreviewImageUrl(step2.profileImage)

                    return imageSrc ? (
                      <img
                        src={imageSrc}
                        alt="Restaurant profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-500" />
                    );
                  })()
                ) : (
                  <ImageIcon className="w-6 h-6 text-gray-500" />
                )}
              </div>
              {step2.profileImage && (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await handleRemoveProfileImage()
                  }}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex-1 flex-col flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-900">Upload profile image</span>
                <span className="text-[11px] text-gray-500">
                  This will be shown on your listing card and restaurant page.
                </span>
              </div>

            </div>

          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full text-xs"
            onClick={() =>
              openImageSourcePicker({
                title: "Upload profile image",
                fileNamePrefix: "profile-image",
                fallbackInputRef: profileImageInputRef,
                onSelectFile: handleProfileImageSelected,
              })
            }
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Upload
          </Button>
          <input
            id="profileImageInput"
            type="file"
            accept={LOCAL_IMAGE_FILE_ACCEPT}
            className="hidden"
            ref={profileImageInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              if (file) {
                debugLog('?? Profile image selected:', file.name)
                handleProfileImageSelected(file)
              }
              // Reset input to allow selecting same file again
              e.target.value = ''
            }}
          />
        </div>
      </OnboardingSection>

      <div className="my-5 h-px bg-gray-100" />

      <OnboardingSection title="Cuisines">
        <div className="flex flex-wrap gap-2">
          {CUISINE_OPTIONS.map((cuisine) => {
            const selected = step2.cuisines.includes(cuisine)
            return (
              <button
                key={cuisine}
                type="button"
                disabled={!isEditing}
                onClick={() => toggleCuisine(cuisine)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? "bg-primary-orange text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-primary-orange/10 hover:text-primary-orange"
                } ${!isEditing ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                {cuisine}
              </button>
            )
          })}
        </div>
        {step2.cuisines.length > 0 && (
          <p className="text-[11px] font-medium text-primary-orange">
            {step2.cuisines.length} cuisine{step2.cuisines.length === 1 ? "" : "s"} selected
          </p>
        )}
      </OnboardingSection>

      <div className="my-5 h-px bg-gray-100" />

      <OnboardingSection title="Timings & hours">
        <div className="space-y-3">
          <Label className="text-xs text-gray-700">Outlet timings</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TimeSelector
              label="Opening time"
              value={step2.openingTime || ""}
              onChange={(val) => {
                setStep2((prev) => ({ ...prev, openingTime: normalizeTimeValue(val) || "" }))
              }}
            />
            <TimeSelector
              label="Closing time"
              value={step2.closingTime || ""}
              onChange={(val) => {
                setStep2((prev) => ({ ...prev, closingTime: normalizeTimeValue(val) || "" }))
              }}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Estimated delivery time*</Label>
            <Input
              value={step2.estimatedDeliveryTime || ""}
              onChange={(e) =>
                setStep2((prev) => ({ ...prev, estimatedDeliveryTime: e.target.value }))
              }
              className={onboardingInputClass}
              placeholder="e.g., 25-30 mins"
            />
          </div>
        </div>

        {/* Open days in a calendar-like grid */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-700 flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-gray-800" />
            <span>Open days</span>
          </Label>
          <p className="text-[11px] text-gray-500">
            Select the days your restaurant accepts delivery orders.
          </p>
          <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
            {daysOfWeek.map((day) => {
              const active = step2.openDays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`aspect-square flex items-center justify-center rounded-md text-[11px] font-medium ${active ? "bg-primary-orange text-white" : "bg-gray-100 text-gray-800"
                    }`}
                >
                  {day.charAt(0)}
                </button>
              )
            })}
          </div>
        </div>
      </OnboardingSection>
    </div>
  )

  const renderStep3 = () => (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 space-y-5">
      <OnboardingSection title="PAN details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-700">PAN number</Label>
            <Input
              value={step3.panNumber || ""}
              onChange={(e) => setStep3({ ...step3, panNumber: normalizePAN(e.target.value) })}
              className={onboardingInputClass}
              placeholder="ABCDE1234F"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">PAN Card Holder Name</Label>
            <Input
              value={step3.nameOnPan || ""}
              onChange={(e) =>
                setStep3({
                  ...step3,
                  nameOnPan: formatNameToCapital(e.target.value.replace(/[^A-Za-z ]/g, "")),
                })
              }
              className={onboardingInputClass}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-gray-700">PAN image</Label>
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full text-xs"
            onClick={() =>
              openImageSourcePicker({
                title: "Upload PAN image",
                fileNamePrefix: "pan-image",
                fallbackInputRef: panImageInputRef,
                onSelectFile: handlePanImageSelected,
              })
            }
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Upload
          </Button>
          <input
            type="file"
            accept={GALLERY_IMAGE_ACCEPT}
            className="hidden"
            ref={panImageInputRef}
            onChange={(e) => {
              handlePanImageSelected(e.target.files?.[0] || null)
              e.target.value = ""
            }}
          />
          {step3.panImage && (
            <div className="mt-3 relative aspect-4/3 rounded-md overflow-hidden bg-gray-100">
              {getPreviewImageUrl(step3.panImage) ? (
                <img
                  src={getPreviewImageUrl(step3.panImage)}
                  alt="PAN document"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                  Preview unavailable
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setStep3((prev) => ({ ...prev, panImage: null }))
                }}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </OnboardingSection>

      <div className="h-px bg-gray-100" />

      <OnboardingSection title="GST details">
        <div className="flex gap-4 items-center text-sm">
          <span className="text-gray-700">GST registered?</span>
          <button
            type="button"
            onClick={() => setStep3({ ...step3, gstRegistered: true })}
            className={`px-3 py-1.5 text-xs rounded-full ${step3.gstRegistered ? "bg-primary-orange text-white" : "bg-gray-100 text-gray-800"
              }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setStep3({ ...step3, gstRegistered: false })}
            className={`px-3 py-1.5 text-xs rounded-full ${!step3.gstRegistered ? "bg-primary-orange text-white" : "bg-gray-100 text-gray-800"
              }`}
          >
            No
          </button>
        </div>
        {step3.gstRegistered && (
          <div className="space-y-3">
            <Input
              value={step3.gstNumber || ""}
              onChange={(e) => setStep3({ ...step3, gstNumber: normalizeGST(e.target.value) })}
              className={onboardingInputClass}
              placeholder="GST number (15 characters)"
            />
            <Input
              value={step3.gstLegalName || ""}
              onChange={(e) =>
                setStep3({
                  ...step3,
                  gstLegalName: formatNameToCapital(e.target.value.replace(/[^A-Za-z ]/g, "")),
                })
              }
              className={onboardingInputClass}
              placeholder="Legal name"
            />
            <Input
              value={step3.gstAddress || ""}
              onChange={(e) => setStep3({ ...step3, gstAddress: e.target.value })}
              className={onboardingInputClass}
              placeholder="Registered address"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs"
              onClick={() =>
                openImageSourcePicker({
                  title: "Upload GST image",
                  fileNamePrefix: "gst-image",
                  fallbackInputRef: gstImageInputRef,
                  onSelectFile: handleGstImageSelected,
                })
              }
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Upload
            </Button>
            <input
              type="file"
              accept={GALLERY_IMAGE_ACCEPT}
              className="hidden"
              ref={gstImageInputRef}
              onChange={(e) => {
                handleGstImageSelected(e.target.files?.[0] || null)
                e.target.value = ""
              }}
            />
            {step3.gstImage && (
              <div className="mt-3 relative aspect-4/3 rounded-md overflow-hidden bg-gray-100">
                {getPreviewImageUrl(step3.gstImage) ? (
                  <img
                    src={getPreviewImageUrl(step3.gstImage)}
                    alt="GST document"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                    Preview unavailable
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setStep3((prev) => ({ ...prev, gstImage: null }))
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </OnboardingSection>

      <div className="h-px bg-gray-100" />

      <OnboardingSection title="FSSAI details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            value={step3.fssaiNumber || ""}
            onChange={(e) =>
              setStep3({ ...step3, fssaiNumber: e.target.value.replace(/\D/g, "").slice(0, 14) })
            }
            className={onboardingInputClass}
            placeholder="FSSAI number (14 digits)"
          />
          <div>
            <Label className="text-xs text-gray-700 mb-1 block">FSSAI expiry date</Label>
            <Popover open={isFssaiCalendarOpen} onOpenChange={setIsFssaiCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={() => setIsFssaiCalendarOpen(true)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm text-left flex items-center justify-between hover:bg-gray-50"
                >
                  <span className={step3.fssaiExpiry ? "text-gray-900" : "text-gray-500"}>
                    {step3.fssaiExpiry
                      ? parseLocalYMDDate(step3.fssaiExpiry)?.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                      : "Select expiry date"}
                  </span>
                  <CalendarIcon className="w-4 h-4 text-gray-500" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-100" align="start">
                <div className="bg-white rounded-md shadow-lg border border-gray-200">
                  <Calendar
                    mode="single"
                    selected={parseLocalYMDDate(step3.fssaiExpiry)}
                    disabled={(date) => formatDateToLocalYMD(date) < getTodayLocalYMD()}
                    onSelect={(date) => {
                      if (date && formatDateToLocalYMD(date) >= getTodayLocalYMD()) {
                        const formattedDate = formatDateToLocalYMD(date)
                        setStep3({ ...step3, fssaiExpiry: formattedDate })
                        setIsFssaiCalendarOpen(false)
                      }
                    }}
                    initialFocus
                    classNames={{
                      today: "bg-transparent text-foreground border-none", // Remove today highlight
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full text-xs"
          onClick={() =>
            openImageSourcePicker({
              title: "Upload FSSAI image",
              fileNamePrefix: "fssai-image",
              fallbackInputRef: fssaiImageInputRef,
              onSelectFile: handleFssaiImageSelected,
            })
          }
        >
          <Upload className="w-4 h-4 mr-1.5" />
          Upload
        </Button>
        <input
          type="file"
          accept={GALLERY_IMAGE_ACCEPT}
          className="hidden"
          ref={fssaiImageInputRef}
          onChange={(e) => {
            handleFssaiImageSelected(e.target.files?.[0] || null)
            e.target.value = ""
          }}
        />
        {step3.fssaiImage && (
          <div className="mt-3 relative aspect-4/3 rounded-md overflow-hidden bg-gray-100">
            {getPreviewImageUrl(step3.fssaiImage) ? (
              <img
                src={getPreviewImageUrl(step3.fssaiImage)}
                alt="FSSAI document"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                Preview unavailable
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setStep3((prev) => ({ ...prev, fssaiImage: null }))
              }}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </OnboardingSection>

      <div className="h-px bg-gray-100" />

      <OnboardingSection title="Bank account">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            value={step3.accountNumber || ""}
            onChange={(e) => setStep3({ ...step3, accountNumber: normalizeBankAcc(e.target.value) })}
            className={onboardingInputClass}
            placeholder="Account number"
          />
          <Input
            value={step3.confirmAccountNumber || ""}
            onChange={(e) => setStep3({ ...step3, confirmAccountNumber: normalizeBankAcc(e.target.value) })}
            className={onboardingInputClass}
            placeholder="Re-enter account number"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            value={step3.ifscCode || ""}
            onChange={(e) => setStep3({ ...step3, ifscCode: normalizeIFSC(e.target.value) })}
            className={onboardingInputClass}
            placeholder="IFSC code"
          />
          <Select
            value={step3.accountType || ""}
            onValueChange={(value) => setStep3({ ...step3, accountType: value })}
          >
            <SelectTrigger className={onboardingInputClass}>
              <SelectValue placeholder="Select account type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Saving">Saving</SelectItem>
              <SelectItem value="Current">Current</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          value={step3.accountHolderName || ""}
          onChange={(e) =>
            setStep3({
              ...step3,
              accountHolderName: formatNameToCapital(e.target.value.replace(/[^A-Za-z ]/g, "")),
            })
          }
          className={onboardingInputClass}
          placeholder="Account holder name"
        />
      </OnboardingSection>
    </div>
  )

  const renderStep = () => {
    if (step === 1) return renderStep1()
    if (step === 2) return renderStep2()
    return renderStep3()
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <OnboardingShell
        step={step}
        completedSteps={completedSteps}
        loading={loading}
        saving={saving}
        isEditing={isEditing}
        isLoggingOut={isLoggingOut}
        keyboardInset={keyboardInset}
        error={error}
        onLogout={handleLogout}
        onBack={() => goToStep(step - 1)}
        onContinue={handleNext}
        continueDisabled={!isCurrentStepValid}
        onClose={() => navigate("/food/restaurant/explore")}
        onEdit={() => setIsEditing(true)}
        onStepSelect={handleStepSelect}
      >
        {rejectionNotice ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-semibold">Previous registration was rejected</p>
            <p className="mt-1 text-xs leading-relaxed text-red-700">{rejectionNotice}</p>
          </div>
        ) : null}
        {renderStep()}
      </OnboardingShell>

      <ImageSourcePicker
        isOpen={sourcePicker.isOpen}
        onClose={closeImageSourcePicker}
        onFileSelect={sourcePicker.onSelectFile}
        title={sourcePicker.title}
        fileNamePrefix={sourcePicker.fileNamePrefix}
        galleryInputRef={sourcePicker.fallbackInputRef}
      />
    </LocalizationProvider>
  )
}




