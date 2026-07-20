const EARTH_RADIUS_METERS = 6371000;

/** Canonical straight-line distance in meters. Replaces the ~5 duplicated Food-module implementations. */
export function haversineMeters(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
}

export function haversineKm(lat1, lng1, lat2, lng2) {
    return haversineMeters(lat1, lng1, lat2, lng2) / 1000;
}

export function formatDistanceLabel(meters) {
    const value = Number(meters);
    if (!Number.isFinite(value) || value < 0) return '';
    if (value >= 1000) return `${(value / 1000).toFixed(1)} km`;
    return `${Math.round(value)} m`;
}
