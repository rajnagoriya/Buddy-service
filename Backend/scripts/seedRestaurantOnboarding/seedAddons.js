/**
 * Seed approved addons for all seed restaurants (phones 9810000020–9810000034).
 *
 * USAGE
 *   node scripts/seedRestaurantOnboarding/seedAddons.js
 *   node scripts/seedRestaurantOnboarding/seedAddons.js --clean
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FoodRestaurant } from '../../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodAddon } from '../../src/modules/food/restaurant/models/foodAddon.model.js';
import { RESTAURANT_PROFILES } from './restaurantProfiles.js';
import { getAddonsForCuisine } from './addonCatalog.js';
import { buildOwnerPhone, buildSeedPhoneFilter, getMongoUri, logMongoTarget, SEED_RESTAURANT_COUNT } from './helpers.js';

dotenv.config();

const CLEAN = process.argv.includes('--clean');
const now = new Date();

async function run() {
    const mongoUri = getMongoUri();
    if (!mongoUri) throw new Error('MONGODB_URI is not set');
    logMongoTarget(mongoUri);

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    if (CLEAN) {
        const restaurants = await FoodRestaurant.find(buildSeedPhoneFilter()).select('_id').lean();
        const ids = restaurants.map((r) => r._id);
        if (ids.length) {
            const result = await FoodAddon.deleteMany({ restaurantId: { $in: ids } });
            console.log(`Removed ${result.deletedCount} addons.`);
        }
    }

    let totalAddons = 0;
    for (let i = 0; i < SEED_RESTAURANT_COUNT; i++) {
        const phone = buildOwnerPhone(i);
        const profile = RESTAURANT_PROFILES[i];
        const restaurant = await FoodRestaurant.findOne({
            ownerPhoneLast10: phone.slice(-10),
        }).lean();

        if (!restaurant) {
            console.warn(`Restaurant not found for ${phone} (${profile?.restaurantName}). Run seedRestaurants.js first.`);
            continue;
        }

        const existingCount = await FoodAddon.countDocuments({
            restaurantId: restaurant._id,
            isDeleted: { $ne: true },
        });
        if (existingCount > 0 && !CLEAN) {
            console.log(`Skip addons: ${restaurant.restaurantName} (${existingCount} exist)`);
            continue;
        }

        if (existingCount > 0 && CLEAN) {
            await FoodAddon.deleteMany({ restaurantId: restaurant._id });
        }

        const templates = getAddonsForCuisine(profile.cuisineKey);
        for (const addon of templates) {
            const payload = {
                name: addon.name,
                description: addon.description,
                price: addon.price,
                image: '',
                images: [],
            };
            await FoodAddon.create({
                restaurantId: restaurant._id,
                draft: payload,
                published: payload,
                approvalStatus: 'approved',
                isAvailable: true,
                isDeleted: false,
                requestedAt: now,
                approvedAt: now,
            });
            totalAddons += 1;
        }
        console.log(`Addons: ${restaurant.restaurantName} — ${templates.length} items`);
    }

    console.log(`\n=== Done: ${totalAddons} addons seeded ===`);
    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error('seedAddons failed:', err.message || err);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    process.exit(1);
});
