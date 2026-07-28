import mongoose from 'mongoose';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodTransaction } from '../../orders/models/foodTransaction.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodRestaurantWithdrawal } from '../models/foodRestaurantWithdrawal.model.js';
import { getBalance } from '../../../../core/payments/transaction.service.js';
import { buildPaginationMeta, buildPaginationOptions } from '../../../../utils/helpers.js';

/**
 * Statuses considered "delivered" / order completed — only these orders
 * should generate a restaurant wallet credit.
 */
const DELIVERED_STATUSES = ['delivered'];

function toTwoDigitYearString(dateObj) {
    const y = String(dateObj.getFullYear());
    return y.slice(-2);
}

function monthShort(monthIndex) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIndex] || 'Jan';
}

function getFixedCurrentCycleWindow(now = new Date()) {
    const startDay = 15;

    let year = now.getFullYear();
    let month = now.getMonth();

    // If before start day, settlement belongs to previous month cycle.
    if (now.getDate() < startDay) {
        month = month - 1;
        if (month < 0) {
            month = 11;
            year -= 1;
        }
    }

    const start = new Date(year, month, startDay, 0, 0, 0, 0);
    // End should be either fixed 21 or now, let's make it more inclusive for "Current Cycle"
    // Users want to see their active earnings, so we extend it to 'now'
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return {
        start,
        end,
        startMeta: { day: String(startDay), month: monthShort(month), year: toTwoDigitYearString(new Date(year, month, startDay)) },
        endMeta: { day: String(now.getDate()), month: monthShort(now.getMonth()), year: toTwoDigitYearString(now) }
    };
}

function parseISODateParam(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
}

function parseISODateParamEnd(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(23, 59, 59, 999);
    return d;
}

function restaurantInvolvedFilter(rid) {
    return {
        $or: [
            { restaurantId: rid },
            { 'restaurantSettlement.restaurantId': rid },
            { 'pickups.restaurantId': rid },
        ],
    };
}

function resolveRestaurantPayoutFromOrder(order, rid) {
    const ridStr = String(rid);
    const settlements = Array.isArray(order?.restaurantSettlement)
        ? order.restaurantSettlement
        : [];
    const settlement = settlements.find(
        (s) => String(s?.restaurantId?._id || s?.restaurantId || '') === ridStr,
    );
    if (settlement) {
        return {
            payout: Math.max(0, Number(settlement.restaurantPayout) || 0),
            commission: Math.max(0, Number(settlement.commission) || 0),
            foodAmount: Math.max(0, Number(settlement.foodAmount) || 0),
        };
    }
    return null;
}

function filterItemsForRestaurant(items, rid) {
    const ridStr = String(rid);
    const list = Array.isArray(items) ? items : [];
    const scoped = list.filter(
        (it) => !it?.restaurantId || String(it.restaurantId) === ridStr,
    );
    return scoped.length ? scoped : list;
}

