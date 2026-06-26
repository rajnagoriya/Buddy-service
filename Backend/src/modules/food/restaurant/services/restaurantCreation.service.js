import mongoose from "mongoose";
import { FoodRestaurant } from "../models/restaurant.model.js";
import { ValidationError, ConflictError } from "../../../../core/auth/errors.js";

export const DRAFT_PLACEHOLDER_NAME = "__DRAFT__";

export const CREATION_SOURCE = {
  ONBOARDING_DRAFT: "onboarding_draft",
  LEGACY_REGISTER: "legacy_register",
  ADMIN: "admin",
};

export const normalizeRestaurantPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "").slice(-15);
  return {
    digits: digits || "",
    last10: digits ? digits.slice(-10) : "",
  };
};

export const normalizeRestaurantEmail = (value) => {
  const email = String(value || "").trim().toLowerCase();
  return email || "";
};

export const isDraftRestaurant = (doc) => {
  const name = String(doc?.restaurantName || "").trim().toLowerCase();
  return (
    name === "pending registration" ||
    name === "draft" ||
    name === DRAFT_PLACEHOLDER_NAME.toLowerCase()
  );
};

const buildPhoneQuery = (phone) => {
  const { digits, last10 } = normalizeRestaurantPhone(phone);
  if (!last10) return null;

  const phoneCandidates = [phone, digits, last10].filter(Boolean);
  return {
    $or: [
      { ownerPhoneLast10: last10 },
      { ownerPhoneDigits: digits },
      { ownerPhone: { $in: phoneCandidates } },
      { primaryContactNumber: { $in: phoneCandidates } },
    ],
  };
};

export const findRestaurantByPhone = async (phone, { excludeId } = {}) => {
  const query = buildPhoneQuery(phone);
  if (!query) return null;

  const filter = excludeId && mongoose.Types.ObjectId.isValid(String(excludeId))
    ? { ...query, _id: { $ne: new mongoose.Types.ObjectId(String(excludeId)) } }
    : query;

  return FoodRestaurant.findOne(filter).lean();
};

export const findRestaurantByEmail = async (email, { excludeId } = {}) => {
  const normalized = normalizeRestaurantEmail(email);
  if (!normalized) return null;

  const filter = { ownerEmail: normalized };
  if (excludeId && mongoose.Types.ObjectId.isValid(String(excludeId))) {
    filter._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };
  }

  return FoodRestaurant.findOne(filter).lean();
};

export const checkRestaurantPhoneAvailability = async (phone, { excludeId } = {}) => {
  const { last10 } = normalizeRestaurantPhone(phone);
  if (!last10) {
    throw new ValidationError("Phone is invalid");
  }

  const existing = await findRestaurantByPhone(phone, { excludeId });
  return {
    available: !existing,
    message: existing ? "Phone number already registered" : undefined,
  };
};

export const checkRestaurantEmailAvailability = async (email, { excludeId } = {}) => {
  const normalized = normalizeRestaurantEmail(email);
  if (!normalized) {
    throw new ValidationError("Email is invalid");
  }

  const existing = await findRestaurantByEmail(normalized, { excludeId });
  return {
    available: !existing,
    message: existing ? "Email already registered" : undefined,
  };
};

export const assertPhoneAvailable = async (phone, { excludeId } = {}) => {
  const existing = await findRestaurantByPhone(phone, { excludeId });
  if (existing) {
    throw new ConflictError("Restaurant already exists with this phone number");
  }
};

export const assertEmailAvailable = async (email, { excludeId } = {}) => {
  const normalized = normalizeRestaurantEmail(email);
  if (!normalized) return;

  const existing = await findRestaurantByEmail(normalized, { excludeId });
  if (existing) {
    throw new ConflictError("Restaurant already exists with this email");
  }
};

export const mapDuplicateKeyError = (err) => {
  if (!err || err.code !== 11000) return null;

  const keyPattern = err.keyPattern || {};
  if (keyPattern.ownerPhoneLast10 || keyPattern.ownerPhone) {
    return new ConflictError("Restaurant already exists with this phone number");
  }
  if (keyPattern.ownerEmail) {
    return new ConflictError("Restaurant already exists with this email");
  }
  if (keyPattern.restaurantNameNormalized && keyPattern.ownerPhoneLast10) {
    return new ConflictError("Restaurant with this name and owner phone already exists");
  }
  return new ConflictError("A restaurant with this value already exists");
};

