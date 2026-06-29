export const ONBOARDING_UPLOAD_FOLDER = "driver/onboarding";

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const FIELD_LIMITS = {
  name: 80,
  email: 120,
  city: 60,
  vehicleMake: 60,
  vehicleModel: 60,
  vehicleNumber: 15,
  aadhaar: 12,
  pan: 10,
  dl: 20,
  ifsc: 11,
  accountNumber: 18,
  accountHolderName: 80,
  bankName: 80,
  branchName: 80,
  upiId: 256,
};

export const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const RE_AADHAAR = /^\d{12}$/;
export const RE_PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const RE_DL = /^[A-Z]{2}[ -]?\d{2}[ -]?[A-Z0-9]{1,15}$/i;
export const RE_IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const RE_UPI = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;
export const RE_VEHICLE = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/;
export const RE_URL = /^(https?:\/\/|blob:).+/i;
export const RE_PERSON_NAME = /^[A-Za-z][A-Za-z\s.'-]{1,79}$/;
export const RE_VEHICLE_TEXT = /^[A-Za-z0-9][A-Za-z0-9\s.\-/&'()]{0,59}$/;

const required = (label) => (val) => (val && String(val).trim() ? "" : `${label} is required`);
const minLen = (label, n) => (val) =>
  String(val || "").trim().length >= n ? "" : `${label} must be at least ${n} characters`;
const maxLen = (label, n) => (val) =>
  String(val || "").length <= n ? "" : `${label} is too long (max ${n})`;
const matches = (re, msg) => (val) => (!val || re.test(String(val || "").trim()) ? "" : msg);
const optionalMatches = (re, msg) => (val) =>
  !val || !String(val).trim() ? "" : re.test(String(val).trim()) ? "" : msg;

export const compose = (...rules) => (val, ctx) => {
  for (const rule of rules) {
    const out = rule(val, ctx);
    if (out) return out;
  }
  return "";
};

export const buildValidators = () => ({
  basics: {
    "basics.name": compose(
      required("Full name"),
      minLen("Full name", 2),
      maxLen("Full name", FIELD_LIMITS.name),
      matches(RE_PERSON_NAME, "Use letters only (as on your ID)"),
    ),
    "basics.email": compose(
      optionalMatches(RE_EMAIL, "Enter a valid email address"),
      maxLen("Email", FIELD_LIMITS.email),
    ),
    "basics.city": compose(maxLen("City", FIELD_LIMITS.city)),
    "basics.gender": (val) => {
      if (!val || !String(val).trim()) return "";
      return ["male", "female", "other"].includes(String(val)) ? "" : "Select a valid gender option";
    },
  },
  kyc: {
    "kyc.aadhaar.number": compose(
      required("Aadhaar number"),
      matches(RE_AADHAAR, "Aadhaar must be a 12-digit number"),
    ),
    "kyc.aadhaar.documentUrl": compose(
      required("Aadhaar front photo"),
      matches(RE_URL, "Please upload your Aadhaar front photo"),
    ),
    "kyc.aadhaar.backDocumentUrl": optionalMatches(RE_URL, "Please upload a valid Aadhaar back photo"),
    "kyc.pan.number": compose(
      optionalMatches(RE_PAN, "PAN must look like ABCDE1234F"),
      maxLen("PAN number", FIELD_LIMITS.pan),
    ),
    "kyc.pan.documentUrl": (val, ctx) => {
      const panNum = String(ctx?.pan?.number || "").trim();
      if (!panNum) return optionalMatches(RE_URL, "Please upload your PAN photo")(val);
      return compose(required("PAN photo"), matches(RE_URL, "Please upload your PAN photo"))(val);
    },
    "kyc.drivingLicense.number": compose(
      required("Driving licence number"),
      maxLen("Driving licence number", FIELD_LIMITS.dl),
      matches(RE_DL, "Enter a valid driving licence number"),
    ),
    "kyc.drivingLicense.documentUrl": compose(
      required("Driving licence photo"),
      matches(RE_URL, "Please upload your driving licence photo"),
    ),
  },
  bank: {
    "bank.mode": (_v, ctx) => {
      if (ctx?.bankMode === "upi") {
        return String(ctx?.upiId || "").trim() ? "" : "Enter your UPI ID";
      }
      const hasAccount = String(ctx?.accountNumber || "").trim();
      const hasIfsc = String(ctx?.ifscCode || "").trim();
      if (hasAccount && hasIfsc) return "";
      return "Account number and IFSC are required";
    },
    "bank.accountHolderName": (val, ctx) =>
      ctx?.bankMode === "bank"
        ? compose(
            required("Account holder name"),
            minLen("Account holder name", 2),
            maxLen("Account holder name", FIELD_LIMITS.accountHolderName),
            matches(RE_PERSON_NAME, "Use letters only (as per bank records)"),
          )(val)
        : "",
    "bank.accountNumber": (val, ctx) =>
      ctx?.bankMode === "bank"
        ? compose(
            required("Account number"),
            matches(/^\d{9,18}$/, "Account number must be 9–18 digits"),
            maxLen("Account number", FIELD_LIMITS.accountNumber),
          )(val)
        : "",
    "bank.ifscCode": (val, ctx) =>
      ctx?.bankMode === "bank"
        ? compose(
            required("IFSC"),
            matches(RE_IFSC, "IFSC should look like HDFC0001234"),
            maxLen("IFSC", FIELD_LIMITS.ifsc),
          )(val)
        : "",
    "bank.bankName": compose(maxLen("Bank name", FIELD_LIMITS.bankName)),
    "bank.branchName": compose(maxLen("Branch name", FIELD_LIMITS.branchName)),
    "bank.upiId": (val, ctx) =>
      ctx?.bankMode === "upi"
        ? compose(
            required("UPI ID"),
            matches(RE_UPI, "UPI must look like name@bank"),
            maxLen("UPI ID", FIELD_LIMITS.upiId),
          )(val)
        : val
          ? compose(matches(RE_UPI, "UPI must look like name@bank"), maxLen("UPI ID", FIELD_LIMITS.upiId))(val)
          : "",
  },
  vehicle_food: {
    "foodVehicle.type": required("Vehicle type"),
    "foodVehicle.number": compose(
      required("Vehicle number"),
      maxLen("Vehicle number", FIELD_LIMITS.vehicleNumber),
      matches(RE_VEHICLE, "Vehicle number must look like MH12AB1234"),
    ),
    "foodVehicle.make": compose(
      required("Vehicle make"),
      minLen("Vehicle make", 2),
      maxLen("Vehicle make", FIELD_LIMITS.vehicleMake),
      matches(RE_VEHICLE_TEXT, "Use letters and numbers only"),
    ),
    "foodVehicle.model": compose(
      required("Vehicle model"),
      minLen("Vehicle model", 2),
      maxLen("Vehicle model", FIELD_LIMITS.vehicleModel),
      matches(RE_VEHICLE_TEXT, "Use letters and numbers only"),
    ),
  },
  vehicle_taxi: {
    "taxiVehicle.type": required("Vehicle type"),
    "taxiVehicle.number": compose(
      required("Vehicle number"),
      maxLen("Vehicle number", FIELD_LIMITS.vehicleNumber),
      matches(RE_VEHICLE, "Vehicle number must look like MH12AB1234"),
    ),
    "taxiVehicle.make": compose(
      required("Vehicle make"),
      minLen("Vehicle make", 2),
      maxLen("Vehicle make", FIELD_LIMITS.vehicleMake),
      matches(RE_VEHICLE_TEXT, "Use letters and numbers only"),
    ),
    "taxiVehicle.model": compose(
      required("Vehicle model"),
      minLen("Vehicle model", 2),
      maxLen("Vehicle model", FIELD_LIMITS.vehicleModel),
      matches(RE_VEHICLE_TEXT, "Use letters and numbers only"),
    ),
  },
  selfie: {
    "selfie.selfieUrl": compose(required("Selfie"), matches(RE_URL, "Please take or upload a selfie")),
  },
  services: {
    onboardingServices: (val) =>
      Array.isArray(val) && val.length > 0 ? "" : "Select at least one service",
  },
});

export function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export function validateOnboardingStep(state, stepKey, { bankMode = "bank" } = {}) {
  const rules = buildValidators()[stepKey] || {};
  const baseCtx = state[stepKey];
  const ctx = stepKey === "bank" ? { ...baseCtx, bankMode } : baseCtx;
  const out = {};
  for (const [path, rule] of Object.entries(rules)) {
    const value = getByPath(state, path);
    const err = rule(value, ctx);
    if (err) out[path] = err;
  }
  return out;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error("invalid dimensions"));
        return;
      }
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

export async function validateOnboardingImageFile(file) {
  if (!file) {
    return { ok: false, message: "No file selected" };
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return { ok: false, message: "File is empty or invalid" };
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return { ok: false, message: "Image must be 5 MB or smaller" };
  }

  const mime = String(file.type || "").toLowerCase();
  if (!mime.startsWith("image/")) {
    return { ok: false, message: "Please select an image file (JPEG, PNG, or WebP)" };
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mime) && mime !== "image/gif") {
    return { ok: false, message: "Unsupported image type. Use JPEG, PNG, or WebP" };
  }

  try {
    await loadImageFromFile(file);
    return { ok: true };
  } catch {
    return { ok: false, message: "Image appears corrupted or unreadable. Try another photo." };
  }
}

