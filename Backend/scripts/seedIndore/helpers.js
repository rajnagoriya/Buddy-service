import { uploadFoodImage } from '../../src/modules/food/services/foodImage.service.js';
import { config } from '../../src/config/env.js';
import { DEFAULT_IMAGES, PLACEHOLDER_IMAGE, WEEK_DAYS } from './config.js';

const CLOUDINARY_CONFIGURED = Boolean(
    config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret,
);

/** Skip network probing/uploading entirely (fast local seeds). */
const OFFLINE_IMAGES = process.argv.includes('--offline-images')
    || process.env.SEED_OFFLINE_IMAGES === 'true';

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
    console.log(`MongoDB target database: ${match?.[1] || 'default'}`);
};

const fetchWithTimeout = async (url, init = {}, timeoutMs = 20000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal,
            headers: { 'User-Agent': 'BuddyServiceSeed/1.0', ...(init.headers || {}) },
        });
    } finally {
        clearTimeout(timer);
    }
};

/** Cache probe verdicts so the same URL is only checked once per run. */
const reachabilityCache = new Map();

const isImageReachable = async (url) => {
    if (reachabilityCache.has(url)) return reachabilityCache.get(url);

    let ok = false;
    try {
        // Some CDNs reject HEAD; fall back to a ranged GET before giving up.
        let res = await fetchWithTimeout(url, { method: 'HEAD' }, 15000);
        if (!res.ok || res.status === 405) {
            res = await fetchWithTimeout(url, { method: 'GET', headers: { Range: 'bytes=0-1023' } }, 15000);
        }
        const contentType = res.headers.get('content-type') || '';
        ok = res.ok && contentType.startsWith('image/');
    } catch {
        ok = false;
    }

    reachabilityCache.set(url, ok);
    return ok;
};

const downloadImageBuffer = async (url) => {
    const res = await fetchWithTimeout(url, { method: 'GET' }, 45000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
};

const uploadCache = new Map();

export const imageStats = {
    curatedUsed: 0,
    fallbackUsed: 0,
    uploaded: 0,
};

/**
 * Resolve one image for a seeded document.
 *
 * Order of preference:
 *   1. the curated URL, if it responds with an image
 *   2. the fallback for `tag` (a coarse dish family, e.g. "curry", "pizza")
 *   3. the global placeholder
 *
 * When Cloudinary is configured the winning URL is mirrored into Cloudinary so
 * seeded data behaves exactly like real uploads (publicId present, deletable).
 */
export const resolveImage = async (sourceUrl, folder, { tag = 'category', label = 'image' } = {}) => {
    const curated = String(sourceUrl || '').trim();
    const fallback = DEFAULT_IMAGES[tag] || PLACEHOLDER_IMAGE;

    // Candidates in preference order, deduped: curated → tag default → placeholder.
    const candidates = [...new Set([curated, fallback, PLACEHOLDER_IMAGE].filter(Boolean))];

    let chosen = candidates[0];

    if (!OFFLINE_IMAGES) {
        chosen = '';
        for (const candidate of candidates) {
            if (await isImageReachable(candidate)) {
                chosen = candidate;
                break;
            }
            console.warn(
                candidate === curated
                    ? `  [image] ${label}: curated image unreachable, falling back to "${tag}" default`
                    : `  [image] ${label}: fallback ${candidate} unreachable, trying next`,
            );
        }
        if (!chosen) {
            // Nothing responded — most likely the network, not the URLs. Keep the
            // curated URL so the record still points at the intended content.
            console.warn(`  [image] ${label}: no candidate reachable, keeping ${candidates[0]}`);
            chosen = candidates[0];
        }
    }

    if (chosen === curated && curated) imageStats.curatedUsed += 1;
    else imageStats.fallbackUsed += 1;

    if (OFFLINE_IMAGES || !CLOUDINARY_CONFIGURED) {
        return { url: chosen, publicId: '' };
    }

    const cacheKey = `${folder}::${chosen}`;
    if (uploadCache.has(cacheKey)) return uploadCache.get(cacheKey);

    // A URL can pass the probe and still fail the full download (CDN hiccup,
    // rate limit). Walk the remaining candidates rather than persisting a URL
    // we just failed to fetch.
    const downloadOrder = [chosen, ...candidates.filter((c) => c !== chosen)];
    for (const candidate of downloadOrder) {
        try {
            const buffer = await downloadImageBuffer(candidate);
            const asset = await uploadFoodImage(buffer, folder);
            const result = { url: asset.url || candidate, publicId: asset.publicId || '' };
            uploadCache.set(cacheKey, result);
            imageStats.uploaded += 1;
            return result;
        } catch (err) {
            console.warn(`  [image] ${label}: upload of ${candidate} failed (${err.message})`);
        }
    }

    console.warn(`  [image] ${label}: all uploads failed, keeping source URL`);
    const result = { url: chosen, publicId: '' };
    uploadCache.set(cacheKey, result);
    return result;
};

/**
 * Preflight: every fallback in DEFAULT_IMAGES must itself resolve.
 *
 * A dead default is the worst failure mode here — it silently writes a broken
 * URL onto every item whose curated image is missing, so it is checked up front
 * rather than discovered per-item.
 */
export const verifyDefaultImages = async () => {
    if (OFFLINE_IMAGES) return [];

    const entries = Object.entries(DEFAULT_IMAGES);
    const results = await Promise.all(
        entries.map(async ([tag, url]) => [tag, url, await isImageReachable(url)]),
    );
    const dead = results.filter(([, , ok]) => !ok);

    if (dead.length) {
        console.warn(`\n[image] ${dead.length}/${entries.length} default images are unreachable:`);
        dead.forEach(([tag, url]) => console.warn(`  - ${tag}: ${url}`));
        console.warn('  Fix these in config.js — items falling back to them would get a broken URL.\n');
    } else {
        console.log(`All ${entries.length} default images reachable.`);
    }

    return dead.map(([tag]) => tag);
};

export const resolveImageList = async (urls, folder, { tag = 'category', labelPrefix = 'image' } = {}) => {
    const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const asset = await resolveImage(list[i], folder, { tag, label: `${labelPrefix}-${i + 1}` });
        if (asset.url) out.push(asset);
    }
    return out;
};

/** Array shape stored on the FoodRestaurantOutletTimings document. */
export const buildOutletTimings = ({ openingTime, closingTime, closedDays = [] }) =>
    WEEK_DAYS.map((day) => {
        const isOpen = !closedDays.includes(day);
        return {
            day,
            isOpen,
            openingTime: isOpen ? openingTime : '',
            closingTime: isOpen ? closingTime : '',
        };
    });

/**
 * Day-keyed shape the API hands back to the client.
 *
 * outletTimings.service.js → toClientShape() converts the stored array into
 * `{ Monday: { isOpen, openingTime, closingTime }, ... }`, and that is what
 * saveOnboardingStep() persists into `onboarding.step2.outletTimings`. Mirror
 * it here so the onboarding screens rehydrate from step2 without reshaping.
 */
export const toOutletTimingsMap = (timings = []) =>
    timings.reduce((map, entry) => {
        map[entry.day] = {
            isOpen: entry.isOpen,
            openingTime: entry.isOpen ? entry.openingTime : '',
            closingTime: entry.isOpen ? entry.closingTime : '',
        };
        return map;
    }, {});

export const slugify = (value) =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
