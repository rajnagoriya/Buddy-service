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
    
    console.log('--- Querying FoodDeliveryPartner for 7223077890 ---');
    const fp = await FoodDeliveryPartner.findOne({ phone: '7223077890' });
    console.log('FoodDeliveryPartner:', JSON.stringify(fp, null, 2));

    console.log('\n--- Querying Driver for 7223077890 ---');
    const d = await Driver.findOne({ phone: '7223077890' });
    console.log('Driver:', JSON.stringify(d, null, 2));

    console.log('\n--- Querying Owner for 7223077890 ---');
    const o = await Owner.findOne({ phone: '7223077890' });
    console.log('Owner:', JSON.stringify(o, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
