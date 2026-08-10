/**
 * Seed 7 fully-onboarded Indore restaurants with categories, menu items
 * (including variant ladders) and addons.
 *
 * Every restaurant lands in the exact state it would be in after
 *   register → onboarding step 1/2/3 → submit → admin approve
 * so nothing has to be filled in by hand before testing.
 *
 * USAGE
 *   node scripts/seedIndore/seedIndore.js                  # create (re-seeds an existing seed restaurant)
 *   node scripts/seedIndore/seedIndore.js --clean          # wipe seed data first, then create
 *   node scripts/seedIndore/seedIndore.js --skip-existing  # leave already-seeded restaurants untouched
 *   node scripts/seedIndore/seedIndore.js --offline-images # skip image probing/upload (fast)
 *   node scripts/seedIndore/seedIndore.js --wipe-only      # only remove seed data, create nothing
 *
 * ENV
 *   MONGODB_URI / MONGO_URI / SEED_MONGODB_URI
 *   CLOUDINARY_*  (optional — when set, images are mirrored into Cloudinary)
 *
 * Owner phones: 9111100001 … 9111100007
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import { FoodRestaurant } from '../../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodCategory } from '../../src/modules/food/admin/models/category.model.js';
import { FoodItem } from '../../src/modules/food/admin/models/food.model.js';
import { FoodAddon } from '../../src/modules/food/restaurant/models/foodAddon.model.js';
import { FoodRestaurantOutletTimings } from '../../src/modules/food/restaurant/models/outletTimings.model.js';
import { FoodRestaurantWallet } from '../../src/modules/food/restaurant/models/restaurantWallet.model.js';
import { FoodRestaurantCommission } from '../../src/modules/food/admin/models/restaurantCommission.model.js';
import { FoodZone } from '../../src/modules/food/admin/models/zone.model.js';

import { RESTAURANT_PROFILES, DOCUMENT_IMAGES } from './restaurants.data.js';
import { getMenuFor } from './menu.data.js';
import { getAddonsFor } from './addons.data.js';
import { GLOBAL_CATEGORIES, GLOBAL_CATEGORY_MAP } from './globalCategories.data.js';
import { ZONES, PRIMARY_ZONE_KEY } from './zones.data.js';
import {
    buildOwnerPhone,
    buildSeedPhoneFilter,
    CITY,
    OUTLET_TIMING_PRESETS,
} from './config.js';
import {
    buildOutletTimings,
    getMongoUri,
    imageStats,
    logMongoTarget,
    resolveImage,
    resolveImageList,
    slugify,
    toOutletTimingsMap,
    verifyDefaultImages,
} from './helpers.js';

dotenv.config();

const CLEAN = process.argv.includes('--clean');
const WIPE_ONLY = process.argv.includes('--wipe-only');
const SKIP_EXISTING = process.argv.includes('--skip-existing');

const NOW = new Date();
const COUNT = RESTAURANT_PROFILES.length;

const totals = { restaurants: 0, categories: 0, items: 0, variants: 0, addons: 0 };

/* ------------------------------------------------------------------ *
 * Validation — fail loudly before writing anything
 * ------------------------------------------------------------------ */