export async function getRestaurantFinance(restaurantId, query = {}) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) return null;
    const rid = new mongoose.Types.ObjectId(restaurantId);

    // Fetch restaurant profile for header display.
    const restaurant = await FoodRestaurant.findById(rid)
        .select('restaurantName addressLine1 addressLine2 area city state pincode location')
        .lean();

    const address =
        restaurant?.location?.formattedAddress ||
        (restaurant?.addressLine1
            ? [restaurant.addressLine1, restaurant.addressLine2, restaurant.area].filter(Boolean).join(', ')
            : restaurant?.addressLine1 || '');

    const nowWindow = getFixedCurrentCycleWindow(new Date());

    // Wallet balance: full ledger (not limited to settlement cycle window).
    // The actual wallet balance is credited only after order delivery (delivery_completed event).
    const ledger = await getBalance('restaurant', String(rid));

    // Include multi-restaurant orders where this resto is in settlement/pickups,
    // not only when it is the primary order.restaurantId.
    const deliveredOrders = await FoodOrder.find({
        ...restaurantInvolvedFilter(rid),
        orderStatus: { $in: DELIVERED_STATUSES },
    })
        .select('_id orderId order_id createdAt items pricing deliveryState orderStatus restaurantSettlement payment restaurantId')
        .lean();

    const deliveredOrderIds = deliveredOrders.map((d) => d._id);
    const orderById = new Map(deliveredOrders.map((d) => [String(d._id), d]));

    // Prefer per-restaurant FoodTransaction rows when present (new multi-resto).
    const currentTransactions = await FoodTransaction.find({
        restaurantId: rid,
        orderId: { $in: deliveredOrderIds },
        status: { $in: ['captured', 'authorized'] },
        'settlement.isRestaurantSettled': { $ne: true },
    })
        .sort({ createdAt: -1 })
        .lean();

    const txByOrderId = new Map(
        currentTransactions.map((tx) => [String(tx.orderId), tx]),
    );

    // Build earnings list from delivered orders so legacy multi-resto orders
    // (single primary FoodTransaction with summed share) still attribute correctly.
    const mapOrderToRestaurantRow = (order) => {
        const fromSettlement = resolveRestaurantPayoutFromOrder(order, rid);
        const tx = txByOrderId.get(String(order._id));
        const items = filterItemsForRestaurant(order.items, rid);
        const foodNames = items.map((it) => it?.name).filter(Boolean).join(', ');
        const orderTotalExclTax = Math.max(
            0,
            Number(order?.pricing?.total ?? 0) - Number(order?.pricing?.tax ?? 0) || 0,
        );
        const payout = fromSettlement
            ? fromSettlement.payout
            : Math.max(0, Number(tx?.amounts?.restaurantShare) || 0);
        const commission = fromSettlement
            ? fromSettlement.commission
            : Math.max(0, Number(tx?.amounts?.restaurantCommission) || 0);
        const foodAmount = fromSettlement?.foodAmount;
        return {
            orderId: order?.orderId || order?.order_id || tx?.orderReadableId,
            mongoId: order?._id?.toString?.() || '',
            createdAt: order.createdAt || tx?.createdAt,
            items,
            foodNames,
            orderTotal: foodAmount != null ? foodAmount : orderTotalExclTax,
            totalAmount: Math.max(
                0,
                Number(tx?.amounts?.totalCustomerPaid) ||
                    Number(order?.pricing?.total) ||
                    0,
            ),
            payout,
            commission,
            paymentMethod: tx?.paymentMethod || order?.payment?.method,
            orderStatus:
                order?.orderStatus ||
                order?.deliveryState?.currentPhase ||
                order?.deliveryState?.status,
            status: tx?.status || 'captured',
        };
    };

    // Only include this restaurant if it still has a settlement row / was not dropped
    // (or is primary with no settlement array for legacy single-resto).
    const eligibleOrders = deliveredOrders.filter((order) => {
        const settlements = Array.isArray(order.restaurantSettlement)
            ? order.restaurantSettlement
            : [];
        if (settlements.length === 0) {
            return String(order.restaurantId) === String(rid);
        }
        return settlements.some(
            (s) => String(s?.restaurantId?._id || s?.restaurantId || '') === String(rid),
        );
    });

    const currentCycleOrders = eligibleOrders
        .map(mapOrderToRestaurantRow)
        .filter((row) => (Number(row.payout) || 0) > 0 || txByOrderId.has(row.mongoId))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const globalEstimatedPayout = currentCycleOrders.reduce(
        (sum, row) => sum + (Number(row.payout) || 0),
        0,
    );

    // Deduct all effective withdrawals from available balance.
    // Both pending and approved reduce withdrawable amount; rejected should not.
    const effectiveWithdrawalsAgg = await FoodRestaurantWithdrawal.aggregate([
        {
            $match: {
                restaurantId: rid,
                $expr: {
                    $in: [
                        { $toLower: { $trim: { input: '$status' } } },
                        ['pending', 'approved']
                    ]
                }
            }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalEffectiveWithdrawals = Number(effectiveWithdrawalsAgg?.[0]?.total || 0);
    const ledgerAvailable = Math.max(
        0,
        (Number(ledger.availableBalance) || 0) - totalEffectiveWithdrawals
    );
    const transactionAvailable = Math.max(0, globalEstimatedPayout - totalEffectiveWithdrawals);
    const availableBalance = Math.max(ledgerAvailable, transactionAvailable);

    const currentCycle = {
        start: { ...nowWindow.startMeta },
        end: { ...nowWindow.endMeta },
        totalEarnings: availableBalance,
        totalWithdrawn: totalEffectiveWithdrawals,
        estimatedPayout: availableBalance,
        totalOrders: currentCycleOrders.length,
        payoutDate: null,
        orders: currentCycleOrders
    };

    // Invoice Summary (derived from current cycle or broader if needed)
    const invoiceSummary = {
        count: currentCycleOrders.length,
        subtotal: currentCycleOrders.reduce((sum, o) => sum + (Number(o.orderTotal) || 0), 0),
        taxes: currentCycleOrders.reduce((sum, o) => sum + Math.max(0, (Number(o.totalAmount) || 0) - (Number(o.orderTotal) || 0)), 0),
        gross: currentCycleOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
    };

    // Past cycles: build from provided startDate/endDate query (paginated).
    const startDate = parseISODateParam(query.startDate);
    const endDate = parseISODateParamEnd(query.endDate);
    const { page, limit, skip } = buildPaginationOptions(query, {
        defaultLimit: 10,
        maxLimit: 50,
    });

    let pastCyclesResult = {
        orders: [],
        totalOrders: 0,
        pagination: buildPaginationMeta({ page, limit, total: 0 }),
    };
    if (startDate && endDate) {
        const pastOrders = await FoodOrder.find({
            ...restaurantInvolvedFilter(rid),
            orderStatus: { $in: DELIVERED_STATUSES },
            createdAt: { $gte: startDate, $lte: endDate },
        })
            .select('_id orderId order_id createdAt items pricing deliveryState orderStatus restaurantSettlement payment restaurantId')
            .sort({ createdAt: -1 })
            .lean();

        const pastEligible = pastOrders.filter((order) => {
            const settlements = Array.isArray(order.restaurantSettlement)
                ? order.restaurantSettlement
                : [];
            if (settlements.length === 0) {
                return String(order.restaurantId) === String(rid);
            }
            return settlements.some(
                (s) => String(s?.restaurantId?._id || s?.restaurantId || '') === String(rid),
            );
        });

        const pastTotal = pastEligible.length;
        const pastSlice = pastEligible.slice(skip, skip + limit);
        const pastOrderIds = pastSlice.map((o) => o._id);
        const pastTxs = await FoodTransaction.find({
            restaurantId: rid,
            orderId: { $in: pastOrderIds },
            status: { $in: ['captured', 'authorized'] },
        }).lean();
        for (const tx of pastTxs) {
            txByOrderId.set(String(tx.orderId), tx);
        }

        pastCyclesResult = {
            orders: pastSlice.map(mapOrderToRestaurantRow),
            totalOrders: pastTotal,
            pagination: buildPaginationMeta({ page, limit, total: pastTotal }),
        };
    }

    return {
        restaurant: {
            name: restaurant?.restaurantName || '',
            restaurantId: restaurant?._id ? `REST${restaurant._id.toString().slice(-6).padStart(6, '0')}` : 'N/A',
            address
        },
        wallet: {
            balance: Number(ledger.balance) || 0,
            lockedAmount: Number(ledger.lockedAmount) || 0,
            availableBalance
        },
        availableBalance,
        currentCycle,
        invoiceSummary,
        pastCycles: pastCyclesResult
    };
}
