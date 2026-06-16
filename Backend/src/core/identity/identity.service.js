import ms from 'ms';
import mongoose from 'mongoose';

import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ValidationError, AuthError } from '../auth/errors.js';
import { signAccessToken, signRefreshToken } from '../auth/token.util.js';
import { FoodRefreshToken } from '../refreshTokens/refreshToken.model.js';
import { createOrUpdateOtp, verifyOtp } from '../otp/otp.service.js';

import { BuddyIdentity } from './buddyIdentity.model.js';
import { normalizePhone, normalizeRoleKey } from './identity.helpers.js';

import { FoodUser } from '../users/user.model.js';
import { User as TaxiUser } from '../../modules/taxi/user/models/User.js';
import { FoodDeliveryPartner } from '../../modules/food/delivery/models/deliveryPartner.model.js';
import { Driver } from '../../modules/taxi/driver/models/Driver.js';

const ROLE_USER = 'USER';
const ROLE_DRIVER = 'DRIVER';

/**
 * The token signed by `verifyOtpUnified` is verifiable by both the existing
 * food middleware (which reads `userId`) and the existing taxi middleware
 * (which reads `sub`), so the same token works against both module trees
 * during the migration. Once all callers consume `identityId`, the duplicate
 * keys can be dropped.
 */
const buildTokenPayload = (identity, role, ids) => ({
  identityId: String(identity._id),
  role,
  // food middleware reads userId / id
  userId: String(ids?.userId || identity._id),
  // taxi middleware reads sub
  sub: String(ids?.sub || ids?.userId || identity._id),
  // capability list — frontends can switch tabs without re-decoding
  capabilities: ids?.capabilities || {},
});

const issueTokens = async (payload) => {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const ttlMs = ms(config.jwtRefreshExpiresIn || '7d');
  const expiresAt = new Date(Date.now() + ttlMs);
  await FoodRefreshToken.create({
    userId: payload.userId,
    token: refreshToken,
    expiresAt,
  });
  return { accessToken, refreshToken };
};

const ensureFoodUserForIdentity = async (identity, { name } = {}) => {
  const existing = await FoodUser.findOne({ identityId: identity._id });
  if (existing) return existing;

  const linkedByPhone = await FoodUser.findOne({ phone: identity.phone });
  if (linkedByPhone) {
    linkedByPhone.identityId = identity._id;
    if (name && !linkedByPhone.name) linkedByPhone.name = name;
    await linkedByPhone.save();
    return linkedByPhone;
  }

  return FoodUser.create({
    identityId: identity._id,
    phone: identity.phone,
    countryCode: identity.countryCode || '+91',
    name: name || identity.name || '',
    email: identity.email || '',
    isVerified: true,
  });
};

const ensureTaxiUserForIdentity = async (identity, { name } = {}) => {
  const existing = await TaxiUser.findOne({ identityId: identity._id });
  if (existing) return existing;

  const linkedByPhone = await TaxiUser.findOne({ phone: identity.phone });
  if (linkedByPhone) {
    linkedByPhone.identityId = identity._id;
    if (name && !linkedByPhone.name) linkedByPhone.name = name;
    await linkedByPhone.save();
    return linkedByPhone;
  }

  return TaxiUser.create({
    identityId: identity._id,
    phone: identity.phone,
    countryCode: identity.countryCode || '+91',
    name: name || identity.name || 'User',
    isVerified: true,
  });
};

const findFoodPartnerForIdentity = async (identity) => {
  return (
    (await FoodDeliveryPartner.findOne({ identityId: identity._id })) ||
    (await FoodDeliveryPartner.findOne({ phone: identity.phone }))
  );
};

const findDriverForIdentity = async (identity) => {
  return (
    (await Driver.findOne({ identityId: identity._id })) ||
    (await Driver.findOne({ phone: identity.phone }))
  );
};

const pushFcmToken = (identity, fcmToken, platform) => {
  if (!fcmToken) return false;
  let modified = false;
  if (platform === 'mobile') {
    identity.fcmTokenMobile = identity.fcmTokenMobile || [];
    if (!identity.fcmTokenMobile.includes(fcmToken)) {
      identity.fcmTokenMobile.push(fcmToken);
      modified = true;
    }
  } else {
    identity.fcmTokens = identity.fcmTokens || [];
    if (!identity.fcmTokens.includes(fcmToken)) {
      identity.fcmTokens.push(fcmToken);
      modified = true;
    }
  }
  return modified;
};

