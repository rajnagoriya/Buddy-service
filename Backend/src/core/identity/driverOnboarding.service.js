import mongoose from 'mongoose';
import { ValidationError, NotFoundError, ConflictError } from '../auth/errors.js';
import { BuddyIdentity } from './buddyIdentity.model.js';
import { FoodDeliveryPartner } from '../../modules/food/delivery/models/deliveryPartner.model.js';
import { Driver } from '../../modules/taxi/driver/models/Driver.js';
import { hashPassword } from '../../modules/taxi/driver/services/authService.js';
import { VEHICLE_TYPES } from '../../modules/taxi/constants/index.js';

const FOOD_VEHICLE_TYPES = ['bike', 'scooter'];

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_AADHAAR = /^\d{12}$/;
const RE_PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const RE_DL = /^[A-Z]{2}[ -]?\d{2}[ -]?[A-Z0-9]{1,15}$/i;
const RE_IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const RE_UPI = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;
const RE_VEHICLE = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/;
const RE_HTTP_URL = /^https?:\/\/.+/i;
const RE_PERSON_NAME = /^[A-Za-z][A-Za-z\s.'-]{1,79}$/;

const assertString = (value, label, { min = 0, max = 500, pattern, patternMessage } = {}) => {
  const text = sanitize(value);
  if (!text || text.length < min) {
    throw new ValidationError(`${label} is required${min > 1 ? ` (min ${min} characters)` : ''}`);
  }
  if (text.length > max) {
    throw new ValidationError(`${label} is too long (max ${max})`);
  }
  if (pattern && !pattern.test(text)) {
    throw new ValidationError(patternMessage || `Invalid ${label}`);
  }
  return text;
};

const assertOptionalString = (value, label, { max = 500, pattern, patternMessage } = {}) => {
  const text = sanitize(value);
  if (!text) return '';
  if (text.length > max) {
    throw new ValidationError(`${label} is too long (max ${max})`);
  }
  if (pattern && !pattern.test(text)) {
    throw new ValidationError(patternMessage || `Invalid ${label}`);
  }
  return text;
};

const assertHttpUrl = (value, label) => {
  const text = sanitize(value);
  if (!text || !RE_HTTP_URL.test(text)) {
    throw new ValidationError(`${label} is required`);
  }
  return text;
};

const assertOptionalHttpUrl = (value, label) => {
  const text = sanitize(value);
  if (!text) return '';
  if (!RE_HTTP_URL.test(text)) {
    throw new ValidationError(`Invalid ${label}`);
  }
  return text;
};

const getSelectedServices = (identity) => {
  const services = Array.isArray(identity?.onboardingServices) ? identity.onboardingServices : [];
  return services.filter((svc) => svc === 'food' || svc === 'taxi');
};

const getNextStep = (identity, currentStep) => {
  const services = getSelectedServices(identity);
  const hasFood = services.includes('food');
  const hasTaxi = services.includes('taxi');

  switch (String(currentStep || '').toLowerCase()) {
    case 'services':
      if (hasFood) return 'vehicle_food';
      if (hasTaxi) return 'vehicle_taxi';
      return 'basics';
    case 'vehicle_food':
      if (hasTaxi) return 'vehicle_taxi';
      return 'basics';
    case 'vehicle_taxi':
      return 'basics';
    case 'basics':
      return 'kyc';
    case 'kyc':
      return 'bank';
    case 'bank':
      return 'selfie';
    case 'selfie':
      return 'done';
  // Legacy flow support
    case 'vehicle':
      return 'selfie';
    case 'capabilities':
    case 'services':
      return 'done';
    default:
      return identity.onboardingStep || 'services';
  }
};

/** Map stored step names to the wizard step the client understands. */
export const normalizeOnboardingStepForClient = (step, identity = null) => {
  const normalized = String(step || 'services').toLowerCase();
  if (normalized === 'capabilities') return 'services';
  if (normalized === 'services') {
    // Legacy: final service picker before submit (profile already filled).
    if (identity?.name && identity?.kyc?.aadhaar?.number) {
      return 'selfie';
    }
    return 'services';
  }
  if (normalized === 'vehicle') {
    if (identity?.vehicle?.number && !identity?.foodVehicle?.number && !identity?.taxiVehicle?.number) {
      return 'selfie';
    }
    const services = getSelectedServices(identity);
    const effective = services.length ? services : ['food'];
    if (effective.includes('food') && !identity?.foodVehicle?.number) return 'vehicle_food';
    if (effective.includes('taxi') && !identity?.taxiVehicle?.number) return 'vehicle_taxi';
    return 'basics';
  }
  if (normalized === 'done') return 'done';
  if (
    !getSelectedServices(identity).length &&
    !['services', 'vehicle_food', 'vehicle_taxi'].includes(normalized)
  ) {
    return 'services';
  }
  return normalized;
};

const sanitize = (val) =>
  typeof val === 'string' ? val.trim() : val === undefined ? undefined : val;

const advanceStep = async (identity, currentStep) => {
  identity.onboardingStep = getNextStep(identity, currentStep);
  await identity.save();
};

const normalizeVehicleType = (value = '') => {
  const v = String(value || '').trim().toLowerCase();
  if (v.includes('bike') || v.includes('scooter')) return 'bike';
  if (v.includes('auto') || v.includes('rickshaw')) return 'auto';
  if (VEHICLE_TYPES.includes(v)) return v;
  return 'bike';
};

const normalizeVehicleNumber = (value = '') => String(value || '').trim().toUpperCase();

const excludeExistingDoc = (existingDoc) =>
  existingDoc?._id ? { _id: { $ne: existingDoc._id } } : {};

const assertUniqueVehicleNumber = async (identity, vehicleNumber) => {
  const normalized = normalizeVehicleNumber(vehicleNumber);
  if (!normalized) return;

  const existingPartner = await FoodDeliveryPartner.findOne({
    $or: [{ identityId: identity._id }, { phone: identity.phone }],
  })
    .select('_id phone')
    .lean();

  const partnerConflict = await FoodDeliveryPartner.findOne({
    vehicleNumber: normalized,
    ...excludeExistingDoc(existingPartner),
  })
    .select('phone name')
    .lean();

  if (partnerConflict) {
    throw new ConflictError(
      `Vehicle number ${normalized} is already registered with another delivery partner`,
    );
  }

  const existingDriver = await Driver.findOne({
    $or: [{ identityId: identity._id }, { phone: identity.phone }],
  })
    .select('_id phone')
    .lean();

  const driverConflict = await Driver.findOne({
    vehicleNumber: normalized,
    ...excludeExistingDoc(existingDriver),
  })
    .select('phone name')
    .lean();

  if (driverConflict && String(driverConflict.phone) !== String(identity.phone)) {
    throw new ConflictError(
      `Vehicle number ${normalized} is already registered with another driver`,
    );
  }
};

const assertUniquePhoneForProfiles = async (identity, { food = false, taxi = false } = {}) => {
  const phone = String(identity.phone || '').trim();
  if (!phone) return;

  if (food) {
    const partnerConflict = await FoodDeliveryPartner.findOne({
      phone,
      identityId: { $ne: identity._id },
    })
      .select('_id')
      .lean();
    if (partnerConflict) {
      throw new ConflictError('This phone number is already registered as a delivery partner');
    }
  }

  if (taxi) {
    const driverConflict = await Driver.findOne({
      phone,
      identityId: { $ne: identity._id },
    })
      .select('_id')
      .lean();
    if (driverConflict) {
      throw new ConflictError('This phone number is already registered as a taxi driver');
    }
  }
};

const normalizeFoodVehicleType = (value = '') => {
  const v = String(value || '').trim().toLowerCase();
  if (v.includes('scooter')) return 'scooter';
  return 'bike';
};

const assertCreatableProfiles = async (identity, services = []) => {
  const normalizedServices = Array.isArray(services) ? services : [];
  if (normalizedServices.includes('food')) {
    await assertUniquePhoneForProfiles(identity, { food: true });
    const foodNumber = identity.foodVehicle?.number || identity.vehicle?.number;
    await assertUniqueVehicleNumber(identity, foodNumber);
  }
  if (normalizedServices.includes('taxi')) {
    await assertUniquePhoneForProfiles(identity, { taxi: true });
    const taxiNumber = identity.taxiVehicle?.number || identity.vehicle?.number;
    if (taxiNumber) {
      await assertUniqueVehicleNumber(identity, taxiNumber);
    }
  }
};

export const updateServices = async (identity, body) => {
  const services = Array.isArray(body?.services)
    ? body.services.filter((svc) => svc === 'food' || svc === 'taxi')
    : [];
  if (services.length === 0) {
    throw new ValidationError('Select at least one service to drive for');
  }
  identity.onboardingServices = services;
  identity.markModified('onboardingServices');
  await advanceStep(identity, 'services');
  return identity;
};

export const updateFoodVehicle = async (identity, body) => {
  const { type, number, make, model, color, photoUrl, rcUrl, insuranceUrl } = body || {};
  const vehicleType = normalizeFoodVehicleType(type);
  if (!FOOD_VEHICLE_TYPES.includes(vehicleType)) {
    throw new ValidationError('Select a valid food delivery vehicle type');
  }
  const vehicleNumber = assertString(number, 'Vehicle number', {
    max: 15,
    pattern: RE_VEHICLE,
    patternMessage: 'Vehicle number must look like MH12AB1234',
  });
  const vehicleMake = assertString(make, 'Vehicle make', { min: 2, max: 60, pattern: /^[A-Za-z0-9][A-Za-z0-9\s.\-/&'()]{0,59}$/ });
  const vehicleModel = assertString(model, 'Vehicle model', { min: 2, max: 60, pattern: /^[A-Za-z0-9][A-Za-z0-9\s.\-/&'()]{0,59}$/ });

  identity.foodVehicle = {
    type: vehicleType,
    make: vehicleMake,
    model: vehicleModel,
    number: normalizeVehicleNumber(vehicleNumber),
    color: assertOptionalString(color, 'Vehicle color', { max: 30 }) || '',
    photoUrl: assertOptionalHttpUrl(photoUrl, 'Vehicle photo') || '',
    rcUrl: assertOptionalHttpUrl(rcUrl, 'RC document') || '',
    insuranceUrl: assertOptionalHttpUrl(insuranceUrl, 'Insurance document') || '',
  };
  await assertUniqueVehicleNumber(identity, identity.foodVehicle.number);
  identity.markModified('foodVehicle');
  await advanceStep(identity, 'vehicle_food');
  return identity;
};

export const updateTaxiVehicle = async (identity, body) => {
  const { type, number, vehicleTypeId, name, make, model, color, photoUrl, rcUrl, insuranceUrl } = body || {};
  const vehicleType = normalizeVehicleType(type);
  if (!vehicleType) {
    throw new ValidationError('Vehicle type is required');
  }
  const vehicleNumber = assertString(number, 'Vehicle number', {
    max: 15,
    pattern: RE_VEHICLE,
    patternMessage: 'Vehicle number must look like MH12AB1234',
  });
  const vehicleMake = assertString(make || name, 'Vehicle make', { min: 2, max: 60 });
  const vehicleModel = assertString(model, 'Vehicle model', { min: 2, max: 60 });
  const catalogTypeId = sanitize(vehicleTypeId) || '';

  identity.taxiVehicle = {
    type: vehicleType,
    make: vehicleMake,
    model: vehicleModel,
    vehicleTypeId: catalogTypeId,
    number: normalizeVehicleNumber(vehicleNumber),
    color: assertOptionalString(color, 'Vehicle color', { max: 30 }) || '',
    photoUrl: assertOptionalHttpUrl(photoUrl, 'Vehicle photo') || '',
    rcUrl: assertOptionalHttpUrl(rcUrl, 'RC document') || '',
    insuranceUrl: assertOptionalHttpUrl(insuranceUrl, 'Insurance document') || '',
  };
  await assertUniqueVehicleNumber(identity, identity.taxiVehicle.number);
  identity.markModified('taxiVehicle');
  await advanceStep(identity, 'vehicle_taxi');
  return identity;
};

export const updateBasics = async (identity, body) => {
  const { name, email, gender, city, profileImage } = body || {};
  identity.name = assertString(name, 'Name', { min: 2, max: 80, pattern: RE_PERSON_NAME });
  if (email !== undefined) {
    const normalizedEmail = assertOptionalString(email, 'Email', {
      max: 120,
      pattern: RE_EMAIL,
      patternMessage: 'Enter a valid email address',
    });
    identity.email = normalizedEmail ? normalizedEmail.toLowerCase() : '';
  }
  if (gender !== undefined) {
    const normalizedGender = sanitize(gender);
    if (normalizedGender && !['male', 'female', 'other'].includes(normalizedGender)) {
      throw new ValidationError('Select a valid gender option');
    }
    identity.gender = normalizedGender || '';
  }
  if (city !== undefined) {
    identity.city = assertOptionalString(city, 'City', { max: 60 }) || '';
  }
  if (profileImage !== undefined) {
    identity.profileImage = assertOptionalHttpUrl(profileImage, 'Profile image') || '';
  }

  await advanceStep(identity, 'basics');
  return identity;
};

export const updateKyc = async (identity, body) => {
  const { aadhaar, pan, drivingLicense } = body || {};
  identity.kyc = identity.kyc || {};
  if (aadhaar) {
    const aadhaarNumber = assertString(aadhaar.number, 'Aadhaar number', {
      pattern: RE_AADHAAR,
      patternMessage: 'Aadhaar must be a 12-digit number',
    });
    const aadhaarFront = assertHttpUrl(
      aadhaar.documentUrl || identity.kyc.aadhaar?.documentUrl,
      'Aadhaar front photo',
    );
    identity.kyc.aadhaar = {
      number: aadhaarNumber,
      documentUrl: aadhaarFront,
      backDocumentUrl:
        assertOptionalHttpUrl(
          aadhaar.backDocumentUrl || identity.kyc.aadhaar?.backDocumentUrl,
          'Aadhaar back photo',
        ) || '',
      uploadedAt: new Date(),
    };
  }
  if (pan) {
    const panNumber = assertOptionalString(pan.number, 'PAN number', {
      max: 10,
      pattern: RE_PAN,
      patternMessage: 'PAN must look like ABCDE1234F',
    });
    if (panNumber) {
      identity.kyc.pan = {
        number: panNumber,
        documentUrl:
          assertHttpUrl(pan.documentUrl || identity.kyc.pan?.documentUrl, 'PAN photo'),
        uploadedAt: new Date(),
      };
    } else {
      identity.kyc.pan = {
        number: '',
        documentUrl: '',
        uploadedAt: new Date(),
      };
    }
  }
  if (drivingLicense) {
    const dlNumber = assertString(drivingLicense.number, 'Driving licence number', {
      max: 20,
      pattern: RE_DL,
      patternMessage: 'Enter a valid driving licence number',
    });
    identity.kyc.drivingLicense = {
      number: dlNumber.toUpperCase(),
      documentUrl: assertHttpUrl(
        drivingLicense.documentUrl || identity.kyc.drivingLicense?.documentUrl,
        'Driving licence photo',
      ),
      uploadedAt: new Date(),
    };
  }

  if (
    !identity.kyc.aadhaar?.number ||
    !identity.kyc.aadhaar?.documentUrl ||
    !identity.kyc.drivingLicense?.number ||
    !identity.kyc.drivingLicense?.documentUrl
  ) {
    throw new ValidationError('Aadhaar and Driving License details with photos are required');
  }

  identity.markModified('kyc');
  await advanceStep(identity, 'kyc');
  return identity;
};

export const updateBank = async (identity, body) => {
  const { accountHolderName, accountNumber, ifscCode, bankName, branchName, upiId, upiQrCodeUrl } =
    body || {};

  const normalizedUpi = assertOptionalString(upiId, 'UPI ID', {
    max: 256,
    pattern: RE_UPI,
    patternMessage: 'UPI must look like name@bank',
  });
  const normalizedAccount = sanitize(accountNumber)?.replace(/\D/g, '') || '';
  const normalizedIfsc = sanitize(ifscCode) ? String(ifscCode).trim().toUpperCase() : '';

  const hasBank = normalizedAccount && normalizedIfsc;
  const hasUpi = !!normalizedUpi;

  if (!hasBank && !hasUpi) {
    throw new ValidationError(
      'Provide either bank account details (accountNumber + ifscCode) or a UPI ID',
    );
  }

  if (hasBank) {
    if (!/^\d{9,18}$/.test(normalizedAccount)) {
      throw new ValidationError('Account number must be 9–18 digits');
    }
    if (!RE_IFSC.test(normalizedIfsc)) {
      throw new ValidationError('IFSC should look like HDFC0001234');
    }
  }

  identity.bank = {
    accountHolderName: hasBank
      ? assertString(accountHolderName, 'Account holder name', { min: 2, max: 80, pattern: RE_PERSON_NAME })
      : '',
    accountNumber: hasBank ? normalizedAccount : '',
    ifscCode: hasBank ? normalizedIfsc : '',
    bankName: assertOptionalString(bankName, 'Bank name', { max: 80 }) || '',
    branchName: assertOptionalString(branchName, 'Branch name', { max: 80 }) || '',
    upiId: hasUpi ? normalizedUpi : '',
    upiQrCodeUrl: assertOptionalHttpUrl(upiQrCodeUrl, 'UPI QR code') || '',
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
  await assertUniqueVehicleNumber(identity, identity.vehicle.number);
  identity.markModified('vehicle');
  await advanceStep(identity, 'vehicle');
  return identity;
};

export const updateSelfie = async (identity, body) => {
  const url = assertHttpUrl(body?.selfieUrl, 'Selfie');
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
const hasPayoutDetails = (bank = {}) => {
  const account = String(bank.accountNumber || '').replace(/\D/g, '');
  const ifsc = String(bank.ifscCode || '').trim();
  const upi = String(bank.upiId || '').trim();
  return (account && ifsc) || Boolean(upi);
};

const assertOnboardingDataComplete = (identityDoc, services = []) => {
  if (!identityDoc.name) {
    throw new ValidationError('Complete your profile details before submitting');
  }
  if (!identityDoc.kyc?.aadhaar?.number || !identityDoc.kyc?.aadhaar?.documentUrl) {
    throw new ValidationError('Aadhaar details with photo are required');
  }
  if (!identityDoc.kyc?.drivingLicense?.number || !identityDoc.kyc?.drivingLicense?.documentUrl) {
    throw new ValidationError('Driving licence details with photo are required');
  }
  if (identityDoc.kyc?.pan?.number && !identityDoc.kyc?.pan?.documentUrl) {
    throw new ValidationError('PAN photo is required when PAN number is provided');
  }
  if (!hasPayoutDetails(identityDoc.bank)) {
    throw new ValidationError('Add bank account or UPI payout details');
  }
  if (!identityDoc.onboardingSelfieUrl) {
    throw new ValidationError('Selfie is required before submitting');
  }

  if (services.includes('food')) {
    const foodVehicle = identityDoc.foodVehicle || {};
    if (!foodVehicle.number || !foodVehicle.make || !foodVehicle.model) {
      throw new ValidationError('Add your food delivery vehicle details');
    }
  }

  if (services.includes('taxi')) {
    const taxiVehicle = identityDoc.taxiVehicle || {};
    if (!taxiVehicle.number || !taxiVehicle.make || !taxiVehicle.model) {
      throw new ValidationError('Add your taxi vehicle details');
    }
  }
};

export const completeOnboarding = async (identity, body) => {
  const identityDoc = await BuddyIdentity.findById(identity._id);
  if (!identityDoc) throw new NotFoundError('Identity not found');

  const services = getSelectedServices(identityDoc).length
    ? getSelectedServices(identityDoc)
    : Array.isArray(body?.services)
      ? body.services.filter((svc) => svc === 'food' || svc === 'taxi')
      : [];
  if (services.length === 0) {
    throw new ValidationError('Select at least one service to drive for');
  }

  assertOnboardingDataComplete(identityDoc, services);

  if (!identityDoc.onboardingServices?.length) {
    identityDoc.onboardingServices = services;
    identityDoc.markModified('onboardingServices');
  }

  await assertCreatableProfiles(identityDoc, services);

  const createdPartner = services.includes('food')
    ? await ensureFoodPartner(identityDoc)
    : null;
  const createdDriver = services.includes('taxi') ? await ensureTaxiDriver(identityDoc) : null;

  identityDoc.onboardingComplete = true;
  identityDoc.onboardingStep = 'done';
  await BuddyIdentity.updateOne(
    { _id: identityDoc._id },
    {
      $set: {
        onboardingComplete: true,
        onboardingStep: 'done',
        'identityRefs.foodPartnerId': createdPartner?._id || identityDoc.identityRefs?.foodPartnerId || null,
        'identityRefs.driverId': createdDriver?._id || identityDoc.identityRefs?.driverId || null,
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
    vehicleType: identity.foodVehicle?.type || identity.vehicle?.type || '',
    vehicleName:
      [identity.foodVehicle?.make, identity.foodVehicle?.model]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      identity.vehicle?.make ||
      identity.vehicle?.model ||
      '',
    vehicleNumber: identity.foodVehicle?.number || identity.vehicle?.number || '',
    aadharNumber: identity.kyc?.aadhaar?.number || '',
    aadharPhoto: identity.kyc?.aadhaar?.documentUrl || '',
    panNumber: identity.kyc?.pan?.number || '',
    panPhoto: identity.kyc?.pan?.documentUrl || '',
    drivingLicenseNumber: identity.kyc?.drivingLicense?.number || '',
    drivingLicensePhoto: identity.kyc?.drivingLicense?.documentUrl || '',
    profilePhoto: identity.onboardingSelfieUrl || identity.profileImage || '',
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

  const vehicleTypeId = identity.taxiVehicle?.vehicleTypeId || '';
  const selfieUrl = identity.onboardingSelfieUrl || identity.profileImage || '';

  return Driver.create({
    identityId: identity._id,
    name: identity.name,
    phone: identity.phone,
    email: identity.email || '',
    password: await hashPassword(String(identity.phone || '')),
    vehicleType: identity.taxiVehicle?.type || identity.vehicle?.type || 'bike',
    vehicleTypeId: mongoose.Types.ObjectId.isValid(vehicleTypeId) ? vehicleTypeId : null,
    vehicleNumber: identity.taxiVehicle?.number || identity.vehicle?.number || '',
    vehicleMake: identity.taxiVehicle?.make || identity.vehicle?.make || '',
    vehicleModel: identity.taxiVehicle?.model || identity.vehicle?.model || '',
    vehicleColor: identity.taxiVehicle?.color || identity.vehicle?.color || '',
    vehicleImage: identity.taxiVehicle?.photoUrl || identity.vehicle?.photoUrl || '',
    profile_picture: selfieUrl,
    profileImage: selfieUrl,
    gender: identity.gender || '',
    city: identity.city || '',
    registerFor: 'taxi',
    approve: false,
    status: 'pending',
    documents: {
      aadhaar: identity.kyc?.aadhaar || {},
      pan: identity.kyc?.pan || {},
      drivingLicense: identity.kyc?.drivingLicense || {},
      selfieUrl,
    },
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
    await assertCreatableProfiles(identity, ['food']);
    const partner = await ensureFoodPartner(identity);
    return { service: 'food', status: partner.status || 'pending' };
  }
  await assertCreatableProfiles(identity, ['taxi']);
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
    onboardingStep: normalizeOnboardingStepForClient(identity.onboardingStep, identity),
    onboardingServices: getSelectedServices(identity),
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
    foodVehicle: identity.foodVehicle || {},
    taxiVehicle: identity.taxiVehicle || {},
    selfieUrl: identity.onboardingSelfieUrl || '',
  };
};
