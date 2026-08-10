/**
 * Shared constants for the Indore seed suite.
 *
 * Phone range is deliberately distinct from scripts/seedRestaurantOnboarding
 * (98100000xx) so both suites can coexist in the same database.
 */

/** Owner phones: 9111100001 … 9111100007 (one per restaurant, in profile order). */
export const PHONE_BASE = '911110000';
export const PHONE_START = 1;

export const buildOwnerPhone = (index) => `${PHONE_BASE}${PHONE_START + index}`;

export const buildSeedPhoneFilter = (count) => {
    const phones = Array.from({ length: count }, (_, i) => buildOwnerPhone(i));
    const last10s = phones.map((p) => p.slice(-10));
    return {
        $or: [
            { ownerPhone: { $in: phones } },
            { ownerPhoneLast10: { $in: last10s } },
            { ownerPhoneDigits: { $in: phones } },
        ],
    };
};

export const CITY = {
    city: 'Indore',
    state: 'Madhya Pradesh',
    country: 'India',
};

/**
 * Fallback images, used when a curated image URL is unreachable.
 * Keyed by a coarse content tag so the fallback still matches the dish family.
 */
export const DEFAULT_IMAGES = {
    restaurant: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop&q=80',
    cover: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&auto=format&fit=crop&q=80',
    menuCard: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80',
    category: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    starter: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&auto=format&fit=crop&q=80',
    curry: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80',
    bread: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=800&auto=format&fit=crop&q=80',
    rice: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
    biryani: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
    chaat: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&auto=format&fit=crop&q=80',
    snack: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&auto=format&fit=crop&q=80',
    breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&auto=format&fit=crop&q=80',
    sweet: 'https://images.unsplash.com/photo-1666190092159-3171cf0fbb12?w=800&auto=format&fit=crop&q=80',
    dessert: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&auto=format&fit=crop&q=80',
    pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80',
    pasta: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&auto=format&fit=crop&q=80',
    chinese: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=80',
    momo: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80',
    beverage: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=800&auto=format&fit=crop&q=80',
    thali: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80',
    combo: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80',
    addon: 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=800&auto=format&fit=crop&q=80',
};

/** Last-resort placeholder when even the tagged fallback is unreachable. */
export const PLACEHOLDER_IMAGE = DEFAULT_IMAGES.category;

export const OUTLET_TIMING_PRESETS = {
    /** Breakfast-led outlets open early and shut by evening. */
    earlyBird: { openingTime: '07:00', closingTime: '21:00', closedDays: [] },
    /** Standard lunch-to-late-dinner service. */
    standard: { openingTime: '11:00', closingTime: '23:00', closedDays: [] },
    /** Evening-only street food / bazaar outlets. */
    eveningOnly: { openingTime: '16:00', closingTime: '23:59', closedDays: [] },
    /** Full-day outlet that rests on Monday — useful for "closed today" testing. */
    weeklyOff: { openingTime: '11:00', closingTime: '23:00', closedDays: ['Monday'] },
};

export const WEEK_DAYS = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
];
