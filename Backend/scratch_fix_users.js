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

    const db = mongoose.connection.db;

    const usersCol = db.collection('buddy_users');
    const badUsers = await usersCol.find({ fcmTokenMobile: { $type: 'array' } }).toArray();
    
    console.log(`Found ${badUsers.length} users with array fcmTokenMobile`);
    for (const user of badUsers) {
        console.log(`User ${user._id}: fcmTokenMobile =`, user.fcmTokenMobile);
        // Fix the user
        await usersCol.updateOne({ _id: user._id }, { $set: { fcmTokenMobile: '' } });
        console.log(`Fixed user ${user._id}`);
    }

    await mongoose.disconnect();
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
