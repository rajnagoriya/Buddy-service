import mongoose from 'mongoose';

const deliverySalaryPaymentSchema = new mongoose.Schema(
    {
        deliveryPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDeliveryPartner',
            required: true,
            index: true,
        },
        amount: { type: Number, required: true, min: 0 },
        salaryDuration: {
            type: String,
            enum: ['weekly', 'monthly'],
            default: 'weekly',
        },
        periodStart: { type: Date, required: true },
        periodEnd: { type: Date, required: true },
        completedOrders: { type: Number, default: 0, min: 0 },
        ordersWorth: { type: Number, default: 0, min: 0 },
        paidAt: { type: Date, default: Date.now },
        note: { type: String, trim: true, default: '' },
        transactionId: { type: String, trim: true, default: '' },
        createdByAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        status: {
            type: String,
            enum: ['paid'],
            default: 'paid',
        },
    },
    { collection: 'food_delivery_salary_payments', timestamps: true },
);

deliverySalaryPaymentSchema.index(
    { deliveryPartnerId: 1, periodStart: 1, periodEnd: 1 },
    { unique: true },
);
deliverySalaryPaymentSchema.index({ deliveryPartnerId: 1, paidAt: -1 });

export const FoodDeliverySalaryPayment = mongoose.model(
    'FoodDeliverySalaryPayment',
    deliverySalaryPaymentSchema,
);
