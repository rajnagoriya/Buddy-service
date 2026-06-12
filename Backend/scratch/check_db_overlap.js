import { MongoClient } from 'mongodb';
import dns from 'dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const sourceUri = "mongodb+srv://rydon24trawler_db_user:buYM1A4sMoTA4PcZ@cluster0.gy5yjip.mongodb.net/appzeto_taxi?retryWrites=true&w=majority";
const targetUri = "mongodb+srv://buddy:buddys@cluster0.6ykakvc.mongodb.net/test?appName=Cluster0";

async function main() {
  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);
  try {
    await sourceClient.connect();
    await targetClient.connect();
    
    const sourceDb = sourceClient.db('appzeto_taxi');
    const targetDb = targetClient.db('test');
    
    const sourceColls = (await sourceDb.listCollections().toArray()).map(c => c.name);
    const targetColls = (await targetDb.listCollections().toArray()).map(c => c.name);
    
    const overlap = sourceColls.filter(c => targetColls.includes(c));
    console.log("Overlapping collections:", overlap);
    
    for (const coll of overlap) {
      const sCount = await sourceDb.collection(coll).countDocuments({});
      const tCount = await targetDb.collection(coll).countDocuments({});
      console.log(`Collection: "${coll}" | Source count: ${sCount} | Target count: ${tCount}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

main();
