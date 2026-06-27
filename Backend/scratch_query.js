import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

async function run() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('MONGODB_URI is not set');
        process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Check addresses of buddy_users
    const buddyUsersCol = db.collection('buddy_users');
    const usersWithAddresses = await buddyUsersCol.find({ addresses: { $exists: true, $not: { $size: 0 } } }).toArray();
    console.log('\n--- USERS WITH ADDRESSES ---');
    console.log(JSON.stringify(usersWithAddresses, null, 2));

    // Check food_orders addresses / location
    const foodOrdersCol = db.collection('food_orders');
    const orders = await foodOrdersCol.find({}).sort({ createdAt: -1 }).limit(5).toArray();
    console.log('\n--- RECENT FOOD ORDERS ---');
    for (const o of orders) {
        console.log(`Order ID: ${o._id}, User: ${o.userId}, Address:`, JSON.stringify(o.deliveryAddress || o.address, null, 2));
    }

    // Check taxiservicelocations
    const taxiLocsCol = db.collection('taxiservicelocations');
    const taxiLocs = await taxiLocsCol.find({}).limit(5).toArray();
    console.log('\n--- TAXI SERVICE LOCATIONS ---');
    console.log(JSON.stringify(taxiLocs, null, 2));

    await mongoose.disconnect();
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
