import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import { FoodDeliveryPartner } from './src/modules/food/delivery/models/deliveryPartner.model.js';
import { Driver } from './src/modules/taxi/driver/models/Driver.js';
import { Owner } from './src/modules/taxi/admin/models/Owner.js';

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const partners = await FoodDeliveryPartner.find({}, 'phone name');
    const drivers = await Driver.find({}, 'phone name role onboarding.role onboarding.convertedOwnerId');
    const owners = await Owner.find({}, 'phone name');

    console.log('--- Delivery Partners ---');
    partners.forEach(p => console.log(`DP: ${p.phone} (${p.name})`));

    console.log('\n--- Owners ---');
    owners.forEach(o => console.log(`Owner: ${o.phone} (${o.name}) ID: ${o._id}`));

    console.log('\n--- Drivers ---');
    drivers.forEach(d => console.log(`Driver: ${d.phone} (${d.name}) OwnerID: ${d.onboarding?.convertedOwnerId} OnboardingRole: ${d.onboarding?.role}`));

    // Check overlaps
    console.log('\n--- Overlaps between DP and Owner ---');
    partners.forEach(p => {
      const match = owners.find(o => o.phone === p.phone);
      if (match) {
        console.log(`DP and Owner overlap on: ${p.phone} (DP: ${p.name}, Owner: ${match.name})`);
      }
    });

    console.log('\n--- Overlaps between DP and Driver ---');
    partners.forEach(p => {
      const match = drivers.find(d => d.phone === p.phone);
      if (match) {
        console.log(`DP and Driver overlap on: ${p.phone} (DP: ${p.name}, Driver: ${match.name})`);
      }
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
