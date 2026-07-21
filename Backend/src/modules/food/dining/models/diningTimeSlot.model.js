import mongoose from 'mongoose';

const diningTimeSlotSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            index: true
        },
        /** Display / booking key, e.g. "12:30 PM" or "12:30" */
        timeLabel: {
            type: String,
            required: true,
            trim: true
        },
        /** Minutes from midnight for sorting / comparisons */
        startMinutes: {
            type: Number,
            required: true,
            min: 0,
            max: 24 * 60 - 1
        },
        durationMinutes: {
            type: Number,
            default: 60,
            min: 15,
            max: 480
        },
        mealPeriod: {
            type: String,
            enum: ['breakfast', 'lunch', 'dinner', 'all'],
            default: 'all'
        },
        isActive: {
            type: Boolean,
            default: true
        },
        /** Optional day overrides: empty = all working days */
        daysOfWeek: {
            type: [String],
            default: []
        },
        maxCovers: {
            type: Number,
            default: null,
            min: 1
        }
    },
    {
        collection: 'food_dining_time_slots',
        timestamps: true
    }
);

diningTimeSlotSchema.index({ restaurantId: 1, isActive: 1, startMinutes: 1 });
diningTimeSlotSchema.index(
    { restaurantId: 1, timeLabel: 1 },
    { unique: true }
);

export const FoodDiningTimeSlot = mongoose.model('FoodDiningTimeSlot', diningTimeSlotSchema);
