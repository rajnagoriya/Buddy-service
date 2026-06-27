import { invalidateCache } from '../../../middleware/cache.js';
import { logger } from '../../../utils/logger.js';

async function invalidatePatterns(patterns) {
    await Promise.all(patterns.map((pattern) => invalidateCache(pattern)));
}

/** Restaurant list + detail cards shown on home/search. */
export async function invalidateFoodRestaurantListCaches() {
    await invalidatePatterns(['restaurants:*', 'restaurant_detail:*']);
}

/** Menu, add-ons, outlet timings for a restaurant. */
export async function invalidateFoodRestaurantMenuCaches() {
    await invalidatePatterns([
        'restaurant_menu:*',
        'restaurant_addons:*',
        'restaurant_timings:*',
    ]);
}

/** Unified search + admin search categories + public categories. */
export async function invalidateFoodSearchCaches() {
    await invalidatePatterns([
        'food_search:*',
        'food_search_categories:*',
        'categories:*',
    ]);
}

export async function invalidateFoodOffersCaches() {
    await invalidateCache('offers:*');
}

export async function invalidateFoodLandingCaches() {
    await invalidateCache('food_landing:*');
}

export async function invalidateFoodZoneCaches() {
    await invalidateCache('food_zones:*');
}

export async function invalidateFoodDiningCaches() {
    await invalidateCache('food_dining:*');
}

/** Restaurant profile / images / availability changes. */
export async function invalidateAfterRestaurantProfileUpdate() {
    await invalidateFoodRestaurantListCaches();
    await invalidateFoodSearchCaches();
}

/** Menu, foods, add-ons changed by restaurant dashboard. */
export async function invalidateAfterRestaurantMenuMutation() {
    await invalidateFoodRestaurantMenuCaches();
    await invalidateFoodRestaurantListCaches();
    await invalidateFoodSearchCaches();
}

/** Restaurant-owned category CRUD. */
export async function invalidateAfterRestaurantCategoryMutation() {
    await invalidateAfterRestaurantMenuMutation();
}

/** Admin changed restaurant approval, location, menu, etc. */
export async function invalidateAfterAdminRestaurantMutation() {
    await invalidateFoodRestaurantListCaches();
    await invalidateFoodRestaurantMenuCaches();
    await invalidateFoodSearchCaches();
    await invalidateFoodOffersCaches();
}

export async function invalidateAfterAdminCategoryMutation() {
    await invalidateFoodSearchCaches();
}

export async function invalidateAfterAdminFoodMutation() {
    await invalidateFoodRestaurantMenuCaches();
    await invalidateFoodSearchCaches();
    await invalidateFoodRestaurantListCaches();
}

export async function invalidateAfterAdminAddonMutation() {
    await invalidateFoodRestaurantMenuCaches();
    await invalidateFoodSearchCaches();
}

export async function invalidateAfterOfferMutation() {
    await invalidateFoodOffersCaches();
    await invalidateFoodRestaurantListCaches();
}

export async function invalidateAfterLandingMutation() {
    await invalidateFoodLandingCaches();
}

export async function invalidateAfterLandingSettingsMutation() {
    await invalidateFoodLandingCaches();
}

export async function invalidateAfterZoneMutation() {
    await invalidateFoodZoneCaches();
    await invalidateFoodRestaurantListCaches();
    await invalidateFoodSearchCaches();
}

export async function invalidateAfterDiningAdminMutation() {
    await invalidateFoodDiningCaches();
    await invalidateFoodLandingCaches();
}

/**
 * Express middleware: run invalidation before the handler (existing app pattern).
 * @param {() => Promise<void>} invalidatorFn
 */
export function withFoodCacheInvalidation(invalidatorFn) {
    return async (req, res, next) => {
        try {
            await invalidatorFn();
        } catch (err) {
            logger.warn(`Food cache invalidation skipped: ${err?.message || err}`);
        }
        next();
    };
}
