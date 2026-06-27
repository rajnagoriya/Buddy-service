import { getImageUrl, normalizeImageAssetList } from '../../services/foodImage.service.js';

const APPROVAL_REQUIRED_KEYS = new Set([
    'restaurantName',
    'restaurantNameNormalized',
    'ownerName',
    'pureVegRestaurant',
    'dietaryType',
    'cuisines',
    'addressLine1',
    'addressLine2',
    'area',
    'city',
    'state',
    'pincode',
    'landmark',
    'location',
    'zoneId',
    'profileImage',
    'coverImages',
    'imagePublicIds',
    'panNumber',
    'nameOnPan',
    'panImage',
    'gstRegistered',
    'gstNumber',
    'gstLegalName',
    'gstAddress',
    'gstImage',
    'fssaiNumber',
    'fssaiExpiry',
    'fssaiImage',
    'accountNumber',
    'ifscCode',
    'accountHolderName',
    'accountType',
    'upiId',
    'upiQrImage',
]);

export const PENDING_PROFILE_MERGE_KEYS = [
    'restaurantName',
    'restaurantNameNormalized',
    'ownerName',
    'pureVegRestaurant',
    'dietaryType',
    'cuisines',
    'addressLine1',
    'addressLine2',
    'area',
    'city',
    'state',
    'pincode',
    'landmark',
    'location',
    'zoneId',
    'profileImage',
    'coverImages',
    'imagePublicIds',
    'panNumber',
    'nameOnPan',
    'panImage',
    'gstRegistered',
    'gstNumber',
    'gstLegalName',
    'gstAddress',
    'gstImage',
    'fssaiNumber',
    'fssaiExpiry',
    'fssaiImage',
    'accountNumber',
    'ifscCode',
    'accountHolderName',
    'accountType',
    'upiId',
    'upiQrImage',
    'ownerPhone',
    'ownerPhoneDigits',
    'ownerPhoneLast10',
];

export const PENDING_FIELD_LABELS = {
    restaurantName: 'Restaurant Name',
    ownerName: 'Full Name',
    cuisines: 'Cuisines',
    addressLine1: 'Address',
    area: 'Area',
    city: 'City',
    state: 'State',
    pincode: 'Pincode',
    landmark: 'Landmark',
    location: 'Location',
    profileImage: 'Profile Image',
    coverImages: 'Outlet Photos',
    pureVegRestaurant: 'Non-Veg / Mixed',
    dietaryType: 'Dietary Type',
    panNumber: 'PAN Number',
    nameOnPan: 'Name on PAN',
    panImage: 'PAN Document',
    fssaiNumber: 'FSSAI Number',
    fssaiExpiry: 'FSSAI Expiry',
    fssaiImage: 'FSSAI Document',
    accountHolderName: 'Account Holder',
    accountNumber: 'Account Number',
    ifscCode: 'IFSC Code',
    upiId: 'UPI ID',
    gstNumber: 'GST Number',
    gstLegalName: 'GST Legal Name',
};

const META_PENDING_KEYS = new Set([
    'pendingUpdateReason',
    'submittedAt',
    'pendingFields',
    '_approvedSnapshot',
]);

const INTERNAL_PENDING_FIELD_KEYS = new Set([
    'imagePublicIds',
    'restaurantNameNormalized',
]);

const LOCATION_PENDING_KEYS = new Set([
    'location',
    'area',
    'city',
    'state',
    'pincode',
    'addressLine1',
    'addressLine2',
    'landmark',
    'zoneId',
]);

export function normalizePendingFieldList(fields = []) {
    const set = new Set(
        (Array.isArray(fields) ? fields : []).filter((key) => !META_PENDING_KEYS.has(key) && !INTERNAL_PENDING_FIELD_KEYS.has(key)),
    );
    const hasLocation = [...set].some((key) => LOCATION_PENDING_KEYS.has(key));
    if (hasLocation) {
        for (const key of LOCATION_PENDING_KEYS) set.delete(key);
        set.add('location');
    }
    return [...set];
}

export function extractApprovedSnapshot(doc = {}) {
    const snapshot = {};
    for (const key of PENDING_PROFILE_MERGE_KEYS) {
        if (doc[key] !== undefined) {
            snapshot[key] = doc[key];
        }
    }
    return snapshot;
}

export function splitProfileUpdate(update = {}) {
    const directUpdate = {};
    const pendingUpdate = {};

    for (const [key, value] of Object.entries(update)) {
        if (key.startsWith('_')) continue;
        if (APPROVAL_REQUIRED_KEYS.has(key)) {
            pendingUpdate[key] = value;
        } else {
            directUpdate[key] = value;
        }
    }

    return { directUpdate, pendingUpdate };
}

export function resolvePendingUpdateReason(updatedFields = []) {
    let reason = 'Profile Update';

    if (updatedFields.some((f) => ['accountNumber', 'ifscCode', 'accountHolderName', 'upiId'].includes(f))) {
        reason = 'Financial Details Update';
    } else if (updatedFields.some((f) => ['panNumber', 'nameOnPan', 'panImage', 'gstNumber', 'fssaiNumber', 'fssaiExpiry'].includes(f))) {
        reason = 'Regulatory Documents Update';
    } else if (updatedFields.some((f) => ['addressLine1', 'area', 'city', 'pincode', 'location'].includes(f))) {
        reason = 'Location/Address Update';
    } else if (updatedFields.some((f) => ['profileImage', 'coverImages'].includes(f))) {
        reason = 'Photo/Banner Update';
    } else if (updatedFields.includes('restaurantName')) {
        reason = 'Restaurant Name Change';
    } else if (updatedFields.includes('cuisines')) {
        reason = 'Cuisine Update';
    } else if (updatedFields.includes('ownerName')) {
        reason = 'Owner Name Update';
    } else if (updatedFields.some((f) => ['pureVegRestaurant', 'dietaryType'].includes(f))) {
        reason = 'Dietary Category Update';
    }

    return reason;
}