const assertProfilesAreConsistent = () => {
    const emails = new Set();
    const names = new Set();

    for (const profile of RESTAURANT_PROFILES) {
        if (emails.has(profile.ownerEmail)) {
            throw new Error(`Duplicate ownerEmail: ${profile.ownerEmail}`);
        }
        if (names.has(profile.restaurantName)) {
            throw new Error(`Duplicate restaurantName: ${profile.restaurantName}`);
        }
        emails.add(profile.ownerEmail);
        names.add(profile.restaurantName);

        if (!OUTLET_TIMING_PRESETS[profile.timingPreset]) {
            throw new Error(`${profile.restaurantName}: unknown timingPreset "${profile.timingPreset}"`);
        }

        const menu = getMenuFor(profile.menuKey);

        // A pure-veg restaurant must not carry a single non-veg item — the user
        // app trusts pureVegRestaurant when filtering.
        if (profile.dietaryType === 'veg') {
            const offenders = menu
                .flatMap((c) => c.items)
                .filter((i) => i.foodType !== 'Veg')
                .map((i) => i.name);
            if (offenders.length) {
                throw new Error(
                    `${profile.restaurantName} is dietaryType "veg" but has non-veg items: ${offenders.join(', ')}`,
                );
            }
        }

        for (const cat of menu) {
            for (const menuItem of cat.items) {
                if (menuItem.variants.length) {
                    const prices = menuItem.variants.map((v) => v.price);
                    if (new Set(prices).size !== prices.length) {
                        throw new Error(`${menuItem.name}: variant prices must be distinct (${prices.join(', ')})`);
                    }
                    if (menuItem.price !== Math.min(...prices)) {
                        throw new Error(
                            `${menuItem.name}: display price ${menuItem.price} !== min variant price ${Math.min(...prices)}`,
                        );
                    }
                }
            }
        }

        const globalMap = GLOBAL_CATEGORY_MAP[profile.menuKey] || {};
        const menuCategoryNames = new Set(menu.map((c) => c.name));
        for (const [catName, globalKey] of Object.entries(globalMap)) {
            if (!menuCategoryNames.has(catName)) {
                throw new Error(`${profile.restaurantName}: GLOBAL_CATEGORY_MAP references unknown category "${catName}"`);
            }
            if (!GLOBAL_CATEGORIES.some((g) => g.key === globalKey)) {
                throw new Error(`${profile.restaurantName}: unknown global category key "${globalKey}"`);
            }
        }
    }
};

/* ------------------------------------------------------------------ *
 * Cleanup
 * ------------------------------------------------------------------ */

const wipeSeedData = async () => {
    const restaurants = await FoodRestaurant.find(buildSeedPhoneFilter(COUNT)).select('_id').lean();
    const ids = restaurants.map((r) => r._id);

    if (!ids.length) {
        console.log('Nothing to wipe — no seed restaurants found.');
        return 0;
    }

    // Only restaurant-owned categories are removed; shared admin categories survive.
    await Promise.all([
        FoodCategory.deleteMany({
            $or: [{ restaurantId: { $in: ids } }, { createdByRestaurantId: { $in: ids } }],
        }),
        FoodItem.deleteMany({ restaurantId: { $in: ids } }),
        FoodAddon.deleteMany({ restaurantId: { $in: ids } }),
        FoodRestaurantOutletTimings.deleteMany({ restaurantId: { $in: ids } }),
        FoodRestaurantWallet.deleteMany({ restaurantId: { $in: ids } }),
        FoodRestaurantCommission.deleteMany({ restaurantId: { $in: ids } }),
    ]);
    await FoodRestaurant.deleteMany({ _id: { $in: ids } });

    console.log(`Wiped ${ids.length} seed restaurants and all related data.`);
    return ids.length;
};

const removeOneRestaurant = async (id) => {
    await Promise.all([
        FoodCategory.deleteMany({ $or: [{ restaurantId: id }, { createdByRestaurantId: id }] }),
        FoodItem.deleteMany({ restaurantId: id }),
        FoodAddon.deleteMany({ restaurantId: id }),
        FoodRestaurantOutletTimings.deleteMany({ restaurantId: id }),
        FoodRestaurantWallet.deleteMany({ restaurantId: id }),
        FoodRestaurantCommission.deleteMany({ restaurantId: id }),
    ]);
    await FoodRestaurant.deleteOne({ _id: id });
};

/* ------------------------------------------------------------------ *
 * Zones + global categories
 * ------------------------------------------------------------------ */

