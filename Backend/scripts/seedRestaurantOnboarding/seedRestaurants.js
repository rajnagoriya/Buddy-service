/**
 * Seed 15 approved restaurants with categories and menu items.
 * Simulates full onboarding flow: register → admin approve → categories approve → menu items.
 *
 * USAGE
 *   node scripts/seedRestaurantOnboarding/seedRestaurants.js
 *   node scripts/seedRestaurantOnboarding/seedRestaurants.js --skip-existing
 *   node scripts/seedRestaurantOnboarding/seedRestaurants.js --clean
 *   node scripts/seedRestaurantOnboarding/seedRestaurants.js --with-global-categories
 *
 * Phones: 9810000020 … 9810000034
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FoodRestaurant } from '../../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodCategory } from '../../src/modules/food/admin/models/category.model.js';
import { FoodItem } from '../../src/modules/food/admin/models/food.model.js';
import { FoodRestaurantOutletTimings } from '../../src/modules/food/restaurant/models/outletTimings.model.js';
import { FoodAddon } from '../../src/modules/food/restaurant/models/foodAddon.model.js';
import { RESTAURANT_PROFILES } from './restaurantProfiles.js';
import { GLOBAL_MENU_ITEMS } from './globalCategories.js';
import { getMenuForCuisine } from './menuCatalog.js';
import {
    buildOwnerPhone,
    buildSeedPhoneFilter,
    defaultOutletTimings,
    getMongoUri,
    logMongoTarget,
    resolveImageList,
    resolveImageUrl,
    SEED_RESTAURANT_COUNT,
} from './helpers.js';

dotenv.config();

const SKIP_EXISTING = process.argv.includes('--skip-existing');
const CLEAN = process.argv.includes('--clean');
const WITH_GLOBAL = process.argv.includes('--with-global-categories');

const now = new Date();

const buildRestaurantDoc = (profile, phone, images) => {
    const pureVeg = profile.dietaryType === 'veg';
    const addressLine1 = `${profile.area}, ${profile.city}`;
    const location = {
        type: 'Point',
        coordinates: [profile.lng, profile.lat],
        latitude: profile.lat,
        longitude: profile.lng,
        formattedAddress: `${addressLine1}, ${profile.state} ${profile.pincode}`,
        address: addressLine1,
        addressLine1,
        area: profile.area,
        city: profile.city,
        state: profile.state,
        pincode: profile.pincode,
    };

    const imagePublicIds = {};
    if (images.profile.publicId) imagePublicIds.profileImage = images.profile.publicId;
    if (images.cover[0]?.publicId) imagePublicIds.coverImage0 = images.cover[0].publicId;
    if (images.cover[1]?.publicId) imagePublicIds.coverImage1 = images.cover[1].publicId;
    images.menu.forEach((img, i) => {
        if (img.publicId) imagePublicIds[`menuImage${i}`] = img.publicId;
    });

    return {
        restaurantName: profile.restaurantName,
        ownerName: profile.ownerName,
        ownerEmail: profile.ownerEmail,
        ownerPhone: phone,
        primaryContactNumber: phone,
        pureVegRestaurant: pureVeg,
        dietaryType: profile.dietaryType,
        addressLine1,
        area: profile.area,
        city: profile.city,
        state: profile.state,
        pincode: profile.pincode,
        cuisines: profile.cuisines,
        location,
        profileImage: images.profile.url,
        coverImages: images.cover.map((a) => a.url),
        menuImages: images.menu.map((a) => a.url),
        imagePublicIds,
        estimatedDeliveryTime: '25-30 mins',
        estimatedDeliveryTimeMinutes: 25,
        featuredDish: profile.cuisines[0] || 'Chef Special',
        featuredPrice: 199,
        offer: '10% off on first order',
        rating: 4.2 + (profile.restaurantName.length % 5) * 0.1,
        totalRatings: 50 + profile.restaurantName.length * 3,
        isAcceptingOrders: true,
        isActive: true,
        status: 'approved',
        onboardingStatus: 'APPROVED',
        currentStep: null,
        completedSteps: [1, 2, 3],
        submittedAt: now,
        verifiedAt: now,
        approvedAt: now,
        panNumber: `ABCDE${String(1000 + profile.restaurantName.length).slice(-4)}F`,
        nameOnPan: profile.ownerName,
        fssaiNumber: `100${String(phone).slice(-10)}`,
        fssaiExpiry: new Date(now.getFullYear() + 2, 5, 30),
        accountNumber: `50100${String(phone).slice(-8)}`,
        ifscCode: 'HDFC0001234',
        accountHolderName: profile.ownerName,
        accountType: 'Savings',
        onboarding: {
            step1: {
                restaurantName: profile.restaurantName,
                ownerName: profile.ownerName,
                ownerEmail: profile.ownerEmail,
                ownerPhone: phone,
                primaryContactNumber: phone,
                pureVegRestaurant: pureVeg,
                dietaryType: profile.dietaryType,
                location,
            },
            step2: {
                cuisines: profile.cuisines,
                profileImageUrl: images.profile.url,
                menuImageUrls: images.menu.map((a) => a.url),
                estimatedDeliveryTime: '25-30 mins',
            },
            step3: {
                pan: { panNumber: `ABCDE${String(1000 + profile.restaurantName.length).slice(-4)}F`, nameOnPan: profile.ownerName },
                fssai: { fssaiNumber: `100${String(phone).slice(-10)}` },
            },
        },
    };
};

const filterItemsForDiet = (items, dietaryType) => {
    if (dietaryType !== 'veg') return items;
    return items.filter((item) => item.foodType === 'Veg');
};

const normalizeItemFoodType = (foodType) => {
    const t = String(foodType || '').trim();
    if (t === 'Veg') return 'Veg';
    return 'Non-Veg';
};

const filterCategoryForDiet = (category, dietaryType) => {
    if (dietaryType !== 'veg') return category;
    if (category.foodTypeScope === 'Non-Veg') return null;
    return {
        ...category,
        foodTypeScope: 'Veg',
        items: filterItemsForDiet(category.items, dietaryType),
    };
};

async function cleanSeedData() {
    const phoneFilter = buildSeedPhoneFilter();
    const restaurants = await FoodRestaurant.find(phoneFilter).select('_id').lean();
    const ids = restaurants.map((r) => r._id);
    if (!ids.length) {
        console.log('No seed restaurants to clean.');
        return;
    }
    await Promise.all([
        FoodCategory.deleteMany({
            $or: [
                { restaurantId: { $in: ids } },
                { createdByRestaurantId: { $in: ids } },
            ],
        }),
        FoodItem.deleteMany({ restaurantId: { $in: ids } }),
        FoodAddon.deleteMany({ restaurantId: { $in: ids } }),
        FoodRestaurantOutletTimings.deleteMany({ restaurantId: { $in: ids } }),
        FoodRestaurant.deleteMany({ _id: { $in: ids } }),
    ]);
    console.log(`Cleaned ${ids.length} seed restaurants and related data.`);
}

async function getGlobalCategoryMap() {
    const globals = await FoodCategory.find({
        name: { $in: Object.keys(GLOBAL_MENU_ITEMS) },
        $or: [{ restaurantId: { $exists: false } }, { restaurantId: null }],
        approvalStatus: 'approved',
    }).lean();
    return new Map(globals.map((c) => [c.name, c]));
}

async function seedRestaurant(profile, index, globalCategoryMap) {
    const phone = buildOwnerPhone(index);
    const slug = profile.restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const existing = await FoodRestaurant.findOne({
        $or: [
            { ownerPhoneLast10: phone.slice(-10) },
            { ownerEmail: profile.ownerEmail },
        ],
    }).lean();

    if (existing && SKIP_EXISTING) {
        console.log(`Skip existing: ${profile.restaurantName} (${phone})`);
        return existing;
    }
    if (existing && !CLEAN) {
        console.log(`Removing existing for re-seed: ${profile.restaurantName}`);
        await FoodCategory.deleteMany({
            $or: [
                { restaurantId: existing._id },
                { createdByRestaurantId: existing._id },
            ],
        });
        await FoodItem.deleteMany({ restaurantId: existing._id });
        await FoodAddon.deleteMany({ restaurantId: existing._id });
        await FoodRestaurantOutletTimings.deleteMany({ restaurantId: existing._id });
        await FoodRestaurant.deleteOne({ _id: existing._id });
    }

    console.log(`\n--- Seeding ${profile.restaurantName} (${phone}) ---`);

    const [profileImg, coverImgs, menuImgs] = await Promise.all([
        resolveImageUrl(profile.profileImageUrl, `food/seed/restaurants/${slug}/profile`, { label: 'profile' }),
        resolveImageList(profile.coverImageUrls, `food/seed/restaurants/${slug}/cover`, { labelPrefix: 'cover' }),
        resolveImageList(profile.menuImageUrls, `food/seed/restaurants/${slug}/menu`, { labelPrefix: 'menu' }),
    ]);

    const doc = buildRestaurantDoc(profile, phone, {
        profile: profileImg,
        cover: coverImgs,
        menu: menuImgs,
    });

    const restaurant = await FoodRestaurant.create(doc);
    const restaurantId = restaurant._id;

    await FoodRestaurantOutletTimings.create({
        restaurantId,
        timings: defaultOutletTimings(),
    });

    const menuDef = getMenuForCuisine(profile.cuisineKey);
    const categories = menuDef.categories
        .map((c) => filterCategoryForDiet(c, profile.dietaryType))
        .filter(Boolean)
        .slice(0, profile.dietaryType === 'veg' ? 6 : 6);

    const categoryMap = new Map();
    for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const imageAsset = await resolveImageUrl(
            cat.imageUrl,
            `food/seed/restaurants/${slug}/categories`,
            { label: cat.name },
        );
        const categoryDoc = await FoodCategory.create({
            name: cat.name,
            image: imageAsset.url,
            imagePublicId: imageAsset.publicId,
            foodTypeScope: cat.foodTypeScope,
            restaurantId,
            createdByRestaurantId: restaurantId,
            approvalStatus: 'approved',
            isApproved: true,
            isActive: true,
            sortOrder: i + 1,
            requestedAt: now,
            approvedAt: now,
        });
        categoryMap.set(cat.name, categoryDoc);
        console.log(`  Category: ${cat.name}`);
    }

    const foodDocs = [];
    for (const cat of categories) {
        const categoryDoc = categoryMap.get(cat.name);
        const items = filterItemsForDiet(cat.items, profile.dietaryType);
        for (const item of items) {
            const imageAsset = await resolveImageUrl(
                item.imageUrl,
                `food/seed/restaurants/${slug}/items`,
                { label: item.name },
            );
            foodDocs.push({
                restaurantId,
                categoryId: categoryDoc._id,
                categoryName: cat.name,
                name: item.name,
                description: item.description,
                price: item.price,
                variants: [
                    { name: 'Regular', price: item.price, unit: 'Portion' },
                    { name: 'Large', price: item.price + 40, unit: 'Portion' },
                ],
                image: imageAsset.url,
                imagePublicId: imageAsset.publicId,
                foodType: normalizeItemFoodType(item.foodType),
                isAvailable: true,
                preparationTime: '15-20 mins',
                approvalStatus: 'approved',
                requestedAt: now,
                approvedAt: now,
            });
        }
    }

    for (const [globalName, globalItems] of Object.entries(GLOBAL_MENU_ITEMS)) {
        const globalCat = globalCategoryMap.get(globalName);
        if (!globalCat) continue;
        const allowed = filterItemsForDiet(globalItems, profile.dietaryType);
        for (const item of allowed) {
            const imageAsset = await resolveImageUrl(
                item.imageUrl,
                `food/seed/restaurants/${slug}/items-global`,
                { label: item.name },
            );
            foodDocs.push({
                restaurantId,
                categoryId: globalCat._id,
                categoryName: globalName,
                name: `${item.name}`,
                description: `Admin category item — ${item.name}`,
                price: item.price,
                image: imageAsset.url,
                imagePublicId: imageAsset.publicId,
                foodType: normalizeItemFoodType(item.foodType),
                isAvailable: true,
                preparationTime: '10-15 mins',
                approvalStatus: 'approved',
                requestedAt: now,
                approvedAt: now,
            });
        }
    }

    if (foodDocs.length) {
        await FoodItem.insertMany(foodDocs);
    }
    console.log(`  Menu items: ${foodDocs.length}`);

    return restaurant;
}

async function run() {
    const mongoUri = getMongoUri();
    if (!mongoUri) throw new Error('MONGODB_URI is not set');
    logMongoTarget(mongoUri);

    if (RESTAURANT_PROFILES.length !== SEED_RESTAURANT_COUNT) {
        throw new Error(`Expected ${SEED_RESTAURANT_COUNT} restaurant profiles, got ${RESTAURANT_PROFILES.length}`);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    if (CLEAN) {
        await cleanSeedData();
    }

    if (WITH_GLOBAL) {
        const { spawn } = await import('node:child_process');
        await new Promise((resolve, reject) => {
            const child = spawn(
                process.execPath,
                ['scripts/seedRestaurantOnboarding/seedGlobalCategories.js'],
                { stdio: 'inherit', cwd: process.cwd() },
            );
            child.on('error', reject);
            child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`global categories exit ${code}`))));
        });
    }

    const globalCategoryMap = await getGlobalCategoryMap();
    if (!globalCategoryMap.size) {
        console.warn('No global categories found. Run seedGlobalCategories.js first for admin-category menu items.');
    }

    let created = 0;
    for (let i = 0; i < RESTAURANT_PROFILES.length; i++) {
        await seedRestaurant(RESTAURANT_PROFILES[i], i, globalCategoryMap);
        created += 1;
    }

    console.log(`\n=== Done: ${created} restaurants seeded (phones 9810000020–9810000034) ===`);
    console.log('Next: node scripts/seedRestaurantOnboarding/seedAddons.js');
    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error('seedRestaurants failed:', err.message || err);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    process.exit(1);
});
