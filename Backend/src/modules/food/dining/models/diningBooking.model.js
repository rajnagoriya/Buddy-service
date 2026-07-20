import mongoose from 'mongoose';

export const DINING_BOOKING_STATUSES = [
    'pending',
    'accepted',
    'checked-in',
    'completed',
    'rejected',
    'cancelled',
    'no_show'
];

export const DINING_ACTIVE_BOOKING_STATUSES = ['pending', 'accepted', 'checked-in'];

const guestInfoSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true, default: '' },
        phone: { type: String, trim: true, default: '' },
        email: { type: String, trim: true, default: '' }
    },
    { _id: false }
);

const diningBookingSchema = new mongoose.Schema(
    {
        bookingId: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },
        reservationNumber: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            index: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodUser',
            required: true,
            index: true
        },
        tableId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDiningTable',
            default: null,
            index: true
        },
        tableSnapshot: {
            name: { type: String, default: '' },
            tableNumber: { type: String, default: '' },
            capacity: { type: Number, default: null },
            tableType: { type: String, default: '' }
        },
        guests: {
            type: Number,
            required: true,
            min: 1,
            max: 50
        },
        /** Calendar date YYYY-MM-DD in restaurant-local intent */
        date: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        timeSlot: {
            type: String,
            required: true,
            trim: true
        },
        startMinutes: {
            type: Number,
            default: null
        },
        specialRequest: {
            type: String,
            trim: true,
            default: ''
        },
        guestInfo: {
            type: guestInfoSchema,
            default: () => ({})
        },
        status: {
            type: String,
            enum: DINING_BOOKING_STATUSES,
            default: 'pending',
            index: true
        },
        cancelledBy: {
            type: String,
            enum: ['user', 'restaurant', 'admin', null],
            default: null
        },
        cancellationReason: {
            type: String,
            trim: true,
            default: ''
        },
        statusHistory: [
            {
                status: { type: String },
                changedBy: { type: String, enum: ['user', 'restaurant', 'admin', 'system'] },
                changedById: { type: mongoose.Schema.Types.ObjectId, default: null },
                note: { type: String, default: '' },
                at: { type: Date, default: Date.now }
            }
        ],
        checkedInAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        /** Future-ready: deposit / payment hooks */
        payment: {
            required: { type: Boolean, default: false },
            status: {
                type: String,
                enum: ['none', 'pending', 'paid', 'refunded', 'failed'],
                default: 'none'
            },
            amount: { type: Number, default: 0 },
            currency: { type: String, default: 'INR' },
            provider: { type: String, default: null },
            referenceId: { type: String, default: null }
        },
        reviewId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDiningReview',
            default: null
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        collection: 'food_dining_bookings',
        timestamps: true
    }
);

diningBookingSchema.index({ restaurantId: 1, date: 1, status: 1 });
diningBookingSchema.index({ restaurantId: 1, date: 1, timeSlot: 1, status: 1 });
diningBookingSchema.index({ userId: 1, createdAt: -1 });
diningBookingSchema.index(
    { restaurantId: 1, tableId: 1, date: 1, timeSlot: 1 },
    {
        unique: true,
        partialFilterExpression: {
            tableId: { $type: 'objectId' },
            status: { $in: DINING_ACTIVE_BOOKING_STATUSES }
        }
    }
);

export const FoodDiningBooking = mongoose.model('FoodDiningBooking', diningBookingSchema);
