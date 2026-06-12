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
    const docs = await coll.find({}).toArray();
    console.log("Documents in target 'deliveries':", JSON.stringify(docs, null, 2));
    const indexes = await coll.listIndexes().toArray();
    console.log("Indexes in target 'deliveries':", JSON.stringify(indexes, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main();
