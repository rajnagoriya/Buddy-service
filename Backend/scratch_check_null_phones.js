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
    
    console.log('--- Querying Drivers with null/undefined phone ---');
    const drivers = await Driver.find({ $or: [{ phone: null }, { phone: { $exists: false } }] });
    console.log('Drivers:', drivers.map(d => ({ _id: d._id, name: d.name, phone: d.phone })));

    console.log('\n--- Querying Owners with null/undefined phone ---');
    const owners = await Owner.find({ $or: [{ phone: null }, { phone: { $exists: false } }] });
    console.log('Owners:', owners.map(o => ({ _id: o._id, name: o.name, phone: o.phone })));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
