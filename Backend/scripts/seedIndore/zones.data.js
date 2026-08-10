/**
 * Service zones for Indore.
 *
 * `coordinates` is a [{ latitude, longitude }] polygon — the shape the backend's
 * isPointInPolygon() expects (see restaurantCreation.service.js). Every seeded
 * restaurant pin must fall inside its zone or onboarding validation rejects it.
 *
 * A single city-wide zone is used on purpose: it keeps every seeded restaurant
 * discoverable regardless of which corner of Indore the test user drops a pin in.
 */
export const ZONES = [
    {
        key: 'indore_city',
        name: 'Indore City',
        zoneName: 'Indore City',
        serviceLocation: 'Indore, Madhya Pradesh',
        country: 'India',
        unit: 'kilometer',
        isActive: true,
        // Rough municipal boundary — covers Rau in the south-west through
        // Nipania/Bypass in the north-east.
        coordinates: [
            { latitude: 22.8300, longitude: 75.7800 },
            { latitude: 22.8300, longitude: 75.9800 },
            { latitude: 22.7200, longitude: 76.0000 },
            { latitude: 22.6200, longitude: 75.9500 },
            { latitude: 22.5800, longitude: 75.8500 },
            { latitude: 22.6000, longitude: 75.7500 },
            { latitude: 22.7200, longitude: 75.7300 },
        ],
    },
];

export const PRIMARY_ZONE_KEY = 'indore_city';