const applyPhoneFields = (doc, phone) => {
  const { digits, last10 } = normalizeRestaurantPhone(phone);
  if (!last10) {
    throw new ValidationError("Owner phone is invalid");
  }
  doc.ownerPhone = digits;
  doc.ownerPhoneDigits = digits;
  doc.ownerPhoneLast10 = last10;
  if (!doc.primaryContactNumber) {
    doc.primaryContactNumber = digits;
  }
  return doc;
};

/**
 * Single entry point for all restaurant document creation.
 */
export const createRestaurant = async (input = {}, { source = CREATION_SOURCE.ADMIN, excludeId } = {}) => {
  const doc = { ...input };

  const phone = doc.ownerPhone || doc.primaryContactNumber;
  if (!phone) {
    throw new ValidationError("Owner phone is required");
  }

  applyPhoneFields(doc, phone);

  if (doc.ownerEmail) {
    doc.ownerEmail = normalizeRestaurantEmail(doc.ownerEmail) || undefined;
  }

  if (source === CREATION_SOURCE.ONBOARDING_DRAFT) {
    const existing = await findRestaurantByPhone(phone, { excludeId });
    if (existing) return existing;
  } else if (source === CREATION_SOURCE.LEGACY_REGISTER) {
    const existing = await findRestaurantByPhone(phone, { excludeId });
    if (existing) {
      if (existing.status === "rejected") {
        await FoodRestaurant.deleteOne({ _id: existing._id });
      } else {
        throw new ConflictError("Restaurant already exists with this phone number");
      }
    }
    await assertEmailAvailable(doc.ownerEmail, { excludeId });
  } else {
    await assertPhoneAvailable(phone, { excludeId });
    await assertEmailAvailable(doc.ownerEmail, { excludeId });
  }

  if (source === CREATION_SOURCE.ONBOARDING_DRAFT) {
    doc.restaurantName = doc.restaurantName || DRAFT_PLACEHOLDER_NAME;
    doc.ownerName = doc.ownerName || DRAFT_PLACEHOLDER_NAME;
    doc.pureVegRestaurant = doc.pureVegRestaurant ?? false;
    doc.onboardingStatus = doc.onboardingStatus || "IN_PROGRESS";
    doc.currentStep = doc.currentStep ?? 1;
    doc.completedSteps = doc.completedSteps || [];
    doc.status = doc.status || "pending";
  }

  if (source === CREATION_SOURCE.LEGACY_REGISTER) {
    doc.status = doc.status || "pending";
    doc.onboardingStatus = doc.onboardingStatus || "SUBMITTED";
    doc.pendingUpdateReason = doc.pendingUpdateReason || "New Registration";
    doc.submittedAt = doc.submittedAt || new Date();
    doc.completedSteps = doc.completedSteps || [1, 2, 3];
    doc.currentStep = doc.currentStep ?? null;
  }

  if (source === CREATION_SOURCE.ADMIN) {
    doc.status = doc.status || "approved";
    doc.onboardingStatus = doc.onboardingStatus || "APPROVED";
    doc.approvedAt = doc.approvedAt || new Date();
  }

  try {
    const restaurant = await FoodRestaurant.create(doc);
    return restaurant;
  } catch (err) {
    const mapped = mapDuplicateKeyError(err);
    if (mapped) throw mapped;
    throw err;
  }
};

export const ensureDraftRestaurantForPhone = async (phone) => {
  const { digits, last10 } = normalizeRestaurantPhone(phone);
  if (!last10) throw new ValidationError("Phone is invalid");

  return createRestaurant(
    {
      restaurantName: DRAFT_PLACEHOLDER_NAME,
      ownerName: DRAFT_PLACEHOLDER_NAME,
      ownerPhone: digits,
      primaryContactNumber: digits,
      pureVegRestaurant: false,
      onboardingStatus: "IN_PROGRESS",
      currentStep: 1,
      completedSteps: [],
      status: "pending",
      onboarding: {
        step1: {
          ownerPhone: digits,
          primaryContactNumber: digits,
        },
        step2: {},
        step3: {},
      },
    },
    { source: CREATION_SOURCE.ONBOARDING_DRAFT },
  );
};

export const assertOnboardingContactUniqueness = async (restaurantId, { ownerPhone, ownerEmail }) => {
  if (ownerPhone) {
    await assertPhoneAvailable(ownerPhone, { excludeId: restaurantId });
  }
  if (ownerEmail) {
    await assertEmailAvailable(ownerEmail, { excludeId: restaurantId });
  }
};
