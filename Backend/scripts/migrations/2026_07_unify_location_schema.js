/**
 * Additive-only migration for the centralized location schema.
 *
 * Backfills new/renamed fields (pincode, addressLine1, country) on existing
 * User addresses and Order delivery addresses, and consolidates the
 * DeliveryPartner's three unsynced location representations
 * (lastLocation / lastLat+lastLng / location) into the new `currentLocation`
 * field - explicitly skipping literal [0,0] "Null Island" values so the bug
 * isn't propagated into the new field.
 *
 * Safe to re-run (idempotent). Run against staging first, diff a sample of
 * before/after documents, then run against prod. Does not remove any
 * existing fields - see Phase 5 cleanup for that.
 *
 * Usage: node Backend/scripts/migrations/2026_07_unify_location_schema.js
 */
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { FoodUser } from '../../src/core/users/user.model.js';
import { FoodRestaurant } from '../../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../../src/modules/food/delivery/models/deliveryPartner.model.js';
import { FoodOrder } from '../../src/modules/food/orders/models/order.model.js';
import { isValidNonZeroCoordinate } from '../../src/core/location/location.schema.js';

dotenv.config({ path: './.env' });

/** Backfill pincode<-zipCode and addressLine1<-street on every address in an array field, via bulkWrite + arrayFilters. */
async function backfillAddressArray(Model, arrayField) {
    const filter = {
        [arrayField]: {
            $elemMatch: {
                $or: [
                    { zipCode: { $exists: true, $ne: '' }, pincode: { $exists: false } },
                    { street: { $exists: true, $ne: '' }, addressLine1: { $exists: false } },
                    { country: { $exists: false } }
                ]
            }
        }
    };

    const docs = await Model.find(filter).select(`_id ${arrayField}`).lean();
    let matched = 0;
    let modified = 0;

    for (const doc of docs) {
        matched += 1;
        const ops = [];
        const items = doc[arrayField] || [];
        items.forEach((item, idx) => {
            const set = {};
            if (item.zipCode && !item.pincode) set[`${arrayField}.${idx}.pincode`] = item.zipCode;
            if (item.street && !item.addressLine1) set[`${arrayField}.${idx}.addressLine1`] = item.street;
            if (!item.country) set[`${arrayField}.${idx}.country`] = 'India';
            if (Object.keys(set).length) ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
        });
        if (ops.length) {
            await Model.bulkWrite(ops);
            modified += 1;
        }
    }

    return { matched, modified };
}

/** Backfill pincode<-zipCode / addressLine1<-street / country on a single embedded object field (not an array). */
async function backfillAddressObject(Model, field) {
    const docs = await Model.find({
        $or: [
            { [`${field}.zipCode`]: { $exists: true, $ne: '' }, [`${field}.pincode`]: { $exists: false } },
            { [`${field}.street`]: { $exists: true, $ne: '' }, [`${field}.addressLine1`]: { $exists: false } },
            { [`${field}.country`]: { $exists: false }, [field]: { $exists: true } }
        ]
    })
        .select(`_id ${field}`)
        .lean();

    let modified = 0;
    for (const doc of docs) {
        const obj = doc[field];
        if (!obj) continue;
        const set = {};
        if (obj.zipCode && !obj.pincode) set[`${field}.pincode`] = obj.zipCode;
        if (obj.street && !obj.addressLine1) set[`${field}.addressLine1`] = obj.street;
        if (!obj.country) set[`${field}.country`] = 'India';
        if (Object.keys(set).length) {
            await Model.updateOne({ _id: doc._id }, { $set: set });
            modified += 1;
        }
    }

    return { matched: docs.length, modified };
}

async function backfillRestaurantCountry() {
    const res = await FoodRestaurant.updateMany(
        { location: { $exists: true }, 'location.country': { $exists: false } },
        { $set: { 'location.country': 'India' } }
    );
    return { matched: res.matchedCount ?? res.n, modified: res.modifiedCount ?? res.nModified };
}

async function consolidateDeliveryPartnerLocation() {
    const partners = await FoodDeliveryPartner.find({ currentLocation: { $exists: false } })
        .select('_id lastLocation lastLat lastLng location lastLocationAt')
        .lean();

    let modified = 0;
    let unrecoverable = 0;

    for (const partner of partners) {
        let lat;
        let lng;

        const lastLocCoords = partner.lastLocation?.coordinates;
        if (Array.isArray(lastLocCoords) && lastLocCoords.length === 2 && isValidNonZeroCoordinate(lastLocCoords[1], lastLocCoords[0])) {
            [lng, lat] = lastLocCoords;
        } else if (isValidNonZeroCoordinate(partner.lastLat, partner.lastLng)) {
            lat = partner.lastLat;
            lng = partner.lastLng;
        } else {
            const locCoords = partner.location?.coordinates;
            if (Array.isArray(locCoords) && locCoords.length === 2 && isValidNonZeroCoordinate(locCoords[1], locCoords[0])) {
                [lng, lat] = locCoords;
            }
        }

        if (lat === undefined || lng === undefined) {
            unrecoverable += 1;
            continue;
        }

        await FoodDeliveryPartner.updateOne(
            { _id: partner._id },
            {
                $set: {
                    currentLocation: {
                        type: 'Point',
                        coordinates: [lng, lat],
                        latitude: lat,
                        longitude: lng,
                        country: 'India'
                    }
                }
            }
        );
        modified += 1;
    }

    return { matched: partners.length, modified, unrecoverable };
}

async function run() {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected!');

    console.log('\n--- FoodUser.addresses backfill (pincode/addressLine1/country) ---');
    const userResult = await backfillAddressArray(FoodUser, 'addresses');
    console.log(`Matched: ${userResult.matched}, modified: ${userResult.modified}`);

    console.log('\n--- FoodRestaurant.location.country backfill ---');
    const restaurantResult = await backfillRestaurantCountry();
    console.log(`Matched: ${restaurantResult.matched}, modified: ${restaurantResult.modified}`);

    console.log('\n--- FoodDeliveryPartner location consolidation -> currentLocation ---');
    const partnerResult = await consolidateDeliveryPartnerLocation();
    console.log(`Matched: ${partnerResult.matched}, modified: ${partnerResult.modified}, unrecoverable (no valid last-known point): ${partnerResult.unrecoverable}`);

    console.log('\n--- FoodOrder.deliveryAddress backfill (pincode/addressLine1/country) ---');
    const orderResult = await backfillAddressObject(FoodOrder, 'deliveryAddress');
    console.log(`Matched: ${orderResult.matched}, modified: ${orderResult.modified}`);

    console.log('\nMigration complete.');
    await disconnectDB();
}

run().catch(async (err) => {
    console.error('Migration failed with error:', err);
    await disconnectDB();
    process.exit(1);
});
