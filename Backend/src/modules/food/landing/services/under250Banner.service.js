import { FoodUnder250Banner } from '../models/under250Banner.model.js';
import {
    deleteFoodImageAsset,
    uploadFoodImage,
} from '../../services/foodImage.service.js';

export const listUnder250Banners = async () => {
    return FoodUnder250Banner.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
};

export const createUnder250BannersFromFiles = async (files, meta = {}) => {
    if (!files || !files.length) {
        return [];
    }

    const results = [];

    for (const file of files) {
        try {
            const asset = await uploadFoodImage(file, 'food/under-250-banners');

            const banner = await FoodUnder250Banner.create({
                imageUrl: asset.url,
                publicId: asset.publicId,
                title: meta.title,
                ctaText: meta.ctaText,
                ctaLink: meta.ctaLink,
                sortOrder: meta.sortOrder ?? 0,
                isActive: true,
            });

            results.push({ success: true, banner: banner.toObject() });
        } catch (error) {
            results.push({ success: false, error: error.message });
        }
    }

    return results;
};

export const deleteUnder250Banner = async (id) => {
    const doc = await FoodUnder250Banner.findById(id);
    if (!doc) {
        return { deleted: false };
    }

    await deleteFoodImageAsset({ publicId: doc.publicId, url: doc.imageUrl });
    await doc.deleteOne();
    return { deleted: true };
};

export const updateUnder250BannerOrder = async (id, sortOrder) => {
    const updated = await FoodUnder250Banner.findByIdAndUpdate(
        id,
        { sortOrder },
        { new: true }
    ).lean();
    return updated;
};

export const toggleUnder250BannerStatus = async (id, isActive) => {
    const updated = await FoodUnder250Banner.findByIdAndUpdate(
        id,
        { isActive },
        { new: true }
    ).lean();
    return updated;
};
