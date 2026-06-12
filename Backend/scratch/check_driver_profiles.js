import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import { Driver } from '../src/modules/taxi/driver/models/Driver.js';
import { FoodDeliveryPartner } from '../src/modules/food/delivery/models/deliveryPartner.model.js';

dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config();

const run = async () => {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);

  // First find all delivery partners to see their phone numbers
  const deliveryPartners = await FoodDeliveryPartner.find().lean();
  console.log(`Found ${deliveryPartners.length} delivery partners:`);
  for (const dp of deliveryPartners) {
    console.log(`- DP ID: ${dp._id}, Phone: ${dp.phone}, Name: ${dp.name || dp.fullName}`);
    
    // Find all matching Driver records for this phone
    const drivers = await Driver.find({ phone: dp.phone }).lean();
    console.log(`  Matching drivers count: ${drivers.length}`);
    for (const d of drivers) {
      console.log(`    * Driver ID: ${d._id}`);
      console.log(`      Phone: ${d.phone}`);
      console.log(`      Role: ${d.role}`);
      console.log(`      RegisterFor: ${d.registerFor}`);
      console.log(`      Owner ID: ${d.owner_id || d.ownerId}`);
      console.log(`      ServiceCategories: ${JSON.stringify(d.serviceCategories)}`);
      console.log(`      DeliveryPartnerId: ${d.deliveryPartnerId}`);
      console.log(`      Status: ${d.status}`);
      console.log(`      CreatedAt: ${d.createdAt}`);
    }
  }

  await mongoose.disconnect();
};

run().catch(console.error);
