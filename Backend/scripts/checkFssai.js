import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';

dotenv.config();

async function run() {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    const restaurants = await FoodRestaurant.find({ status: 'approved' })
        .select("restaurantName fssaiNumber fssaiImage onboarding.step3.fssai.registrationNumber")
        .lean();
    console.log(JSON.stringify(restaurants, null, 2));
    await mongoose.disconnect();
}

run().catch(console.error);
