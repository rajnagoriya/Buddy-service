import mongoose from 'mongoose';

const diningTableSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        tableNumber: {
            type: String,
            trim: true,
            default: ''
        },
        capacity: {
            type: Number,
            required: true,
            min: 1,
            max: 50
        },
        tableType: {
            type: String,
            trim: true,
            default: 'standard',
            enum: ['standard', 'vip', 'outdoor', 'booth', 'bar', 'private', 'other']
        },
        isActive: {
            type: Boolean,
            default: true
        },
        sortOrder: {
            type: Number,
            default: 0
        },
        notes: {
            type: String,
            trim: true,
            default: ''
        }
    },
    {
        collection: 'food_dining_tables',
        timestamps: true
    }
);

diningTableSchema.index({ restaurantId: 1, isActive: 1 });
diningTableSchema.index(
    { restaurantId: 1, tableNumber: 1 },
    {
        unique: true,
        partialFilterExpression: { tableNumber: { $type: 'string', $ne: '' } }
    }
);

export const FoodDiningTable = mongoose.model('FoodDiningTable', diningTableSchema);
