import mongoose from 'mongoose';
import { ConflictError, ValidationError } from '../../../../core/auth/errors.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodCategory } from '../../admin/models/category.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import {
    deleteFoodImageAsset,
    uploadFoodImage,
} from '../../services/foodImage.service.js';
import {
    extractRawFoodVariants,
    getFoodDisplayPrice,
    hasFoodVariants,
    normalizeFoodVariantsInput
} from '../../admin/services/foodVariant.service.js';
import {
    ACTIVE_PUBLIC_CATEGORY_FILTER,
    backfillLegacyCategoryWorkflow,
    categoryAllowsFoodType,
    GLOBAL_CATEGORY_FILTER
} from '../../shared/categoryWorkflow.js';

const toStr = (v) => (v != null ? String(v).trim() : '');

const TERMINAL_ORDER_STATUSES = [
    'delivered',
    'cancelled_by_user',
    'cancelled_by_restaurant',
    'cancelled_by_admin',
    'rejected_by_restaurant',
];

const formatBlockingOrderStatus = (status) => {
    const normalized = String(status || '').toLowerCase();
    const labels = {
        created: 'pending',
        scheduled: 'scheduled',
        confirmed: 'confirmed',
        preparing: 'in progress',
        ready_for_pickup: 'ready for pickup',
        reached_pickup: 'rider at pickup',
        picked_up: 'out for delivery',
        reached_drop: 'rider at drop',
    };
    return labels[normalized] || normalized.replace(/_/g, ' ');
};

const findActiveOrdersForFoodItem = async (restaurantId, foodId) => {
    const foodIdStr = String(foodId);
    const restaurantObjectId = new mongoose.Types.ObjectId(String(restaurantId));

    return FoodOrder.find({
        orderStatus: { $nin: TERMINAL_ORDER_STATUSES },
        'items.itemId': foodIdStr,
        $or: [
            { restaurantId: restaurantObjectId },
            { 'items.restaurantId': restaurantObjectId },
        ],
    })
        .select('order_id orderId orderStatus')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
};
const APPROVED_CATEGORY_FILTER = [
    { approvalStatus: 'approved' },
    { approvalStatus: { $exists: false }, isApproved: { $ne: false } }
];

const CLOUDINARY_HOST_RE = /res\.cloudinary\.com/i;
const MAX_BULK_ITEMS = 500;
const BULK_CONCURRENCY = 5;
const IMAGE_UPLOAD_FOLDER = 'food/items';

const isCloudinaryUrl = (value) => CLOUDINARY_HOST_RE.test(String(value || ''));

const shouldUploadImageUrl = (value) => {
    const url = toStr(value);
    if (!url) return false;
    if (isCloudinaryUrl(url)) return false;
    if (/^data:/i.test(url) || /^blob:/i.test(url)) return false;
    return /^https?:\/\//i.test(url);
};

const downloadImageBuffer = async (url) => {
    if (typeof fetch !== 'function') {
        throw new Error('Image download is not supported in this runtime');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Failed to download image (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } finally {
        clearTimeout(timeoutId);
    }
};

const ensureCloudinaryImageAsset = async (value) => {
    const url = toStr(value);
    if (!url) return { url: '', publicId: '' };
    if (!shouldUploadImageUrl(url)) {
        return { url, publicId: '' };
    }
    const buffer = await downloadImageBuffer(url);
    return uploadFoodImage(buffer, IMAGE_UPLOAD_FOLDER);
};

const asyncPool = async (limit, items, iterator) => {
    const results = [];
    const executing = new Set();

    for (let i = 0; i < items.length; i++) {
        const p = Promise.resolve().then(() => iterator(items[i], i));
        results.push(p);
        executing.add(p);

        const cleanup = () => executing.delete(p);
        p.then(cleanup).catch(cleanup);

        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }

    return Promise.all(results);
};

const normalizeFoodType = (v) => {
    const t = String(v || '').trim();
    if (!t) return 'Non-Veg';
    if (t === 'Veg') return 'Veg';
    if (t === 'Non-Veg') return 'Non-Veg';
    if (t === 'Egg') return 'Non-Veg';
    return 'Non-Veg';
};

const getCreateFoodPricing = (body = {}) => {
    const variants = normalizeFoodVariantsInput(extractRawFoodVariants(body));
    if (variants.length > 0) {
        return {
            price: getFoodDisplayPrice({ variants }),
            variants
        };
    }

    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) throw new ValidationError('Price is invalid');
    return {
        price,
        variants: []
    };
};

