/**
 * Strapi mirror of react-app-tablet/scripts/dedupe_berlingo_filter_compatibilities.cjs.
 * Same logic (group by engine_code+vehicle_variant+dates, keep the richer
 * filters payload), adapted for Strapi's draft+published row pairs: each
 * logical duplicate is 2 document_ids x 2 rows (draft+pub) = 4 rows: keep
 * both rows of the richer document_id, delete both rows of the sparser one.
 *
 * Usage: node scripts/dedupe_berlingo_filter_compatibilities_strapi.cjs [--dry-run]
 */
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

const db = new Database(DB_PATH, { readonly: true });
const rows = db.prepare(`
  SELECT id, document_id, engine_code, vehicle_variant, production_start, production_end, filters
  FROM filter_compatibilities
  WHERE vehicle_variant LIKE 'Berlingo%'
`).all();
db.close();

// Group by document_id first (draft+pub share one logical record), take
// the max filters length per document_id as that document's "richness".
const byDoc = new Map();
for (const row of rows) {
  if (!byDoc.has(row.document_id)) byDoc.set(row.document_id, { rows: [], key: null, richness: 0 });
  const entry = byDoc.get(row.document_id);
  entry.rows.push(row);
  entry.key = [row.engine_code, row.vehicle_variant, row.production_start, row.production_end].join('|');
  entry.richness = Math.max(entry.richness, row.filters?.length || 0);
}

const groups = new Map();
for (const [docId, entry] of byDoc) {
  if (!groups.has(entry.key)) groups.set(entry.key, []);
  groups.get(entry.key).push({ docId, ...entry });
}

const toDelete = [];
let pairs = 0;
for (const [key, docs] of groups) {
  if (docs.length <= 1) continue;
  pairs++;
  const sorted = [...docs].sort((a, b) => b.richness - a.richness);
  const keep = sorted[0];
  const drop = sorted.slice(1);
  console.log(`${key}: keeping doc=${keep.docId} (${keep.richness} bytes), dropping doc(s)=${drop.map(d => d.docId).join(',')}`);
  for (const d of drop) toDelete.push(...d.rows.map((r) => r.id));
}

console.log(`\n${pairs} duplicate group(s), ${toDelete.length} row(s) to delete (draft+pub combined)`);

if (DRY_RUN) {
  console.log('--dry-run: no rows deleted.');
  process.exit(0);
}

const wdb = new Database(DB_PATH);
const del = wdb.prepare('DELETE FROM filter_compatibilities WHERE id = ?');
const delLnk = wdb.prepare('DELETE FROM filter_compatibilities_model_lnk WHERE filter_compatibility_id = ?');
const delBrandLnk = wdb.prepare('DELETE FROM filter_compatibilities_brand_lnk WHERE filter_compatibility_id = ?');
const txn = wdb.transaction(() => {
  for (const id of toDelete) {
    delLnk.run(id);
    delBrandLnk.run(id);
    del.run(id);
  }
});
txn();
wdb.close();
console.log(`Deleted ${toDelete.length} row(s) from ${DB_PATH}`);
