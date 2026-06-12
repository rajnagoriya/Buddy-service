
import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const col of collections) {
      const name = col.name;
      const model = mongoose.connection.model(name, new mongoose.Schema({}, { strict: false }), name);
      const docs = await model.find({
        $or: [
          { phone: '9755633147' },
          { mobile: '9755633147' },
          { 'phone': /9755633147/ },
          { 'mobile': /9755633147/ }
        ]
      });
      if (docs.length > 0) {
        console.log(`Found ${docs.length} docs in collection "${name}":`);
        docs.forEach(d => console.log(JSON.stringify(d, null, 2)));
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
