import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
  {
    lineItemId: { type: String, trim: true },
    itemId: { type: String, trim: true },
    productId: { type: String, trim: true },
    variantId: { type: String, trim: true, default: '' },
    variantName: { type: String, trim: true, default: '' },
    variantPrice: { type: Number, default: 0 },
    name: { type: String, trim: true, default: 'Item' },
    price: { type: Number, default: 0 },
    quantity: { type: Number, default: 1, min: 1 },
    imageUrl: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    restaurant: { type: String, trim: true, default: '' },
    restaurantId: { type: String, trim: true, required: true },
    latitude: { type: Number },
    longitude: { type: Number },
    isVeg: { type: Boolean },
    foodType: { type: String, trim: true },
    preparationTime: { type: Number },
    specialInstructions: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const restaurantMetaSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, trim: true, required: true },
    lastKnownStatus: { type: String, enum: ['open', 'closed'], default: 'open' },
    lastValidatedAt: { type: Date },
  },
  { _id: false },
);

const foodUserCartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodUser',
      required: true,
      unique: true,
      index: true,
    },
    items: { type: [cartItemSchema], default: [] },
    restaurantMeta: { type: [restaurantMetaSchema], default: [] },
    cartType: {
      type: new mongoose.Schema(
        {
          restaurantScope: {
            type: String,
            enum: ['single_restaurant', 'multi_restaurant'],
          },
          itemScope: {
            type: String,
            enum: ['single_item', 'multi_item'],
          },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

export const FoodUserCart = mongoose.model('FoodUserCart', foodUserCartSchema);