export function mergePendingProfile(existingPending = {}, pendingUpdate = {}) {
    const merged = { ...(existingPending || {}) };
    for (const [key, value] of Object.entries(pendingUpdate || {})) {
        if (!META_PENDING_KEYS.has(key)) {
            merged[key] = value;
        }
    }
    return merged;
}

const IMAGE_FIELD_KEYS = new Set([
    'profileImage',
    'panImage',
    'gstImage',
    'fssaiImage',
    'upiQrImage',
]);

const IMAGE_LIST_FIELD_KEYS = new Set(['coverImages', 'menuImages']);

const LOCATION_COMPARE_KEYS = [
    'addressLine1',
    'addressLine2',
    'area',
    'city',
    'state',
    'pincode',
    'landmark',
];

const normalizeStringList = (value) =>
    (Array.isArray(value) ? value : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .sort()
        .join('|');

const normalizeImageListKey = (value) =>
    normalizeImageAssetList(value)
        .map((item) => item.url)
        .sort()
        .join('|');

const locationSnapshotKey = (value = {}) =>
    LOCATION_COMPARE_KEYS.map((key) => String(value?.[key] || '').trim()).join('|');

export function pendingValuesDiffer(key, snapshotVal, pendingVal) {
    if (pendingVal === undefined) return false;

    if (IMAGE_FIELD_KEYS.has(key)) {
        return getImageUrl(pendingVal) !== getImageUrl(snapshotVal);
    }
    if (IMAGE_LIST_FIELD_KEYS.has(key)) {
        return normalizeImageListKey(pendingVal) !== normalizeImageListKey(snapshotVal);
    }
    if (key === 'cuisines') {
        return normalizeStringList(pendingVal) !== normalizeStringList(snapshotVal);
    }
    if (key === 'location') {
        return locationSnapshotKey(pendingVal) !== locationSnapshotKey(snapshotVal);
    }
    if (key === 'fssaiExpiry') {
        const pendingTime = pendingVal ? new Date(pendingVal).getTime() : null;
        const snapshotTime = snapshotVal ? new Date(snapshotVal).getTime() : null;
        return pendingTime !== snapshotTime;
    }

    return JSON.stringify(pendingVal) !== JSON.stringify(snapshotVal);
}

export function computePendingFieldsFromSnapshot(snapshot = {}, mergedPending = {}) {
    const fields = [];
    for (const key of PENDING_PROFILE_MERGE_KEYS) {
        if (META_PENDING_KEYS.has(key) || INTERNAL_PENDING_FIELD_KEYS.has(key)) continue;
        if (pendingValuesDiffer(key, snapshot[key], mergedPending[key])) {
            fields.push(key);
        }
    }
    return normalizePendingFieldList(fields);
}

export function getEffectiveCoverImages(restaurant = {}) {
    const pending = restaurant.pendingProfile;
    if (restaurant.profileReviewStatus === 'pending' && pending?.coverImages) {
        return normalizeImageAssetList(pending.coverImages);
    }
    return normalizeImageAssetList(restaurant.coverImages);
}

export function isCoverImageDeletionOnly(baselineImages, requestedImages) {
    const baseline = normalizeImageAssetList(baselineImages);
    const requested = normalizeImageAssetList(requestedImages);
    if (!baseline.length || requested.length >= baseline.length) return false;

    const baselineUrls = new Set(baseline.map((item) => item.url));
    return requested.every((item) => baselineUrls.has(item.url));
}

export function applyCoverImageDeletionToLive(liveImages, requestedImages) {
    const requestedUrls = new Set(normalizeImageAssetList(requestedImages).map((item) => item.url));
    return normalizeImageAssetList(liveImages).filter((item) => requestedUrls.has(item.url));
}

export function buildPendingProfileSet(pendingUpdate = {}, reason, existingPending = null, liveDoc = null) {
    const mergedPending = mergePendingProfile(existingPending, pendingUpdate);
    const snapshot =
        existingPending?._approvedSnapshot ||
        extractApprovedSnapshot(liveDoc || {});

    const changedFields = computePendingFieldsFromSnapshot(snapshot, mergedPending);

    const set = {
        profileReviewStatus: 'pending',
        pendingUpdateReason: reason,
        isAcceptingOrders: false,
        'pendingProfile.pendingUpdateReason': reason,
        'pendingProfile.submittedAt': new Date(),
        'pendingProfile.pendingFields': changedFields,
        'pendingProfile._approvedSnapshot': snapshot,
    };

    for (const [key, value] of Object.entries(mergedPending)) {
        if (META_PENDING_KEYS.has(key)) continue;
        set[`pendingProfile.${key}`] = value;
    }

    set['pendingProfile.pendingFields'] = changedFields;
    set['pendingProfile._approvedSnapshot'] = snapshot;

    return set;
}

export function mergePendingProfileIntoSet(pendingProfile = {}) {
    const set = {};
    for (const key of PENDING_PROFILE_MERGE_KEYS) {
        if (pendingProfile[key] !== undefined) {
            set[key] = pendingProfile[key];
        }
    }
    return set;
}

export function getPendingFieldLabels(fields = []) {
    return (Array.isArray(fields) ? fields : [])
        .map((field) => PENDING_FIELD_LABELS[field] || field)
        .filter(Boolean);
}
