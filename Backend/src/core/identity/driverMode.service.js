import mongoose from 'mongoose';
import { ValidationError, ForbiddenError } from '../auth/errors.js';
import { BuddyIdentity } from './buddyIdentity.model.js';
import { FoodDeliveryPartner } from '../../modules/food/delivery/models/deliveryPartner.model.js';
import { Driver } from '../../modules/taxi/driver/models/Driver.js';
import { FoodOrder } from '../../modules/food/orders/models/order.model.js';

const VALID_MODES = ['off', 'food', 'taxi'];
const OFF_ALIASES = new Set(['off', 'none', 'offline', '', null, undefined]);

/**
 * Normalises any "I'm not on duty" wording (`off`, `none`, `offline`, empty)
 * to the canonical `'off'` value. Anything else is returned verbatim so the
 * VALID_MODES gate below can reject typos.
 */
const normalizeMode = (raw) => {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : raw;
  if (OFF_ALIASES.has(value)) return 'off';
  return value;
};

/** True when an identity's stored `activeService` represents "not on duty". */
const isOffMode = (value) => OFF_ALIASES.has(typeof value === 'string' ? value.toLowerCase() : value);

const IN_FLIGHT_FOOD_STATUSES = [
  'created',
  'accepted',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'reached_drop',
];

/**
 * Atomically switches a driver's active service.
 *
 * Rules enforced here (so neither dispatcher can pick the driver up twice):
 *
 *   - You can't switch to taxi while a food order is mid-flight.
 *   - You can't switch to food while a taxi ride is in progress.
 *   - Switching to a service requires that service to be approved.
 *   - The taxi `Driver.isOnline` and food `FoodDeliveryPartner.availabilityStatus`
 *     fields are kept consistent with `BuddyIdentity.activeService`.
 *
 * The single source of truth is `BuddyIdentity.activeService`. The two
 * capability docs carry mirror copies so dispatch queries stay single-doc
 * (no joins on the hot path).
 */
export const setDriverMode = async (identity, mode, options = {}) => {
  const normalized = normalizeMode(mode);
  if (!VALID_MODES.includes(normalized)) {
    throw new ValidationError(`mode must be one of: ${VALID_MODES.join(', ')}`);
  }
  mode = normalized;

  if (!identity.onboardingComplete) {
    throw new ForbiddenError('Complete onboarding before going online');
  }

  const partner = await FoodDeliveryPartner.findOne({ identityId: identity._id });
  const driver = await Driver.findOne({ identityId: identity._id });

  if (mode === 'food' && !partner) {
    throw new ForbiddenError('Food capability is not enabled for this driver');
  }
  if (mode === 'taxi' && !driver) {
    throw new ForbiddenError('Taxi capability is not enabled for this driver');
  }
  if (mode === 'food' && partner.status !== 'approved') {
    throw new ForbiddenError(
      `Food capability is ${partner.status || 'pending'} — wait for admin approval`,
    );
  }
  if (mode === 'taxi') {
    const status = String(driver.status || '').toLowerCase();
    if (driver.approve === false || status === 'pending' || status === 'rejected') {
      throw new ForbiddenError(`Taxi capability is ${status || 'pending'} — wait for admin approval`);
    }
  }

  // Block illegal mid-job transitions.
  if (mode !== 'food' && partner) {
    const activeFoodOrder = await FoodOrder.findOne({
      $or: [
        { 'dispatch.deliveryPartnerId': partner._id },
        { 'dispatch.sharedPartnerId': partner._id },
      ],
      orderStatus: { $in: IN_FLIGHT_FOOD_STATUSES },
    })
      .select('_id orderStatus')
      .lean();
    if (activeFoodOrder) {
      throw new ForbiddenError(
        'You have an active food order. Finish or cancel it before switching mode.',
      );
    }
  }
  if (mode !== 'taxi' && driver && driver.isOnRide) {
    throw new ForbiddenError(
      'You have an active taxi ride. Finish it before switching mode.',
    );
  }

  const { latitude, longitude, selfieImageUrl } = options;
  const now = new Date();

  // Run all updates inside a transaction-like sequence. Since Mongo without
  // replica sets can't span sessions, we update each document with
  // `findOneAndUpdate` and an `activeService` precondition that prevents
  // concurrent writes from leaving the system half-flipped.
  const setIdentity = await BuddyIdentity.findOneAndUpdate(
    {
      _id: identity._id,
      // Optimistic concurrency: refuse if another request flipped activeService
      // out from under us between our read and write.
      activeService: identity.activeService,
    },
    { $set: { activeService: mode, lastLoginAt: now } },
    { new: true },
  );
  if (!setIdentity) {
    throw new ForbiddenError('Mode changed in another session. Please retry.');
  }

  if (partner) {
    const update = {
      availabilityStatus: mode === 'food' ? 'online' : 'offline',
    };
    if (mode === 'food' && typeof latitude === 'number' && typeof longitude === 'number') {
      update.lastLocation = { type: 'Point', coordinates: [longitude, latitude] };
      update.lastLat = latitude;
      update.lastLng = longitude;
      update.lastLocationAt = now;
    }
    await FoodDeliveryPartner.updateOne({ _id: partner._id }, { $set: update });
  }

  if (driver) {
    const update = { isOnline: mode === 'taxi' };
    if (mode === 'taxi' && typeof latitude === 'number' && typeof longitude === 'number') {
      update.location = { type: 'Point', coordinates: [longitude, latitude] };
    }
    if (mode === 'taxi' && selfieImageUrl) {
      const todayKey = new Date().toISOString().slice(0, 10);
      update.onlineSelfie = {
        imageUrl: String(selfieImageUrl).trim(),
        capturedAt: now,
        uploadedAt: now,
        forDate: todayKey,
      };
    }
    await Driver.updateOne({ _id: driver._id }, { $set: update });
  }

  return {
    activeService: mode,
    capabilities: {
      food: partner ? partner.status || 'approved' : 'not_enabled',
      taxi: driver
        ? driver.approve === false
          ? 'pending'
          : driver.status || 'approved'
        : 'not_enabled',
    },
  };
};

export { isOffMode, normalizeMode };


export const getDriverMode = async (identity) => {
  const partner = await FoodDeliveryPartner.findOne({ identityId: identity._id })
    .select('status availabilityStatus')
    .lean();
  const driver = await Driver.findOne({ identityId: identity._id })
    .select('status approve isOnline isOnRide')
    .lean();
  return {
    activeService: isOffMode(identity.activeService) ? 'off' : identity.activeService,
    capabilities: {
      food: partner ? partner.status || 'approved' : 'not_enabled',
      taxi: driver
        ? driver.approve === false
          ? 'pending'
          : driver.status || 'approved'
        : 'not_enabled',
    },
    food: partner
      ? {
          status: partner.status,
          availabilityStatus: partner.availabilityStatus || 'offline',
        }
      : null,
    taxi: driver
      ? {
          status: driver.status,
          isOnline: !!driver.isOnline,
          isOnRide: !!driver.isOnRide,
        }
      : null,
  };
};
