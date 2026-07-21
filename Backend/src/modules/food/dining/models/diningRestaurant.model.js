import mongoose from 'mongoose';

const diningRestaurantSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            unique: true
        },
        categoryIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'FoodDiningCategory'
            }
        ],
        primaryCategoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDiningCategory',
            default: null
        },
        isEnabled: {
            type: Boolean,
            default: false
        },
        maxGuests: {
            type: Number,
            default: 6,
            min: 0
        },
        pureVegRestaurant: {
            type: Boolean,
            required: true,
            default: false
        },
        /** Slot length when generating from outlet timings (minutes) */
        slotIntervalMinutes: {
            type: Number,
            default: 30,
            min: 15,
            max: 180
        },
        /** How far ahead users may book (days) */
        advanceBookingDays: {
            type: Number,
            default: 7,
            min: 1,
            max: 90
        },
        /** Minutes before slot start when user can no longer cancel */
        cancellationCutoffMinutes: {
            type: Number,
            default: 60,
            min: 0,
            max: 24 * 60
        },
        /** Auto-accept bookings without restaurant action */
        autoConfirm: {
            type: Boolean,
            default: false
        },
        /** Working days override; empty = use outlet timings */
        workingDays: {
            type: [String],
            default: []
        },
        /** Closed / holiday dates as YYYY-MM-DD */
        holidays: {
            type: [String],
            default: []
        },
        closedDates: {
            type: [String],
            default: []
        },
        openingTime: {
            type: String,
            trim: true,
            default: ''
        },
        closingTime: {
            type: String,
            trim: true,
            default: ''
        },
        policyText: {
            type: String,
            trim: true,
            default: ''
        }
    },
    {
        collection: 'food_dining_restaurants',
        timestamps: true
    }
);

// restaurantId is already unique via field definition above
diningRestaurantSchema.index({ isEnabled: 1, primaryCategoryId: 1 });

export const FoodDiningRestaurant = mongoose.model('FoodDiningRestaurant', diningRestaurantSchema);