const seedZones = async () => {
    const byKey = new Map();

    for (const zone of ZONES) {
        const doc = await FoodZone.findOneAndUpdate(
            { name: zone.name },
            {
                $set: {
                    name: zone.name,
                    zoneName: zone.zoneName,
                    serviceLocation: zone.serviceLocation,
                    country: zone.country,
                    unit: zone.unit,
                    coordinates: zone.coordinates,
                    isActive: zone.isActive,
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        byKey.set(zone.key, doc);
        console.log(`Zone ready: ${doc.name} (${doc._id})`);
    }

    return byKey;
};

const seedGlobalCategories = async () => {
    const byKey = new Map();

    for (const cat of GLOBAL_CATEGORIES) {
        const image = await resolveImage(cat.imageUrl, 'food/seed/indore/categories/global', {
            tag: cat.tag,
            label: `global category ${cat.name}`,
        });

        const doc = await FoodCategory.findOneAndUpdate(
            {
                name: cat.name,
                $or: [{ restaurantId: { $exists: false } }, { restaurantId: null }],
            },
            {
                $set: {
                    name: cat.name,
                    image: image.url,
                    imagePublicId: image.publicId,
                    type: 'global',
                    foodTypeScope: cat.foodTypeScope,
                    approvalStatus: 'approved',
                    isApproved: true,
                    isActive: true,
                    adminDeactivated: false,
                    sortOrder: cat.sortOrder,
                    approvedAt: NOW,
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        byKey.set(cat.key, doc);
        console.log(`Global category ready: ${doc.name} (${doc._id})`);
    }

    return byKey;
};

/* ------------------------------------------------------------------ *
 * Restaurant document
 * ------------------------------------------------------------------ */

const buildRestaurantDoc = (profile, phone, zoneId, images, outletTimings) => {
    const isPureVeg = profile.dietaryType === 'veg';
    const formattedAddress = [
        profile.addressLine1,
        profile.addressLine2,
        profile.area,
        `${CITY.city}, ${CITY.state} ${profile.pincode}`,
    ]
        .filter(Boolean)
        .join(', ');

    const location = {
        type: 'Point',
        coordinates: [profile.lng, profile.lat],
        latitude: profile.lat,
        longitude: profile.lng,
        formattedAddress,
        address: formattedAddress,
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2 || '',
        area: profile.area,
        city: CITY.city,
        state: CITY.state,
        pincode: profile.pincode,
        landmark: profile.landmark || '',
    };

    // imagePublicIds only tracks the single-image fields — uploadStepFiles() in
    // restaurantOnboarding.service.js sets it via setRestaurantImageField() for
    // exactly these four. Gallery images carry their own publicId inline.
    const imagePublicIds = {};
    if (images.profile.publicId) imagePublicIds.profileImage = images.profile.publicId;
    if (images.pan.publicId) imagePublicIds.panImage = images.pan.publicId;
    if (images.gst?.publicId) imagePublicIds.gstImage = images.gst.publicId;
    if (images.fssai.publicId) imagePublicIds.fssaiImage = images.fssai.publicId;

    // Stored as { url, publicId } assets, matching what uploadFoodImage() returns
    // in the real upload path (restaurant.service.js / uploadStepFiles).
    const coverImages = images.cover.map((a) => ({ url: a.url, publicId: a.publicId }));
    const menuImages = images.menu.map((a) => ({ url: a.url, publicId: a.publicId }));

    const fssaiExpiry = new Date(NOW);
    fssaiExpiry.setFullYear(fssaiExpiry.getFullYear() + profile.fssai.expiryYearsFromNow);

    const gstRegistered = Boolean(profile.gst?.isRegistered);

    return {
        restaurantName: profile.restaurantName,
        ownerName: profile.ownerName,
        ownerEmail: profile.ownerEmail,
        ownerPhone: phone,
        primaryContactNumber: phone,

        pureVegRestaurant: isPureVeg,
        dietaryType: profile.dietaryType,
        cuisines: profile.cuisines,

        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2 || '',
        area: profile.area,
        city: CITY.city,
        state: CITY.state,
        pincode: profile.pincode,
        landmark: profile.landmark || '',
        location,
        zoneId,

        profileImage: images.profile.url,
        coverImages,
        menuImages,
        panImage: images.pan.url,
        gstImage: gstRegistered ? images.gst.url : '',
        fssaiImage: images.fssai.url,
        imagePublicIds,

        estimatedDeliveryTime: profile.estimatedDeliveryTime,
        estimatedDeliveryTimeMinutes: profile.estimatedDeliveryTimeMinutes,
        packagingFee: profile.packagingFee,
        featuredDish: profile.featuredDish,
        featuredPrice: profile.featuredPrice,
        offer: profile.offer,
        rating: profile.rating,
        totalRatings: profile.totalRatings,

        // Compliance
        panNumber: profile.pan.panNumber,
        nameOnPan: profile.pan.nameOnPan,
        gstRegistered,
        gstNumber: gstRegistered ? profile.gst.gstNumber : '',
        gstLegalName: gstRegistered ? profile.gst.legalName : '',
        gstAddress: gstRegistered ? profile.gst.address : '',
        fssaiNumber: profile.fssai.registrationNumber,
        fssaiExpiry,

        // Payouts
        accountNumber: profile.bank.accountNumber,
        ifscCode: profile.bank.ifscCode,
        accountHolderName: profile.bank.accountHolderName,
        accountType: profile.bank.accountType,
        upiId: profile.upiId,

        diningSettings: {
            isEnabled: profile.dining.isEnabled,
            maxGuests: profile.dining.maxGuests,
            diningType: profile.dining.diningType,
        },

        // Post-approval state
        isAcceptingOrders: true,
        isActive: true,
        status: 'approved',
        onboardingStatus: 'APPROVED',
        currentStep: null,
        completedSteps: [1, 2, 3],
        submittedAt: NOW,
        verifiedAt: NOW,
        approvedAt: NOW,

        // Mirrors what saveOnboardingStep() writes, so the onboarding screens
        // rehydrate with every field already answered.
        onboarding: {
            step1: {
                restaurantName: profile.restaurantName,
                pureVegRestaurant: isPureVeg,
                dietaryType: profile.dietaryType,
                ownerName: profile.ownerName,
                ownerEmail: profile.ownerEmail,
                ownerPhone: phone,
                primaryContactNumber: phone,
                zoneId: String(zoneId),
                location,
            },
            step2: {
                cuisines: profile.cuisines,
                // Day-keyed map, matching what saveOnboardingStep() persists.
                outletTimings: toOutletTimingsMap(outletTimings),
                menuImageUrls: menuImages,
                profileImageUrl: images.profile.url,
                estimatedDeliveryTime: profile.estimatedDeliveryTime,
            },
            step3: {
                pan: {
                    panNumber: profile.pan.panNumber,
                    nameOnPan: profile.pan.nameOnPan,
                    image: images.pan.url,
                },
                gst: {
                    isRegistered: gstRegistered,
                    gstNumber: gstRegistered ? profile.gst.gstNumber : '',
                    legalName: gstRegistered ? profile.gst.legalName : '',
                    address: gstRegistered ? profile.gst.address : '',
                    image: gstRegistered ? images.gst.url : '',
                },
                fssai: {
                    registrationNumber: profile.fssai.registrationNumber,
                    expiryDate: fssaiExpiry,
                    image: images.fssai.url,
                },
                bank: {
                    accountNumber: profile.bank.accountNumber,
                    ifscCode: profile.bank.ifscCode,
                    accountHolderName: profile.bank.accountHolderName,
                    accountType: profile.bank.accountType,
                },
            },
        },
    };
};

/* ------------------------------------------------------------------ *
 * Per-restaurant seeding
 * ------------------------------------------------------------------ */

const seedRestaurant = async (profile, index, zoneId, globalCategoryMap) => {
    const phone = buildOwnerPhone(index);
    const slug = slugify(profile.restaurantName);

    const existing = await FoodRestaurant.findOne({
        $or: [{ ownerPhoneLast10: phone.slice(-10) }, { ownerEmail: profile.ownerEmail }],
    })
        .select('_id restaurantName')
        .lean();

    if (existing) {
        if (SKIP_EXISTING) {
            console.log(`\n- Skipping existing ${profile.restaurantName} (${phone})`);
            return;
        }
        console.log(`\n- Re-seeding ${profile.restaurantName}: removing previous data`);
        await removeOneRestaurant(existing._id);
    }

    console.log(`\n=== ${index + 1}/${COUNT}  ${profile.restaurantName} — ${profile.area}, Indore (${phone}) ===`);

    const gstRegistered = Boolean(profile.gst?.isRegistered);
    const [profileImg, coverImgs, menuImgs, panImg, gstImg, fssaiImg] = await Promise.all([
        resolveImage(profile.profileImageUrl, `food/seed/indore/${slug}/profile`, {
            tag: 'restaurant',
            label: `${profile.restaurantName} profile`,
        }),
        resolveImageList(profile.coverImageUrls, `food/seed/indore/${slug}/cover`, {
            tag: 'cover',
            labelPrefix: `${profile.restaurantName} cover`,
        }),
        resolveImageList(profile.menuImageUrls, `food/seed/indore/${slug}/menu`, {
            tag: 'menuCard',
            labelPrefix: `${profile.restaurantName} menu`,
        }),
        resolveImage(DOCUMENT_IMAGES.pan, `food/seed/indore/${slug}/docs`, {
            tag: 'category',
            label: `${profile.restaurantName} PAN`,
        }),
        gstRegistered
            ? resolveImage(DOCUMENT_IMAGES.gst, `food/seed/indore/${slug}/docs`, {
                  tag: 'category',
                  label: `${profile.restaurantName} GST`,
              })
            : Promise.resolve({ url: '', publicId: '' }),
        resolveImage(DOCUMENT_IMAGES.fssai, `food/seed/indore/${slug}/docs`, {
            tag: 'category',
            label: `${profile.restaurantName} FSSAI`,
        }),
    ]);

    const outletTimings = buildOutletTimings(OUTLET_TIMING_PRESETS[profile.timingPreset]);

    const restaurant = await FoodRestaurant.create(
        buildRestaurantDoc(profile, phone, zoneId, {
            profile: profileImg,
            cover: coverImgs,
            menu: menuImgs,
            pan: panImg,
            gst: gstImg,
            fssai: fssaiImg,
        }, outletTimings),
    );
    const restaurantId = restaurant._id;
    totals.restaurants += 1;

    await FoodRestaurantOutletTimings.create({ restaurantId, timings: outletTimings });

    await FoodRestaurantWallet.create({
        restaurantId,
        balance: 0,
        lockedAmount: 0,
        totalEarnings: 0,
        totalSettled: 0,
    });

    await FoodRestaurantCommission.create({
        restaurantId,
        defaultCommission: { type: 'percentage', value: profile.commissionPercent },
        notes: 'Seeded default commission for Indore test data',
        status: true,
    });

    /* ---- categories ---- */
    const menu = getMenuFor(profile.menuKey);
    const globalMap = GLOBAL_CATEGORY_MAP[profile.menuKey] || {};
    const categoryIdByName = new Map();

    for (let i = 0; i < menu.length; i++) {
        const cat = menu[i];
        const globalKey = globalMap[cat.name];

        if (globalKey) {
            // Items go under the shared admin category — nothing new to create.
            const globalDoc = globalCategoryMap.get(globalKey);
            categoryIdByName.set(cat.name, { id: globalDoc._id, name: globalDoc.name });
            console.log(`  Category (admin/global): ${cat.name} → ${globalDoc.name}`);
            continue;
        }

        const image = await resolveImage(cat.image, `food/seed/indore/${slug}/categories`, {
            tag: cat.tag,
            label: `${profile.restaurantName} / ${cat.name}`,
        });

        const doc = await FoodCategory.create({
            name: cat.name,
            image: image.url,
            imagePublicId: image.publicId,
            type: 'restaurant',
            foodTypeScope: cat.foodTypeScope,
            restaurantId,
            createdByRestaurantId: restaurantId,
            zoneId,
            approvalStatus: 'approved',
            isApproved: true,
            isActive: true,
            adminDeactivated: false,
            sortOrder: i + 1,
            requestedAt: NOW,
            approvedAt: NOW,
        });

        categoryIdByName.set(cat.name, { id: doc._id, name: doc.name });
        totals.categories += 1;
        console.log(`  Category: ${cat.name} (${cat.foodTypeScope}, ${cat.items.length} items)`);
    }

    /* ---- menu items ---- */
    const itemDocs = [];

    for (const cat of menu) {
        const target = categoryIdByName.get(cat.name);

        for (const menuItem of cat.items) {
            const image = await resolveImage(menuItem.image, `food/seed/indore/${slug}/items`, {
                tag: menuItem.tag,
                label: `${profile.restaurantName} / ${menuItem.name}`,
            });

            itemDocs.push({
                restaurantId,
                categoryId: target.id,
                categoryName: target.name,
                name: menuItem.name,
                description: menuItem.description,
                // Display price; equals min(variant price) when a ladder exists.
                price: menuItem.price,
                variants: menuItem.variants,
                image: image.url,
                imagePublicId: image.publicId,
                foodType: menuItem.foodType,
                isAvailable: menuItem.isAvailable,
                preparationTime: menuItem.prepTime,
                approvalStatus: 'approved',
                requestedAt: NOW,
                approvedAt: NOW,
            });

            totals.variants += menuItem.variants.length;
        }
    }

    if (itemDocs.length) {
        await FoodItem.insertMany(itemDocs);
        totals.items += itemDocs.length;
    }
    console.log(`  Menu items: ${itemDocs.length}`);

    /* ---- addons ---- */
    const addons = getAddonsFor(profile.menuKey);
    for (const addon of addons) {
        const payload = {
            name: addon.name,
            description: addon.description,
            price: addon.price,
            image: '',
            images: [],
        };
        await FoodAddon.create({
            restaurantId,
            draft: payload,
            published: payload,
            approvalStatus: 'approved',
            isAvailable: true,
            isDeleted: false,
            requestedAt: NOW,
            approvedAt: NOW,
        });
        totals.addons += 1;
    }
    console.log(`  Addons: ${addons.length}`);
};

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

async function run() {
    assertProfilesAreConsistent();
    console.log(`Validated ${COUNT} restaurant profiles and their menus.`);

    await verifyDefaultImages();
    console.log('');

    const mongoUri = getMongoUri();
    if (!mongoUri) throw new Error('MONGODB_URI is not set (checked SEED_MONGODB_URI, MONGODB_URI, MONGO_URI)');
    logMongoTarget(mongoUri);

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    if (CLEAN || WIPE_ONLY) {
        await wipeSeedData();
        if (WIPE_ONLY) {
            await mongoose.disconnect();
            return;
        }
        console.log('');
    }

    const zoneMap = await seedZones();
    const zoneId = zoneMap.get(PRIMARY_ZONE_KEY)._id;
    console.log('');

    const globalCategoryMap = await seedGlobalCategories();

    for (let i = 0; i < COUNT; i++) {
        await seedRestaurant(RESTAURANT_PROFILES[i], i, zoneId, globalCategoryMap);
    }

    console.log('\n============================================');
    console.log('Indore seed complete');
    console.log('============================================');
    console.log(`Restaurants        : ${totals.restaurants}`);
    console.log(`Private categories : ${totals.categories}`);
    console.log(`Global categories  : ${GLOBAL_CATEGORIES.length}`);
    console.log(`Menu items         : ${totals.items}`);
    console.log(`Variants           : ${totals.variants}`);
    console.log(`Addons             : ${totals.addons}`);
    console.log(`Images             : ${imageStats.curatedUsed} curated, ${imageStats.fallbackUsed} default, ${imageStats.uploaded} uploaded to Cloudinary`);
    console.log(`\nOwner phones       : ${buildOwnerPhone(0)} … ${buildOwnerPhone(COUNT - 1)}`);
    console.log('Restaurant login   : POST /api/v1/auth/restaurant/request-otp → verify-otp');

    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error('\nseedIndore failed:', err.message || err);
    if (err.stack) console.error(err.stack);
    try {
        await mongoose.disconnect();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
