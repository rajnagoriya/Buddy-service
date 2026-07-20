/**
 * Seed admin/global food categories (no restaurantId).
 *
 * USAGE
 *   node scripts/seedRestaurantOnboarding/seedGlobalCategories.js
 *   node scripts/seedRestaurantOnboarding/seedGlobalCategories.js --force
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FoodCategory } from '../../src/modules/food/admin/models/category.model.js';
import { GLOBAL_CATEGORIES } from './globalCategories.js';
import { resolveImageUrl, getMongoUri, logMongoTarget } from './helpers.js';

dotenv.config();

const FORCE = process.argv.includes('--force');

async function run() {
    const mongoUri = getMongoUri();
    if (!mongoUri) throw new Error('MONGODB_URI is not set');
    logMongoTarget(mongoUri);

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const names = GLOBAL_CATEGORIES.map((c) => c.name);
    const existing = await FoodCategory.find({
        name: { $in: names },
        $or: [{ restaurantId: { $exists: false } }, { restaurantId: null }],
    }).lean();

    if (existing.length && !FORCE) {
        console.log(`Found ${existing.length} global categories. Skipping (use --force to recreate).`);
        await mongoose.disconnect();
        return;
    }

    if (FORCE && existing.length) {
        await FoodCategory.deleteMany({
            name: { $in: names },
            $or: [{ restaurantId: { $exists: false } }, { restaurantId: null }],
        });
        console.log('Removed existing global categories.');
    }

    for (const cat of GLOBAL_CATEGORIES) {
        const imageAsset = await resolveImageUrl(
            cat.imageUrl,
            'food/seed/categories/global',
            { label: cat.name },
        );
        const doc = await FoodCategory.create({
            name: cat.name,
            image: imageAsset.url,
            imagePublicId: imageAsset.publicId,
            type: cat.type,
            foodTypeScope: cat.foodTypeScope,
            approvalStatus: 'approved',
            isApproved: true,
            isActive: true,
            sortOrder: cat.sortOrder,
            approvedAt: new Date(),
        });
        console.log(`Global category: ${doc.name} (${doc._id})`);
    }

    console.log('Global categories seeded.');
    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error('seedGlobalCategories failed:', err.message || err);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    process.exit(1);
});
