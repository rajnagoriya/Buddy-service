import mongoose from 'mongoose';

const deliveryCommissionRuleSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true, default: '' },
        minDistance: { type: Number, required: true, min: 0 },
        maxDistance: { type: Number, default: null },
        /** Fixed amount charged to the customer for this distance slab */
        userCharge: { type: Number, min: 0, default: 0 },
        /** Fixed amount paid to the delivery partner for this distance slab */
        deliveryBoyFee: { type: Number, min: 0, default: 0 },
        /**
         * Legacy fields kept optional for older documents.
         * Prefer userCharge / deliveryBoyFee.
         */
        commissionPerKm: { type: Number, min: 0, default: 0 },
        basePayout: { type: Number, min: 0, default: 0 },
        status: { type: Boolean, default: true, index: true }
    },
    { collection: 'food_delivery_commission_rules', timestamps: true }
);

deliveryCommissionRuleSchema.index({ createdAt: -1 });

export const FoodDeliveryCommissionRule = mongoose.model('FoodDeliveryCommissionRule', deliveryCommissionRuleSchema);
