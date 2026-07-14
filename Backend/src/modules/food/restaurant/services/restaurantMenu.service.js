import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { buildPaginationMeta } from '../../../../utils/helpers.js';
import { buildFoodVisibleCategoryFilter, getCategoryApprovalStatus, isCategoryDisabled, isCategoryHiddenFromPublic, isCategoryPubliclyVisible, isCategoryVisibleToEndUser } from '../../shared/categoryWorkflow.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodCategory } from '../../admin/models/category.model.js';
import { getFoodDisplayPrice, serializeFoodVariants } from '../../admin/services/foodVariant.service.js';

const buildMenuFromFoods = async (foods = [], options = {}) => {
    const { hideInactiveCategoryItems = false } = options;
    const categoryIds = Array.from(
        new Set(
            (foods || [])
                .map((food) => {
                    const raw = food?.categoryId;
                    if (!raw) return '';
                    return String(raw);
                })
                .filter((value) => mongoose.Types.ObjectId.isValid(value))
        )
    );

    const categoryDocs = categoryIds.length
        ? await FoodCategory.find({ _id: { $in: categoryIds } })
            .select('name image sortOrder isActive adminDeactivated approvalStatus isApproved')
            .lean()
        : [];
    const categoryMap = new Map(categoryDocs.map((doc) => [String(doc._id), doc]));

    const byCategory = new Map();
    for (const food of foods) {
        const categoryId = food?.categoryId ? String(food.categoryId) : '';
        const categoryDoc = categoryMap.get(categoryId) || null;
        const categoryDisabled = Boolean(categoryId && categoryDoc && isCategoryDisabled(categoryDoc));
        const categoryHiddenFromPublic = Boolean(categoryId && categoryDoc && isCategoryHiddenFromPublic(categoryDoc));

        if (hideInactiveCategoryItems && categoryId && (!categoryDoc || categoryHiddenFromPublic)) {
            continue;
        }

        const sectionName = (categoryDoc?.name || food?.categoryName || food?.category || 'Menu').trim() || 'Menu';
        const groupKey = categoryId || `name:${sectionName.toLowerCase()}`;

        if (!byCategory.has(groupKey)) {
            byCategory.set(groupKey, {
                id: categoryId || null,
                name: sectionName,
                image: categoryDoc?.image || '',
                sortOrder: Number.isFinite(Number(categoryDoc?.sortOrder)) ? Number(categoryDoc.sortOrder) : Number.MAX_SAFE_INTEGER,
                categoryDisabled,
                categoryDisabledByAdmin: categoryDoc?.adminDeactivated === true,
                categoryIsActive: categoryDoc ? isCategoryPubliclyVisible(categoryDoc) : true,
                categoryPendingApproval: categoryDoc ? !isCategoryVisibleToEndUser(categoryDoc) && getCategoryApprovalStatus(categoryDoc) === 'pending' : false,
                items: []
            });
        }

        byCategory.get(groupKey).items.push({
            id: String(food._id),
            _id: food._id,
            categoryId: categoryId || null,
            categoryName: sectionName,
            category: sectionName,
            categoryDisabled,
            categoryDisabledByAdmin: categoryDoc?.adminDeactivated === true,
            categoryIsActive: categoryDoc ? isCategoryPubliclyVisible(categoryDoc) : true,
            name: food.name,
            description: food.description || '',
            price: getFoodDisplayPrice(food),
            variants: serializeFoodVariants(food.variants),
            variations: serializeFoodVariants(food.variants),
            image: food.image || '',
            foodType: food.foodType || 'Non-Veg',
            isAvailable: food.isAvailable !== false,
            approvalStatus: food.approvalStatus || 'approved',
            rejectionReason: food.rejectionReason || '',
            requestedAt: food.requestedAt,
            approvedAt: food.approvedAt,
            rejectedAt: food.rejectedAt,
            preparationTime: food.preparationTime || '',
            createdAt: food.createdAt,
            updatedAt: food.updatedAt
        });
    }

    const orderedGroups = Array.from(byCategory.values()).sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });

    const sections = orderedGroups.map((group, idx) => ({
        id: group.id || `section-${idx}`,
        categoryId: group.id || null,
        name: group.name,
        image: group.image || '',
        sortOrder: Number.isFinite(Number(group.sortOrder)) ? Number(group.sortOrder) : 0,
        categoryDisabled: group.categoryDisabled === true,
        categoryDisabledByAdmin: group.categoryDisabledByAdmin === true,
        categoryIsActive: group.categoryIsActive !== false,
        itemCount: group.items.length,
        items: group.items.sort((a, b) => {
            const at = new Date(a.createdAt || a.requestedAt || 0).getTime();
            const bt = new Date(b.createdAt || b.requestedAt || 0).getTime();
            return bt - at;
        }),
        subsections: []
    }));

    const categories = sections.map((section) => ({
        id: section.categoryId || section.id,
        categoryId: section.categoryId || null,
        name: section.name,
        image: section.image || '',
        sortOrder: section.sortOrder || 0,
        itemCount: section.itemCount || 0,
        categoryDisabled: section.categoryDisabled === true,
        categoryDisabledByAdmin: section.categoryDisabledByAdmin === true,
        categoryIsActive: section.categoryIsActive !== false,
    }));

    return { sections, categories };
};

