import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { logger } from '../../../../utils/logger.js';
import {
    invalidateFoodRestaurantListCaches,
    invalidateFoodRestaurantMenuCaches,
    invalidateFoodSearchCaches,
    invalidateFoodLandingCaches,
} from '../../utils/foodCacheInvalidation.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodRestaurantOutletTimings } from '../models/outletTimings.model.js';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const normalizeDay = (value) => {
    const v = String(value || '').trim();
    if (!v) return null;
    const exact = DAY_NAMES.find((d) => d.toLowerCase() === v.toLowerCase());
    if (exact) return exact;
    const abbr = v.slice(0, 3).toLowerCase();
    const match = DAY_NAMES.find((d) => d.toLowerCase().startsWith(abbr));
    return match || null;
};

const normalizeTime = (value, fallback) => {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    // Accept "HH:mm" or "H:mm"
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return fallback;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return fallback;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const defaultTimings = () =>
    DAY_NAMES.map((day) => ({
        day,
        isOpen: true,
        openingTime: '09:00',
        closingTime: '22:00'
    }));

const toClientShape = (doc) => {
    const timings = Array.isArray(doc?.timings) ? doc.timings : [];
    const map = {};
    for (const day of DAY_NAMES) {
        const found = timings.find((t) => normalizeDay(t?.day) === day);
        const isOpen = found ? found.isOpen !== false : true;
        map[day] = {
            isOpen,
            openingTime: isOpen ? normalizeTime(found?.openingTime, '09:00') : '',
            closingTime: isOpen ? normalizeTime(found?.closingTime, '22:00') : ''
        };
    }
    return map;
};

const DAY_ABBREV = {
    Monday: 'Mon',
    Tuesday: 'Tue',
    Wednesday: 'Wed',
    Thursday: 'Thu',
    Friday: 'Fri',
    Saturday: 'Sat',
    Sunday: 'Sun',
};

export const parseOutletTimingsInput = (raw) => {
    if (!raw) return null;
    let value = raw;
    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch {
            return null;
        }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value;
};

export const legacyRestaurantToOutletTimings = (restaurant = {}) => {
    const openDays = Array.isArray(restaurant.openDays) ? restaurant.openDays : [];
    const openingTime = normalizeTime(
        restaurant.openingTime || restaurant?.deliveryTimings?.openingTime,
        '09:00',
    );
    const closingTime = normalizeTime(
        restaurant.closingTime || restaurant?.deliveryTimings?.closingTime,
        '22:00',
    );

    return DAY_NAMES.reduce((acc, day) => {
        const abbrev = DAY_ABBREV[day];
        const isOpen = openDays.some(
            (entry) => normalizeDay(entry) === day || String(entry || '').trim() === abbrev,
        );
        acc[day] = {
            isOpen: openDays.length === 0 ? true : isOpen,
            openingTime: isOpen ? openingTime : '',
            closingTime: isOpen ? closingTime : '',
        };
        return acc;
    }, {});
};

const migrateLegacyTimingsIfNeeded = async (restaurantId) => {
    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    const existing = await FoodRestaurantOutletTimings.findOne({ restaurantId: rid }).select('_id').lean();
    if (existing?._id) return;

    const restaurant = await mongoose.connection.db.collection('food_restaurants').findOne(
        { _id: rid },
        { projection: { openingTime: 1, closingTime: 1, openDays: 1, onboarding: 1 } },
    );
    if (!restaurant?._id) return;

    const step2 = restaurant.onboarding?.step2 || {};
    const hasLegacy = Boolean(
        restaurant.openingTime ||
        restaurant.closingTime ||
        (Array.isArray(restaurant.openDays) && restaurant.openDays.length > 0) ||
        step2.openingTime ||
        step2.closingTime ||
        (Array.isArray(step2.openDays) && step2.openDays.length > 0),
    );
    if (!hasLegacy) return;

    const outletTimings = legacyRestaurantToOutletTimings({
        openDays: restaurant.openDays?.length ? restaurant.openDays : step2.openDays,
        openingTime: restaurant.openingTime || step2.openingTime || step2.deliveryTimings?.openingTime,
        closingTime: restaurant.closingTime || step2.closingTime || step2.deliveryTimings?.closingTime,
    });

    await FoodRestaurantOutletTimings.findOneAndUpdate(
        { restaurantId: rid },
        { $set: { timings: DAY_NAMES.map((day) => {
            const src = outletTimings[day] || {};
            const isOpen = src.isOpen !== false;
            return {
                day,
                isOpen,
                openingTime: isOpen ? normalizeTime(src.openingTime, '09:00') : '',
                closingTime: isOpen ? normalizeTime(src.closingTime, '22:00') : '',
            };
        }) } },
        { upsert: true, setDefaultsOnInsert: true },
    );

    await FoodRestaurant.updateOne(
        { _id: rid },
        {
            $unset: {
                openingTime: '',
                closingTime: '',
                openDays: '',
                'onboarding.step2.openingTime': '',
                'onboarding.step2.closingTime': '',
                'onboarding.step2.deliveryTimings': '',
                'onboarding.step2.openDays': '',
            },
        },
    );
};

export async function getOutletTimingsForRestaurant(restaurantId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    await migrateLegacyTimingsIfNeeded(restaurantId);
    const doc = await FoodRestaurantOutletTimings.findOne({ restaurantId }).select('timings updatedAt').lean();
    if (!doc) return { outletTimings: toClientShape({ timings: defaultTimings() }) };
    return { outletTimings: toClientShape(doc) };
}

export function getDefaultOutletTimingsShape() {
    return toClientShape({ timings: defaultTimings() });
}

/** Batch-load outlet timings for list endpoints (one DB query for all restaurants). */
export async function getOutletTimingsMapForRestaurants(restaurantIds = []) {
    const validIds = [
        ...new Set(
            (Array.isArray(restaurantIds) ? restaurantIds : [])
                .map((id) => String(id || '').trim())
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
        )
    ].map((id) => new mongoose.Types.ObjectId(id));

    if (validIds.length === 0) return new Map();

    const docs = await FoodRestaurantOutletTimings.find({ restaurantId: { $in: validIds } })
        .select('restaurantId timings')
        .lean();

    const map = new Map();
    for (const doc of docs) {
        map.set(String(doc.restaurantId), toClientShape(doc));
    }
    return map;
}

export async function attachOutletTimingsToRestaurants(restaurants = []) {
    const docs = Array.isArray(restaurants) ? restaurants.filter(Boolean) : [];
    if (docs.length === 0) return [];

    const timingsMap = await getOutletTimingsMapForRestaurants(
        docs.map((doc) => doc._id || doc.id).filter(Boolean),
    );
    const defaultShape = getDefaultOutletTimingsShape();

    return docs.map((doc) => {
        const rid = String(doc._id || doc.id || '');
        return {
            ...doc,
            outletTimings: timingsMap.get(rid) || defaultShape,
        };
    });
}

export async function upsertOutletTimingsForRestaurant(restaurantId, outletTimings) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    if (!outletTimings || typeof outletTimings !== 'object' || Array.isArray(outletTimings)) {
        throw new ValidationError('outletTimings must be an object keyed by day name');
    }

    const timings = DAY_NAMES.map((day) => {
        const src = outletTimings[day] && typeof outletTimings[day] === 'object' ? outletTimings[day] : {};
        const isOpen = src.isOpen !== false;
        return {
            day,
            isOpen,
            openingTime: isOpen ? normalizeTime(src.openingTime, '09:00') : '',
            closingTime: isOpen ? normalizeTime(src.closingTime, '22:00') : ''
        };
    });

    const doc = await FoodRestaurantOutletTimings.findOneAndUpdate(
        { restaurantId },
        { $set: { timings } },
        { upsert: true, new: true, setDefaultsOnInsert: true, projection: 'timings updatedAt' }
    ).lean();

    const savedOutletTimings = toClientShape(doc);

    await FoodRestaurant.updateOne(
        { _id: restaurantId },
        { $set: { 'onboarding.step2.outletTimings': savedOutletTimings } },
    );

    try {
        await invalidateFoodRestaurantMenuCaches();
        await invalidateFoodRestaurantListCaches();
        await invalidateFoodSearchCaches();
        await invalidateFoodLandingCaches();
    } catch (err) {
        logger.warn(`Outlet timings cache invalidation skipped: ${err?.message || err}`);
    }

    return { outletTimings: savedOutletTimings };
}