export const STEP_MEDIA_PATHS = {
  kyc: [
    "kyc.aadhaar.documentUrl",
    "kyc.aadhaar.backDocumentUrl",
    "kyc.pan.documentUrl",
    "kyc.drivingLicense.documentUrl",
  ],
  selfie: ["selfie.selfieUrl"],
};

export function setByPath(obj, path, value) {
  const keys = path.split(".");
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  let cursor = clone;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const existing = cursor[key];
    cursor[key] = Array.isArray(existing) ? [...existing] : { ...(existing || {}) };
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
  return clone;
}

export async function prepareOnboardingStepState(state, stepKey, pendingUploads, uploadMedia) {
  const mediaPaths = STEP_MEDIA_PATHS[stepKey] || [];
  let next = state;

  for (const path of mediaPaths) {
    const value = getByPath(next, path);
    if (!value || !String(value).startsWith("blob:")) continue;
    const file = pendingUploads[path];
    if (!file) {
      throw new Error("Please re-select your photos before continuing.");
    }
    const url = await uploadOnboardingImage(file, uploadMedia);
    next = setByPath(next, path, url);
  }

  const pendingPaths = Object.keys(pendingUploads).filter((path) => path.startsWith(`${stepKey}.`));
  for (const path of pendingPaths) {
    const currentValue = String(getByPath(next, path) || "");
    if (currentValue.startsWith("https://") || currentValue.startsWith("http://")) continue;
    const file = pendingUploads[path];
    if (!file) continue;
    const url = await uploadOnboardingImage(file, uploadMedia);
    next = setByPath(next, path, url);
  }

  for (const path of mediaPaths) {
    const value = String(getByPath(next, path) || "");
    if (value.startsWith("blob:")) {
      throw new Error("Upload your documents before continuing.");
    }
  }

  return next;
}

export async function uploadOnboardingImage(file, uploadMedia) {
  const check = await validateOnboardingImageFile(file);
  if (!check.ok) {
    throw new Error(check.message);
  }

  const response = await uploadMedia(file, { folder: ONBOARDING_UPLOAD_FOLDER });
  const url = response?.data?.data?.url || response?.data?.url || "";
  if (!url) {
    throw new Error("Upload failed. Please try again.");
  }
  return url;
}
