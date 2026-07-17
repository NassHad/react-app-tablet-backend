/**
 * Strapi mirror of react-app-tablet/scripts/fix_juke_f16_split.cjs.
 * Un-merges the Nissan Juke lights_products row (document_id
 * kdkfzmwcxc3im4gi3h6l4laj, draft id=2853/pub id=2854) that mixes 10
 * pre-2014 halogen-era F15 entries (exact duplicate of juke-f15's own
 * id=19376 row) with 11 post-2019 LED-facelift entries. Creates a
 * juke-f16 model (draft+pub, display_name='Juke' matching juke-f15's
 * existing pattern) + a new lights_products row (draft+pub) for the F16
 * entries, deletes the mixed row entirely.
 *
 * Usage: node scripts/fix_juke_f16_split_strapi.cjs [--dry-run]
 */
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

function generateDocumentId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const bytes = crypto.randomBytes(24);
  for (let i = 0; i < 24; i++) id += chars[bytes[i] % chars.length];
  return id;
}

const db = new Database(DB_PATH, { readonly: true });
const mixedRows = db.prepare(`
  SELECT lp.id, lp.document_id, lp.published_at IS NOT NULL as pub, lp.light_positions
  FROM lights_products lp
  JOIN lights_products_model_lnk mlnk ON mlnk.lights_product_id = lp.id
  JOIN models m ON m.id = mlnk.model_id
  WHERE m.slug = 'juke'
`).all();
const dupe = db.prepare('SELECT light_positions FROM lights_products WHERE id = 19376').get();
const nissanBrand = db.prepare("SELECT id FROM brands WHERE UPPER(name)='NISSAN' AND published_at IS NOT NULL").get();
db.close();

if (mixedRows.length === 0) {
  console.log('No lights_products linked to model "juke" -- already fixed or data changed, aborting.');
  process.exit(1);
}

const positions = JSON.parse(mixedRows[0].light_positions);
const f15Entries = positions.filter((p) => p.ref !== 'LED' && p.ref !== 'WY21W');
const f16Entries = positions.filter((p) => p.ref === 'LED' || p.ref === 'WY21W');

const norm = (p) => `${p.ref}|${p.category}`;
const f15Keys = f15Entries.map(norm).sort();
const dupeKeys = JSON.parse(dupe.light_positions).map(norm).sort();
const f15Dupe = JSON.stringify(f15Keys) === JSON.stringify(dupeKeys);

console.log(`${mixedRows.length} row(s) (draft+pub) for model "juke", ${positions.length} positions, ${f15Entries.length} F15-era, ${f16Entries.length} F16-era`);
console.log(`F15 portion matches id=19376 (juke-f15) by ref+category: ${f15Dupe}`);
if (!f15Dupe) {
  console.error('F15 portion does not match expected -- aborting rather than risk data loss.');
  process.exit(1);
}
if (!nissanBrand) {
  console.error('Could not find published NISSAN brand -- aborting.');
  process.exit(1);
}

if (DRY_RUN) {
  console.log('\n--dry-run: would create juke-f16 model + lights_products rows, delete mixed rows.');
  process.exit(0);
}

const now = new Date().toISOString();
const wdb = new Database(DB_PATH);

const txn = wdb.transaction(() => {
  const modelDocId = generateDocumentId();
  const insertModel = wdb.prepare(`
    INSERT INTO models (document_id, name, slug, is_active, display_name, vehicle_type, created_at, updated_at, published_at)
    VALUES (?, 'JUKE (F16)', 'juke-f16', 1, 'Juke', NULL, ?, ?, ?)
  `);
  const draftModelId = insertModel.run(modelDocId, now, now, null).lastInsertRowid;
  const pubModelId = insertModel.run(modelDocId, now, now, now).lastInsertRowid;

  const insertBrandLnk = wdb.prepare('INSERT INTO models_brand_lnk (model_id, brand_id) VALUES (?, ?)');
  insertBrandLnk.run(draftModelId, nissanBrand.id);
  insertBrandLnk.run(pubModelId, nissanBrand.id);
  console.log(`Created models juke-f16: draft id=${draftModelId}, pub id=${pubModelId}`);

  const lpDocId = generateDocumentId();
  const insertLP = wdb.prepare(`
    INSERT INTO lights_products (
      document_id, name, slug, ref, category, construction_year_start, construction_year_end,
      type_conception, is_active, source, light_positions, created_at, updated_at, published_at
    ) VALUES (?, 'NISSAN JUKE (F16)', 'nissan-juke-f16', 'Multiple', 'multiple', '08/19', 'Present', 'Standard', 1, ?, ?, ?, ?, ?)
  `);
  const source = 'OSRAM CSV Guide (split out of merged juke row, 2026-07-16)';
  const draftLPId = insertLP.run(lpDocId, source, JSON.stringify(f16Entries), now, now, null).lastInsertRowid;
  const pubLPId = insertLP.run(lpDocId, source, JSON.stringify(f16Entries), now, now, now).lastInsertRowid;

  const insertLPBrandLnk = wdb.prepare('INSERT INTO lights_products_brand_lnk (lights_product_id, brand_id) VALUES (?, ?)');
  const insertLPModelLnk = wdb.prepare('INSERT INTO lights_products_model_lnk (lights_product_id, model_id) VALUES (?, ?)');
  insertLPBrandLnk.run(draftLPId, nissanBrand.id);
  insertLPBrandLnk.run(pubLPId, nissanBrand.id);
  insertLPModelLnk.run(draftLPId, draftModelId);
  insertLPModelLnk.run(pubLPId, pubModelId);
  console.log(`Created lights_products juke-f16: draft id=${draftLPId}, pub id=${pubLPId}`);

  for (const row of mixedRows) {
    wdb.prepare('DELETE FROM lights_products_model_lnk WHERE lights_product_id = ?').run(row.id);
    wdb.prepare('DELETE FROM lights_products_brand_lnk WHERE lights_product_id = ?').run(row.id);
    wdb.prepare('DELETE FROM lights_products WHERE id = ?').run(row.id);
  }
  console.log(`Deleted ${mixedRows.length} mixed row(s): ${mixedRows.map((r) => r.id).join(', ')}`);
});
txn();
wdb.close();
console.log('Done.');
