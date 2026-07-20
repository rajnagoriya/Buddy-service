import mongoose from 'mongoose';

const coordinatesValidator = {
    validator(v) {
        return (
            v === undefined ||
            (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n)))
        );
    },
    message: 'location.coordinates must be [lng, lat]'
};

/**
 * Canonical location/address sub-schema shared by User addresses, Restaurant
 * location, DeliveryPartner currentLocation, and Order deliveryAddress/pickup.
 *
 * `zipCode` and `street` are kept as virtual aliases (pincode/addressLine1)
 * so existing reads/writes on older field names keep working during the
 * migration window - see Phase 5 cleanup in the location centralization plan.
 */
export function buildLocationSchema({ requireCoordinates = false } = {}) {
    const schema = new mongoose.Schema(
        {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: {
                // [lng, lat]
                type: [Number],
                default: undefined,
                required: requireCoordinates,
                validate: coordinatesValidator
            },
            latitude: { type: Number },
            longitude: { type: Number },
            formattedAddress: { type: String, trim: true },
            address: { type: String, trim: true },
            addressLine1: { type: String, trim: true },
            addressLine2: { type: String, trim: true },
            area: { type: String, trim: true },
            landmark: { type: String, trim: true },
            city: { type: String, trim: true },
            state: { type: String, trim: true },
            pincode: { type: String, trim: true },
            country: { type: String, trim: true, default: 'India' },
            placeId: { type: String, trim: true }
        },
        { _id: false }
    );

    schema
        .virtual('zipCode')
        .get(function () {
            return this.pincode;
        })
        .set(function (v) {
            this.pincode = v;
        });

    schema
        .virtual('street')
        .get(function () {
            return this.addressLine1;
        })
        .set(function (v) {
            this.addressLine1 = v;
        });

    schema.set('toJSON', { virtuals: true });
    schema.set('toObject', { virtuals: true });

    return schema;
}

/** Build a GeoJSON Point + lat/lng mirror from raw lat/lng, or undefined if invalid/missing. */
export function toGeoPoint(lat, lng) {
    if (lat == null || lng == null) return undefined;
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
    return {
        type: 'Point',
        coordinates: [longitude, latitude],
        latitude,
        longitude
    };
}

/** Returns true only for a real, non-Null-Island coordinate pair. */
export function isValidNonZeroCoordinate(lat, lng) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
    if (latitude === 0 && longitude === 0) return false;
    return true;
}

/**
 * Extracts { lat, lng } from any of the location-like shapes used across
 * the codebase: GeoJSON { coordinates: [lng, lat] }, or { latitude, longitude }
 * / { lat, lng }.
 */
export function extractLatLng(locationLike) {
    if (!locationLike || typeof locationLike !== 'object') return null;

    if (Array.isArray(locationLike.coordinates) && locationLike.coordinates.length === 2) {
        const [lng, lat] = locationLike.coordinates;
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    const lat = Number(locationLike.latitude ?? locationLike.lat);
    const lng = Number(locationLike.longitude ?? locationLike.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };

    return null;
}
