import { config } from '../../../../config/env.js';
import { logger } from '../../../../utils/logger.js';

/**
 * Fetches an encoded polyline from Google Directions API.
 * This should be called ONLY ONCE per order assignment to save costs.
 * @param {Object} origin - { lat, lng }
 * @param {Object} destination - { lat, lng }
 * @returns {Promise<string>} - Encoded polyline points
 */
export async function fetchPolyline(origin, destination) {
    const apiKey = config.googleMapsApiKey;
    if (!apiKey) {
        logger.warn('Google Maps API key missing. Polyline fetch skipped.');
        return '';
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const originStr = `${origin.lat},${origin.lng}`;
        const destStr = `${destination.lat},${destination.lng}`;
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&key=${apiKey}`;

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();

        if (data.status === 'OK' && data.routes?.length > 0) {
            return data.routes[0].overview_polyline?.points || '';
        } else {
            logger.warn(`Google Directions API returned status: ${data.status}. Message: ${data.error_message || 'No routes found'}`);
        }
    } catch (err) {
        logger.error(`Error fetching polyline from Google: ${err.message}`);
    }

    return '';
}

/**
 * Road driving distances (km) from one origin to many destinations via Google Distance Matrix.
 * Returns array parallel to destinations, or null on failure (caller should fall back to haversine).
 */
export async function fetchRoadDistancesKm(origin, destinations = []) {
    const apiKey = config.googleMapsApiKey;
    if (!apiKey || !origin || !Array.isArray(destinations) || destinations.length === 0) {
        return null;
    }

    const validDests = destinations.filter(
        (d) => Number.isFinite(d?.lat) && Number.isFinite(d?.lng),
    );
    if (!validDests.length) return null;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const originStr = `${origin.lat},${origin.lng}`;
        const destStr = validDests.map((d) => `${d.lat},${d.lng}`).join('|');
        const url =
            `https://maps.googleapis.com/maps/api/distancematrix/json` +
            `?origins=${encodeURIComponent(originStr)}` +
            `&destinations=${encodeURIComponent(destStr)}` +
            `&mode=driving&units=metric&key=${apiKey}`;

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();

        if (data.status !== 'OK' || !data.rows?.[0]?.elements?.length) {
            logger.warn(`Distance Matrix API status: ${data.status}`);
            return null;
        }

        return data.rows[0].elements.map((el) => {
            if (el.status !== 'OK' || !el.distance?.value) return null;
            return Number((el.distance.value / 1000).toFixed(2));
        });
    } catch (err) {
        logger.warn(`Distance Matrix fetch failed: ${err.message}`);
        return null;
    }
}
