import { uploadFoodImage } from '../../src/modules/food/services/foodImage.service.js';
import { config } from '../../src/config/env.js';

const CLOUDINARY_CONFIGURED = Boolean(
    config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret,
);

const PHONE_BASE = '98100000';

export const SEED_PHONE_START = 20;
export const SEED_RESTAURANT_COUNT = 15;

export const buildOwnerPhone = (index) => {
    const suffix = String(SEED_PHONE_START + index).padStart(2, '0');
    return `${PHONE_BASE}${suffix}`;
};

export const buildSeedPhoneFilter = () => {
    const phones = Array.from({ length: SEED_RESTAURANT_COUNT }, (_, i) => buildOwnerPhone(i));
    const last10s = phones.map((p) => p.slice(-10));
    return {
        $or: [
            { ownerPhone: { $in: phones } },
            { ownerPhoneLast10: { $in: last10s } },
            { ownerPhoneDigits: { $in: phones } },
        ],
    };
};

const downloadImageBuffer = async (url) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'BuddyServiceSeed/1.0' },
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } finally {
        clearTimeout(timeoutId);
    }
};

const uploadCache = new Map();

export const resolveImageUrl = async (sourceUrl, folder, { label = 'image' } = {}) => {
    const url = String(sourceUrl || '').trim();
    if (!url) return { url: '', publicId: '' };

    const cacheKey = `${folder}::${url}`;
    if (uploadCache.has(cacheKey)) return uploadCache.get(cacheKey);

    if (!CLOUDINARY_CONFIGURED) {
        const fallback = { url, publicId: '' };
        uploadCache.set(cacheKey, fallback);
        return fallback;
    }

    try {
        const buffer = await downloadImageBuffer(url);
        const asset = await uploadFoodImage(buffer, folder);
        const result = { url: asset.url || url, publicId: asset.publicId || '' };
        uploadCache.set(cacheKey, result);
        return result;
    } catch (err) {
        console.warn(`[seed] ${label} upload failed, using source URL: ${err.message}`);
        const fallback = { url, publicId: '' };
        uploadCache.set(cacheKey, fallback);
        return fallback;
    }
};

export const resolveImageList = async (urls, folder, { labelPrefix = 'image' } = {}) => {
    const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
    const results = [];
    for (let i = 0; i < list.length; i++) {
        const asset = await resolveImageUrl(list[i], folder, { label: `${labelPrefix}-${i + 1}` });
        if (asset.url) results.push(asset);
    }
    return results;
};

export const defaultOutletTimings = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days.map((day) => ({
        day,
        isOpen: true,
        openingTime: '10:00',
        closingTime: '23:00',
    }));
};

export const pickCount = (min, max, seed) => min + (seed % (max - min + 1));

export const getMongoUri = () => {
    const raw = process.env.SEED_MONGODB_URI
        || process.env.MONGODB_URI
        || process.env.MONGO_URI
        || '';
    const trimmed = String(raw).trim().replace(/^["']|["']$/g, '');
    const match = trimmed.match(/mongodb(\+srv)?:\/\/[^\s"']+/i);
    return match ? match[0] : trimmed;
};

export const logMongoTarget = (uri) => {
    const match = String(uri).match(/\/([^/?]+)(\?|$)/);
    const dbName = match?.[1] || 'default';
    console.log(`MongoDB target database: ${dbName}`);
};
