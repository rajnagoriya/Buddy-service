/**
 * Drop empty collections to free up Atlas tier slots so BuddyIdentity (or
 * any other new collection) can be auto-created on first insert.
 *
 * USAGE
 *   node scripts/drop-empty-collections.js                  # dry-run, prints what would drop
 *   node scripts/drop-empty-collections.js --apply          # actually drop
 *   node scripts/drop-empty-collections.js --keep buddyidentities,sessions
 *
 * SAFETY
 *   - Only drops collections whose `estimatedDocumentCount()` is 0.
 *   - Skips system.* collections.
 *   - --keep accepts a comma-separated allow-list of names to preserve
 *     even if they're empty (useful if a collection just happens to be
 *     transiently empty during off-hours).
 *   - Always run dry-run first; eyeball the list before --apply.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const ARGV = process.argv.slice(2);
const APPLY = ARGV.includes('--apply');

const keepArg = ARGV.find((a) => a.startsWith('--keep='))
  || (ARGV.indexOf('--keep') !== -1 ? ARGV[ARGV.indexOf('--keep') + 1] : '');

const KEEP_LIST = String(keepArg || '')
  .replace(/^--keep=?/, '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const KEEP = new Set([
  // Always preserve these even when empty.
  ...KEEP_LIST,
  'buddyidentities', // the very collection the backfill wants to create
]);

const log = (...args) => console.log('[drop-empty]', ...args);

const main = async () => {
  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb+srv://sooperbuddyopcpvtltd_db_user:buddy-service123@buddy.vadstlf.mongodb.net/buddydb';

  log(`Connecting to ${mongoUri.replace(/\/\/[^@]+@/, '//***:***@')}`);
  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;
  const collections = await db.listCollections({}, { nameOnly: false }).toArray();
  const candidates = collections.filter(
    (c) => c.type !== 'view' && !c.name.startsWith('system.'),
  );

  log(`Scanning ${candidates.length} collections for emptiness…`);

  const empties = [];
  for (const c of candidates) {
    const count = await db.collection(c.name).estimatedDocumentCount().catch(() => -1);
    if (count === 0) empties.push(c.name);
  }

  const droppable = empties.filter((n) => !KEEP.has(n.toLowerCase()));
  const preserved = empties.filter((n) => KEEP.has(n.toLowerCase()));

  log(`Empty collections found: ${empties.length}`);
  log(`Preserved (--keep / built-in): ${preserved.length}`);
  log(`Droppable: ${droppable.length}`);
  console.log('');

  if (preserved.length) {
    log('Preserving (will NOT drop):');
    preserved.forEach((n) => console.log('  ', n));
    console.log('');
  }

  if (!droppable.length) {
    log('Nothing to drop. Exiting.');
    await mongoose.disconnect();
    return;
  }

  log(`Targets to drop (${droppable.length}):`);
  droppable.forEach((n) => console.log('  -', n));
  console.log('');

  if (!APPLY) {
    log('DRY-RUN complete. Re-run with --apply to drop the above.');
    await mongoose.disconnect();
    return;
  }

  let dropped = 0;
  let failed = 0;
  for (const name of droppable) {
    try {
      await db.collection(name).drop();
      dropped += 1;
      log(`dropped ${name}`);
    } catch (err) {
      failed += 1;
      log(`FAILED to drop ${name}: ${err?.message || err}`);
    }
  }

  log(`Done. Dropped=${dropped} Failed=${failed}`);
  await mongoose.disconnect();
};

main().catch((err) => {
  console.error('drop-empty-collections failed:', err);
  process.exit(1);
});
