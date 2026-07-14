import mongoose from 'mongoose';
import { FoodDeliveryPartner } from '../../modules/food/delivery/models/deliveryPartner.model.js';
import { FoodOrder } from '../../modules/food/orders/models/order.model.js';
import { logger } from '../../utils/logger.js';
import { connectDB } from '../../config/db.js';
import { getRedisClient } from '../../config/redis.js';

let isDBConnected = false;

const ensureDB = async () => {
    if (isDBConnected) return;
    await connectDB();
    isDBConnected = true;
};

/**
 * Syncs the latest location from "HOT" Redis storage to "COLD" MongoDB storage.
 */
export const processTrackingJob = async (job) => {
    await ensureDB();
    const { name, data } = job;

    if (name === 'sync-hot-locations') {
        return await handleHotSync(data);
    }
    return null;
};

const handleHotSync = async ({ userId, orderId }) => {
    const redis = getRedisClient();
    if (!redis) {
        // Redis went down between job scheduling and execution (job was
        // already enqueued while Redis was up). The hot-hash data this job
        // depends on is unreachable either way, so there's nothing to sync -
        // but log it instead of silently no-op-ing, since a run of these
        // means MongoDB location persistence has a gap.
        logger.warn(`Skipping hot-location sync for order ${orderId} - Redis unavailable`);
        return;
    }

    try {
        // Fetch the absolute latest location for both rider and order from Redis
        const [riderRaw, orderRaw] = await Promise.all([
            redis.hGet('rider:locations:hot', String(userId)),
            redis.hGet('order:locations:hot', String(orderId))
        ]);

        const riderData = riderRaw ? JSON.parse(riderRaw) : null;
        const orderData = orderRaw ? JSON.parse(orderRaw) : null;

        const updates = [];

        if (riderData && userId) {
            const point = { type: 'Point', coordinates: [riderData.lng, riderData.lat] };
            updates.push(
                FoodDeliveryPartner.findByIdAndUpdate(userId, {
                    $set: {
                        currentLocation: { ...point, latitude: riderData.lat, longitude: riderData.lng },
                        lastLocationAt: new Date(riderData.timestamp || Date.now()),
                        // Deprecated mirrors, kept until Phase 5 removes these fields.
                        lastLocation: point,
                        lastLat: riderData.lat,
                        lastLng: riderData.lng,
                    }
                })
            );
        }

        if (orderData && orderId) {
            const rawOrderId = String(orderId).trim();
            const orderIdentityFilter = mongoose.isValidObjectId(rawOrderId)
                ? { _id: new mongoose.Types.ObjectId(rawOrderId) }
                : { $or: [{ order_id: rawOrderId }, { orderId: rawOrderId }] };
            updates.push(
                FoodOrder.findOneAndUpdate(orderIdentityFilter, {
                    $set: {
                        lastRiderLocation: {
                            type: 'Point',
                            coordinates: [orderData.lng, orderData.lat]
                        }
                    }
                })
            );
        }

        if (updates.length > 0) {
            await Promise.all(updates);
            logger.info(`Synced hot location to MongoDB for Order ${orderId} / Rider ${userId}`);
        }
    } catch (err) {
        logger.error(`Failed to handle hot sync for ${orderId}: ${err.message}`);
        throw err;
    }
};
