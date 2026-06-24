import mongoose from "mongoose";
import { FoodRestaurant } from "../models/restaurant.model.js";
import {
  uploadImageBuffer,
  uploadFileBuffer,
} from "../../../../services/cloudinary.service.js";
import { ValidationError } from "../../../../core/auth/errors.js";

const ONBOARDING_STATUSES = new Set([
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
]);

const normalizePhone = (value) => {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(-15);
  return {
    digits: digits || "",
    last10: digits ? digits.slice(-10) : "",
  };
};

const normalizeRestaurantTime = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const toFiniteNumber = (value) => {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
};

const parseCsvOrArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

const DRAFT_PLACEHOLDER_NAME = "__DRAFT__";

const isDraftRestaurant = (doc) => {
  const name = String(doc?.restaurantName || "").trim().toLowerCase();
  return (
    name === "pending registration" ||
    name === "draft" ||
    name === DRAFT_PLACEHOLDER_NAME.toLowerCase()
  );
};

const hasSubmittedProfile = (doc) => {
  if (!doc) return false;
  if (doc.submittedAt) return true;
  if (doc.pendingUpdateReason === "New Registration" && !isDraftRestaurant(doc)) {
    return Boolean(doc.menuPdf && doc.panNumber && doc.fssaiNumber);
  }
  return false;
};

export const resolveOnboardingStatus = (doc) => {
  if (!doc) return "NOT_STARTED";
  if (
    doc.onboardingStatus &&
    ONBOARDING_STATUSES.has(doc.onboardingStatus)
  ) {
    return doc.onboardingStatus;
  }
  if (doc.status === "approved") return "APPROVED";
  if (doc.status === "rejected") return "REJECTED";
  if (hasSubmittedProfile(doc)) return "SUBMITTED";
  if (doc.status === "pending") return "IN_PROGRESS";
  return "NOT_STARTED";
};

const buildOnboardingPayload = (doc) => {
  const status = resolveOnboardingStatus(doc);
  const onboarding = doc?.onboarding || {};
  const openingTime =
    onboarding?.step2?.openingTime ||
    doc?.openingTime ||
    onboarding?.step2?.deliveryTimings?.openingTime ||
    "";
  const closingTime =
    onboarding?.step2?.closingTime ||
    doc?.closingTime ||
    onboarding?.step2?.deliveryTimings?.closingTime ||
    "";

  return {
    onboardingStatus: status,
    currentStep:
      status === "SUBMITTED" || status === "UNDER_REVIEW"
        ? null
        : Math.min(3, Math.max(1, Number(doc?.currentStep) || 1)),
    completedSteps: Array.isArray(doc?.completedSteps)
      ? [...doc.completedSteps]
      : [],
    submittedAt: doc?.submittedAt || null,
    verifiedAt: doc?.verifiedAt || doc?.approvedAt || null,
    adminRemarks: doc?.adminRemarks || doc?.rejectionReason || null,
    rejectionStep: doc?.rejectionStep || null,
    onboarding: {
      completedSteps: doc?.completedSteps?.length || 0,
      step1: onboarding.step1 || {
        restaurantName: doc?.restaurantName,
        pureVegRestaurant: doc?.pureVegRestaurant,
        dietaryType: doc?.dietaryType,
        ownerName: doc?.ownerName,
        ownerEmail: doc?.ownerEmail,
        ownerPhone: doc?.ownerPhone,
        primaryContactNumber: doc?.primaryContactNumber,
        zoneId: doc?.zoneId ? String(doc.zoneId) : "",
        location: doc?.location || {
          addressLine1: doc?.addressLine1,
          addressLine2: doc?.addressLine2,
          area: doc?.area,
          city: doc?.city,
          state: doc?.state,
          pincode: doc?.pincode,
          landmark: doc?.landmark,
        },
      },
      step2: onboarding.step2 || {
        cuisines: doc?.cuisines,
        openingTime,
        closingTime,
        deliveryTimings: { openingTime, closingTime },
        openDays: doc?.openDays,
        menuImageUrls: doc?.menuImages,
        profileImageUrl: doc?.profileImage,
        menuPdfUrl: doc?.menuPdf,
        estimatedDeliveryTime: doc?.estimatedDeliveryTime,
      },
      step3: onboarding.step3 || {
        pan: {
          panNumber: doc?.panNumber,
          nameOnPan: doc?.nameOnPan,
          image: doc?.panImage,
        },
        gst: {
          isRegistered: Boolean(doc?.gstRegistered),
          gstNumber: doc?.gstNumber,
          legalName: doc?.gstLegalName,
          address: doc?.gstAddress,
          image: doc?.gstImage,
        },
        fssai: {
          registrationNumber: doc?.fssaiNumber,
          expiryDate: doc?.fssaiExpiry,
          image: doc?.fssaiImage,
        },
        bank: {
          accountNumber: doc?.accountNumber,
          ifscCode: doc?.ifscCode,
          accountHolderName: doc?.accountHolderName,
          accountType: doc?.accountType,
        },
      },
    },
  };
};

