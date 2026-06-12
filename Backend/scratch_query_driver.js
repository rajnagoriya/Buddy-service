import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import { Driver } from './src/modules/taxi/driver/models/Driver.js';
import { Owner } from './src/modules/taxi/admin/models/Owner.js';

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('--- Querying Driver named Static Owner ---');
    const d1 = await Driver.findOne({ name: /Static Owner/i });
    console.log('Driver by name:', JSON.stringify(d1, null, 2));

    console.log('\n--- Querying Driver by convertedOwnerId ---');
    const d2 = await Driver.findOne({ 'onboarding.convertedOwnerId': '6a057343dd93e4281cba315c' });
    console.log('Driver by convertedOwnerId:', JSON.stringify(d2, null, 2));

    console.log('\n--- Querying Driver by role = owner ---');
    const d3 = await Driver.findOne({ role: 'owner' });
    console.log('Driver by role:', JSON.stringify(d3, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
