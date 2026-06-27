import express from 'express';
import { searchController, listAdminCategoriesController } from '../controllers/search.controller.js';
import { cacheResponse } from '../../../../middleware/cache.js';

const router = express.Router();

/**
 * Unified Search Endpoint
 * GET /api/v1/food/search/unified
 */
router.get('/unified', cacheResponse(90, 'food_search'), searchController);

/**
 * Admin Categories Only Endpoint (to avoid restaurant-created ones as requested)
 * GET /api/v1/food/search/categories/admin
 */
router.get('/categories/admin', cacheResponse(600, 'food_search_categories'), listAdminCategoriesController);

export default router;