export const getOnboardingProgress = async (restaurantId) => {
  if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
    throw new ValidationError("Invalid restaurant id");
  }
  const doc = await FoodRestaurant.findById(restaurantId).lean();
  if (!doc) throw new ValidationError("Restaurant not found");
  return buildOnboardingPayload(doc);
};

export const ensureDraftRestaurantForPhone = async (phone) => {
  const { digits, last10 } = normalizePhone(phone);
  if (!last10) throw new ValidationError("Phone is invalid");

  const phoneCandidates = [phone, digits, last10].filter(Boolean);
  const existing = await FoodRestaurant.findOne({
    $or: [
      { ownerPhone: { $in: phoneCandidates } },
      { ownerPhoneDigits: digits },
      { ownerPhoneLast10: last10 },
      { primaryContactNumber: { $in: phoneCandidates } },
    ],
  });

  if (existing) return existing;

  return FoodRestaurant.create({
    restaurantName: DRAFT_PLACEHOLDER_NAME,
    ownerName: DRAFT_PLACEHOLDER_NAME,
    ownerPhone: digits,
    ownerPhoneDigits: digits,
    ownerPhoneLast10: last10,
    pureVegRestaurant: false,
    onboardingStatus: "IN_PROGRESS",
    currentStep: 1,
    completedSteps: [],
    status: "pending",
    onboarding: {
      step1: { ownerPhone: digits, primaryContactNumber: digits },
      step2: {},
      step3: {},
    },
  });
};

const uploadStepFiles = async (stepNumber, files = {}) => {
  const uploaded = {};
  if (stepNumber === 2) {
    if (files?.profileImage?.[0]) {
      uploaded.profileImage = await uploadImageBuffer(
        files.profileImage[0].buffer,
        "food/restaurants/profile",
      );
    }
    if (files?.menuImages?.length) {
      uploaded.menuImages = await Promise.all(
        files.menuImages.map((file) =>
          uploadImageBuffer(file.buffer, "food/restaurants/menu"),
        ),
      );
    }
    if (files?.menuPdf?.[0]) {
      uploaded.menuPdf = await uploadFileBuffer(
        files.menuPdf[0].buffer,
        "food/restaurants/menu-pdf",
        {
          fileName: files.menuPdf[0].originalname || "menu.pdf",
          format: "pdf",
        },
      );
    }
  }
  if (stepNumber === 3) {
    if (files?.panImage?.[0]) {
      uploaded.panImage = await uploadImageBuffer(
        files.panImage[0].buffer,
        "food/restaurants/pan",
      );
    }
    if (files?.gstImage?.[0]) {
      uploaded.gstImage = await uploadImageBuffer(
        files.gstImage[0].buffer,
        "food/restaurants/gst",
      );
    }
    if (files?.fssaiImage?.[0]) {
      uploaded.fssaiImage = await uploadImageBuffer(
        files.fssaiImage[0].buffer,
        "food/restaurants/fssai",
      );
    }
  }
  return uploaded;
};

const mergeCompletedSteps = (existing = [], stepNumber) => {
  const next = new Set(
    (Array.isArray(existing) ? existing : []).map((n) => Number(n)),
  );
  next.add(Number(stepNumber));
  return [...next].filter((n) => n >= 1 && n <= 3).sort((a, b) => a - b);
};

