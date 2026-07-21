import { FoodDiningBanner } from '../../landing/models/diningBanner.model.js';
import * as diningService from '../services/dining.service.js';

export async function getPublicDiningCategories(req, res, next) {
    try {
        const categories = await diningService.listDiningCategoriesPublic();
        res.status(200).json({ success: true, message: 'Dining categories fetched successfully', data: categories });
    } catch (error) {
        next(error);
    }
}

export async function getPublicDiningRestaurants(req, res, next) {
    try {
        const result = await diningService.listDiningRestaurantsPublic(req.query || {});
        res.status(200).json({
            success: true,
            message: 'Dining restaurants fetched successfully',
            data: {
                restaurants: result.restaurants,
                pagination: result.pagination,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Dining explore home payload.
 * - page=1: banners + categories + restaurants + pagination
 * - page>1: restaurants + pagination only (cheaper for infinite scroll)
 * Query: page, limit, city, lat, lng, zoneId, category
 */
export async function getPublicDiningHome(req, res, next) {
    try {
        const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
        const includeExtras = page <= 1;

        const restaurantsPromise = diningService.listDiningRestaurantsPublic(req.query || {});

        const [bannerDocs, categories, restaurantResult] = await Promise.all([
            includeExtras
                ? FoodDiningBanner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean()
                : Promise.resolve([]),
            includeExtras
                ? diningService.listDiningCategoriesPublic()
                : Promise.resolve([]),
            restaurantsPromise,
        ]);

        res.status(200).json({
            success: true,
            message: 'Dining home fetched successfully',
            data: {
                banners: bannerDocs || [],
                categories: categories || [],
                restaurants: restaurantResult.restaurants || [],
                pagination: restaurantResult.pagination,
            },
        });
    } catch (error) {
        next(error);
    }
}
