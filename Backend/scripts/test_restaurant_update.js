import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { updateRestaurantProfile } from '../src/modules/food/restaurant/services/restaurant.service.js';
import { approveRestaurant } from '../src/modules/food/admin/services/admin.service.js';

dotenv.config({ path: './.env' });

async function run() {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected!');

    // Define a unique suffix to avoid collisions
    const suffix = Date.now().toString().slice(-6);
    const mockEmail = `test-owner-${suffix}@example.com`;
    const mockPhone = `+9199999${suffix}`;

    console.log('Creating a mock approved restaurant...');
    const restaurant = await FoodRestaurant.create({
        restaurantName: `Test Restaurant ${suffix}`,
        restaurantNameNormalized: `test restaurant ${suffix}`,
        ownerName: 'Test Owner',
        ownerEmail: mockEmail,
        ownerPhone: mockPhone,
        ownerPhoneDigits: mockPhone.replace('+', ''),
        ownerPhoneLast10: mockPhone.slice(-10),
        status: 'approved',
        profileReviewStatus: null,
        location: {
            type: 'Point',
            coordinates: [77.5946, 12.9716], // Bangalore
            latitude: 12.9716,
            longitude: 77.5946,
            address: 'Old Address',
            formattedAddress: 'Old Address'
        },
        addressLine1: 'Old Address',
        city: 'Bangalore',
        area: 'Indiranagar',
        zoneId: new mongoose.Types.ObjectId()
    });

    console.log(`Mock restaurant created with ID: ${restaurant._id}`);

    try {
        console.log('\n--- Attempting Location & Zone Update (should trigger pending approval) ---');
        const updatedProfile = await updateRestaurantProfile(restaurant._id, {
            zoneSelectionUpdate: true, // simulates zone setup page
            zoneId: new mongoose.Types.ObjectId().toString(),
            location: {
                latitude: 13.0827,
                longitude: 80.2707, // Chennai
                address: 'New Location Address',
                formattedAddress: 'New Location Address',
                city: 'Chennai',
                area: 'Adyar'
            }
        });

        // Fetch fresh document from DB to check live values
        const dbDoc = await FoodRestaurant.findById(restaurant._id).lean();

        console.log('\nResults after update request:');
        console.log(`Status: ${dbDoc.status} (expected: approved)`);
        console.log(`Profile Review Status: ${dbDoc.profileReviewStatus} (expected: null/undefined)`);
        console.log(`Live location coordinates: ${dbDoc.location.coordinates} (expected: 80.2707, 13.0827 - updated)`);
        console.log(`Live city: ${dbDoc.city} (expected: Chennai - updated)`);

        if (dbDoc.profileReviewStatus && dbDoc.profileReviewStatus === 'pending') {
            throw new Error(`Assertion failed: profileReviewStatus is pending but expected direct update`);
        }
        if (dbDoc.location.coordinates[0] !== 80.2707) {
            throw new Error('Assertion failed: Live coordinates were not updated directly!');
        }
        if (dbDoc.city !== 'Chennai') {
            throw new Error('Assertion failed: City was not updated directly!');
        }

        console.log('\n--- Bypassed approval (applied directly) ---');
        const approvedDoc = dbDoc;
        console.log('\nResults after admin approval:');
        console.log(`Status: ${approvedDoc.status} (expected: approved)`);
        console.log(`Profile Review Status: ${approvedDoc.profileReviewStatus} (expected: undefined/null)`);
        console.log(`Live location coordinates: ${approvedDoc.location.coordinates} (expected: 80.2707,13.0827 - updated)`);
        console.log(`Live city: ${approvedDoc.city} (expected: Chennai - updated)`);
        console.log(`Pending profile:`, approvedDoc.pendingProfile);

        if (approvedDoc.profileReviewStatus) {
            throw new Error('Assertion failed: profileReviewStatus was not cleared');
        }
        if (approvedDoc.location.coordinates[0] !== 80.2707) {
            throw new Error('Assertion failed: Live coordinates were not updated after approval');
        }

        console.log('\nSUCCESS! All assertions passed.');
    } finally {
        console.log('\nCleaning up mock restaurant...');
        await FoodRestaurant.deleteOne({ _id: restaurant._id });
        console.log('Cleanup done.');
        await disconnectDB();
    }
}

run().catch(async (err) => {
    console.error('Test failed with error:', err);
    await disconnectDB();
    process.exit(1);
});
