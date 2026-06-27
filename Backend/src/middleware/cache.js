import { getRedisClient } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

const MEMORY_CACHE_MAX = Number(process.env.MEMORY_CACHE_MAX_ENTRIES || 500);
const memoryStore = new Map();

function patternToRegex(pattern) {
    const escaped = String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
}

function pruneMemoryStore() {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
        if (!entry || entry.expiresAt <= now) {
            memoryStore.delete(key);
        }
    }
    if (memoryStore.size <= MEMORY_CACHE_MAX) return;
    const overflow = memoryStore.size - MEMORY_CACHE_MAX;
    const keys = memoryStore.keys();
    for (let i = 0; i < overflow; i += 1) {
        const next = keys.next();
        if (next.done) break;
        memoryStore.delete(next.value);
    }
}

async function getMemoryCached(key) {
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        memoryStore.delete(key);
        return null;
    }
    return entry.body;
}

function setMemoryCached(key, body, ttlInSeconds) {
    pruneMemoryStore();
    memoryStore.set(key, {
        body,
        expiresAt: Date.now() + ttlInSeconds * 1000,
    });
}

function invalidateMemoryByPattern(pattern) {
    const regex = patternToRegex(pattern);
    let count = 0;
    for (const key of memoryStore.keys()) {
        if (regex.test(key)) {
            memoryStore.delete(key);
            count += 1;
        }
    }
    return count;
}

async function scanDeleteRedisKeys(redis, pattern) {
    let cursor = 0;
    let deleted = 0;
    do {
        const reply = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = Number(reply.cursor);
        const keys = reply.keys || [];
        if (keys.length > 0) {
            await redis.del(keys);
            deleted += keys.length;
        }
    } while (cursor !== 0);
    return deleted;
}

/**
 * Higher-order function to create a caching middleware.
 * Uses Redis when enabled; falls back to in-process memory cache otherwise.
 * @param {number} ttlInSeconds - Time to live for the cache in seconds.
 * @param {string} prefix - Optional key prefix for Redis (e.g. 'restaurants').
 * @returns {import('express').RequestHandler}
 */
export const cacheResponse = (ttlInSeconds = 300, prefix = 'api_cache') => {
    return async (req, res, next) => {
        if (req.method !== 'GET') return next();

        const key = `${prefix}:${req.method}:${req.originalUrl || req.url}`;
        const redis = config.redisEnabled ? getRedisClient() : null;
        const redisReady = Boolean(redis?.isReady);

        try {
            if (redisReady) {
                const cachedData = await redis.get(key);
                if (cachedData) {
                    res.setHeader('X-Cache', 'HIT');
                    return res.json(JSON.parse(cachedData));
                }
            } else {
                const cachedBody = await getMemoryCached(key);
                if (cachedBody) {
                    res.setHeader('X-Cache', 'HIT');
                    return res.json(cachedBody);
                }
            }

            const originalJson = res.json.bind(res);
            res.json = (body) => {
                if (res.statusCode < 400) {
                    res.setHeader('X-Cache', 'MISS');
                    if (redisReady) {
                        redis.set(key, JSON.stringify(body), { EX: ttlInSeconds })
                            .catch((err) => logger.error(`Redis caching failed for ${key}: ${err.message}`));
                    } else {
                        setMemoryCached(key, body, ttlInSeconds);
                    }
                }
                return originalJson(body);
            };

            next();
        } catch (err) {
            logger.warn(`Cache middleware error: ${err.message}`);
            next();
        }
    };
};

/**
 * Clear cache by pattern (e.g. 'restaurants:*')
 * @param {string} pattern - Redis glob pattern for keys to delete.
 */
export const invalidateCache = async (pattern) => {
    const memoryDeleted = invalidateMemoryByPattern(pattern);

    if (!config.redisEnabled) {
        if (memoryDeleted > 0) {
            logger.info(`Invalidated ${memoryDeleted} in-memory cache keys matching: ${pattern}`);
        }
        return;
    }

    const redis = getRedisClient();
    if (!redis || !redis.isReady) {
        if (memoryDeleted > 0) {
            logger.info(`Invalidated ${memoryDeleted} in-memory cache keys matching: ${pattern}`);
        }
        return;
    }

    try {
        const redisDeleted = await scanDeleteRedisKeys(redis, pattern);
        const total = memoryDeleted + redisDeleted;
        if (total > 0) {
            logger.info(`Invalidated ${total} cache keys matching: ${pattern}`);
        }
    } catch (err) {
        logger.error(`Cache invalidation error: ${err.message}`);
    }
};
