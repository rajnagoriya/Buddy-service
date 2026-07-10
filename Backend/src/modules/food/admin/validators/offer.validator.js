import { z } from 'zod';
import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';

const createOfferSchema = z.object({
    couponCode: z.string().min(1, 'Coupon code is required'),
    discountType: z.enum(['percentage', 'flat-price']).default('percentage'),
    discountValue: z.number().positive('Discount value must be greater than 0'),
    customerScope: z.enum(['all', 'first-time']).default('all'),
    restaurantScope: z.enum(['all', 'selected']).default('all'),
    restaurantId: z.string().optional(),
    endDate: z.string().optional().or(z.literal('')).or(z.undefined()),
    startDate: z.string().optional().or(z.literal('')).or(z.undefined()),
    minOrderValue: z.number().min(0).optional(),
    maxDiscount: z.number().min(0).optional(),
    usageLimit: z.number().min(0).optional(),
    perUserLimit: z.number().min(0).optional(),
    isFirstOrderOnly: z.boolean().optional(),
    couponCategory: z.enum(['normal', 'free_delivery']).optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    banner: z.string().optional(),
    terms: z.string().optional(),
});

const updateOfferSchema = createOfferSchema.extend({
    status: z.enum(['active', 'paused', 'inactive']).optional(),
});

function parseOfferDates(result, { requireFutureEndDate = true } = {}) {
    const endDate = result.data.endDate ? new Date(`${result.data.endDate}T00:00:00.000Z`) : undefined;
    if (endDate && Number.isNaN(endDate.getTime())) {
        throw new ValidationError('Invalid endDate');
    }
    const startDate = result.data.startDate ? new Date(`${result.data.startDate}T00:00:00.000Z`) : undefined;
    if (startDate && Number.isNaN(startDate.getTime())) {
        throw new ValidationError('Invalid startDate');
    }
    if (endDate && startDate && endDate.getTime() <= startDate.getTime()) {
        throw new ValidationError('endDate must be after startDate');
    }
    if (requireFutureEndDate && endDate && endDate.getTime() <= Date.now()) {
        throw new ValidationError('endDate must be a future date');
    }

    let maxDiscount = result.data.maxDiscount;
    if (result.data.discountType === 'percentage') {
        if (maxDiscount === undefined || maxDiscount === null || Number.isNaN(Number(maxDiscount))) {
            throw new ValidationError('maxDiscount is required for percentage coupons');
        }
        maxDiscount = Math.max(0, Number(maxDiscount) || 0);
    } else {
        maxDiscount = undefined;
    }

    return { endDate, startDate, maxDiscount };
}

export const validateCreateOfferDto = (body) => {
    const isFreeDelivery = body?.couponCategory === 'free_delivery';
    const normalized = {
        ...body,
        couponCode: typeof body?.couponCode === 'string' ? body.couponCode.trim() : body?.couponCode,
        discountType: isFreeDelivery ? 'flat-price' : body?.discountType,
        discountValue: isFreeDelivery ? 1 : Number(body?.discountValue),
        customerScope: body?.customerScope,
        restaurantScope: body?.restaurantScope,
        restaurantId: body?.restaurantId ? String(body.restaurantId) : undefined,
        endDate: body?.endDate ? String(body.endDate) : undefined,
        startDate: body?.startDate ? String(body.startDate) : undefined,
        minOrderValue: body?.minOrderValue !== undefined ? Number(body.minOrderValue) : undefined,
        maxDiscount: body?.maxDiscount !== undefined ? Number(body.maxDiscount) : undefined,
        usageLimit: body?.usageLimit !== undefined ? Number(body.usageLimit) : undefined,
        perUserLimit: body?.perUserLimit !== undefined ? Number(body.perUserLimit) : undefined,
        isFirstOrderOnly: body?.isFirstOrderOnly !== undefined ? Boolean(body.isFirstOrderOnly) : undefined,
        couponCategory: body?.couponCategory || 'normal',
        name: body?.name ? String(body.name) : undefined,
        description: body?.description ? String(body.description) : undefined,
        banner: body?.banner ? String(body.banner) : undefined,
        terms: body?.terms ? String(body.terms) : undefined,
    };

    const result = createOfferSchema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }

    if (result.data.restaurantScope === 'selected') {
        if (!result.data.restaurantId || !mongoose.Types.ObjectId.isValid(result.data.restaurantId)) {
            throw new ValidationError('Valid restaurantId is required for selected restaurant scope');
        }
    }

    const endDate = result.data.endDate ? new Date(`${result.data.endDate}T00:00:00.000Z`) : undefined;
    if (endDate && Number.isNaN(endDate.getTime())) {
        throw new ValidationError('Invalid endDate');
    }
    const startDate = result.data.startDate ? new Date(`${result.data.startDate}T00:00:00.000Z`) : undefined;
    if (startDate && Number.isNaN(startDate.getTime())) {
        throw new ValidationError('Invalid startDate');
    }
    if (endDate && startDate && endDate.getTime() <= startDate.getTime()) {
        throw new ValidationError('endDate must be after startDate');
    }
    if (endDate && endDate.getTime() <= Date.now()) {
        throw new ValidationError('endDate must be a future date');
    }
    // Business rule: percentage coupon must have maxDiscount; flat ignores it
    let maxDiscount = result.data.maxDiscount;
    if (result.data.discountType === 'percentage') {
        if (maxDiscount === undefined || maxDiscount === null || Number.isNaN(Number(maxDiscount))) {
            throw new ValidationError('maxDiscount is required for percentage coupons');
        }
        maxDiscount = Math.max(0, Number(maxDiscount) || 0);
    } else {
        maxDiscount = undefined; // ignore for flat-price
    }

    if (result.data.couponCategory === 'free_delivery' && result.data.discountType !== 'flat-price') {
        // free delivery uses flat-price with 0 value
    }

    return {
        couponCode: result.data.couponCode.trim().toUpperCase(),
        discountType: result.data.couponCategory === 'free_delivery' ? 'flat-price' : result.data.discountType,
        discountValue: result.data.couponCategory === 'free_delivery' ? 0 : result.data.discountValue,
        customerScope: result.data.customerScope,
        restaurantScope: result.data.restaurantScope,
        restaurantId: result.data.restaurantScope === 'selected' ? result.data.restaurantId : undefined,
        endDate,
        startDate,
        minOrderValue: result.data.minOrderValue,
        maxDiscount: result.data.couponCategory === 'free_delivery' ? undefined : maxDiscount,
        usageLimit: result.data.usageLimit,
        perUserLimit: result.data.perUserLimit,
        isFirstOrderOnly: result.data.isFirstOrderOnly,
        couponCategory: result.data.couponCategory || 'normal',
        name: result.data.name,
        description: result.data.description,
        banner: result.data.banner,
        terms: result.data.terms,
    };
};

