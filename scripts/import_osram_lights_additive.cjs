/**
 * Additive-only import of the corrected OSRAM lights dataset
 * (react-app-tablet/scripts/data_sources/osram_bulbs_with_slugs.json, produced
 * by parse_osram_csv_to_json.cjs -> merge_light_positions.cjs ->
 * add_slugs_to_bulbs.cjs, all fixed 2026-07-18 to stop losing typeConception
 * date-qualifier/variant data) into the local dev Strapi SQLite DB.
 *
 * Never deletes or modifies any existing row. For each (brand, model,
 * constructionYear, typeConception) combination in the source data:
 *   - skip entirely if the model belongs to a "split family" (a nameplate
 *     whose lights data is already deliberately spread across multiple
 *     generation/body-style model slugs, e.g. Nissan Juke -> juke-f15/juke-f16
 *     -- see scripts/reports/lights_split_families.json). The source CSV has
 *     no reliable way to route a row to the *correct* sibling slug, so
 *     inserting under the generic slug risks orphaning/duplicating data for
 *     these ~319 nameplates. Left as a known follow-up.
 *   - skip if no matching (brand slug, model slug) exists in the live models
 *     table
 *   - skip if an equivalent row (same model, constructionYearStart/End,
 *     typeConception) already exists
 *   - otherwise insert new lights_products row(s), mirroring the existing
 *     draft+published pair pattern (scripts/fix_juke_f16_split_strapi.cjs)
 *     so both states link to the *matching* state's model/brand id -- a
 *     plain single-row insert linked only to the published id makes the
 *     draft row invisible to the app's own read path (see project memory /
 *     the Mercedes S-Class import script comments for the underlying Strapi
 *     v5 draft/publish relation gotcha).
 *
 * Usage: node scripts/import_osram_lights_additive.cjs [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');
const DATA_PATH = path.join(__dirname, 'osram_bulbs_with_slugs.json');

function generateDocumentId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const bytes = crypto.randomBytes(24);
  for (let i = 0; i < 24; i++) id += chars[bytes[i] % chars.length];
  return id;
}

const items = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
console.log(`Loaded ${items.length} entries from ${DATA_PATH}`);

const db = new Database(DB_PATH, { readonly: !DRY_RUN && false });
// Always open read-write; --dry-run just skips the final txn commit path
// (all mutating statements are only ever *prepared*, never *run*, below).

// ---- 1. Compute the split-family skip-list live against current data ----
const modelsWithLights = db.prepare(`
  SELECT DISTINCT m.id as model_id, b.slug as brandSlug, m.slug as modelSlug, m.display_name
  FROM models m
  JOIN models_brand_lnk mbl ON mbl.model_id = m.id
  JOIN brands b ON b.id = mbl.brand_id
  JOIN lights_products_model_lnk mlnk ON mlnk.model_id = m.id
  JOIN lights_products lp ON lp.id = mlnk.lights_product_id
  WHERE m.published_at IS NOT NULL AND lp.published_at IS NOT NULL
    AND m.display_name IS NOT NULL AND m.display_name != ''
`).all();

const byDisplay = new Map();
for (const r of modelsWithLights) {
  const key = r.display_name;
  if (!byDisplay.has(key)) byDisplay.set(key, new Map());
  byDisplay.get(key).set(r.modelSlug, r.brandSlug);
}

const skipSet = new Set(); // "brandSlug|modelSlug"
let splitFamilyCount = 0;
for (const [, slugMap] of byDisplay) {
  if (slugMap.size > 1) {
    splitFamilyCount++;
    for (const [modelSlug, brandSlug] of slugMap) {
      skipSet.add(`${brandSlug}|${modelSlug}`);
    }
  }
}
console.log(`Skip-list: ${splitFamilyCount} split families, ${skipSet.size} (brand,model) slugs excluded`);

// ---- 2. Prepared statements ----
const findModelStates = db.prepare(`
  SELECT m.id, m.document_id, m.published_at, m.name
  FROM models m
  JOIN models_brand_lnk mbl ON mbl.model_id = m.id
  JOIN brands b ON b.id = mbl.brand_id
  WHERE b.slug = ? AND m.slug = ?
`);

const findBrandStates = db.prepare(`SELECT id, published_at FROM brands WHERE slug = ?`);

const findExisting = db.prepare(`
  SELECT lp.id
  FROM lights_products lp
  JOIN lights_products_model_lnk mlnk ON mlnk.lights_product_id = lp.id
  WHERE mlnk.model_id IN (SELECT m2.id FROM models m2 JOIN models_brand_lnk mbl2 ON mbl2.model_id = m2.id JOIN brands b2 ON b2.id = mbl2.brand_id WHERE b2.slug = ? AND m2.slug = ?)
    AND lp.construction_year_start IS ? AND lp.construction_year_end IS ? AND lp.type_conception IS ?
  LIMIT 1
`);

// Fingerprint of the pre-A1-fix parser bug: a continuation typeConception row
// whose production-period column was blank got construction_year_start/end
// both stored as NULL (verified: 1,034 such rows exist, 0 rows have only one
// of the two NULL -- a properly-dated row always has at least a real end
// value or the literal string 'Present'). Matching on this exact signature
// lets us safely correct these rows in place instead of leaving a stale
// always-matches-every-date duplicate sitting next to the newly-inserted
// correct one.
const findBroken = db.prepare(`
  SELECT lp.id
  FROM lights_products lp
  JOIN lights_products_model_lnk mlnk ON mlnk.lights_product_id = lp.id
  WHERE mlnk.model_id IN (SELECT m2.id FROM models m2 JOIN models_brand_lnk mbl2 ON mbl2.model_id = m2.id JOIN brands b2 ON b2.id = mbl2.brand_id WHERE b2.slug = ? AND m2.slug = ?)
    AND lp.construction_year_start IS NULL AND lp.construction_year_end IS NULL AND lp.type_conception IS ?
`);

const insertLP = db.prepare(`
  INSERT INTO lights_products (
    document_id, name, ref, description, construction_year_start, construction_year_end,
    type_conception, part_number, notes, source, category, is_active, light_positions,
    created_at, updated_at, published_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'multiple', 1, ?, ?, ?, ?)
`);
const insertModelLnk = db.prepare(`INSERT INTO lights_products_model_lnk (lights_product_id, model_id) VALUES (?, ?)`);
const insertBrandLnk = db.prepare(`INSERT INTO lights_products_brand_lnk (lights_product_id, brand_id) VALUES (?, ?)`);
const updateBrokenDates = db.prepare(`UPDATE lights_products SET construction_year_start = ?, construction_year_end = ?, updated_at = ? WHERE id = ?`);

// ---- 3. Process ----
const stats = { imported: 0, fixedStaleDates: 0, skippedFamily: 0, skippedExisting: 0, unmatchedModel: 0, noPositions: 0, duplicateModelGroup: 0 };
const unmatchedLog = [];
const now = new Date().toISOString();

const runOne = db.transaction((item) => {
  const brandSlug = item.brandSlug;
  const modelSlug = item.modelSlug;
  const key = `${brandSlug}|${modelSlug}`;

  if (skipSet.has(key)) { stats.skippedFamily++; return; }

  const modelRows = findModelStates.all(brandSlug, modelSlug);
  if (modelRows.length === 0) { stats.unmatchedModel++; unmatchedLog.push(`${item.originalBrand} / ${item.originalModel} (${key})`); return; }

  // Rare case: same (brand,model) slug pair resolves to >1 distinct document_id
  // group (2 known cases: dodge/charger, fiat/500e). Prefer whichever group
  // already has lights data; else the lowest id, and note it for review.
  const groups = new Map();
  for (const r of modelRows) {
    if (!groups.has(r.document_id)) groups.set(r.document_id, []);
    groups.get(r.document_id).push(r);
  }
  let chosenDocId = [...groups.keys()][0];
  if (groups.size > 1) {
    stats.duplicateModelGroup++;
    let found = false;
    for (const docId of groups.keys()) {
      const anyId = groups.get(docId)[0].id;
      const existing = db.prepare(`SELECT 1 FROM lights_products_model_lnk WHERE model_id = ? LIMIT 1`).get(anyId);
      if (existing) { chosenDocId = docId; found = true; break; }
    }
    if (!found) chosenDocId = [...groups.keys()].sort()[0];
  }
  const states = groups.get(chosenDocId); // 1 or 2 rows: draft (published_at null) and/or published

  const cyStart = item.constructionYear.start || null;
  const cyEnd = item.constructionYear.end || null;
  const typeConception = item.typeConception || null;

  const existing = findExisting.get(brandSlug, modelSlug, cyStart, cyEnd, typeConception);
  if (existing) { stats.skippedExisting++; return; }

  const positions = Object.values(item.lightType || {})
    .filter((pos) => pos && pos.ref && pos.position)
    .map((pos) => ({ ref: pos.ref, position: pos.position, category: pos.category }));
  if (positions.length === 0) { stats.noPositions++; return; }

  const brokenRows = findBroken.all(brandSlug, modelSlug, typeConception);
  if (brokenRows.length > 0) {
    for (const row of brokenRows) updateBrokenDates.run(cyStart, cyEnd, now, row.id);
    stats.fixedStaleDates++;
    return;
  }

  const brandRows = findBrandStates.all(brandSlug);
  const brandDraft = brandRows.find((b) => b.published_at === null) || brandRows[0];
  const brandPub = brandRows.find((b) => b.published_at !== null) || brandRows[0];

  const lpDocId = generateDocumentId();
  const ref = positions.length === 1 ? positions[0].ref : 'Multiple';
  const name = `${item.originalBrand} ${item.originalModel}`;
  const description = `Light positions for ${name} (${typeConception || 'Standard'}, ${cyStart || '?'}-${cyEnd || '?'})`;
  const source = item.source || 'OSRAM CSV Guide';
  const lightPositionsJson = JSON.stringify(positions);

  for (const modelState of states) {
    const isDraft = modelState.published_at === null;
    const brandRow = isDraft ? brandDraft : brandPub;
    const publishedAt = isDraft ? null : now;

    const result = insertLP.run(
      lpDocId, name, ref, description, cyStart, cyEnd, typeConception,
      item.partNumber || '', item.notes || '', source, lightPositionsJson,
      now, now, publishedAt
    );
    const lpId = result.lastInsertRowid;
    insertModelLnk.run(lpId, modelState.id);
    if (brandRow) insertBrandLnk.run(lpId, brandRow.id);
  }

  stats.imported++;
});

// Mirrors runOne's branching for --dry-run so stats are accurate without
// ever calling an insert/update statement.
const runOneDry = (item) => {
  const brandSlug = item.brandSlug;
  const modelSlug = item.modelSlug;
  const key = `${brandSlug}|${modelSlug}`;
  if (skipSet.has(key)) { stats.skippedFamily++; return; }
  const modelRows = findModelStates.all(brandSlug, modelSlug);
  if (modelRows.length === 0) { stats.unmatchedModel++; unmatchedLog.push(`${item.originalBrand} / ${item.originalModel} (${key})`); return; }
  const groups = new Set(modelRows.map((r) => r.document_id));
  if (groups.size > 1) stats.duplicateModelGroup++;
  const cyStart = item.constructionYear.start || null;
  const cyEnd = item.constructionYear.end || null;
  const typeConception = item.typeConception || null;
  const existing = findExisting.get(brandSlug, modelSlug, cyStart, cyEnd, typeConception);
  if (existing) { stats.skippedExisting++; return; }
  const positions = Object.values(item.lightType || {}).filter((pos) => pos && pos.ref && pos.position);
  if (positions.length === 0) { stats.noPositions++; return; }
  const brokenRows = findBroken.all(brandSlug, modelSlug, typeConception);
  if (brokenRows.length > 0) { stats.fixedStaleDates++; return; }
  stats.imported++;
};

for (const item of items) {
  if (DRY_RUN) runOneDry(item);
  else runOne(item);
}

console.log('\n' + (DRY_RUN ? '[DRY RUN] ' : '') + 'Import summary:');
console.log(stats);
console.log(`\nUnmatched models (first 20 of ${unmatchedLog.length}):`);
unmatchedLog.slice(0, 20).forEach((l) => console.log('  ', l));

db.close();
