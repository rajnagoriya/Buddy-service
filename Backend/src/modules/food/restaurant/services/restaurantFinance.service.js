import mongoose from 'mongoose';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodTransaction } from '../../orders/models/foodTransaction.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodRestaurantWithdrawal } from '../models/foodRestaurantWithdrawal.model.js';
import { getBalance } from '../../../../core/payments/transaction.service.js';
import { buildPaginationMeta, buildPaginationOptions } from '../../../../utils/helpers.js';

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
    const ledger = await getBalance('restaurant', String(rid));

    // Unsettled orders for the live earnings list (matches withdrawable balance).
    const currentTransactions = await FoodTransaction.find({
        restaurantId: rid,
        status: { $in: ['captured', 'authorized'] },
        'settlement.isRestaurantSettled': { $ne: true }
    })
        .populate('orderId', 'orderId order_id createdAt items pricing deliveryState orderStatus')
        .sort({ createdAt: -1 })
        .lean();

    const mapTxToRestaurantOrder = (tx) => {
        const order = tx.orderId && typeof tx.orderId === 'object' ? tx.orderId : {};
        const items = Array.isArray(order.items) ? order.items : [];
        const foodNames = items.map((it) => it?.name).filter(Boolean).join(', ');
        const orderTotalExclTax = Math.max(
            0,
            Number(order?.pricing?.total ?? 0) - Number(order?.pricing?.tax ?? 0) || 0
        );
        const mongoId =
            order?._id?.toString?.() ||
            (tx.orderId && typeof tx.orderId !== 'object' ? String(tx.orderId) : '') ||
            '';
        return {
            orderId: order?.orderId || order?.order_id || tx.orderReadableId,
            mongoId,
            createdAt: tx.createdAt,
            items,
            foodNames,
            orderTotal: orderTotalExclTax,
            totalAmount: tx.amounts?.totalCustomerPaid || 0,
            payout: tx.amounts?.restaurantShare || 0,
            commission: tx.amounts?.restaurantCommission || 0,
            paymentMethod: tx.paymentMethod || order?.payment?.method,
            orderStatus: order?.orderStatus || order?.deliveryState?.currentPhase || order?.deliveryState?.status,
            status: tx.status
        };
    };

    const currentCycleOrders = currentTransactions.map(mapTxToRestaurantOrder);

    // Calculate global estimated payout (all unsettled transactions)
    const allUnsettledTransactions = await FoodTransaction.find({
        restaurantId: rid,
        status: { $in: ['captured', 'authorized'] },
        'settlement.isRestaurantSettled': { $ne: true }
    }).select('amounts.restaurantShare').lean();

    const globalEstimatedPayout = allUnsettledTransactions.reduce(
        (sum, tx) => sum + (Number(tx.amounts?.restaurantShare) || 0),
        0
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
        const pastFilter = {
            restaurantId: rid,
            status: { $in: ['captured', 'authorized'] },
            createdAt: { $gte: startDate, $lte: endDate },
        };

        const [pastTransactions, pastTotal] = await Promise.all([
            FoodTransaction.find(pastFilter)
                .populate('orderId', 'orderId order_id createdAt items pricing deliveryState orderStatus')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FoodTransaction.countDocuments(pastFilter),
        ]);

        const pastCycleOrders = pastTransactions.map(mapTxToRestaurantOrder);

        pastCyclesResult = {
            orders: pastCycleOrders,
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


