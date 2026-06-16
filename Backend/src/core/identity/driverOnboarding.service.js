import { ValidationError, NotFoundError } from '../auth/errors.js';
import { BuddyIdentity } from './buddyIdentity.model.js';
import { FoodDeliveryPartner } from '../../modules/food/delivery/models/deliveryPartner.model.js';
import { Driver } from '../../modules/taxi/driver/models/Driver.js';
import { hashPassword } from '../../modules/taxi/driver/services/authService.js';
import { VEHICLE_TYPES } from '../../modules/taxi/constants/index.js';

const NEXT_STEP = {
  basics: 'kyc',
  kyc: 'bank',
  bank: 'vehicle',
  vehicle: 'selfie',
  selfie: 'capabilities',
  capabilities: 'done',
};

const sanitize = (val) =>
  typeof val === 'string' ? val.trim() : val === undefined ? undefined : val;

const advanceStep = async (identity, currentStep) => {
  identity.onboardingStep = NEXT_STEP[currentStep] || identity.onboardingStep;
  await identity.save();
};

const normalizeVehicleType = (value = '') => {
  const v = String(value || '').trim().toLowerCase();
  if (v.includes('bike') || v.includes('scooter')) return 'bike';
  if (v.includes('auto') || v.includes('rickshaw')) return 'auto';
  if (VEHICLE_TYPES.includes(v)) return v;
  return 'bike';
};

export const updateBasics = async (identity, body) => {
  const { name, email, gender, city, profileImage } = body || {};
  if (!name || String(name).trim().length < 2) {
    throw new ValidationError('Name is required (min 2 characters)');
  }
  identity.name = sanitize(name);
  if (email !== undefined) identity.email = String(email || '').trim().toLowerCase();
  if (gender !== undefined) identity.gender = sanitize(gender);
  if (city !== undefined) identity.city = sanitize(city);
  if (profileImage !== undefined) identity.profileImage = sanitize(profileImage);

  await advanceStep(identity, 'basics');
  return identity;
};

export const updateKyc = async (identity, body) => {
  const { aadhaar, pan, drivingLicense } = body || {};
  identity.kyc = identity.kyc || {};
  if (aadhaar) {
    identity.kyc.aadhaar = {
      number: sanitize(aadhaar.number) || identity.kyc.aadhaar?.number || '',
      documentUrl: sanitize(aadhaar.documentUrl) || identity.kyc.aadhaar?.documentUrl || '',
      backDocumentUrl:
        sanitize(aadhaar.backDocumentUrl) || identity.kyc.aadhaar?.backDocumentUrl || '',
      uploadedAt: new Date(),
    };
  }
  if (pan) {
    identity.kyc.pan = {
      number: sanitize(pan.number) || identity.kyc.pan?.number || '',
      documentUrl: sanitize(pan.documentUrl) || identity.kyc.pan?.documentUrl || '',
      uploadedAt: new Date(),
    };
  }
  if (drivingLicense) {
    identity.kyc.drivingLicense = {
      number: sanitize(drivingLicense.number) || identity.kyc.drivingLicense?.number || '',
      documentUrl:
        sanitize(drivingLicense.documentUrl) || identity.kyc.drivingLicense?.documentUrl || '',
      uploadedAt: new Date(),
    };
  }

  if (
    !identity.kyc.aadhaar?.number ||
    !identity.kyc.drivingLicense?.number
  ) {
    throw new ValidationError('Aadhaar number and Driving License number are required');
  }

  identity.markModified('kyc');
  await advanceStep(identity, 'kyc');
  return identity;
};

export const updateBank = async (identity, body) => {
  const { accountHolderName, accountNumber, ifscCode, bankName, branchName, upiId, upiQrCodeUrl } =
    body || {};

  // Either bank account or UPI must be present.
  const hasBank = accountNumber && ifscCode;
  const hasUpi = !!upiId;
  if (!hasBank && !hasUpi) {
    throw new ValidationError(
      'Provide either bank account details (accountNumber + ifscCode) or a UPI ID',
    );
  }

  identity.bank = {
    accountHolderName: sanitize(accountHolderName) || '',
    accountNumber: sanitize(accountNumber) || '',
    ifscCode: sanitize(ifscCode) ? String(ifscCode).trim().toUpperCase() : '',
    bankName: sanitize(bankName) || '',
    branchName: sanitize(branchName) || '',
    upiId: sanitize(upiId) || '',
    upiQrCodeUrl: sanitize(upiQrCodeUrl) || '',
    updatedAt: new Date(),
  };

  identity.markModified('bank');
  await advanceStep(identity, 'bank');
  return identity;
};

