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
    
    console.log('--- Querying Driver for 9755633147 ---');
    const driver = await Driver.findOne({ phone: '9755633147' });
    console.log('Driver:', JSON.stringify(driver, null, 2));

    console.log('\n--- Querying Owner for 9755633147 ---');
    const owner = await Owner.findOne({ phone: '9755633147' });
    console.log('Owner:', JSON.stringify(owner, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