export async function getRestaurantMenu(restaurantId, query = {}) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }

    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 200);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = { restaurantId };

    if (query.search) {
        const term = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
            { name: { $regex: term, $options: 'i' } },
            { categoryName: { $regex: term, $options: 'i' } }
        ];
    }

    if (query.filter && query.filter !== 'all') {
        if (query.filter === 'in-stock') {
            filter.isAvailable = true;
        } else if (query.filter === 'out-of-stock') {
            filter.isAvailable = false;
        } else if (query.filter === 'veg') {
            filter.foodType = 'Veg';
        } else if (query.filter === 'non-veg') {
            filter.foodType = 'Non-Veg';
        } else if (query.filter === 'recommended') {
            let recIds = [];
            if (query.recommendedIds) {
                try {
                    recIds = Array.isArray(query.recommendedIds)
                        ? query.recommendedIds
                        : String(query.recommendedIds).split(',').filter(Boolean);
                } catch (e) {
                    recIds = [];
                }
            }
            const validRecIds = recIds.filter(id => mongoose.Types.ObjectId.isValid(String(id)));
            filter._id = { $in: validRecIds.map(id => new mongoose.Types.ObjectId(String(id))) };
        }
    }

    const [foods, totalItems] = await Promise.all([
        FoodItem.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodItem.countDocuments(filter)
    ]);

    const menu = await buildMenuFromFoods(foods, { hideInactiveCategoryItems: false });

    return {
        ...menu,
        pagination: buildPaginationMeta({ page, limit, total: totalItems }),
    };
}

export async function updateRestaurantMenu(restaurantId, body = {}) {
    // Option A: single source of truth (food_items). Menu layout snapshots are disabled.
    // Keep endpoint for backward compatibility, but make it explicit.
    throw new ValidationError('Menu editing is disabled. Menu is generated from food items.');
}

export async function getPublicApprovedRestaurantMenu(restaurantIdOrSlug, query = {}) {
    const value = String(restaurantIdOrSlug || '').trim();
    if (!value) throw new ValidationError('Restaurant id is required');

    let restaurant = null;
    if (/^[0-9a-fA-F]{24}$/.test(value)) {
        restaurant = await FoodRestaurant.findOne({ _id: value, status: 'approved' })
            .select('_id status')
            .lean();
    } else {
        const normalized = value.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
        restaurant = await FoodRestaurant.findOne({ restaurantNameNormalized: normalized, status: 'approved' })
            .select('_id status')
            .lean();
    }

    if (!restaurant?._id) {
        return null;
    }

    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 200, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = { restaurantId: restaurant._id, approvalStatus: 'approved' };
    const visibleCategoryFilter = await buildFoodVisibleCategoryFilter();
    if (visibleCategoryFilter) {
        filter.$and = [...(filter.$and || []), visibleCategoryFilter];
    }

    if (query.search) {
        const term = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.name = { $regex: term, $options: 'i' };
    }

    // Get all food items for categories construction to ensure tabs are fully populated
    const allFoodsFilter = { restaurantId: restaurant._id, approvalStatus: 'approved' };
    if (visibleCategoryFilter) {
        allFoodsFilter.$and = [...(allFoodsFilter.$and || []), visibleCategoryFilter];
    }
    const allFoods = await FoodItem.find(allFoodsFilter)
        .select('categoryName sectionName sortOrder categoryId')
        .lean();

    // Group allFoods to build complete categories list
    const categoryMap = new Map();
    for (const food of allFoods) {
        const catName = food.categoryName || food.sectionName || 'Main Course';
        if (!categoryMap.has(catName)) {
            categoryMap.set(catName, {
                name: catName,
                itemCount: 0,
                sortOrder: food.sortOrder || 0
            });
        }
        categoryMap.get(catName).itemCount += 1;
    }

    const categories = Array.from(categoryMap.values())
        .map(cat => ({
            id: cat.name.toLowerCase().replace(/\s+/g, '-'),
            categoryId: cat.name.toLowerCase().replace(/\s+/g, '-'),
            name: cat.name,
            sortOrder: cat.sortOrder,
            itemCount: cat.itemCount
        }))
        .sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
            return a.name.localeCompare(b.name);
        });

    // Query paginated items for sections
    const [foods, totalItems] = await Promise.all([
        FoodItem.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodItem.countDocuments(filter)
    ]);

    const menu = await buildMenuFromFoods(foods, { hideInactiveCategoryItems: true });

    return {
        sections: menu.sections,
        categories,
        pagination: buildPaginationMeta({ page, limit, total: totalItems }),
    };
}

export async function syncMenuItemApprovalStatus(restaurantId, itemId, status, rejectionReason = '') {
    // No-op in Option A (menu snapshots removed). Approval status lives only in food_items.
    // Kept to avoid breaking admin approval flows that call this helper.
    return;
}
