import { MongoClient } from 'mongodb';
import dns from 'dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);

async function main() {
  const uri = "mongodb+srv://buddy:buddys@cluster0.6ykakvc.mongodb.net/?appName=Cluster0";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected successfully to target cluster");
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    console.log("Databases on target cluster:", JSON.stringify(dbs.databases, null, 2));
  } catch (err) {
    console.error("Error connecting or listing databases:", err);
  } finally {
    await client.close();
  }
}

main();
