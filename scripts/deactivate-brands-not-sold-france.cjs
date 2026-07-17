/**
 * Client feedback: 23 brands not sold in France should be hidden from the
 * catalog. Deactivated (is_active=0), not deleted -- reversible, and avoids
 * the filter_compatibilities FK-cascade risk deletion would carry.
 *
 * Usage: node scripts/deactivate-brands-not-sold-france.cjs [--dry-run]
 */
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

const BRAND_NAMES = [
  'DAIMLER', 'FSO', 'GAZ', 'GEELY', 'GEO', 'GMC', 'GRECAV', 'INNOCENTI', 'IRMSCHER',
  'LDV', 'LIFAN', 'MOSKVITCH', 'PLYMOUTH', 'PROTON', 'SANTANA', 'T.V.R.', 'TATA',
  'TAZZARI', 'UAZ', 'VAUXHALL', 'YUGO', 'ZASTAVA', 'ZAZ',
];

const db = new Database(DB_PATH, { readonly: DRY_RUN });
const placeholders = BRAND_NAMES.map(() => '?').join(',');
const rows = db.prepare(`SELECT id, name, is_active FROM brands WHERE UPPER(name) IN (${placeholders})`).all(...BRAND_NAMES.map(n => n.toUpperCase()));
console.log(`${rows.length} row(s) (draft+pub) found for ${BRAND_NAMES.length} brand names`);

const foundNames = new Set(rows.map(r => r.name.toUpperCase()));
const missing = BRAND_NAMES.filter(n => !foundNames.has(n.toUpperCase()));
if (missing.length) console.log('NOT FOUND:', missing.join(', '));

if (DRY_RUN) {
  db.close();
  console.log('[DRY RUN] no changes written.');
  process.exit(0);
}

const update = db.prepare('UPDATE brands SET is_active = 0 WHERE id = ?');
for (const r of rows) update.run(r.id);
db.close();
console.log(`Deactivated ${rows.length} row(s).`);