const sanitizeIdentityForResponse = (identity) => ({
  id: String(identity._id),
  identityId: String(identity._id),
  phone: identity.phone,
  countryCode: identity.countryCode || '+91',
  name: identity.name || '',
  email: identity.email || '',
  profileImage: identity.profileImage || '',
  roles: Array.isArray(identity.roles) ? identity.roles : [],
  isVerified: Boolean(identity.isVerified),
  isActive: identity.isActive !== false,
  onboardingComplete: Boolean(identity.onboardingComplete),
  onboardingStep: identity.onboardingStep || 'basics',
  // Normalise the legacy stored `'none'` to the new canonical `'off'` on the
  // way out so clients only ever see one off-state value.
  activeService:
    !identity.activeService || identity.activeService === 'none' ? 'off' : identity.activeService,
});

const summariseCapabilities = (partner, driver) => ({
  food: partner ? partner.status || 'approved' : 'not_enabled',
  taxi: driver
    ? driver.approve === false || String(driver.status || '').toLowerCase() === 'pending'
      ? 'pending'
      : driver.status || 'approved'
    : 'not_enabled',
});

const upsertIdentity = async (phoneLast10, role, name) => {
  // findOneAndUpdate + upsert is atomic on the unique phone index, so two
  // racing OTP verifications on the same phone cannot create duplicates.
  //
  // NOTE: $addToSet covers both "first time" (creates the array with the
  // role) and "subsequent" (no-op if already present) cases, so we must
  // NOT also set `roles` in $setOnInsert — MongoDB refuses an update that
  // touches the same path with two operators ("Updating the path 'roles'
  // would create a conflict at 'roles'").
  const identity = await BuddyIdentity.findOneAndUpdate(
    { phone: phoneLast10 },
    {
      $setOnInsert: {
        phone: phoneLast10,
        countryCode: '+91',
        isVerified: true,
        name: name || '',
      },
      $addToSet: { roles: role },
      $set: { lastLoginAt: new Date() },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  // If we just learned the user's name on first signup, persist it.
  if (name && !identity.name) {
    identity.name = String(name).trim();
    await identity.save();
  }
  return identity;
};

/**
 * STEP 1: Request OTP
 *
 * `role` is only a hint; the same OTP works for whichever role the caller
 * verifies with. We accept it so dev/QA can see in logs why an OTP was sent.
 */
export const requestOtpUnified = async ({ phone, role }) => {
  if (!phone) throw new ValidationError('Phone is required');
  const phoneLast10 = normalizePhone(phone);
  if (!phoneLast10 || phoneLast10.length !== 10) {
    throw new ValidationError('A valid 10-digit phone number is required');
  }

  const normalizedRole = normalizeRoleKey(role);
  const otp = await createOrUpdateOtp(phoneLast10);
  logger.info(`[unified-auth] OTP requested for ${phoneLast10} (role=${normalizedRole})`);

  const shouldExposeOtp = config.nodeEnv !== 'production' || config.useDefaultOtp;
  return {
    phone: phoneLast10,
    role: normalizedRole,
    ...(shouldExposeOtp ? { otp } : {}),
  };
};

/**
 * STEP 2: Verify OTP and log in / register
 *
 * The response is shaped so the client can route on three signals:
 *   - `needsOnboarding`     → push driver into onboarding wizard
 *   - `capabilities`        → which driver services are approved
 *   - `isNewUser`           → show welcome banner / referral nag for customers
 */
export const verifyOtpUnified = async ({
  phone,
  role,
  otp,
  name,
  fcmToken,
  platform,
}) => {
  const phoneLast10 = normalizePhone(phone);
  if (!phoneLast10 || phoneLast10.length !== 10) {
    throw new ValidationError('A valid 10-digit phone number is required');
  }
  const normalizedRole = normalizeRoleKey(role);
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  // Resolve existing identity *before* consuming the OTP so we know whether
  // this is a brand-new signup that requires a name.
  const preIdentity = await BuddyIdentity.findOne({ phone: phoneLast10 });
  const isNewIdentity = !preIdentity;
  if (
    normalizedRole === ROLE_USER &&
    isNewIdentity &&
    !trimmedName
  ) {
    throw new ValidationError('Name is required for first-time signup');
  }

  const otpResult = await verifyOtp(phoneLast10, otp);
  if (!otpResult.valid) {
    throw new AuthError(otpResult.reason || 'OTP verification failed');
  }

  const identity = await upsertIdentity(phoneLast10, normalizedRole, trimmedName);
  if (identity.isActive === false) {
    throw new AuthError('Your account has been deactivated. Please contact support.');
  }

  if (pushFcmToken(identity, fcmToken, platform)) {
    await identity.save();
  }

  // === Branch on role =====================================================
  if (normalizedRole === ROLE_USER) {
    const [foodUser, taxiUser] = await Promise.all([
      ensureFoodUserForIdentity(identity, { name: trimmedName }),
      ensureTaxiUserForIdentity(identity, { name: trimmedName }),
    ]);

    // Keep identityRefs current — useful for support / admin tooling.
    await BuddyIdentity.updateOne(
      { _id: identity._id },
      {
        $set: {
          'identityRefs.foodUserId': foodUser._id,
          'identityRefs.taxiUserId': taxiUser._id,
        },
      },
    );

    const tokenPayload = buildTokenPayload(identity, ROLE_USER, {
      // Older food endpoints still resolve a FoodUser by `userId`, so we
      // pass the FoodUser._id as the legacy id during the migration window.
      userId: foodUser._id,
      sub: taxiUser._id,
      capabilities: { food: 'enabled', taxi: 'enabled' },
    });
    const { accessToken, refreshToken } = await issueTokens(tokenPayload);

    return {
      accessToken,
      refreshToken,
      token: accessToken,
      role: ROLE_USER,
      identity: sanitizeIdentityForResponse(identity),
      capabilities: { food: 'enabled', taxi: 'enabled' },
      services: ['food', 'taxi'],
      isNewUser: isNewIdentity,
      needsOnboarding: false,
      user: {
        // legacy shape — keep food clients happy
        id: String(foodUser._id),
        _id: String(foodUser._id),
        phone: identity.phone,
        name: identity.name || trimmedName || '',
        email: identity.email || '',
        role: 'USER',
      },
    };
  }

  if (normalizedRole === ROLE_DRIVER) {
    const [partner, driver] = await Promise.all([
      findFoodPartnerForIdentity(identity),
      findDriverForIdentity(identity),
    ]);

    // Onboarding gate: brand-new driver hasn't entered KYC.
    if (!identity.onboardingComplete) {
      const tokenPayload = buildTokenPayload(identity, ROLE_DRIVER, {
        userId: identity._id,
        sub: identity._id,
        capabilities: { food: 'not_enabled', taxi: 'not_enabled' },
      });
      const { accessToken, refreshToken } = await issueTokens(tokenPayload);
      return {
        accessToken,
        refreshToken,
        token: accessToken,
        role: ROLE_DRIVER,
        identity: sanitizeIdentityForResponse(identity),
        capabilities: { food: 'not_enabled', taxi: 'not_enabled' },
        services: [],
        isNewUser: isNewIdentity,
        needsOnboarding: true,
        onboardingStep: identity.onboardingStep || 'basics',
      };
    }

    // Already onboarded — return capability status. The same token works on
    // both the food delivery and taxi driver endpoints because the JWT
    // secret is shared and the payload carries both `userId` and `sub`.
    const tokenPayload = buildTokenPayload(identity, ROLE_DRIVER, {
      userId: partner?._id || identity._id,
      sub: driver?._id || identity._id,
      capabilities: summariseCapabilities(partner, driver),
    });
    const { accessToken, refreshToken } = await issueTokens(tokenPayload);

    await BuddyIdentity.updateOne(
      { _id: identity._id },
      {
        $set: {
          'identityRefs.foodPartnerId': partner?._id || null,
          'identityRefs.driverId': driver?._id || null,
        },
      },
    );

    const services = [];
    if (partner) services.push('food');
    if (driver) services.push('taxi');

    return {
      accessToken,
      refreshToken,
      token: accessToken,
      role: ROLE_DRIVER,
      identity: sanitizeIdentityForResponse(identity),
      capabilities: summariseCapabilities(partner, driver),
      services,
      isNewUser: isNewIdentity,
      needsOnboarding: false,
      activeService:
        !identity.activeService || identity.activeService === 'none'
          ? 'off'
          : identity.activeService,
    };
  }

  throw new ValidationError('Unsupported role');
};

/**
 * Convenience getter used by the unified middleware to attach `req.identity`.
 * Cached only within a single request lifecycle by the caller.
 */
export const getIdentityById = async (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return null;
  return BuddyIdentity.findById(id);
};
