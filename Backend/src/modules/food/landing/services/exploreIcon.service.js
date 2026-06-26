import { FoodExploreIcon } from '../models/exploreIcon.model.js';
import {
    deleteFoodImageAsset,
    replaceCloudinaryImage,
    uploadFoodImage,
} from '../../services/foodImage.service.js';

const CLOUDINARY_FOLDER = 'food/explore-icons';

export const listExploreIcons = async () => {
    return FoodExploreIcon.find()
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();
};

const getNextSortOrder = async () => {
    const last = await FoodExploreIcon.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    return (last?.sortOrder ?? -1) + 1;
};

export const createExploreIcon = async (file, meta) => {
    if (!file?.buffer) {
        throw new Error('Image file is required');
    }
    const label = (meta?.label || '').trim();
    if (!label) {
        throw new Error('Label is required');
    }

    const asset = await uploadFoodImage(file, CLOUDINARY_FOLDER);
    const sortOrder = await getNextSortOrder();

    const doc = await FoodExploreIcon.create({
        label,
        iconUrl: asset.url,
        publicId: asset.publicId,
        linkType: 'custom',
        targetPath: (meta?.link || '').trim() || undefined,
        sortOrder,
        isActive: true,
    });

    return doc.toObject();
};

export const updateExploreIcon = async (id, payload) => {
    const doc = await FoodExploreIcon.findById(id);
    if (!doc) {
        return null;
    }

    const updates = {};

    if (payload?.file?.buffer) {
        const asset = await replaceCloudinaryImage({
            buffer: payload.file.buffer,
            folder: CLOUDINARY_FOLDER,
            oldPublicId: doc.publicId,
            oldUrl: doc.iconUrl,
            mimeType: payload.file.mimetype,
        });
        updates.iconUrl = asset.url;
        updates.publicId = asset.publicId;
    }

    if (payload?.label !== undefined) {
        updates.label = String(payload.label).trim();
    }
    if (payload?.link !== undefined) {
        updates.targetPath = String(payload.link).trim() || undefined;
    }

    if (Object.keys(updates).length === 0) {
        return doc.toObject();
    }

    const updated = await FoodExploreIcon.findByIdAndUpdate(id, updates, { new: true }).lean();
    return updated;
};

export const deleteExploreIcon = async (id) => {
    const doc = await FoodExploreIcon.findById(id);
    if (!doc) {
        return { deleted: false };
    }
    await deleteFoodImageAsset({ publicId: doc.publicId, url: doc.iconUrl });
    await doc.deleteOne();
    return { deleted: true };
};

export const toggleExploreIconStatus = async (id) => {
    const doc = await FoodExploreIcon.findById(id);
    if (!doc) return null;
    const isActive = !doc.isActive;
    const updated = await FoodExploreIcon.findByIdAndUpdate(id, { isActive }, { new: true }).lean();
    return updated;
};

export const updateExploreIconOrder = async (id, order) => {
    const num = Number(order);
    if (Number.isNaN(num)) return null;
    const updated = await FoodExploreIcon.findByIdAndUpdate(id, { sortOrder: num }, { new: true }).lean();
    return updated;
};
