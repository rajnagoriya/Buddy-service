import { ValidationError } from '../auth/errors.js';
import { FoodUser } from '../users/user.model.js';
import { toGeoPoint } from './location.schema.js';
import { reverseGeocode } from './geocode.service.js';

/**
 * Single choke point for "any actor's location gets picked up and saved" -
 * user, restaurant, and delivery partner all flow through here so the shape
 * saved to the DB (and the reverse-geocode-fill behavior) is consistent.
 *
 * Does not reinvent each actor's existing persistence rules: user saved
 * addresses still go through userAddress.service.js, restaurant location
 * still goes through the approval-gated updateRestaurantProfile(), delivery
 * partner still updates its own model directly (no approval gating there).
 *
 * @param {object} args
 * @param {'USER'|'RESTAURANT'|'DELIVERY_PARTNER'} args.actorType
 * @param {string} args.actorId
 * @param {string} [args.addressId] - USER only: update this saved address instead of the raw currentLocation ping.
 * @param {number} args.lat
 * @param {number} args.lng
 * @param {boolean} [args.reverseGeocodeIfMissingAddress=true] - fill in city/formattedAddress/etc via reverseGeocode() when not supplied.
 * @param {object} [args.addressFields] - formattedAddress, address, addressLine1, addressLine2, area, city, state, pincode, country, landmark, label, phone, additionalDetails...
 */
export async function saveActorLocation({
    actorType,
    actorId,
    addressId,
    lat,
    lng,
    reverseGeocodeIfMissingAddress = true,
    addressFields = {},
}) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new ValidationError('lat/lng are required');
    }
    if (!actorId) {
        throw new ValidationError('actorId is required');
    }

    let resolvedFields = addressFields;
    const missingAddressDetail = !addressFields.city && !addressFields.formattedAddress && !addressFields.address;
    if (reverseGeocodeIfMissingAddress && missingAddressDetail) {
        try {
            const geo = await reverseGeocode(latitude, longitude);
            resolvedFields = { ...geo, ...addressFields };
        } catch {
            // Reverse geocode is best-effort here - still persist raw coordinates.
        }
    }

    if (actorType === 'USER') {
        return saveUserLocation({ actorId, addressId, latitude, longitude, addressFields: resolvedFields });
    }

    if (actorType === 'RESTAURANT') {
        return saveRestaurantLocation({ actorId, latitude, longitude, addressFields: resolvedFields });
    }

    if (actorType === 'DELIVERY_PARTNER') {
        return saveDeliveryPartnerLocation({ actorId, latitude, longitude });
    }

    throw new ValidationError(`Unknown actorType: ${actorType}`);
}

async function saveUserLocation({ actorId, addressId, latitude, longitude, addressFields }) {
    if (addressId) {
        // Delegates to the existing saved-address update path (label dedup, isDefault handling, etc.)
        const { updateAddress } = await import('../../modules/food/user/services/userAddress.service.js');
        const { address } = await updateAddress(actorId, addressId, {
            latitude,
            longitude,
            ...addressFields,
        });
        return address;
    }

    // Raw GPS ping, independent of any saved address - must not silently
    // create/overwrite a Home/Office/Other address. Accepts both our
    // canonical field names and the frontend's current-location field names
    // (address/postalCode/street) so useLocation.jsx can pass its payload
    // through unchanged.
    const point = {
        ...toGeoPoint(latitude, longitude),
        formattedAddress: addressFields.formattedAddress || addressFields.address || '',
        addressLine1: addressFields.addressLine1 || addressFields.street || '',
        area: addressFields.area || '',
        city: addressFields.city || '',
        state: addressFields.state || '',
        pincode: addressFields.pincode || addressFields.zipCode || addressFields.postalCode || '',
        country: addressFields.country || 'India',
    };

    await FoodUser.updateOne({ _id: actorId }, { $set: { currentLocation: point } });
    return point;
}

async function saveRestaurantLocation({ actorId, latitude, longitude, addressFields }) {
    // Goes through the existing approval-gated profile update flow - dynamic
    // import avoids a circular dependency between core/location and the
    // restaurant module.
    const { updateRestaurantProfile } = await import(
        '../../modules/food/restaurant/services/restaurant.service.js'
    );

    return updateRestaurantProfile(actorId, {
        location: {
            latitude,
            longitude,
            formattedAddress: addressFields.formattedAddress || addressFields.address || '',
            address: addressFields.formattedAddress || addressFields.address || '',
            addressLine1: addressFields.addressLine1 || '',
            addressLine2: addressFields.addressLine2 || '',
            area: addressFields.area || '',
            city: addressFields.city || '',
            state: addressFields.state || '',
            pincode: addressFields.pincode || '',
            landmark: addressFields.landmark || '',
        },
    });
}

async function saveDeliveryPartnerLocation({ actorId, latitude, longitude }) {
    const { FoodDeliveryPartner } = await import(
        '../../modules/food/delivery/models/deliveryPartner.model.js'
    );

    const point = toGeoPoint(latitude, longitude);
    await FoodDeliveryPartner.updateOne(
        { _id: actorId },
        {
            $set: {
                currentLocation: point,
                lastLocationAt: new Date(),
                // Deprecated fields kept in sync until Phase 3 migrates all
                // readers (order-dispatch.service.js, search.service.js) off
                // them onto currentLocation - see location centralization plan.
                lastLocation: { type: 'Point', coordinates: point.coordinates },
                lastLat: latitude,
                lastLng: longitude,
            },
        },
    );

    return point;
}
