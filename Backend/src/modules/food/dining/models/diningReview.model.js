import mongoose from 'mongoose';

const diningReviewSchema = new mongoose.Schema(
    {
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDiningBooking',
            required: true,
            unique: true
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
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        comment: {
            type: String,
            trim: true,
            default: ''
        },
        isVisible: {
            type: Boolean,
            default: true
        }
    },
    {
        collection: 'food_dining_reviews',
        timestamps: true
    }
);

diningReviewSchema.index({ restaurantId: 1, createdAt: -1 });

export const FoodDiningReview = mongoose.model('FoodDiningReview', diningReviewSchema);
