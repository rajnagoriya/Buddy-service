import { MongoClient } from 'mongodb';
import dns from 'dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const targetUri = "mongodb+srv://buddy:buddys@cluster0.6ykakvc.mongodb.net/test?appName=Cluster0";

async function main() {
  const client = new MongoClient(targetUri);
  try {
    await client.connect();
    const db = client.db('test');
    const coll = db.collection('deliveries');
    
    console.log("Dropping index phone_1...");
    try {
      await coll.dropIndex('phone_1');
      console.log("Successfully dropped phone_1");
    } catch (e) {
      console.log("Error dropping phone_1:", e.message);
    }

    console.log("Dropping index location_2dsphere...");
    try {
      await coll.dropIndex('location_2dsphere');
      console.log("Successfully dropped location_2dsphere");
    } catch (e) {
      console.log("Error dropping location_2dsphere:", e.message);
    }

    console.log("Dropping index isOnline_1_isVerified_1...");
    try {
      await coll.dropIndex('isOnline_1_isVerified_1');
      console.log("Successfully dropped isOnline_1_isVerified_1");
    } catch (e) {
      console.log("Error dropping isOnline_1_isVerified_1:", e.message);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main();
