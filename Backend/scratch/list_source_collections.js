import { MongoClient } from 'mongodb';
import dns from 'dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);

async function main() {
  const uri = "mongodb+srv://rydon24trawler_db_user:buYM1A4sMoTA4PcZ@cluster0.gy5yjip.mongodb.net/appzeto_taxi?retryWrites=true&w=majority";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected successfully to source cluster");
    const db = client.db('appzeto_taxi');
    const collections = await db.listCollections().toArray();
    console.log("Collections in 'appzeto_taxi' database:", collections.map(c => c.name));
  } catch (err) {
    console.error("Error connecting or listing collections:", err);
  } finally {
    await client.close();
  }
}

main();
