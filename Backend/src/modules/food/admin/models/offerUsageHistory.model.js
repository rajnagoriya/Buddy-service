import mongoose from 'mongoose';

const foodOfferUsageHistorySchema = new mongoose.Schema(
    {
        offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOffer', index: true, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', index: true, required: true },
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', index: true, required: true },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOrder', index: true, required: true },
        couponCode: { type: String, trim: true, uppercase: true },
        discountAmount: { type: Number, default: 0, min: 0 },
        deliveryCharge: { type: Number, default: 0, min: 0 },
        deliveryChargeCovered: { type: Number, default: 0, min: 0 },
        platformSubsidy: { type: Number, default: 0, min: 0 },
        orderAmount: { type: Number, default: 0, min: 0 },
        paymentMethod: { type: String },
        orderStatus: { type: String },
        usedAt: { type: Date, default: Date.now, index: true },
    },
    { collection: 'food_offer_usage_history', timestamps: true }
);

foodOfferUsageHistorySchema.index({ offerId: 1, usedAt: -1 });
foodOfferUsageHistorySchema.index({ offerId: 1, restaurantId: 1, usedAt: -1 });

export const FoodOfferUsageHistory = mongoose.model('FoodOfferUsageHistory', foodOfferUsageHistorySchema);