const cartVisibilitySchema = z.object({
    itemId: z.string().min(1, 'itemId is required'),
    showInCart: z.boolean()
});

export const validateUpdateOfferCartVisibilityDto = (body) => {
    const result = cartVisibilitySchema.safeParse(body || {});
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

export const validateRestaurantCreateOfferDto = (body) => {
    const normalized = {
        ...body,
        couponCode: typeof body?.couponCode === 'string' ? body.couponCode.trim() : body?.couponCode,
        discountType: body?.discountType,
        discountValue: Number(body?.discountValue),
        customerScope: body?.customerScope,
        restaurantScope: 'all',
        endDate: body?.endDate ? String(body.endDate) : undefined,
        startDate: body?.startDate ? String(body.startDate) : undefined,
        minOrderValue: body?.minOrderValue !== undefined ? Number(body.minOrderValue) : undefined,
        maxDiscount: body?.maxDiscount !== undefined ? Number(body.maxDiscount) : undefined,
        usageLimit: body?.usageLimit !== undefined ? Number(body.usageLimit) : undefined,
        perUserLimit: body?.perUserLimit !== undefined ? Number(body.perUserLimit) : undefined,
        isFirstOrderOnly: body?.isFirstOrderOnly !== undefined ? Boolean(body.isFirstOrderOnly) : undefined,
    };

    const result = createOfferSchema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }

    const endDate = result.data.endDate ? new Date(`${result.data.endDate}T00:00:00.000Z`) : undefined;
    if (endDate && Number.isNaN(endDate.getTime())) {
        throw new ValidationError('Invalid endDate');
    }
    const startDate = result.data.startDate ? new Date(`${result.data.startDate}T00:00:00.000Z`) : undefined;
    if (startDate && Number.isNaN(startDate.getTime())) {
        throw new ValidationError('Invalid startDate');
    }
    if (endDate && startDate && endDate.getTime() <= startDate.getTime()) {
        throw new ValidationError('endDate must be after startDate');
    }
    if (endDate && endDate.getTime() <= Date.now()) {
        throw new ValidationError('endDate must be a future date');
    }

    let maxDiscount = result.data.maxDiscount;
    if (result.data.discountType === 'percentage') {
        if (maxDiscount === undefined || maxDiscount === null || Number.isNaN(Number(maxDiscount))) {
            throw new ValidationError('maxDiscount is required for percentage coupons');
        }
        maxDiscount = Math.max(0, Number(maxDiscount) || 0);
    } else {
        maxDiscount = undefined;
    }

    return {
        couponCode: result.data.couponCode.trim().toUpperCase(),
        discountType: result.data.discountType,
        discountValue: result.data.discountValue,
        customerScope: result.data.customerScope,
        endDate,
        startDate,
        minOrderValue: result.data.minOrderValue,
        maxDiscount,
        usageLimit: result.data.usageLimit,
        perUserLimit: result.data.perUserLimit,
        isFirstOrderOnly: result.data.isFirstOrderOnly,
    };
};

