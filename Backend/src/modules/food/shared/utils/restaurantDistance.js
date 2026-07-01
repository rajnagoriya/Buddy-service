import { Client } from '@googlemaps/google-maps-services-js';
import { logger } from '../../../../utils/logger.js';

const mapsClient = new Client({});

const getGoogleMapsApiKey = () => (
    process.env.GOOGLE_MAPS_API_KEY?.trim()
    || process.env.GOOGLE_MAPS_SERVER_KEY?.trim()
    || process.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
    || ''
);

const CACHE_TTL_MS = 15 * 60 * 1000;
/** @type {Map<string, { ts: number, meters: number }>} */
const distanceCache = new Map();

export const formatDistanceLabel = (meters) => {
    const value = Number(meters);
    if (!Number.isFinite(value) || value < 0) return '';
    if (value >= 1000) return `${(value / 1000).toFixed(1)} km`;
    return `${Math.round(value)} m`;
};

const roundCoord = (value) => Math.round(Number(value) * 1e4) / 1e4;

const haversineMeters = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const resolveRestaurantCoords = (restaurant = {}) => {
    const loc = restaurant.location || {};
    const lat = typeof loc.latitude === 'number'
        ? loc.latitude
        : (Array.isArray(loc.coordinates) ? loc.coordinates[1] : null);
    const lng = typeof loc.longitude === 'number'
        ? loc.longitude
        : (Array.isArray(loc.coordinates) ? loc.coordinates[0] : null);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
};

const buildCacheKey = (origin, dest) => (
    `${roundCoord(origin.lat)},${roundCoord(origin.lng)}|${roundCoord(dest.lat)},${roundCoord(dest.lng)}`
);

const readCachedDistance = (origin, dest) => {
    const key = buildCacheKey(origin, dest);
    const hit = distanceCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > CACHE_TTL_MS) {
        distanceCache.delete(key);
        return null;
    }
    return hit.meters;
};

const writeCachedDistance = (origin, dest, meters) => {
    if (!Number.isFinite(meters)) return;
    distanceCache.set(buildCacheKey(origin, dest), { ts: Date.now(), meters });
};

const fetchDrivingDistanceDirections = async (origin, dest, apiKey) => {
    const cached = readCachedDistance(origin, dest);
    if (Number.isFinite(cached)) return cached;

    try {
        const resp = await mapsClient.directions({
            params: {
                origin: `${origin.lat},${origin.lng}`,
                destination: `${dest.lat},${dest.lng}`,
                mode: 'driving',
                key: apiKey,
            },
            timeout: 8000,
        });
        const meters = resp.data?.routes?.[0]?.legs?.[0]?.distance?.value;
        if (Number.isFinite(meters)) {
            writeCachedDistance(origin, dest, meters);
            return meters;
        }
    } catch (err) {
        logger.warn(`Directions distance failed: ${err.message}`);
    }
    return null;
};

const fetchDrivingDistancesBatch = async (origin, destinations, apiKey) => {
    if (!destinations.length) return [];

    const cachedResults = destinations.map((dest) => readCachedDistance(origin, dest));
    const uncachedIndexes = [];
    cachedResults.forEach((value, index) => {
        if (!Number.isFinite(value)) uncachedIndexes.push(index);
    });

    if (uncachedIndexes.length === 0) {
        return cachedResults;
    }

    const uncachedDestinations = uncachedIndexes.map((index) => destinations[index]);

    try {
        const resp = await mapsClient.distancematrix({
            params: {
                origins: [{ lat: origin.lat, lng: origin.lng }],
                destinations: uncachedDestinations.map((d) => ({ lat: d.lat, lng: d.lng })),
                mode: 'driving',
                units: 'metric',
                key: apiKey,
            },
            timeout: 10000,
        });

        const status = resp.data?.status;
        const elements = resp.data?.rows?.[0]?.elements;
        if (status === 'OK' && Array.isArray(elements)) {
            await Promise.all(elements.map(async (element, batchIndex) => {
                const destIndex = uncachedIndexes[batchIndex];
                const dest = destinations[destIndex];
                let meters = null;

                if (element?.status === 'OK' && Number.isFinite(element.distance?.value)) {
                    meters = element.distance.value;
                } else {
                    meters = await fetchDrivingDistanceDirections(origin, dest, apiKey);
                }

                if (Number.isFinite(meters)) {
                    writeCachedDistance(origin, dest, meters);
                    cachedResults[destIndex] = meters;
                }
            }));
            return cachedResults;
        }

        logger.warn(`Distance Matrix status: ${status || 'unknown'}`);
    } catch (err) {
        logger.warn(`Distance Matrix failed: ${err.message}`);
    }

    await Promise.all(uncachedIndexes.map(async (destIndex) => {
        const dest = destinations[destIndex];
        const meters = await fetchDrivingDistanceDirections(origin, dest, apiKey);
        if (Number.isFinite(meters)) {
            cachedResults[destIndex] = meters;
        }
    }));

    return cachedResults;
};

const resolveRoadDistanceMeters = async (origin, dest, apiKey) => {
    const cached = readCachedDistance(origin, dest);
    if (Number.isFinite(cached)) return cached;

    const [batchResult] = await fetchDrivingDistancesBatch(origin, [dest], apiKey);
    if (Number.isFinite(batchResult)) return batchResult;

    return fetchDrivingDistanceDirections(origin, dest, apiKey);
};

export const enrichRestaurantsWithDistance = async (restaurants = [], origin = {}) => {
    const userLat = Number(origin.lat);
    const userLng = Number(origin.lng);
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng) || !restaurants.length) {
        return restaurants;
    }

    const apiKey = getGoogleMapsApiKey();
    const indexed = restaurants.map((restaurant, index) => {
        const coords = resolveRestaurantCoords(restaurant);
        return { restaurant, index, coords };
    });

    const withCoords = indexed.filter((item) => item.coords);
    const results = [...restaurants];
    const originPoint = { lat: userLat, lng: userLng };

    for (let i = 0; i < withCoords.length; i += 25) {
        const batch = withCoords.slice(i, i + 25);
        const distanceValues = apiKey
            ? await fetchDrivingDistancesBatch(
                originPoint,
                batch.map((item) => item.coords),
                apiKey,
            )
            : [];

        await Promise.all(batch.map(async (item, batchIndex) => {
            const coords = item.coords;
            let distanceMeters = Number.isFinite(distanceValues?.[batchIndex])
                ? distanceValues[batchIndex]
                : null;
            let distanceSource = 'none';

            if (!Number.isFinite(distanceMeters) && apiKey) {
                distanceMeters = await resolveRoadDistanceMeters(originPoint, coords, apiKey);
            }

            if (Number.isFinite(distanceMeters)) {
                distanceSource = 'road';
            } else {
                distanceMeters = haversineMeters(
                    userLat,
                    userLng,
                    coords.lat,
                    coords.lng,
                );
                distanceSource = 'straight';
            }

            results[item.index] = {
                ...item.restaurant,
                distanceMeters,
                distanceInKm: Number((distanceMeters / 1000).toFixed(2)),
                distance: formatDistanceLabel(distanceMeters),
                distanceSource,
            };
        }));
    }

    indexed
        .filter((item) => !item.coords)
        .forEach((item) => {
            results[item.index] = {
                ...item.restaurant,
                distanceMeters: null,
                distanceInKm: null,
                distance: '',
                distanceSource: 'none',
            };
        });

    return results;
};
