import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import { FoodDeliveryPartner } from './src/modules/food/delivery/models/deliveryPartner.model.js';
import { Driver } from './src/modules/taxi/driver/models/Driver.js';

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('--- FoodDeliveryPartner records ---');
    const partners = await FoodDeliveryPartner.find({});
    for (const p of partners) {
      console.log(JSON.stringify({
        _id: p._id,
        name: p.name,
        phone: p.phone,
        email: p.email,
        status: p.status
      }, null, 2));
    }

    console.log('\n--- Driver records ---');
    const drivers = await Driver.find({});
    for (const d of drivers) {
      console.log(JSON.stringify({
        _id: d._id,
        phone: d.phone,
        role: d.role,
        owner_id: d.owner_id,
        registerFor: d.registerFor,
        status: d.status,
        createdAt: d.createdAt,
        serviceCategories: d.serviceCategories,
        approve: d.approve
      }, null, 2));
    }

    if (partners.length > 0) {
      const p = partners[0];
      console.log(`\n--- Driver.findOne({ phone: '${p.phone}' }) ---`);
      const matched = await Driver.findOne({ phone: p.phone });
      console.log(JSON.stringify(matched, null, 2));
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
