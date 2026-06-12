import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import { Driver } from '../src/modules/taxi/driver/models/Driver.js';
import { Owner } from '../src/modules/taxi/admin/models/Owner.js';

dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config();

const run = async () => {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);

  const drivers = await Driver.find().lean();
  console.log(`Found ${drivers.length} total drivers in Taxi:`);
  for (const d of drivers) {
    console.log(`- Driver ID: ${d._id}, Phone: ${d.phone}, Role: ${d.role}, Name: ${d.name || d.fullName}`);
    console.log(`  RegisterFor: ${d.registerFor}, DeliveryPartnerId: ${d.deliveryPartnerId}, Owner_Id: ${d.owner_id}`);
  }

  const owners = await Owner.find().lean();
  console.log(`Found ${owners.length} total owners in Taxi:`);
  for (const o of owners) {
    console.log(`- Owner ID: ${o._id}, Phone: ${o.phone}, Name: ${o.name || o.owner_name}`);
  }

  await mongoose.disconnect();
};

run().catch(console.error);
