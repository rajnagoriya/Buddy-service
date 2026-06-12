import { MongoClient } from 'mongodb';
import dns from 'dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);

async function main() {
  const uri = "mongodb+srv://buddy:buddys@cluster0.6ykakvc.mongodb.net/?appName=Cluster0";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected successfully to target cluster");
    const db = client.db('test');
    const collections = await db.listCollections().toArray();
    console.log("Collections in 'test' database:", collections.map(c => c.name));
  } catch (err) {
    console.error("Error connecting or listing collections:", err);
  } finally {
    await client.close();
  }
}

main();
