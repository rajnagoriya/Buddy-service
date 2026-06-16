/**
 * Inspector: list every collection in the connected DB with its document
 * count, sorted by count ascending. Use this to find empty / legacy
 * collections that are eating your Atlas tier's 500-collection budget so
 * the BuddyIdentity backfill can create its target collection.
 *
 *   node scripts/list-collections.js
 *   node scripts/list-collections.js --empty-only
 *   node scripts/list-collections.js --json
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const ARGV = new Set(process.argv.slice(2));
const EMPTY_ONLY = ARGV.has('--empty-only');
const AS_JSON = ARGV.has('--json');

const log = (...args) => console.log('[list-collections]', ...args);

const main = async () => {
  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb+srv://sooperbuddyopcpvtltd_db_user:buddy-service123@buddy.vadstlf.mongodb.net/buddydb';

  log(`Connecting to ${mongoUri.replace(/\/\/[^@]+@/, '//***:***@')}`);
  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;
  const collections = await db.listCollections({}, { nameOnly: false }).toArray();
  const filtered = collections.filter((c) => c.type !== 'view');

  const rows = await Promise.all(
    filtered.map(async (c) => {
      // estimatedDocumentCount is O(1); good enough for a triage report.
      const count = await db.collection(c.name).estimatedDocumentCount().catch(() => -1);
      return { name: c.name, count };
    }),
  );

  rows.sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));

  const empties = rows.filter((r) => r.count === 0);
  const visible = EMPTY_ONLY ? empties : rows;

  if (AS_JSON) {
    console.log(JSON.stringify({ total: rows.length, empties: empties.length, rows: visible }, null, 2));
  } else {
    log(`Total collections: ${rows.length}`);
    log(`Empty collections: ${empties.length}`);
    console.log('');
    console.log('count    name');
    console.log('-----    -----------------------------');
    for (const row of visible) {
      const pad = String(row.count).padStart(5, ' ');
      console.log(`${pad}    ${row.name}`);
    }
  }

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error('list-collections failed:', err);
  process.exit(1);
});
