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
    
    console.log('--- Owner records ---');
    const owners = await Owner.find({});
    for (const o of owners) {
      console.log(JSON.stringify(o, null, 2));
    }

    console.log('\n--- Driver records ---');
    const drivers = await Driver.find({});
    for (const d of drivers) {
      console.log(JSON.stringify(d, null, 2));
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