export const saveOnboardingStep = async (restaurantId, stepNumber, payload, files) => {
  const step = Number(stepNumber);
  if (![1, 2, 3].includes(step)) {
    throw new ValidationError("Invalid onboarding step");
  }

  const restaurant = await FoodRestaurant.findById(restaurantId);
  if (!restaurant) throw new ValidationError("Restaurant not found");

  const status = resolveOnboardingStatus(restaurant);
  if (status === "SUBMITTED" || status === "UNDER_REVIEW") {
    throw new ValidationError("Onboarding already submitted for review");
  }
  if (status === "APPROVED") {
    throw new ValidationError("Restaurant is already approved");
  }

  const maxAllowedStep = Math.min(3, Math.max(1, Number(restaurant.currentStep) || 1));
  if (step > maxAllowedStep) {
    throw new ValidationError("Complete previous onboarding steps first");
  }

  const uploads = await uploadStepFiles(step, files);
  const onboarding = restaurant.onboarding || {};

  if (step === 1) {
    const latNum = toFiniteNumber(payload.latitude ?? payload.location?.latitude);
    const lngNum = toFiniteNumber(payload.longitude ?? payload.location?.longitude);
    const zoneId =
      payload.zoneId && mongoose.Types.ObjectId.isValid(String(payload.zoneId).trim())
        ? new mongoose.Types.ObjectId(String(payload.zoneId).trim())
        : undefined;

    restaurant.restaurantName =
      String(payload.restaurantName || "").trim() || restaurant.restaurantName;
    restaurant.ownerName =
      String(payload.ownerName || "").trim() || restaurant.ownerName;
    restaurant.ownerEmail = String(payload.ownerEmail || "").trim();
    restaurant.ownerPhone = normalizePhone(payload.ownerPhone || restaurant.ownerPhone).digits;
    restaurant.primaryContactNumber = normalizePhone(
      payload.primaryContactNumber || payload.ownerPhone || restaurant.primaryContactNumber,
    ).digits;

    const dietaryType = String(payload.dietaryType || "").trim();
    if (["veg", "non_veg", "mixed"].includes(dietaryType)) {
      restaurant.dietaryType = dietaryType;
      restaurant.pureVegRestaurant = dietaryType === "veg";
    } else {
      restaurant.pureVegRestaurant =
        payload.pureVegRestaurant === true || payload.pureVegRestaurant === "true";
      if (restaurant.pureVegRestaurant) {
        restaurant.dietaryType = "veg";
      } else if (!restaurant.dietaryType) {
        restaurant.dietaryType = "non_veg";
      }
    }

    restaurant.zoneId = zoneId;
    restaurant.location = {
      type: "Point",
      coordinates: latNum !== null && lngNum !== null ? [lngNum, latNum] : undefined,
      latitude: latNum ?? undefined,
      longitude: lngNum ?? undefined,
      formattedAddress: String(payload.formattedAddress || payload.location?.formattedAddress || "").trim(),
      address: String(payload.formattedAddress || payload.location?.formattedAddress || "").trim(),
      addressLine1: String(payload.addressLine1 || payload.location?.addressLine1 || "").trim(),
      addressLine2: String(payload.addressLine2 || payload.location?.addressLine2 || "").trim(),
      area: String(payload.area || payload.location?.area || "").trim(),
      city: String(payload.city || payload.location?.city || "").trim(),
      state: String(payload.state || payload.location?.state || "").trim(),
      pincode: String(payload.pincode || payload.location?.pincode || "").trim(),
      landmark: String(payload.landmark || payload.location?.landmark || "").trim(),
    };

    onboarding.step1 = {
      restaurantName: restaurant.restaurantName,
      pureVegRestaurant: restaurant.pureVegRestaurant,
      dietaryType: restaurant.dietaryType || null,
      ownerName: restaurant.ownerName,
      ownerEmail: restaurant.ownerEmail,
      ownerPhone: restaurant.ownerPhone,
      primaryContactNumber: restaurant.primaryContactNumber,
      zoneId: zoneId ? String(zoneId) : "",
      location: restaurant.location,
    };
  }

  if (step === 2) {
    const cuisines = parseCsvOrArray(payload.cuisines);
    const openDays = parseCsvOrArray(payload.openDays);
    const openingTime = normalizeRestaurantTime(payload.openingTime);
    const closingTime = normalizeRestaurantTime(payload.closingTime);

    restaurant.cuisines = cuisines;
    restaurant.openDays = openDays;
    restaurant.openingTime = openingTime || undefined;
    restaurant.closingTime = closingTime || undefined;
    restaurant.estimatedDeliveryTime = String(payload.estimatedDeliveryTime || "").trim() || undefined;

    if (uploads.profileImage) restaurant.profileImage = uploads.profileImage;
    if (uploads.menuImages?.length) restaurant.menuImages = uploads.menuImages;
    if (uploads.menuPdf) restaurant.menuPdf = uploads.menuPdf;

    onboarding.step2 = {
      cuisines,
      openingTime,
      closingTime,
      deliveryTimings: { openingTime, closingTime },
      openDays,
      menuImageUrls: restaurant.menuImages,
      profileImageUrl: restaurant.profileImage,
      menuPdfUrl: restaurant.menuPdf,
      estimatedDeliveryTime: restaurant.estimatedDeliveryTime,
    };
  }

  if (step === 3) {
    restaurant.panNumber = String(payload.panNumber || "").trim().toUpperCase();
    restaurant.nameOnPan = String(payload.nameOnPan || "").trim();
    restaurant.gstRegistered = payload.gstRegistered === true || payload.gstRegistered === "true";
    restaurant.gstNumber = restaurant.gstRegistered
      ? String(payload.gstNumber || "").trim().toUpperCase()
      : "";
    restaurant.gstLegalName = restaurant.gstRegistered
      ? String(payload.gstLegalName || "").trim()
      : "";
    restaurant.gstAddress = restaurant.gstRegistered
      ? String(payload.gstAddress || "").trim()
      : "";
    restaurant.fssaiNumber = String(payload.fssaiNumber || "").trim();
    restaurant.fssaiExpiry = payload.fssaiExpiry ? new Date(payload.fssaiExpiry) : undefined;
    restaurant.accountNumber = String(payload.accountNumber || "").trim();
    restaurant.ifscCode = String(payload.ifscCode || "").trim().toUpperCase();
    restaurant.accountHolderName = String(payload.accountHolderName || "").trim();
    restaurant.accountType = String(payload.accountType || "").trim();

    if (uploads.panImage) restaurant.panImage = uploads.panImage;
    if (uploads.gstImage) restaurant.gstImage = uploads.gstImage;
    if (uploads.fssaiImage) restaurant.fssaiImage = uploads.fssaiImage;

    onboarding.step3 = {
      pan: {
        panNumber: restaurant.panNumber,
        nameOnPan: restaurant.nameOnPan,
        image: restaurant.panImage,
      },
      gst: {
        isRegistered: restaurant.gstRegistered,
        gstNumber: restaurant.gstNumber,
        legalName: restaurant.gstLegalName,
        address: restaurant.gstAddress,
        image: restaurant.gstImage,
      },
      fssai: {
        registrationNumber: restaurant.fssaiNumber,
        expiryDate: restaurant.fssaiExpiry,
        image: restaurant.fssaiImage,
      },
      bank: {
        accountNumber: restaurant.accountNumber,
        ifscCode: restaurant.ifscCode,
        accountHolderName: restaurant.accountHolderName,
        accountType: restaurant.accountType,
      },
    };
  }

  restaurant.onboarding = onboarding;
  restaurant.markModified("onboarding");
  restaurant.completedSteps = mergeCompletedSteps(restaurant.completedSteps, step);
  restaurant.currentStep = Math.min(3, step + 1);
  restaurant.onboardingStatus = "IN_PROGRESS";
  if (status === "REJECTED") {
    restaurant.status = "pending";
    restaurant.rejectedAt = undefined;
    restaurant.rejectionReason = undefined;
    restaurant.adminRemarks = undefined;
  }

  await restaurant.save();
  return buildOnboardingPayload(restaurant.toObject());
};

