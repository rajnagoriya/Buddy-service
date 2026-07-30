import { logger } from '../../utils/logger.js';
import { creditWallet } from '../../core/payments/wallet.service.js';
import { createPayment, markPaymentSuccess } from '../../core/payments/payment.service.js';
import { initiateRefund } from '../../core/payments/refund.service.js';
import { resolveRiderPayoutAmount } from '../../modules/food/orders/services/order.helpers.js';

/**
 * Post-delivery financial settlement processor.
 * Called by BullMQ when a delivery_completed event fires.
 *
 * Splits the order total into:
 * 1. Restaurant commission credit
 * 2. Delivery partner earning credit (same source as admin: order.riderEarning)
 * 3. Platform profit credit (admin wallet)
 *
 * Also handles refunds on order cancellation.
 *
 * @param {import('bullmq').Job} job
 */
export const processPaymentJob = async (job) => {
    const { action, orderMongoId, orderId } = job.data || {};
    logger.info(`[PaymentProcessor] Processing ${action} for order ${orderId || orderMongoId} (job ${job.id})`);

    try {
        switch (action) {
            case 'delivery_completed':
                await handleDeliveryCompleted(job.data);
                break;

            case 'order_cancelled':
                await handleOrderCancelled(job.data);
                break;

            case 'payment_verified':
                await handlePaymentVerified(job.data);
                break;

            default:
                logger.info(`[PaymentProcessor] No handler for action: ${action}`);
        }
    } catch (err) {
        logger.error(`[PaymentProcessor] Error processing ${action}: ${err.message}`);
        throw err; // Let BullMQ retry
    }

    return { processed: true, action, jobId: job.id };
};

/**
 * Load frozen settlement amounts from the order (single source of truth with admin).
 */
async function loadOrderSettlement(data = {}) {
    const orderMongoId = data.orderMongoId || data.orderId;
    if (!orderMongoId) return null;

    const { FoodOrder } = await import('../../modules/food/orders/models/order.model.js');
    const mongoose = await import('mongoose');
    const identity = mongoose.default.Types.ObjectId.isValid(String(orderMongoId))
        ? { _id: new mongoose.default.Types.ObjectId(String(orderMongoId)) }
        : { $or: [{ order_id: String(orderMongoId) }, { orderId: String(orderMongoId) }] };

    return FoodOrder.findOne(identity)
        .select(
            'order_id orderId restaurantId isMultiRestaurant pickups dispatch riderEarning sharedRiderEarning platformProfit pricing settlementBreakdown restaurantSettlement payment',
        )
        .lean();
}

/**
 * After delivery is completed and payment is confirmed:
 * Split money using frozen order fields (same amounts admin revenue uses).
 */