export const validateUpdateOfferDto = (body) => {
    if (body && body.status && !body.couponCode) {
        const statusResult = z.object({ status: z.enum(['active', 'paused', 'inactive']) }).safeParse({ status: body.status });
        if (!statusResult.success) {
            throw new ValidationError(statusResult.error.errors[0].message);
        }
        return { status: statusResult.data.status };
    }

    const normalized = {
        ...body,
        couponCode: typeof body?.couponCode === 'string' ? body.couponCode.trim() : body?.couponCode,
        discountType: body?.discountType,
        discountValue: Number(body?.discountValue),
        customerScope: body?.customerScope,
        restaurantScope: body?.restaurantScope,
        restaurantId: body?.restaurantId ? String(body.restaurantId) : undefined,
        endDate: body?.endDate ? String(body.endDate) : undefined,
        startDate: body?.startDate ? String(body.startDate) : undefined,
        minOrderValue: body?.minOrderValue !== undefined ? Number(body.minOrderValue) : undefined,
        maxDiscount: body?.maxDiscount !== undefined ? Number(body.maxDiscount) : undefined,
        usageLimit: body?.usageLimit !== undefined ? Number(body.usageLimit) : undefined,
        perUserLimit: body?.perUserLimit !== undefined ? Number(body.perUserLimit) : undefined,
        isFirstOrderOnly: body?.isFirstOrderOnly !== undefined ? Boolean(body.isFirstOrderOnly) : undefined,
        status: body?.status,
        couponCategory: body?.couponCategory,
        name: body?.name ? String(body.name) : undefined,
        description: body?.description ? String(body.description) : undefined,
        banner: body?.banner ? String(body.banner) : undefined,
        terms: body?.terms ? String(body.terms) : undefined,
    };

    const result = updateOfferSchema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }

    if (result.data.restaurantScope === 'selected') {
        if (!result.data.restaurantId || !mongoose.Types.ObjectId.isValid(result.data.restaurantId)) {
            throw new ValidationError('Valid restaurantId is required for selected restaurant scope');
        }
    }

    const { endDate, startDate, maxDiscount } = parseOfferDates(result, { requireFutureEndDate: false });

    return {
        couponCode: result.data.couponCode.trim().toUpperCase(),
        discountType: result.data.discountType,
        discountValue: result.data.discountValue,
        customerScope: result.data.customerScope,
        restaurantScope: result.data.restaurantScope,
        restaurantId: result.data.restaurantScope === 'selected' ? result.data.restaurantId : undefined,
        endDate,
        startDate,
        minOrderValue: result.data.minOrderValue,
        maxDiscount,
        usageLimit: result.data.usageLimit,
        perUserLimit: result.data.perUserLimit,
        isFirstOrderOnly: result.data.isFirstOrderOnly,
        status: result.data.status,
        couponCategory: result.data.couponCategory,
        name: result.data.name,
        description: result.data.description,
        banner: result.data.banner,
        terms: result.data.terms,
    };
};

export const validateRestaurantUpdateOfferDto = (body) => {
    if (body && body.status && !body.couponCode) {
        const statusResult = z.object({ status: z.enum(['active', 'paused', 'inactive']) }).safeParse({ status: body.status });
        if (!statusResult.success) {
            throw new ValidationError(statusResult.error.errors[0].message);
        }
        return { status: statusResult.data.status };
    }

    const normalized = {
        ...body,
        couponCode: typeof body?.couponCode === 'string' ? body.couponCode.trim() : body?.couponCode,
        discountType: body?.discountType,
        discountValue: Number(body?.discountValue),
        customerScope: body?.customerScope,
        restaurantScope: 'all',
        endDate: body?.endDate ? String(body.endDate) : undefined,
        startDate: body?.startDate ? String(body.startDate) : undefined,
        minOrderValue: body?.minOrderValue !== undefined ? Number(body.minOrderValue) : undefined,
        maxDiscount: body?.maxDiscount !== undefined ? Number(body.maxDiscount) : undefined,
        usageLimit: body?.usageLimit !== undefined ? Number(body.usageLimit) : undefined,
        perUserLimit: body?.perUserLimit !== undefined ? Number(body.perUserLimit) : undefined,
        isFirstOrderOnly: body?.isFirstOrderOnly !== undefined ? Boolean(body.isFirstOrderOnly) : undefined,
        status: body?.status,
    };

    const result = updateOfferSchema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }

    const { endDate, startDate, maxDiscount } = parseOfferDates(result, { requireFutureEndDate: false });

    return {
        couponCode: result.data.couponCode.trim().toUpperCase(),
        discountType: result.data.discountType,
        discountValue: result.data.discountValue,
        customerScope: result.data.customerScope,
        endDate,
        startDate,
        minOrderValue: result.data.minOrderValue,
        maxDiscount,
        usageLimit: result.data.usageLimit,
        perUserLimit: result.data.perUserLimit,
        isFirstOrderOnly: result.data.isFirstOrderOnly,
        status: result.data.status,
    };
};
