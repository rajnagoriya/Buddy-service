import { sendResponse } from '../../utils/response.js';
import { ValidationError } from '../auth/errors.js';
import { reverseGeocode } from './geocode.service.js';
import { saveActorLocation } from './location.service.js';

/** GET /v1/location/reverse-geocode?lat=&lng= - shared by any authenticated actor. */
export const reverseGeocodeController = async (req, res, next) => {
    try {
        const lat = Number(req.query.lat);
        const lng = Number(req.query.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            throw new ValidationError('lat/lng query params are required');
        }
        const result = await reverseGeocode(lat, lng, { country: req.query.country });
        return sendResponse(res, 200, 'Reverse geocode successful', result);
    } catch (err) {
        next(err);
    }
};

/** POST /v1/food/user/location - real backend for the raw-GPS "current location" ping (not a saved address). */
export const saveUserCurrentLocationController = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { lat, latitude, lng, longitude, ...addressFields } = req.body || {};
        const result = await saveActorLocation({
            actorType: 'USER',
            actorId: userId,
            lat: lat ?? latitude,
            lng: lng ?? longitude,
            addressFields,
        });
        return sendResponse(res, 200, 'Location saved successfully', result);
    } catch (err) {
        next(err);
    }
};
