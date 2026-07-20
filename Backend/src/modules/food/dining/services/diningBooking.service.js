import mongoose from 'mongoose';
import { ValidationError, NotFoundError, ForbiddenError, ConflictError } from '../../../../core/auth/errors.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodDiningRestaurant } from '../models/diningRestaurant.model.js';
import { FoodDiningReview } from '../models/diningReview.model.js';
import {
    DINING_ACTIVE_BOOKING_STATUSES,
    FoodDiningBooking
} from '../models/diningBooking.model.js';
import {
    assertSlotBookable,
    getDefaultDiningSettings,
    getDiningSettingsDoc,
    normalizeTimeSlotLabel,
    parseTimeToMinutes,
    pickBestTable,
    toDateKey
} from './diningAvailability.service.js';
import { notifyOwnerSafely } from '../../orders/services/order.helpers.js';
import { logger } from '../../../../utils/logger.js';

const RESTAURANT_TRANSITIONS = {
    pending: ['accepted', 'rejected', 'cancelled'],
    accepted: ['checked-in', 'cancelled', 'no_show'],
    'checked-in': ['completed', 'cancelled'],
    completed: [],
    rejected: [],
    cancelled: [],
    no_show: []
};

function buildBookingId() {
    return `TB${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
}

function buildReservationNumber() {
    const part = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `RSV-${part}`;
}

function mapRestaurantSnapshot(restaurant) {
    if (!restaurant) return null;
    const cover =
        (Array.isArray(restaurant.coverImages) &&
            (typeof restaurant.coverImages[0] === 'string'
                ? restaurant.coverImages[0]
                : restaurant.coverImages[0]?.url)) ||
        '';
    const profile =
        typeof restaurant.profileImage === 'string'
            ? restaurant.profileImage
            : restaurant.profileImage?.url || '';

    return {
        _id: restaurant._id,
        id: restaurant._id,
        restaurantId: restaurant._id,
        name: restaurant.restaurantName || restaurant.name || 'Restaurant',
        restaurantName: restaurant.restaurantName || restaurant.name || 'Restaurant',
        slug: restaurant.restaurantNameNormalized || '',
        restaurantNameNormalized: restaurant.restaurantNameNormalized || '',
        profileImage: restaurant.profileImage || null,
        coverImages: restaurant.coverImages || [],
        menuImages: restaurant.menuImages || [],
        image: cover || profile || '',
        location: restaurant.location || null,
        rating: restaurant.rating || 0
    };
}

function mapBooking(doc, { restaurant = null, review = null } = {}) {
    if (!doc) return null;
    const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    const restaurantPayload =
        restaurant ||
        (plain.restaurantId && typeof plain.restaurantId === 'object' && plain.restaurantId._id
            ? mapRestaurantSnapshot(plain.restaurantId)
            : null);

    return {
        _id: plain._id,
        id: plain._id,
        bookingId: plain.bookingId,
        reservationNumber: plain.reservationNumber,
        restaurantId: restaurantPayload?._id || plain.restaurantId,
        restaurant: restaurantPayload,
        userId: plain.userId,
        user: {
            _id: plain.userId,
            id: plain.userId,
            name: plain.guestInfo?.name || '',
            phone: plain.guestInfo?.phone || '',
            email: plain.guestInfo?.email || ''
        },
        guestInfo: plain.guestInfo || {},
        tableId: plain.tableId || null,
        table: plain.tableSnapshot || null,
        guests: plain.guests,
        date: plain.date,
        timeSlot: plain.timeSlot,
        specialRequest: plain.specialRequest || '',
        status: plain.status,
        cancelledBy: plain.cancelledBy || null,
        cancellationReason: plain.cancellationReason || '',
        checkedInAt: plain.checkedInAt,
        completedAt: plain.completedAt,
        payment: plain.payment || { required: false, status: 'none', amount: 0 },
        review: review
            ? {
                  rating: review.rating,
                  comment: review.comment || '',
                  createdAt: review.createdAt
              }
            : null,
        reviewId: plain.reviewId || null,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt
    };
}

async function loadRestaurantSnapshot(restaurantId) {
    const restaurant = await FoodRestaurant.findById(restaurantId)
        .select(
            'restaurantName restaurantNameNormalized profileImage coverImages menuImages location rating'
        )
        .lean();
    return mapRestaurantSnapshot(restaurant);
}

async function notifyRestaurantBooking(restaurantId, booking, title, body) {
    try {
        await notifyOwnerSafely(
            { ownerType: 'RESTAURANT', ownerId: restaurantId },
            {
                title,
                body,
                data: {
                    type: 'dining_booking',
                    bookingId: String(booking._id),
                    reservationNumber: booking.reservationNumber,
                    status: booking.status
                }
            }
        );
    } catch (err) {
        logger.warn(`Dining booking notification failed: ${err?.message || err}`);
    }
}

async function notifyUserBooking(userId, booking, title, body) {
    try {
        await notifyOwnerSafely(
            { ownerType: 'USER', ownerId: userId },
            {
                title,
                body,
                data: {
                    type: 'dining_booking',
                    bookingId: String(booking._id),
                    reservationNumber: booking.reservationNumber,
                    status: booking.status
                }
            }
        );
    } catch (err) {
        logger.warn(`Dining user notification failed: ${err?.message || err}`);
    }
}

export async function createBooking(userId, dto) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ValidationError('Invalid user');
    }

    const restaurantId = dto.restaurantId;
    const { settings, slot, dateKey } = await assertSlotBookable(restaurantId, {
        date: dto.date,
        timeSlot: dto.timeSlot,
        guests: dto.guests
    });

    const settingsDoc = await getDiningSettingsDoc(restaurantId);
    const diningSettings = getDefaultDiningSettings(settingsDoc);

    const user = await FoodUser.findById(userId).select('name phone email').lean();
    if (!user) throw new NotFoundError('User not found');

    const guestInfo = {
        name: String(dto.guestInfo?.name || user.name || '').trim() || 'Guest',
        phone: String(dto.guestInfo?.phone || user.phone || '').trim(),
        email: String(dto.guestInfo?.email || user.email || '').trim()
    };

    const table = await pickBestTable(restaurantId, {
        date: dateKey,
        timeSlot: slot.timeSlot,
        guests: dto.guests,
        preferredTableId: dto.tableId || null
    });

    const status = diningSettings.autoConfirm ? 'accepted' : 'pending';
    const now = new Date();

    const bookingPayload = {
        bookingId: buildBookingId(),
        reservationNumber: buildReservationNumber(),
        restaurantId,
        userId,
        tableId: table?._id || null,
        tableSnapshot: table
            ? {
                  name: table.name,
                  tableNumber: table.tableNumber || '',
                  capacity: table.capacity,
                  tableType: table.tableType || 'standard'
              }
            : null,
        guests: dto.guests,
        date: dateKey,
        timeSlot: slot.timeSlot,
        startMinutes: parseTimeToMinutes(slot.timeSlot),
        specialRequest: String(dto.specialRequest || '').trim(),
        guestInfo,
        status,
        statusHistory: [
            {
                status,
                changedBy: 'user',
                changedById: userId,
                note: status === 'accepted' ? 'Auto-confirmed' : 'Booking created',
                at: now
            }
        ],
        payment: {
            required: false,
            status: 'none',
            amount: 0,
            currency: 'INR'
        }
    };

    let booking;
    try {
        booking = await FoodDiningBooking.create(bookingPayload);
    } catch (err) {
        if (err?.code === 11000) {
            throw new ConflictError('This table is already booked for the selected slot');
        }
        throw err;
    }

    const restaurant = await loadRestaurantSnapshot(restaurantId);
    const mapped = mapBooking(booking, { restaurant });

    await notifyRestaurantBooking(
        restaurantId,
        booking,
        'New dining reservation',
        `${guestInfo.name} requested a table for ${dto.guests} on ${dateKey} at ${slot.timeSlot}`
    );

    await notifyUserBooking(
        userId,
        booking,
        status === 'accepted' ? 'Table reserved' : 'Reservation requested',
        status === 'accepted'
            ? `Your table is confirmed for ${dateKey} at ${slot.timeSlot}`
            : `Your reservation request for ${dateKey} at ${slot.timeSlot} is pending restaurant approval`
    );

    return mapped;
}

export async function listUserBookings(userId, query = {}) {
    const filter = { userId };
    if (query.status) {
        filter.status = String(query.status).trim().toLowerCase();
    }

    const bookings = await FoodDiningBooking.find(filter).sort({ createdAt: -1 }).lean();
    const restaurantIds = [...new Set(bookings.map((b) => String(b.restaurantId)))];
    const reviewIds = bookings.map((b) => b.reviewId).filter(Boolean);

    const [restaurants, reviews] = await Promise.all([
        FoodRestaurant.find({ _id: { $in: restaurantIds } })
            .select(
                'restaurantName restaurantNameNormalized profileImage coverImages menuImages location rating'
            )
            .lean(),
        reviewIds.length
            ? FoodDiningReview.find({ _id: { $in: reviewIds } }).lean()
            : Promise.resolve([])
    ]);

    const restaurantMap = new Map(
        restaurants.map((r) => [String(r._id), mapRestaurantSnapshot(r)])
    );
    const reviewMap = new Map(reviews.map((r) => [String(r._id), r]));

    return {
        bookings: bookings.map((b) =>
            mapBooking(b, {
                restaurant: restaurantMap.get(String(b.restaurantId)),
                review: b.reviewId ? reviewMap.get(String(b.reviewId)) : null
            })
        )
    };
}

export async function getUserBookingById(userId, bookingId) {
    const booking = await findBookingFlexible(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');
    if (String(booking.userId) !== String(userId)) {
        throw new ForbiddenError('Not allowed to view this booking');
    }
    const restaurant = await loadRestaurantSnapshot(booking.restaurantId);
    const review = booking.reviewId
        ? await FoodDiningReview.findById(booking.reviewId).lean()
        : null;
    return mapBooking(booking, { restaurant, review });
}

async function findBookingFlexible(bookingIdOrCode) {
    const raw = String(bookingIdOrCode || '').trim();
    if (!raw) return null;

    if (mongoose.Types.ObjectId.isValid(raw)) {
        const byId = await FoodDiningBooking.findById(raw);
        if (byId) return byId;
    }

    return FoodDiningBooking.findOne({
        $or: [{ bookingId: raw }, { reservationNumber: raw }]
    });
}

export async function cancelUserBooking(userId, bookingId, { reason = '' } = {}) {
    const booking = await findBookingFlexible(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');
    if (String(booking.userId) !== String(userId)) {
        throw new ForbiddenError('Not allowed to cancel this booking');
    }

    if (!['pending', 'accepted'].includes(booking.status)) {
        throw new ValidationError(`Cannot cancel a booking in ${booking.status} status`);
    }

    const settingsDoc = await getDiningSettingsDoc(booking.restaurantId).catch(() => null);
    const settings = getDefaultDiningSettings(settingsDoc || {});
    const startMinutes = booking.startMinutes ?? parseTimeToMinutes(booking.timeSlot);
    if (startMinutes !== null) {
        const slotStart = new Date(`${booking.date}T00:00:00`);
        slotStart.setMinutes(startMinutes);
        const cutoffMs = settings.cancellationCutoffMinutes * 60 * 1000;
        if (Date.now() > slotStart.getTime() - cutoffMs) {
            throw new ValidationError('Cancellation window has closed for this reservation');
        }
    }

    booking.status = 'cancelled';
    booking.cancelledBy = 'user';
    booking.cancellationReason = String(reason || '').trim();
    booking.statusHistory.push({
        status: 'cancelled',
        changedBy: 'user',
        changedById: userId,
        note: booking.cancellationReason || 'Cancelled by user',
        at: new Date()
    });
    await booking.save();

    const restaurant = await loadRestaurantSnapshot(booking.restaurantId);
    await notifyRestaurantBooking(
        booking.restaurantId,
        booking,
        'Reservation cancelled',
        `Guest cancelled reservation ${booking.reservationNumber}`
    );

    return mapBooking(booking, { restaurant });
}

export async function listRestaurantBookings(restaurantId, query = {}) {
    const filter = { restaurantId };
    if (query.status) {
        filter.status = String(query.status).trim().toLowerCase();
    }
    if (query.date) {
        filter.date = toDateKey(query.date);
    }
    if (query.q) {
        const q = String(query.q).trim();
        filter.$or = [
            { bookingId: new RegExp(q, 'i') },
            { reservationNumber: new RegExp(q, 'i') },
            { 'guestInfo.name': new RegExp(q, 'i') },
            { 'guestInfo.phone': new RegExp(q, 'i') }
        ];
    }

    const bookings = await FoodDiningBooking.find(filter).sort({ date: 1, startMinutes: 1, createdAt: -1 }).lean();
    const restaurant = await loadRestaurantSnapshot(restaurantId);

    return {
        bookings: bookings.map((b) => mapBooking(b, { restaurant }))
    };
}

export async function getRestaurantBookingStats(restaurantId) {
    const today = toDateKey(new Date());
    const [todayCount, upcoming, completed, cancelled, noShow, pending] = await Promise.all([
        FoodDiningBooking.countDocuments({
            restaurantId,
            date: today,
            status: { $in: DINING_ACTIVE_BOOKING_STATUSES }
        }),
        FoodDiningBooking.countDocuments({
            restaurantId,
            date: { $gt: today },
            status: { $in: ['pending', 'accepted'] }
        }),
        FoodDiningBooking.countDocuments({ restaurantId, status: 'completed' }),
        FoodDiningBooking.countDocuments({ restaurantId, status: 'cancelled' }),
        FoodDiningBooking.countDocuments({ restaurantId, status: 'no_show' }),
        FoodDiningBooking.countDocuments({ restaurantId, status: 'pending' })
    ]);

    return {
        today: todayCount,
        upcoming,
        completed,
        cancelled,
        noShow,
        pending
    };
}

export async function updateRestaurantBookingStatus(restaurantId, bookingId, dto, actorId) {
    const booking = await findBookingFlexible(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');
    if (String(booking.restaurantId) !== String(restaurantId)) {
        throw new ForbiddenError('Booking does not belong to this restaurant');
    }

    let nextStatus = String(dto.status || '').trim().toLowerCase();
    if (nextStatus === 'confirmed') nextStatus = 'accepted';
    if (nextStatus === 'checked_in') nextStatus = 'checked-in';
    // Restaurant "Decline" on pending maps to rejected
    if (booking.status === 'pending' && nextStatus === 'cancelled') {
        nextStatus = 'rejected';
    }

    const allowed = RESTAURANT_TRANSITIONS[booking.status] || [];
    if (!allowed.includes(nextStatus)) {
        throw new ValidationError(
            `Cannot change status from ${booking.status} to ${nextStatus}`
        );
    }

    booking.status = nextStatus;
    if (nextStatus === 'rejected' || nextStatus === 'cancelled') {
        booking.cancelledBy = 'restaurant';
        booking.cancellationReason = String(dto.reason || dto.note || '').trim();
    }
    if (nextStatus === 'checked-in') {
        booking.checkedInAt = new Date();
    }
    if (nextStatus === 'completed') {
        booking.completedAt = new Date();
    }

    booking.statusHistory.push({
        status: nextStatus,
        changedBy: 'restaurant',
        changedById: actorId || restaurantId,
        note: String(dto.note || dto.reason || '').trim(),
        at: new Date()
    });

    await booking.save();
    const restaurant = await loadRestaurantSnapshot(restaurantId);

    await notifyUserBooking(
        booking.userId,
        booking,
        `Reservation ${nextStatus}`,
        `Your reservation ${booking.reservationNumber} is now ${nextStatus}`
    );

    return mapBooking(booking, { restaurant });
}

export async function searchRestaurantBooking(restaurantId, code) {
    const booking = await findBookingFlexible(code);
    if (!booking) throw new NotFoundError('Booking not found');
    if (String(booking.restaurantId) !== String(restaurantId)) {
        throw new NotFoundError('Booking not found');
    }
    const restaurant = await loadRestaurantSnapshot(restaurantId);
    return mapBooking(booking, { restaurant });
}

export async function listAdminBookings(query = {}) {
    const filter = {};
    if (query.restaurantId && mongoose.Types.ObjectId.isValid(query.restaurantId)) {
        filter.restaurantId = query.restaurantId;
    }
    if (query.status) filter.status = String(query.status).trim().toLowerCase();
    if (query.date) filter.date = toDateKey(query.date);

    const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
        FoodDiningBooking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        FoodDiningBooking.countDocuments(filter)
    ]);

    const restaurantIds = [...new Set(bookings.map((b) => String(b.restaurantId)))];
    const restaurants = await FoodRestaurant.find({ _id: { $in: restaurantIds } })
        .select(
            'restaurantName restaurantNameNormalized profileImage coverImages menuImages location rating'
        )
        .lean();
    const restaurantMap = new Map(
        restaurants.map((r) => [String(r._id), mapRestaurantSnapshot(r)])
    );

    return {
        bookings: bookings.map((b) =>
            mapBooking(b, { restaurant: restaurantMap.get(String(b.restaurantId)) })
        ),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 }
    };
}

export async function getAdminBookingAnalytics(query = {}) {
    const match = {};
    if (query.restaurantId && mongoose.Types.ObjectId.isValid(query.restaurantId)) {
        match.restaurantId = new mongoose.Types.ObjectId(query.restaurantId);
    }
    if (query.from || query.to) {
        match.date = {};
        if (query.from) match.date.$gte = toDateKey(query.from);
        if (query.to) match.date.$lte = toDateKey(query.to);
    }

    const [byStatus, totals] = await Promise.all([
        FoodDiningBooking.aggregate([
            { $match: match },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        FoodDiningBooking.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    guests: { $sum: '$guests' }
                }
            }
        ])
    ]);

    const statusMap = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
    return {
        total: totals[0]?.total || 0,
        totalGuests: totals[0]?.guests || 0,
        byStatus: statusMap,
        cancelled: statusMap.cancelled || 0,
        noShow: statusMap.no_show || 0,
        completed: statusMap.completed || 0
    };
}

export async function createReview(userId, dto) {
    const booking = await findBookingFlexible(dto.bookingId);
    if (!booking) throw new NotFoundError('Booking not found');
    if (String(booking.userId) !== String(userId)) {
        throw new ForbiddenError('Not allowed to review this booking');
    }
    if (booking.status !== 'completed') {
        throw new ValidationError('Reviews can only be submitted for completed bookings');
    }
    if (booking.reviewId) {
        throw new ConflictError('Review already submitted for this booking');
    }

    const review = await FoodDiningReview.create({
        bookingId: booking._id,
        restaurantId: booking.restaurantId,
        userId,
        rating: dto.rating,
        comment: String(dto.comment || '').trim()
    });

    booking.reviewId = review._id;
    await booking.save();

    // Lightweight dining rating aggregate on restaurant (does not replace food order rating)
    try {
        const stats = await FoodDiningReview.aggregate([
            { $match: { restaurantId: booking.restaurantId, isVisible: true } },
            {
                $group: {
                    _id: '$restaurantId',
                    avg: { $avg: '$rating' },
                    count: { $sum: 1 }
                }
            }
        ]);
        if (stats[0]) {
            await FoodRestaurant.findByIdAndUpdate(booking.restaurantId, {
                $set: {
                    'diningSettings.diningRating': Number(stats[0].avg.toFixed(2)),
                    'diningSettings.diningReviewCount': stats[0].count
                }
            });
        }
    } catch (err) {
        logger.warn(`Dining rating aggregate failed: ${err?.message || err}`);
    }

    const restaurant = await loadRestaurantSnapshot(booking.restaurantId);
    return mapBooking(booking, { restaurant, review: review.toObject() });
}

export async function updateReservationSettings(restaurantId, dto) {
    const doc = await getDiningSettingsDoc(restaurantId).catch(async () => {
        throw new ValidationError('Dining must be enabled before updating reservation settings');
    });

    const updates = {};
    const fields = [
        'slotIntervalMinutes',
        'advanceBookingDays',
        'cancellationCutoffMinutes',
        'autoConfirm',
        'workingDays',
        'holidays',
        'closedDates',
        'openingTime',
        'closingTime',
        'policyText',
        'maxGuests'
    ];

    for (const field of fields) {
        if (dto[field] !== undefined) updates[field] = dto[field];
    }

    const updated = await FoodDiningRestaurant.findOneAndUpdate(
        { restaurantId },
        { $set: updates },
        { new: true }
    ).lean();

    if (dto.maxGuests !== undefined) {
        await FoodRestaurant.findByIdAndUpdate(restaurantId, {
            $set: { 'diningSettings.maxGuests': dto.maxGuests }
        });
    }

    return getDefaultDiningSettings(updated || doc);
}

export async function getReservationSettings(restaurantId) {
    const doc = await getDiningSettingsDoc(restaurantId);
    return getDefaultDiningSettings(doc);
}
