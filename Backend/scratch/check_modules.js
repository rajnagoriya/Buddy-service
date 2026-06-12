import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { TaxiAppModule } from '../src/modules/taxi/admin/models/TaxiAppModule.js';

dotenv.config();

const run = async () => {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);
  const modules = await TaxiAppModule.find().lean();
  console.log('Modules count:', modules.length);
  console.log('Modules details:');
  modules.forEach(m => {
    console.log(`- Name: ${m.name}`);
    console.log(`  Active: ${m.active}`);
    console.log(`  mobile_menu_icon: ${m.mobile_menu_icon}`);
  });
  await mongoose.disconnect();
};

run().catch(console.error);
