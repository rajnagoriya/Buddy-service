import { MongoClient } from 'mongodb';
import dns from 'dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const sourceUri = "mongodb+srv://rydon24trawler_db_user:buYM1A4sMoTA4PcZ@cluster0.gy5yjip.mongodb.net/appzeto_taxi?retryWrites=true&w=majority";
const targetUri = "mongodb+srv://buddy:buddys@cluster0.6ykakvc.mongodb.net/test?appName=Cluster0";

async function main() {
  console.log("Connecting to source and target databases...");
  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);

  try {
    await sourceClient.connect();
    console.log("Connected to source database.");

    await targetClient.connect();
    console.log("Connected to target database.");

    const sourceDb = sourceClient.db('appzeto_taxi');
    const targetDb = targetClient.db('test');

    const collections = await sourceDb.listCollections().toArray();
    console.log(`Found ${collections.length} collections in source database.`);

    for (const collInfo of collections) {
      const collName = collInfo.name;
      console.log(`\nProcessing collection: "${collName}"`);

      const sourceColl = sourceDb.collection(collName);
      const targetColl = targetDb.collection(collName);

      // Fetch all documents from source
      const docs = await sourceColl.find({}).toArray();
      console.log(`  Source has ${docs.length} documents.`);

      // Clear destination collection
      const deleteResult = await targetColl.deleteMany({});
      console.log(`  Cleared ${deleteResult.deletedCount} existing documents in target.`);

      // Insert documents if any exist
      if (docs.length > 0) {
        // Use batching to avoid BSON document size or request limits if needed
        const batchSize = 1000;
        for (let i = 0; i < docs.length; i += batchSize) {
          const batch = docs.slice(i, i + batchSize);
          const insertResult = await targetColl.insertMany(batch);
          console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1} (${insertResult.insertedCount} documents).`);
        }
      } else {
        console.log("  No documents to insert.");
      }
    }

    console.log("\nDatabase copy operation completed successfully!");

  } catch (error) {
    console.error("An error occurred during copying:", error);
  } finally {
    await sourceClient.close();
    await targetClient.close();
    console.log("Connections closed.");
  }
}

main();
