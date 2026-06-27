import { restaurantAPI } from "@food/api"
import { isRestaurantBanned } from "@food/utils/restaurantBan"

const debugError = (...args) => {}

export const getOnboardingStorageKey = () => {
  try {
    const userStr = localStorage.getItem("restaurant_user")
    if (userStr) {
      const user = JSON.parse(userStr)
      const userId = user._id || user.id
      if (userId) return `restaurant_onboarding_data_${userId}`
    }
  } catch (e) {}
  return "restaurant_onboarding_data"
}

const isPresentImage = (value) => {
  if (!value) return false
  if (typeof value === "string" && value.trim()) return true
  if (typeof File !== "undefined" && value instanceof File) return true
  if (typeof Blob !== "undefined" && value instanceof Blob) return true
  if (value?.url) return true
  return false
}

const hasValidMenuImages = (images) =>
  Array.isArray(images) && images.length > 0 && images.some(isPresentImage)

const isPresentDocument = (value) => {
  if (!value) return false
  if (typeof value === "string" && value.trim()) return true
  if (typeof File !== "undefined" && value instanceof File) return true
  if (typeof Blob !== "undefined" && value instanceof Blob) return true
  if (value?.url) return true
  return false
}

const isStepComplete = (stepData, stepNumber) => {
  if (!stepData) return false

  if (stepNumber === 1) {
    const dietType = stepData.dietaryType || stepData.step1?.dietaryType
    const hasDiet =
      dietType === "veg" || dietType === "non_veg" || dietType === "mixed" ||
      typeof stepData.pureVegRestaurant === "boolean"

    return (
      stepData.restaurantName &&
      hasDiet &&
      stepData.ownerName &&
      stepData.ownerEmail &&
      stepData.ownerPhone &&
      stepData.primaryContactNumber &&
      stepData.zoneId &&
      stepData.location?.area &&
      stepData.location?.city &&
      stepData.location?.pincode
    )
  }

  if (stepNumber === 2) {
    const openingTime =
      stepData.deliveryTimings?.openingTime || stepData.openingTime || ""
    const closingTime =
      stepData.deliveryTimings?.closingTime || stepData.closingTime || ""

    return (
      Array.isArray(stepData.cuisines) &&
      stepData.cuisines.length > 0 &&
      openingTime &&
      closingTime &&
      Array.isArray(stepData.openDays) &&
      stepData.openDays.length > 0 &&
      hasValidMenuImages(stepData.menuImageUrls) &&
      isPresentImage(stepData.profileImageUrl) &&
      isPresentDocument(stepData.menuPdf) &&
      Boolean(String(stepData.estimatedDeliveryTime || "").trim())
    )
  }

  if (stepNumber === 3) {
    const hasPanImage = isPresentImage(stepData.pan?.image)
    const hasFssaiImage = isPresentImage(stepData.fssai?.image)
    const hasGstImage =
      !stepData.gst?.isRegistered || isPresentImage(stepData.gst?.image)

    return (
      stepData.pan?.panNumber &&
      stepData.pan?.nameOnPan &&
      hasPanImage &&
      stepData.fssai?.registrationNumber &&
      hasFssaiImage &&
      hasGstImage &&
      stepData.bank?.accountNumber &&
      stepData.bank?.ifscCode &&
      stepData.bank?.accountHolderName &&
      stepData.bank?.accountType
    )
  }

  return false
}

const buildOnboardingLikeDataFromRestaurant = (restaurant) => {
  const onboarding = restaurant?.onboarding || {}

  const openingTime =
    restaurant?.openingTime ||
    restaurant?.deliveryTimings?.openingTime ||
    onboarding?.step2?.deliveryTimings?.openingTime
  const closingTime =
    restaurant?.closingTime ||
    restaurant?.deliveryTimings?.closingTime ||
    onboarding?.step2?.deliveryTimings?.closingTime

  return {
    completedSteps: onboarding.completedSteps,
    step1: onboarding.step1 || {
      restaurantName: restaurant?.restaurantName || restaurant?.name,
      pureVegRestaurant:
        typeof restaurant?.pureVegRestaurant === "boolean"
          ? restaurant.pureVegRestaurant
          : null,
      ownerName: restaurant?.ownerName,
      ownerEmail: restaurant?.ownerEmail || restaurant?.email,
      ownerPhone: restaurant?.ownerPhone || restaurant?.phone,
      primaryContactNumber: restaurant?.primaryContactNumber,
      location:
        restaurant?.location ||
        (restaurant?.area || restaurant?.city || restaurant?.addressLine1
          ? {
              addressLine1: restaurant?.addressLine1,
              addressLine2: restaurant?.addressLine2,
              area: restaurant?.area,
              city: restaurant?.city,
              landmark: restaurant?.landmark,
            }
          : null),
    },
    step2: onboarding.step2 || {
      cuisines: restaurant?.cuisines,
      deliveryTimings:
        restaurant?.deliveryTimings ||
        (openingTime || closingTime ? { openingTime, closingTime } : null),
      openDays: restaurant?.openDays,
      menuImageUrls: restaurant?.menuImages,
      profileImageUrl: restaurant?.profileImage,
    },
    step3:
      onboarding.step3 ||
      (restaurant?.panNumber ||
      restaurant?.fssaiNumber ||
      restaurant?.accountNumber ||
      restaurant?.ifscCode
        ? {
            pan: {
              panNumber: restaurant?.panNumber,
              nameOnPan: restaurant?.nameOnPan,
              image: restaurant?.panImage,
            },
            gst: {
              isRegistered: Boolean(restaurant?.gstRegistered),
              gstNumber: restaurant?.gstNumber,
              legalName: restaurant?.gstLegalName,
              address: restaurant?.gstAddress,
              image: restaurant?.gstImage,
            },
            fssai: {
              registrationNumber: restaurant?.fssaiNumber,
              expiryDate: restaurant?.fssaiExpiry,
              image: restaurant?.fssaiImage,
            },
            bank: {
              accountNumber: restaurant?.accountNumber,
              ifscCode: restaurant?.ifscCode,
              accountHolderName: restaurant?.accountHolderName,
              accountType: restaurant?.accountType,
            },
          }
        : null),
  }
}

