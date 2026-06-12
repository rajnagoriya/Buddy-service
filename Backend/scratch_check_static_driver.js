import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import { Driver } from './src/modules/taxi/driver/models/Driver.js';

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('--- Querying Drivers by owner_id ---');
    const drivers1 = await Driver.find({ owner_id: '6a057343dd93e4281cba315c' });
    console.log('By owner_id:', JSON.stringify(drivers1, null, 2));

    console.log('\n--- Querying Drivers by onboarding.convertedOwnerId ---');
    const drivers2 = await Driver.find({ 'onboarding.convertedOwnerId': '6a057343dd93e4281cba315c' });
    console.log('By convertedOwnerId:', JSON.stringify(drivers2, null, 2));

    console.log('\n--- Querying Drivers by phone 7610416911 ---');
    const drivers3 = await Driver.find({ phone: '7610416911' });
    console.log('By phone:', JSON.stringify(drivers3, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
