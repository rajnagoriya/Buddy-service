/**
 * Backfill BuddyIdentity rows from the four existing user-like collections
 * (FoodUser, TaxiUser, FoodDeliveryPartner, Driver) and link `identityId`
 * back into each row.
 *
 * USAGE
 *   node scripts/backfill-buddy-identities.js           # dry-run, no writes
 *   node scripts/backfill-buddy-identities.js --apply   # actually write
 *
 * SAFETY
 *   - Phones are normalized to last-10 digits before grouping.
 *   - Existing identityId on a row is never overwritten.
 *   - When the same phone appears in multiple collections, we merge them
 *     under one identity and prefer driver-side KYC / vehicle data, then
 *     latest updatedAt for name/email/profile.
 *   - Conflicting names are reported in the run summary so an operator
 *     can review them after the dry-run.
 *
 * Run the dry-run first, eyeball the summary, then run with --apply.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

import { BuddyIdentity } from '../src/core/identity/buddyIdentity.model.js';
import { normalizePhone } from '../src/core/identity/identity.helpers.js';
import { FoodUser } from '../src/core/users/user.model.js';
import { User as TaxiUser } from '../src/modules/taxi/user/models/User.js';
import { FoodDeliveryPartner } from '../src/modules/food/delivery/models/deliveryPartner.model.js';
import { Driver } from '../src/modules/taxi/driver/models/Driver.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');

const summary = {
  identitiesCreated: 0,
  identitiesReused: 0,
  foodUsersLinked: 0,
  taxiUsersLinked: 0,
  foodPartnersLinked: 0,
  driversLinked: 0,
  phoneSkipped: 0,
  nameConflicts: [],
};

const log = (...args) => console.log('[backfill]', ...args);

const pickName = (...candidates) =>
  candidates.map((c) => String(c || '').trim()).find((c) => c) || '';

const pickEmail = (...candidates) =>
  candidates
    .map((c) => String(c || '').trim().toLowerCase())
    .find((c) => c) || '';

// Source collections store gender as "Male" / "FEMALE" / "M" / "" etc.
// BuddyIdentity's enum only accepts ['male', 'female', 'other',
// 'prefer-not-to-say', ''], so we normalize here.
const GENDER_ENUM = new Set(['male', 'female', 'other', 'prefer-not-to-say', '']);
const normalizeGender = (...candidates) => {
  for (const raw of candidates) {
    const v = String(raw || '').trim().toLowerCase();
    if (!v) continue;
    if (GENDER_ENUM.has(v)) return v;
    if (v === 'm') return 'male';
    if (v === 'f') return 'female';
    if (v === 'o') return 'other';
    if (v.startsWith('male')) return 'male';
    if (v.startsWith('female')) return 'female';
    // Unknown values are dropped rather than failing the whole record.
  }
  return '';
};

const collectFromFoodUser = (doc) => ({
  source: 'FoodUser',
  id: doc._id,
  phone: doc.phone,
  countryCode: doc.countryCode,
  name: doc.name,
  email: doc.email,
  profileImage: doc.profileImage,
  gender: doc.gender,
  isVerified: doc.isVerified,
  fcmTokens: doc.fcmTokens,
  fcmTokenMobile: doc.fcmTokenMobile,
  updatedAt: doc.updatedAt,
});

const collectFromTaxiUser = (doc) => ({
  source: 'TaxiUser',
  id: doc._id,
  phone: doc.phone,
  countryCode: doc.countryCode,
  name: doc.name,
  email: doc.email,
  profileImage: doc.profileImage,
  gender: doc.gender,
  isVerified: doc.isVerified,
  fcmTokenMobile: doc.fcmTokenMobile ? [doc.fcmTokenMobile] : [],
  fcmTokens: doc.fcmTokenWeb ? [doc.fcmTokenWeb] : [],
  updatedAt: doc.updatedAt,
});

const collectFromPartner = (doc) => ({
  source: 'FoodDeliveryPartner',
  id: doc._id,
  phone: doc.phone,
  countryCode: doc.countryCode,
  name: doc.name,
  email: doc.email,
  profileImage: doc.profilePhoto,
  city: doc.city,
  fcmTokens: doc.fcmTokens,
  fcmTokenMobile: doc.fcmTokenMobile,
  // driver-side carries KYC
  kyc: {
    aadhaar: {
      number: doc.aadharNumber || '',
      documentUrl: doc.aadharPhoto || '',
    },
    pan: {
      number: doc.panNumber || '',
      documentUrl: doc.panPhoto || '',
    },
    drivingLicense: {
      number: doc.drivingLicenseNumber || '',
      documentUrl: doc.drivingLicensePhoto || '',
    },
  },
  bank: {
    accountHolderName: doc.bankAccountHolderName || '',
    accountNumber: doc.bankAccountNumber || '',
    ifscCode: doc.bankIfscCode || '',
    bankName: doc.bankName || '',
    upiId: doc.upiId || '',
    upiQrCodeUrl: doc.upiQrCode || '',
  },
  vehicle: {
    type: doc.vehicleType || '',
    make: doc.vehicleName || '',
    model: doc.vehicleName || '',
    number: doc.vehicleNumber || '',
  },
  isVerified: doc.isVerified,
  updatedAt: doc.updatedAt,
});

const collectFromDriver = (doc) => ({
  source: 'Driver',
  id: doc._id,
  phone: doc.phone,
  name: doc.name,
  email: doc.email,
  profileImage: doc.profileImage || doc.profile_picture,
  city: doc.city,
  gender: doc.gender,
  fcmTokens: doc.fcmTokenWeb ? [doc.fcmTokenWeb] : [],
  fcmTokenMobile: doc.fcmTokenMobile ? [doc.fcmTokenMobile] : [],
  vehicle: {
    type: doc.vehicleType || '',
    make: doc.vehicleMake || '',
    model: doc.vehicleModel || '',
    number: doc.vehicleNumber || '',
    color: doc.vehicleColor || '',
    photoUrl: doc.vehicleImage || '',
  },
  bank: {
    accountHolderName: doc.bankDetails?.accountHolderName || '',
    accountNumber: doc.bankDetails?.accountNumber || '',
    ifscCode: doc.bankDetails?.ifsc || '',
    bankName: doc.bankDetails?.bankName || '',
    branchName: doc.bankDetails?.branchName || '',
    upiId: doc.bankDetails?.upiId || '',
    upiQrCodeUrl: doc.bankDetails?.qrCodeImage || '',
  },
  isVerified: true,
  updatedAt: doc.updatedAt,
});

const mergeIntoIdentityPayload = (collected) => {
  // Sort by updatedAt desc so latest data wins on simple fields.
  const sorted = [...collected].sort(
    (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
  );

  const driverishSource = sorted.find(
    (s) => s.source === 'FoodDeliveryPartner' || s.source === 'Driver',
  );

  const names = sorted.map((s) => s.name).filter(Boolean);
  const distinctNames = [...new Set(names.map((n) => n.trim().toLowerCase()))];

  return {
    nameConflict: distinctNames.length > 1 ? names : null,
    payload: {
      countryCode: pickName(...sorted.map((s) => s.countryCode)) || '+91',
      name: pickName(...sorted.map((s) => s.name)),
      email: pickEmail(...sorted.map((s) => s.email)),
      profileImage: pickName(...sorted.map((s) => s.profileImage)),
      gender: normalizeGender(...sorted.map((s) => s.gender)),
      city: pickName(...sorted.map((s) => s.city)),
      isVerified: sorted.some((s) => s.isVerified === true),
      fcmTokens: [...new Set(sorted.flatMap((s) => s.fcmTokens || []).filter(Boolean))],
      fcmTokenMobile: [
        ...new Set(sorted.flatMap((s) => s.fcmTokenMobile || []).filter(Boolean)),
      ],
      kyc: driverishSource?.kyc || undefined,
      bank: driverishSource?.bank || undefined,
      vehicle: driverishSource?.vehicle || undefined,
    },
  };
};

const inferRoles = (sources) => {
  const roles = new Set();
  for (const s of sources) {
    if (s.source === 'FoodUser' || s.source === 'TaxiUser') roles.add('USER');
    if (s.source === 'FoodDeliveryPartner' || s.source === 'Driver') roles.add('DRIVER');
  }
  return [...roles];
};

async function run() {
  const mongoUri =
    process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb+srv://sooperbuddyopcpvtltd_db_user:buddy-service123@buddy.vadstlf.mongodb.net/buddydb';
  log(`Connecting to ${mongoUri}`);
  await mongoose.connect(mongoUri);

  const [foodUsers, taxiUsers, partners, drivers] = await Promise.all([
    FoodUser.find({}).lean(),
    TaxiUser.find({}).lean(),
    FoodDeliveryPartner.find({}).lean(),
    Driver.find({}).lean(),
  ]);

  log(
    `Found: FoodUser=${foodUsers.length} TaxiUser=${taxiUsers.length} FoodDeliveryPartner=${partners.length} Driver=${drivers.length}`,
  );

  // Group all docs by normalized phone.
  const byPhone = new Map();
  const push = (last10, entry) => {
    if (!last10) {
      summary.phoneSkipped += 1;
      return;
    }
    if (!byPhone.has(last10)) byPhone.set(last10, []);
    byPhone.get(last10).push(entry);
  };

  for (const d of foodUsers) push(normalizePhone(d.phone), collectFromFoodUser(d));
  for (const d of taxiUsers) push(normalizePhone(d.phone), collectFromTaxiUser(d));
  for (const d of partners) push(normalizePhone(d.phone), collectFromPartner(d));
  for (const d of drivers) push(normalizePhone(d.phone), collectFromDriver(d));

  log(`Distinct phones across all collections: ${byPhone.size}`);

  for (const [last10, sources] of byPhone.entries()) {
    const existing = await BuddyIdentity.findOne({ phone: last10 });
    const { payload, nameConflict } = mergeIntoIdentityPayload(sources);
    const roles = inferRoles(sources);

    if (nameConflict) {
      summary.nameConflicts.push({ phone: last10, names: nameConflict });
    }

    let identity;
    if (existing) {
      identity = existing;
      summary.identitiesReused += 1;
    } else {
      if (APPLY) {
        identity = await BuddyIdentity.create({
          phone: last10,
          ...payload,
          roles,
          isVerified: payload.isVerified,
        });
      } else {
        identity = { _id: new mongoose.Types.ObjectId(), phone: last10, ...payload, roles };
      }
      summary.identitiesCreated += 1;
    }

    const refs = {
      foodUserId: null,
      taxiUserId: null,
      foodPartnerId: null,
      driverId: null,
    };

    // Link each source row back to the identity (only when identityId is empty).
    for (const s of sources) {
      try {
        if (s.source === 'FoodUser') {
          refs.foodUserId = s.id;
          if (APPLY) {
            await FoodUser.updateOne(
              { _id: s.id, $or: [{ identityId: null }, { identityId: { $exists: false } }] },
              { $set: { identityId: identity._id } },
            );
          }
          summary.foodUsersLinked += 1;
        } else if (s.source === 'TaxiUser') {
          refs.taxiUserId = s.id;
          if (APPLY) {
            await TaxiUser.updateOne(
              { _id: s.id, $or: [{ identityId: null }, { identityId: { $exists: false } }] },
              { $set: { identityId: identity._id } },
            );
          }
          summary.taxiUsersLinked += 1;
        } else if (s.source === 'FoodDeliveryPartner') {
          refs.foodPartnerId = s.id;
          if (APPLY) {
            await FoodDeliveryPartner.updateOne(
              { _id: s.id, $or: [{ identityId: null }, { identityId: { $exists: false } }] },
              { $set: { identityId: identity._id } },
            );
          }
          summary.foodPartnersLinked += 1;
        } else if (s.source === 'Driver') {
          refs.driverId = s.id;
          if (APPLY) {
            await Driver.updateOne(
              { _id: s.id, $or: [{ identityId: null }, { identityId: { $exists: false } }] },
              { $set: { identityId: identity._id } },
            );
          }
          summary.driversLinked += 1;
        }
      } catch (err) {
        log(`!! Failed to link ${s.source}/${s.id}:`, err.message);
      }
    }

    if (APPLY && existing) {
      // Refresh refs + roles on existing identity (do not clobber names already set).
      await BuddyIdentity.updateOne(
        { _id: identity._id },
        {
          $addToSet: { roles: { $each: roles } },
          $set: {
            identityRefs: refs,
            ...(existing.name ? {} : { name: payload.name }),
            ...(existing.email ? {} : { email: payload.email }),
            ...(existing.profileImage ? {} : { profileImage: payload.profileImage }),
          },
        },
      );
    } else if (APPLY) {
      await BuddyIdentity.updateOne({ _id: identity._id }, { $set: { identityRefs: refs } });
    }
  }

  log('--- SUMMARY ---');
  log(JSON.stringify(summary, null, 2));
  if (!APPLY) {
    log('DRY-RUN complete. Re-run with --apply to commit changes.');
  } else {
    log('APPLY complete.');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
