import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import { Owner } from './src/modules/taxi/admin/models/Owner.js';

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('--- Querying Owner by ID 6a057343dd93e4281cba315c ---');
    const o1 = await Owner.findById('6a057343dd93e4281cba315c');
    console.log('Owner by ID:', JSON.stringify(o1, null, 2));

    console.log('\n--- Querying Owner named Static Owner ---');
    const o2 = await Owner.findOne({ name: /Static Owner/i });
    console.log('Owner by name:', JSON.stringify(o2, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