const getUpdatedFoodPricing = (existing = {}, body = {}) => {
    const variantsTouched = body.variants !== undefined || body.variations !== undefined;
    const existingHasVariants = hasFoodVariants(existing);
    const update = {};

    if (variantsTouched) {
        const variants = normalizeFoodVariantsInput(extractRawFoodVariants(body));
        update.variants = variants;

        if (variants.length > 0) {
            update.price = getFoodDisplayPrice({ variants });
            return update;
        }

        const nextBasePrice = body.price !== undefined ? Number(body.price) : Number(existingHasVariants ? NaN : existing.price);
        if (!Number.isFinite(nextBasePrice) || nextBasePrice < 0) {
            throw new ValidationError('Base price is required when variants are removed');
        }
        update.price = nextBasePrice;
        return update;
    }

    if (body.price !== undefined) {
        if (existingHasVariants) {
            throw new ValidationError('Update variants instead of base price for foods with variants');
        }
        const price = Number(body.price);
        if (!Number.isFinite(price) || price < 0) throw new ValidationError('Price is invalid');
        update.price = price;
    }

    return update;
};

const getRestaurantContext = async (restaurantId) => {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }

    const restaurant = await FoodRestaurant.findById(restaurantId)
        .select('pureVegRestaurant')
        .lean();
    if (!restaurant?._id) {
        throw new ValidationError('Restaurant not found');
    }

    return {
        restaurantId: new mongoose.Types.ObjectId(String(restaurantId)),
        pureVegRestaurant: restaurant.pureVegRestaurant === true
    };
};

const getAccessibleCategoryFilter = (context) => ({
    $or: [
        { restaurantId: context.restaurantId, $or: APPROVED_CATEGORY_FILTER },
        {
            $and: [
                { $or: GLOBAL_CATEGORY_FILTER },
                { $or: APPROVED_CATEGORY_FILTER }
            ]
        }
    ]
});