async function handleDeliveryCompleted(data) {
    const order = await loadOrderSettlement(data);

    const orderMongoId = order?._id?.toString?.() || data.orderMongoId;
    const orderId = order?.order_id || order?.orderId || data.orderId;
    const restaurantId =
        order?.restaurantId?._id?.toString?.() ||
        order?.restaurantId?.toString?.() ||
        data.restaurantId;
    const deliveryPartnerId =
        order?.dispatch?.deliveryPartnerId?._id?.toString?.() ||
        order?.dispatch?.deliveryPartnerId?.toString?.() ||
        data.deliveryPartnerId;
    const sharedPartnerId =
        order?.dispatch?.sharedPartnerId?._id?.toString?.() ||
        order?.dispatch?.sharedPartnerId?.toString?.() ||
        null;

    const primaryRiderEarning = order
        ? resolveRiderPayoutAmount(order)
        : Math.max(0, Number(data.riderEarning) || 0);
    const sharedRiderEarning = Math.max(0, Number(order?.sharedRiderEarning) || 0);
    const platformProfit = Math.max(
        0,
        Number(
            order?.platformProfit ??
            order?.settlementBreakdown?.platform?.netProfit ??
            data.platformProfit,
        ) || 0,
    );

    const settlements = Array.isArray(order?.restaurantSettlement) ? order.restaurantSettlement : [];
    const isMultiRestaurant =
        settlements.length > 1 ||
        Boolean(order?.isMultiRestaurant) ||
        (Array.isArray(order?.pickups) && order.pickups.length > 1);
    const commissionAmount = settlements.length
        ? settlements.reduce((sum, s) => sum + (Number(s.restaurantPayout) || 0), 0)
        : Math.max(0, Number(data.commissionAmount) || 0);

    const paymentMethod = order?.payment?.method || data.paymentMethod || data.payMethod;

    // 1. Credit restaurant wallet(s) — always prefer per-restaurant settlement rows.
    if (settlements.length > 0) {
        for (const s of settlements) {
            const rid = s.restaurantId?._id?.toString?.() || s.restaurantId?.toString?.();
            const payout = Number(s.restaurantPayout) || 0;
            if (!rid || payout <= 0) continue;
            try {
                await creditWallet({
                    entityType: 'restaurant',
                    entityId: rid,
                    amount: payout,
                    description: `Order ${orderId} - restaurant payout`,
                    category: 'commission',
                    orderId: orderMongoId,
                    metadata: { orderId, paymentMethod, restaurantId: rid },
                });
                logger.info(`[PaymentProcessor] Restaurant ${rid} credited ${payout} for order ${orderId}`);
            } catch (err) {
                logger.error(`[PaymentProcessor] Failed to credit restaurant ${rid}: ${err.message}`);
            }
        }
    } else if (isMultiRestaurant) {
        // Never dump the full multi-resto payout onto the primary restaurant.
        logger.error(
            `[PaymentProcessor] Multi-restaurant order ${orderId} missing restaurantSettlement; skipping restaurant wallet credits`,
        );
    } else if (restaurantId && commissionAmount > 0) {
        try {
            await creditWallet({
                entityType: 'restaurant',
                entityId: restaurantId,
                amount: commissionAmount,
                description: `Order ${orderId} - restaurant commission`,
                category: 'commission',
                orderId: orderMongoId,
                metadata: { orderId, paymentMethod }
            });
            logger.info(`[PaymentProcessor] Restaurant ${restaurantId} credited ${commissionAmount} for order ${orderId}`);
        } catch (err) {
            logger.error(`[PaymentProcessor] Failed to credit restaurant: ${err.message}`);
        }
    }

    // 2. Credit delivery partner(s) — same amount as admin (order.riderEarning)
    const partnerCredits = [
        { id: deliveryPartnerId, amount: primaryRiderEarning, role: 'primary' },
        { id: sharedPartnerId, amount: sharedRiderEarning, role: 'shared' },
    ].filter((p) => p.id && p.amount > 0);

    for (const partner of partnerCredits) {
        try {
            await creditWallet({
                entityType: 'deliveryBoy',
                entityId: partner.id,
                amount: partner.amount,
                description: `Order ${orderId} - delivery earning (${partner.role})`,
                category: 'delivery_earning',
                orderId: orderMongoId,
                metadata: { orderId, paymentMethod, role: partner.role }
            });

            const { FoodDeliveryWallet } = await import('../../modules/food/delivery/models/deliveryWallet.model.js');
            const mongoose = await import('mongoose');
            await FoodDeliveryWallet.updateOne(
                { deliveryPartnerId: new mongoose.default.Types.ObjectId(partner.id) },
                { $inc: { totalDeliveries: 1, totalEarnings: partner.amount } }
            );

            logger.info(`[PaymentProcessor] Delivery partner ${partner.id} credited ${partner.amount} for order ${orderId}`);
        } catch (err) {
            logger.error(`[PaymentProcessor] Failed to credit delivery partner ${partner.id}: ${err.message}`);
        }
    }

    // 3. Credit admin/platform wallet with platform profit
    if (platformProfit > 0) {
        try {
            await creditWallet({
                entityType: 'admin',
                entityId: 'platform',
                amount: platformProfit,
                description: `Order ${orderId} - platform profit`,
                category: 'platform_fee',
                orderId: orderMongoId,
                metadata: {
                    orderId,
                    paymentMethod,
                    riderEarning: primaryRiderEarning,
                    sharedRiderEarning,
                }
            });
            logger.info(`[PaymentProcessor] Platform credited ${platformProfit} for order ${orderId}`);
        } catch (err) {
            logger.error(`[PaymentProcessor] Failed to credit platform: ${err.message}`);
        }
    }
}

/**
 * Handle order cancellation — trigger refund if payment was made.
 */
async function handleOrderCancelled(data) {
    const { orderMongoId, paymentId, paymentMethod, paymentStatus, userId, amount, reason } = data;

    if (!paymentId || paymentStatus !== 'success') {
        logger.info(`[PaymentProcessor] No refund needed for order ${orderMongoId} (status: ${paymentStatus})`);
        return;
    }

    try {
        await initiateRefund({
            paymentId,
            orderId: orderMongoId,
            userId,
            amount,
            reason: reason || 'Order cancelled',
            refundTo: paymentMethod === 'wallet' ? 'wallet' : 'wallet' // Default to wallet refund
        });
        logger.info(`[PaymentProcessor] Refund initiated for order ${orderMongoId}`);
    } catch (err) {
        logger.error(`[PaymentProcessor] Refund failed for order ${orderMongoId}: ${err.message}`);
    }
}

/**
 * Handle payment verified — create a Payment record in the new system.
 */
async function handlePaymentVerified(data) {
    const { orderMongoId, orderId, userId, paymentMethod, paymentStatus, amount, gatewayPaymentId } = data;

    try {
        const payment = await createPayment({
            orderId: orderMongoId,
            userId,
            amount,
            method: paymentMethod,
            gateway: paymentMethod === 'razorpay' ? 'razorpay' : 'none',
            gatewayOrderId: data.razorpayOrderId || '',
            metadata: { orderId, source: 'payment_verified_event' }
        });

        if (paymentStatus === 'paid' && gatewayPaymentId) {
            await markPaymentSuccess(payment._id, { gatewayPaymentId });
        }

        logger.info(`[PaymentProcessor] Payment record created for order ${orderId}: ${payment._id}`);
    } catch (err) {
        logger.error(`[PaymentProcessor] Failed to create payment record: ${err.message}`);
    }
}
