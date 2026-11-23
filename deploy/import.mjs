import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { openDatabase } from '../server/database.mjs';
import { localBucket } from '../server/storage.mjs';

// Input: private backup directory containing database.json and uploads/<object_key>.
// database.json = { format: 'medicina-vps-v1', tables: { accounts: [...], ... } }
const backupDirectory = resolve(process.argv[2] || '/backup');
const snapshot = JSON.parse(readFileSync(resolve(backupDirectory, 'database.json'), 'utf8'));
if (snapshot.format !== 'medicina-vps-v1') throw Error('Unknown backup format');
const { sqlite } = openDatabase();
const tableNames = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_vps_migrations'").all().map(r => r.name);
if (tableNames.some(table => sqlite.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n)) throw Error('Destination must be empty. No existing records were replaced.');
if (Object.keys(snapshot.tables).some(table => !tableNames.includes(table))) throw Error('Backup contains unknown tables');
for (const table of tableNames) if (!Array.isArray(snapshot.tables[table])) throw Error(`Missing table: ${table}`);
const assets = [...snapshot.tables.photos, ...snapshot.tables.avatars];
for (const asset of assets) {
  if (!/^(photos|avatars)\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(asset.object_key)) throw Error('Invalid asset path');
  const filename = resolve(backupDirectory, 'uploads', asset.object_key);
  if (!existsSync(filename)) throw Error('Missing asset: '+asset.object_key);
  const hash = createHash('sha256').update(readFileSync(filename)).digest('hex');
  if (snapshot.assetSha256 && snapshot.assetSha256[asset.object_key] !== hash) throw Error('Image checksum mismatch: '+asset.object_key);
}
const bucket = localBucket();
// Copy objects first: an interrupted copy leaves no imported database records.
for (const asset of assets) await bucket.put(asset.object_key, readFileSync(resolve(backupDirectory, 'uploads', asset.object_key)));
sqlite.exec('BEGIN IMMEDIATE');
try {
  for (const table of tableNames) {
    // Require a fresh login and invalidate old reset links after the move.
    if (table === 'sessions' || table === 'password_resets') continue;
    const columns = sqlite.prepare(`PRAGMA table_info("${table}")`).all().map(r => r.name);
    const insert = sqlite.prepare(`INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`);
    for (const row of snapshot.tables[table]) {
      if (Object.keys(row).length !== columns.length || !columns.every(c => Object.hasOwn(row, c))) throw Error('Column mismatch in '+table);
      insert.run(...columns.map(c => row[c]));
    }
  }
  sqlite.exec('COMMIT');
} catch (error) { sqlite.exec('ROLLBACK'); throw error; }
for (const table of tableNames) console.log(table, sqlite.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n);
console.log('Imported. Sessions and reset links intentionally invalidated; users must log in again.');
sqlite.close();