const resolveCategoryForRestaurant = async (context, body = {}) => {
    const categoryIdRaw = toStr(body.categoryId);
    const categoryNameRaw = toStr(body.categoryName);
    const foodType = normalizeFoodType(body.foodType);

    if (!categoryIdRaw && !categoryNameRaw) {
        return { categoryObjectId: undefined, categoryName: '' };
    }

    const baseFilter = {
        ...getAccessibleCategoryFilter(context),
        ...ACTIVE_PUBLIC_CATEGORY_FILTER
    };
    if (context.pureVegRestaurant) {
        baseFilter.foodTypeScope = 'Veg';
    }

    let category = null;
    if (categoryIdRaw) {
        if (!mongoose.Types.ObjectId.isValid(categoryIdRaw)) {
            throw new ValidationError('Invalid category id');
        }

        category = await FoodCategory.findOne({
            _id: new mongoose.Types.ObjectId(categoryIdRaw),
            ...baseFilter
        }).lean();
    } else {
        const exact = `^${String(categoryNameRaw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
        const matches = await FoodCategory.find({
            ...baseFilter,
            name: { $regex: exact, $options: 'i' }
        })
            .sort({ createdAt: -1 })
            .limit(2)
            .lean();
        if (matches.length > 1) {
            throw new ValidationError('Multiple categories share this name. Please choose a specific category.');
        }
        category = matches[0] || null;
    }

    if (!category?._id) {
        throw new ValidationError('Category not found for this restaurant');
    }

    await backfillLegacyCategoryWorkflow([category]);

    if (String(category.approvalStatus || '') !== 'approved') {
        throw new ValidationError('This category is awaiting admin approval');
    }
    if (context.pureVegRestaurant && String(category.foodTypeScope || '') !== 'Veg') {
        throw new ValidationError('Pure veg restaurants can only use veg categories');
    }
    if (!categoryAllowsFoodType(category.foodTypeScope, foodType)) {
        throw new ValidationError(`This ${category.foodTypeScope} category cannot accept ${foodType} food`);
    }

    return {
        categoryObjectId: category._id,
        categoryName: category.name || '',
        category
    };
};

export async function createRestaurantFood(restaurantId, body = {}) {
    const context = await getRestaurantContext(restaurantId);

    const name = toStr(body.name);
    if (!name) throw new ValidationError('Item name is required');
    if (name.length > 200) throw new ValidationError('Item name is too long');

    const { price, variants } = getCreateFoodPricing(body);

    const description = toStr(body.description);
    const imageInput = toStr(body.image);
    const imageAsset = imageInput ? await ensureCloudinaryImageAsset(imageInput) : { url: '', publicId: '' };
    const isAvailable = body.isAvailable !== false;
    const foodType = normalizeFoodType(body.foodType);
    const preparationTime = toStr(body.preparationTime);
    const { categoryObjectId, categoryName } = await resolveCategoryForRestaurant(context, { ...body, foodType });

    const doc = await FoodItem.create({
        restaurantId,
        categoryId: categoryObjectId,
        categoryName: categoryName || '',
        name,
        description,
        price,
        variants,
        image: imageAsset.url,
        imagePublicId: imageAsset.publicId,
        foodType,
        isAvailable,
        preparationTime,
        approvalStatus: 'pending',
        requestedAt: new Date()
    });

    try {
        const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
        void notifyAdminsSafely({
            title: 'New Product Approval Request ðŸ”',
            body: `Restaurant has submitted a new item "${doc.name}" for approval.`,
            data: {
                type: 'approval_request',
                subType: 'food',
                id: String(doc._id)
            }
        });
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to notify admins of new food approval request:', e);
    }

    return doc.toObject();
}

export async function updateRestaurantFood(restaurantId, foodId, body = {}) {
    const context = await getRestaurantContext(restaurantId);
    if (!foodId || !mongoose.Types.ObjectId.isValid(String(foodId))) {
        throw new ValidationError('Invalid food id');
    }

    const existing = await FoodItem.findOne({ _id: foodId, restaurantId }).lean();
    if (!existing) return null;

    const update = {};

    if (body.name !== undefined) {
        const name = toStr(body.name);
        if (!name) throw new ValidationError('Item name is required');
        if (name.length > 200) throw new ValidationError('Item name is too long');
        update.name = name;
    }
    if (body.description !== undefined) update.description = toStr(body.description);
    if (body.image !== undefined) {
        const nextImage = toStr(body.image);
        if (nextImage !== existing.image) {
            const imageAsset = nextImage
                ? await ensureCloudinaryImageAsset(nextImage)
                : { url: '', publicId: '' };
            update.image = imageAsset.url;
            update.imagePublicId = imageAsset.publicId;
            if (existing.image || existing.imagePublicId) {
                await deleteFoodImageAsset({
                    publicId: existing.imagePublicId,
                    url: existing.image,
                });
            }
        }
    }
    Object.assign(update, getUpdatedFoodPricing(existing, body));
    if (body.isAvailable !== undefined) update.isAvailable = body.isAvailable !== false;
    if (body.preparationTime !== undefined) update.preparationTime = toStr(body.preparationTime);

    const targetFoodType = body.foodType !== undefined ? normalizeFoodType(body.foodType) : normalizeFoodType(existing.foodType);
    if (body.foodType !== undefined) update.foodType = targetFoodType;

    if (
        body.categoryId !== undefined ||
        body.categoryName !== undefined ||
        body.foodType !== undefined
    ) {
        const { categoryObjectId, categoryName } = await resolveCategoryForRestaurant(context, {
            categoryId: body.categoryId !== undefined ? body.categoryId : existing.categoryId,
            categoryName: body.categoryName !== undefined ? body.categoryName : existing.categoryName,
            foodType: targetFoodType
        });
        update.categoryId = categoryObjectId;
        update.categoryName = categoryName || '';
    }

    const requiresReapproval = (
        body.name !== undefined ||
        body.description !== undefined ||
        body.image !== undefined ||
        body.variants !== undefined ||
        body.variations !== undefined ||
        body.price !== undefined ||
        body.foodType !== undefined ||
        body.categoryId !== undefined ||
        body.categoryName !== undefined ||
        body.preparationTime !== undefined
    );

    if (requiresReapproval) {
        update.approvalStatus = 'pending';
        update.requestedAt = new Date();
        update.rejectionReason = '';
        update.approvedAt = null;
        update.rejectedAt = null;
    }

    if (Object.keys(update).length === 0) {
        return existing;
    }

    const updated = await FoodItem.findOneAndUpdate(
        { _id: foodId, restaurantId },
        { $set: update },
        { new: true }
    ).lean();

    if (updated && requiresReapproval) {
        try {
            const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
            void notifyAdminsSafely({
                title: 'Updated Product Approval Request',
                body: `Restaurant has updated and resubmitted "${updated.name}" for approval.`,
                data: {
                    type: 'approval_request',
                    subType: 'food',
                    id: String(updated._id)
                }
            });
        } catch (e) {
            console.error('Failed to notify admins of resubmitted food approval request:', e);
        }
    }

    return updated;
}

export async function deleteRestaurantFood(restaurantId, foodId) {
    const context = await getRestaurantContext(restaurantId);
    if (!foodId || !mongoose.Types.ObjectId.isValid(String(foodId))) {
        throw new ValidationError('Invalid food id');
    }

    const existing = await FoodItem.findOne({
        _id: foodId,
        restaurantId: context.restaurantId,
    }).lean();
    if (!existing?._id) return null;

    const activeOrders = await findActiveOrdersForFoodItem(context.restaurantId, foodId);
    if (activeOrders.length > 0) {
        const first = activeOrders[0];
        const orderRef = first.order_id || first.orderId || String(first._id || '');
        const statusLabel = formatBlockingOrderStatus(first.orderStatus);
        const extraCount = activeOrders.length > 1 ? ` (+${activeOrders.length - 1} more active order${activeOrders.length > 2 ? 's' : ''})` : '';
        throw new ConflictError(
            `Cannot delete this dish because it is part of an active order (#${orderRef}) that is ${statusLabel}${extraCount}. Wait until the order is delivered or cancelled.`
        );
    }

    await deleteFoodImageAsset({
        publicId: existing.imagePublicId,
        url: existing.image,
    });
    await FoodItem.findOneAndDelete({ _id: foodId, restaurantId: context.restaurantId });
    return { id: String(foodId) };
}