export const updateVehicle = async (identity, body) => {
  const { type, make, model, number, color, photoUrl, rcUrl, insuranceUrl } = body || {};
  if (!type || !number) {
    throw new ValidationError('Vehicle type and number are required');
  }
  identity.vehicle = {
    type: normalizeVehicleType(type),
    make: sanitize(make) || '',
    model: sanitize(model) || '',
    number: String(number || '').trim().toUpperCase(),
    color: sanitize(color) || '',
    photoUrl: sanitize(photoUrl) || '',
    rcUrl: sanitize(rcUrl) || '',
    insuranceUrl: sanitize(insuranceUrl) || '',
  };
  identity.markModified('vehicle');
  await advanceStep(identity, 'vehicle');
  return identity;
};

export const updateSelfie = async (identity, body) => {
  const url = sanitize(body?.selfieUrl);
  if (!url) throw new ValidationError('Selfie URL is required');
  identity.onboardingSelfieUrl = url;
  await advanceStep(identity, 'selfie');
  return identity;
};

/**
 * Marks onboarding complete and creates the requested capability profiles.
 *
 * Both `FoodDeliveryPartner` and `Driver` (TaxiDriver) docs are created with
 * `status: 'pending'` so admin must approve them before the driver can pick
 * up jobs. KYC + bank + vehicle data is copied from the identity so the
 * driver doesn't re-enter anything.
 */
export const completeOnboarding = async (identity, body) => {
  const services = Array.isArray(body?.services) ? body.services : [];
  if (services.length === 0) {
    throw new ValidationError('Select at least one service to drive for');
  }

  if (!identity.name || !identity.kyc?.aadhaar?.number || !identity.vehicle?.number) {
    throw new ValidationError('Complete all onboarding steps before submitting');
  }

  const createdPartner = services.includes('food')
    ? await ensureFoodPartner(identity)
    : null;
  const createdDriver = services.includes('taxi') ? await ensureTaxiDriver(identity) : null;

  identity.onboardingComplete = true;
  identity.onboardingStep = 'done';
  await BuddyIdentity.updateOne(
    { _id: identity._id },
    {
      $set: {
        onboardingComplete: true,
        onboardingStep: 'done',
        'identityRefs.foodPartnerId': createdPartner?._id || identity.identityRefs?.foodPartnerId || null,
        'identityRefs.driverId': createdDriver?._id || identity.identityRefs?.driverId || null,
      },
      $addToSet: { roles: 'DRIVER' },
    },
  );

  return {
    onboardingComplete: true,
    services: services,
    capabilities: {
      food: createdPartner ? createdPartner.status || 'pending' : 'not_enabled',
      taxi: createdDriver ? createdDriver.status || 'pending' : 'not_enabled',
    },
  };
};

const ensureFoodPartner = async (identity) => {
  const existing = await FoodDeliveryPartner.findOne({
    $or: [{ identityId: identity._id }, { phone: identity.phone }],
  });
  if (existing) {
    if (!existing.identityId) {
      existing.identityId = identity._id;
      await existing.save();
    }
    return existing;
  }

  return FoodDeliveryPartner.create({
    identityId: identity._id,
    name: identity.name,
    phone: identity.phone,
    email: identity.email || '',
    countryCode: identity.countryCode || '+91',
    city: identity.city || '',
    vehicleType: identity.vehicle?.type || '',
    vehicleName: identity.vehicle?.make || identity.vehicle?.model || '',
    vehicleNumber: identity.vehicle?.number || '',
    aadharNumber: identity.kyc?.aadhaar?.number || '',
    aadharPhoto: identity.kyc?.aadhaar?.documentUrl || '',
    panNumber: identity.kyc?.pan?.number || '',
    panPhoto: identity.kyc?.pan?.documentUrl || '',
    drivingLicenseNumber: identity.kyc?.drivingLicense?.number || '',
    drivingLicensePhoto: identity.kyc?.drivingLicense?.documentUrl || '',
    profilePhoto: identity.profileImage || '',
    bankAccountHolderName: identity.bank?.accountHolderName || '',
    bankAccountNumber: identity.bank?.accountNumber || '',
    bankIfscCode: identity.bank?.ifscCode || '',
    bankName: identity.bank?.bankName || '',
    upiId: identity.bank?.upiId || '',
    upiQrCode: identity.bank?.upiQrCodeUrl || '',
    status: 'pending',
  });
};