export const resolveRestaurantOnboardingStatus = (restaurant) => {
  if (!restaurant) return "NOT_STARTED"
  if (isRestaurantBanned(restaurant)) return "BANNED"
  const explicit = String(restaurant?.onboardingStatus || "").toUpperCase()
  if (explicit === "BANNED") return "BANNED"
  if (explicit) return explicit
  if (restaurant?.status === "approved") return "APPROVED"
  if (restaurant?.status === "banned") return "BANNED"
  if (restaurant?.status === "rejected") return "REJECTED"
  if (restaurant?.submittedAt || restaurant?.pendingUpdateReason === "New Registration") {
    return "SUBMITTED"
  }
  return "IN_PROGRESS"
}

export const isRestaurantOnboardingComplete = (restaurant) => {
  if (!restaurant) return false

  const status = resolveRestaurantOnboardingStatus(restaurant)
  if (status === "APPROVED") return true

  if (
    restaurant?.status === "pending" &&
    (restaurant?.approvedAt ||
      (restaurant?.pendingUpdateReason &&
        restaurant?.pendingUpdateReason !== "New Registration"))
  ) {
    return true
  }

  if (restaurant?.isActive === true) return true

  if (status === "SUBMITTED" || status === "UNDER_REVIEW") return true

  const onboardingLikeData = buildOnboardingLikeDataFromRestaurant(restaurant)
  if (onboardingLikeData.completedSteps === 4) return true

  const step1Complete = isStepComplete(onboardingLikeData.step1, 1)
  const step2Complete = isStepComplete(onboardingLikeData.step2, 2)
  const step3Complete = isStepComplete(onboardingLikeData.step3, 3)

  if (step1Complete && step2Complete && step3Complete) return true

  const hasOperationalProfile =
    Boolean(String(restaurant?.name || "").trim()) &&
    Boolean(String(restaurant?.restaurantId || "").trim()) &&
    Boolean(String(restaurant?.slug || "").trim()) &&
    step1Complete &&
    step2Complete &&
    (restaurant?.approvedAt ||
      restaurant?.rejectedAt ||
      restaurant?.rejectionReason ||
      restaurant?.isActive === false)

  if (hasOperationalProfile) return true

  return false
}

export const mapOnboardingFormToCheckData = (step1 = {}, step2 = {}, step3 = {}) => ({
    step1: {
      ...step1,
      zoneId: step1.zoneId,
      dietaryType: step1.dietaryType,
    },
  step2: {
    cuisines: step2.cuisines,
    openDays: step2.openDays,
    openingTime: step2.openingTime,
    closingTime: step2.closingTime,
    deliveryTimings: {
      openingTime: step2.openingTime || step2.deliveryTimings?.openingTime,
      closingTime: step2.closingTime || step2.deliveryTimings?.closingTime,
    },
    menuImageUrls: step2.menuImages,
    profileImageUrl: step2.profileImage,
    menuPdf: step2.menuPdf,
    estimatedDeliveryTime: step2.estimatedDeliveryTime,
  },
  step3: {
    pan: {
      panNumber: step3.panNumber,
      nameOnPan: step3.nameOnPan,
      image: step3.panImage,
    },
    gst: {
      isRegistered: Boolean(step3.gstRegistered),
      gstNumber: step3.gstNumber,
      legalName: step3.gstLegalName,
      address: step3.gstAddress,
      image: step3.gstImage,
    },
    fssai: {
      registrationNumber: step3.fssaiNumber,
      expiryDate: step3.fssaiExpiry,
      image: step3.fssaiImage,
    },
    bank: {
      accountNumber: step3.accountNumber,
      ifscCode: step3.ifscCode,
      accountHolderName: step3.accountHolderName,
      accountType: step3.accountType,
    },
  },
})

export const getCompletedOnboardingSteps = (step1, step2, step3) => {
  const data = mapOnboardingFormToCheckData(step1, step2, step3)
  const completed = new Set()
  if (isStepComplete(data.step1, 1)) completed.add(1)
  if (isStepComplete(data.step2, 2)) completed.add(2)
  if (isStepComplete(data.step3, 3)) completed.add(3)
  return completed
}

export const determineStepToShow = (data) => {
  if (!data) return 1

  if (data.completedSteps === 4) return null

  if (!isStepComplete(data.step1, 1)) return 1
  if (!isStepComplete(data.step2, 2)) return 2
  if (!isStepComplete(data.step3, 3)) return 3

  return null
}

export const checkOnboardingStatus = async () => {
  try {
    const res = await restaurantAPI.getOnboardingProgress()
    const payload = res?.data?.data?.onboarding || res?.data?.onboarding
    if (!payload) return 1

    const status = String(payload.onboardingStatus || "").toUpperCase()
    if (status === "APPROVED") return null
    if (status === "SUBMITTED" || status === "UNDER_REVIEW") return null

    if (payload.currentStep) return payload.currentStep

    const stepToShow = determineStepToShow(payload.onboarding)
    return stepToShow || 1
  } catch (err) {
    try {
      const localData = localStorage.getItem(getOnboardingStorageKey())
      if (localData) {
        const parsed = JSON.parse(localData)
        return parsed.currentStep || 1
      }
    } catch (localErr) {
      debugError("Failed to check localStorage:", localErr)
    }
    return 1
  }
}
