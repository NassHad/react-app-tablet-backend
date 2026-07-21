/**
 * One-time cleanup after import_osram_lights_additive.cjs's first run.
 *
 * That script's "already broken, fix in place" detection only recognized
 * the NULL/NULL date fingerprint. It missed a second stale pattern: the one
 * typeConception variant per model that *did* get imported by the old
 * pre-fix pipeline (before the merge-step bug that skipped all others) kept
 * the raw, un-narrowed full-model date range instead of the >/< qualifier's
 * narrowed sub-range (e.g. Alfa Romeo 147 "> 2004, Halogen" stayed
 * "11/00-03/10" instead of "01/05-03/10"). Since that old row's dates
 * weren't NULL, it wasn't recognized as broken, so a second, correctly-dated
 * row got inserted alongside it -- a real duplicate now sitting in the DB.
 *
 * This only affects typeConception values carrying a "> YYYY"/"< YYYY"
 * qualifier, which the corrected source data guarantees are (with 6 known
 * exceptions, minor near-duplicates unrelated to this bug) unique per
 * (brand, model) -- so any qualified key with >1 distinct date range in the
 * DB right now is exactly this duplicate-creation bug, not a legitimate
 * second production era. For each such conflict, keep the row matching the
 * corrected source's canonical date range and delete the other(s).
 *
 * Usage: node scripts/cleanup_stale_wide_range_duplicates.cjs [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');
const DATA_PATH = path.join(__dirname, 'osram_bulbs_with_slugs.json');

const items = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const qualifierRe = /^[<>]\s*\d{4}/;

// Canonical (brand,model,typeConception) -> {start,end} from the corrected
// source, restricted to qualified typeConceptions only.
const canonical = new Map();
for (const item of items) {
  if (!qualifierRe.test(item.typeConception || '')) continue;
  const key = `${item.brandSlug}|${item.modelSlug}|${item.typeConception}`;
  canonical.set(key, { start: item.constructionYear.start || null, end: item.constructionYear.end || null });
}

const db = new Database(DB_PATH);

const conflictRows = db.prepare(`
  SELECT lp.id, b.slug as brandSlug, m.slug as modelSlug, lp.type_conception as typeConception,
         lp.construction_year_start as start, lp.construction_year_end as end,
         lp.published_at IS NOT NULL as pub
  FROM lights_products lp
  JOIN lights_products_model_lnk mlnk ON mlnk.lights_product_id = lp.id
  JOIN models m ON m.id = mlnk.model_id
  JOIN models_brand_lnk mbl ON mbl.model_id = m.id
  JOIN brands b ON b.id = mbl.brand_id
  WHERE lp.type_conception LIKE '<%' OR lp.type_conception LIKE '>%'
`).all();

const byKey = new Map();
for (const r of conflictRows) {
  const key = `${r.brandSlug}|${r.modelSlug}|${r.typeConception}|${r.pub}`;
  if (!byKey.has(key)) byKey.set(key, []);
  byKey.get(key).push(r);
}

const deleteModelLnk = db.prepare(`DELETE FROM lights_products_model_lnk WHERE lights_product_id = ?`);
const deleteBrandLnk = db.prepare(`DELETE FROM lights_products_brand_lnk WHERE lights_product_id = ?`);
const deleteLP = db.prepare(`DELETE FROM lights_products WHERE id = ?`);

let conflictKeys = 0;
let deleted = 0;
let noCanonical = 0;
let ambiguous = 0;

for (const [key, rows] of byKey) {
  const distinctRanges = new Set(rows.map((r) => `${r.start}|${r.end}`));
  if (distinctRanges.size <= 1) continue;
  conflictKeys++;

  const [brandSlug, modelSlug, typeConception] = key.split('|');
  const canonicalKey = `${brandSlug}|${modelSlug}|${typeConception}`;
  const wanted = canonical.get(canonicalKey);
  if (!wanted) { noCanonical++; console.log(`No canonical range found for ${canonicalKey}, skipping`); continue; }

  const keepRows = rows.filter((r) => r.start === wanted.start && r.end === wanted.end);
  const dropRows = rows.filter((r) => !(r.start === wanted.start && r.end === wanted.end));
  if (keepRows.length === 0) { ambiguous++; console.log(`No row matches canonical range for ${canonicalKey} (wanted ${JSON.stringify(wanted)}, have ${JSON.stringify(rows.map(r=>[r.start,r.end]))}), skipping`); continue; }

  for (const row of dropRows) {
    console.log(`${DRY_RUN ? '[DRY RUN] would delete' : 'Deleting'} lights_products id=${row.id} (${canonicalKey}, stale range ${row.start}-${row.end}, keeping ${wanted.start}-${wanted.end})`);
    if (!DRY_RUN) {
      deleteModelLnk.run(row.id);
      deleteBrandLnk.run(row.id);
      deleteLP.run(row.id);
    }
    deleted++;
  }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Conflict keys: ${conflictKeys}, rows deleted: ${deleted}, no canonical match: ${noCanonical}, ambiguous (no row matches canonical): ${ambiguous}`);
db.close();