export const submitOnboarding = async (restaurantId, payload, files) => {
  await saveOnboardingStep(restaurantId, 3, payload, files);

  const restaurant = await FoodRestaurant.findById(restaurantId);
  if (!restaurant) throw new ValidationError("Restaurant not found");

  if (!restaurant.menuPdf) {
    throw new ValidationError("Menu PDF is required");
  }
  if (!restaurant.profileImage) {
    throw new ValidationError("Restaurant profile image is required");
  }
  if (!Array.isArray(restaurant.menuImages) || !restaurant.menuImages.length) {
    throw new ValidationError("At least one menu image is required");
  }
  if (!restaurant.panImage || !restaurant.fssaiImage) {
    throw new ValidationError("Compliance documents are required");
  }

  restaurant.onboardingStatus = "SUBMITTED";
  restaurant.currentStep = null;
  restaurant.completedSteps = [1, 2, 3];
  restaurant.submittedAt = new Date();
  restaurant.status = "pending";
  restaurant.pendingUpdateReason = "New Registration";
  restaurant.rejectedAt = undefined;
  restaurant.rejectionReason = undefined;
  restaurant.adminRemarks = undefined;

  await restaurant.save();

  try {
    const { notifyAdminsSafely } = await import(
      "../../../../core/notifications/firebase.service.js"
    );
    void notifyAdminsSafely({
      title: "New Restaurant Registration",
      body: `A new restaurant "${restaurant.restaurantName}" has registered and is pending approval.`,
      data: {
        type: "new_registration",
        subType: "restaurant",
        id: String(restaurant._id),
      },
    });
  } catch (e) {
    console.error("Failed to notify admins of new restaurant registration:", e);
  }

  return buildOnboardingPayload(restaurant.toObject());
};