const ensureTaxiDriver = async (identity) => {
  const existing = await Driver.findOne({
    $or: [{ identityId: identity._id }, { phone: identity.phone }],
  });
  if (existing) {
    if (!existing.identityId) {
      existing.identityId = identity._id;
      await existing.save();
    }
    return existing;
  }

  return Driver.create({
    identityId: identity._id,
    name: identity.name,
    phone: identity.phone,
    email: identity.email || '',
    password: await hashPassword(String(identity.phone || '')),
    vehicleType: identity.vehicle?.type || 'bike',
    vehicleNumber: identity.vehicle?.number || '',
    vehicleMake: identity.vehicle?.make || '',
    vehicleModel: identity.vehicle?.model || '',
    vehicleColor: identity.vehicle?.color || '',
    vehicleImage: identity.vehicle?.photoUrl || '',
    profile_picture: identity.profileImage || '',
    profileImage: identity.profileImage || '',
    gender: identity.gender || '',
    city: identity.city || '',
    registerFor: 'taxi',
    approve: false,
    status: 'pending',
    bankDetails: {
      accountHolderName: identity.bank?.accountHolderName || '',
      upiId: identity.bank?.upiId || '',
      qrCodeImage: identity.bank?.upiQrCodeUrl || '',
      accountNumber: identity.bank?.accountNumber || '',
      ifsc: identity.bank?.ifscCode || '',
      branchName: identity.bank?.branchName || '',
      updatedAt: new Date(),
    },
    location: { type: 'Point', coordinates: [0, 0] },
  });
};

/**
 * Lets an already-onboarded driver add a new capability (e.g. they signed up
 * for food only, now want taxi too). No KYC re-entry — the identity already
 * has it.
 */
export const enableCapability = async (identity, service) => {
  if (!identity.onboardingComplete) {
    throw new ValidationError('Complete onboarding before enabling a capability');
  }
  const svc = String(service || '').toLowerCase();
  if (svc !== 'food' && svc !== 'taxi') {
    throw new ValidationError('service must be either "food" or "taxi"');
  }
  if (svc === 'food') {
    const partner = await ensureFoodPartner(identity);
    return { service: 'food', status: partner.status || 'pending' };
  }
  const driver = await ensureTaxiDriver(identity);
  return { service: 'taxi', status: driver.status || 'pending' };
};

export const getOnboardingState = async (identity) => {
  if (!identity) throw new NotFoundError('Identity not found');
  return {
    // Identity essentials — useful for the unified driver profile page that
    // renders this state directly (phone/joined date/active service).
    identityId: String(identity._id),
    phone: identity.phone,
    countryCode: identity.countryCode || '+91',
    activeService: identity.activeService || 'off',
    isVerified: Boolean(identity.isVerified),
    isActive: identity.isActive !== false,
    lastLoginAt: identity.lastLoginAt || null,
    createdAt: identity.createdAt || null,
    updatedAt: identity.updatedAt || null,

    onboardingComplete: identity.onboardingComplete,
    onboardingStep: identity.onboardingStep,
    basics: {
      name: identity.name,
      email: identity.email,
      gender: identity.gender,
      city: identity.city,
      profileImage: identity.profileImage,
    },
    kyc: identity.kyc || {},
    bank: identity.bank || {},
    vehicle: identity.vehicle || {},
    selfieUrl: identity.onboardingSelfieUrl || '',
  };
};