export async function bulkCreateFood(restaurantId, items = []) {
    const context = await getRestaurantContext(restaurantId);
    const results = {
        successCount: 0,
        errorCount: 0,
        errors: [],
        items: []
    };

    if (!Array.isArray(items) || items.length === 0) {
        throw new ValidationError('No items provided for bulk upload');
    }

    // Limit bulk size to prevent timeout
    if (items.length > MAX_BULK_ITEMS) {
        throw new ValidationError(`Bulk upload limit is ${MAX_BULK_ITEMS} items per request`);
    }

    const processedItems = [];

    await asyncPool(BULK_CONCURRENCY, items, async (item, index) => {
        try {
            const name = toStr(item.name);
            if (!name) throw new Error('Item name is required');

            const foodType = normalizeFoodType(item.foodType);
            const { categoryObjectId, categoryName } = await resolveCategoryForRestaurant(context, {
                categoryId: item.categoryId,
                categoryName: item.categoryName,
                foodType
            });

            const { price: finalPrice, variants: finalVariants } = getCreateFoodPricing(item);
            const imageAsset = await ensureCloudinaryImageAsset(
                item.image || item.imageUrl || item.photoUrl || item.photo
            );

            processedItems.push({
                restaurantId,
                categoryId: categoryObjectId,
                categoryName: categoryName || '',
                name,
                description: toStr(item.description),
                price: finalPrice,
                variants: finalVariants,
                image: imageAsset.url,
                imagePublicId: imageAsset.publicId,
                foodType,
                isAvailable: item.isAvailable !== false,
                preparationTime: toStr(item.preparationTime),
                approvalStatus: 'pending',
                requestedAt: new Date()
            });

            results.successCount++;
        } catch (err) {
            results.errorCount++;
            results.errors.push({
                index,
                name: item?.name || 'Unknown',
                message: err.message
            });
        }
    });

    if (processedItems.length > 0) {
        const docs = await FoodItem.insertMany(processedItems);
        results.items = docs;

        // Notify admins about the bulk request
        try {
            const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
            void notifyAdminsSafely({
                title: 'Bulk Product Approval Request 🚀',
                body: `Restaurant has uploaded ${processedItems.length} new items for approval.`,
                data: {
                    type: 'approval_request',
                    subType: 'food_bulk',
                    restaurantId: String(restaurantId)
                }
            });
        } catch (e) {
            console.error('Failed to notify admins of bulk food upload:', e);
        }
    }

    return results;
}
