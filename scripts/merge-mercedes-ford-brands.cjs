/**
 * Strapi mirror of react-app-tablet/scripts/merge_mercedes_ford_brands.cjs.
 * Merges mercedes-benz -> mercedes and ford-usa -> ford (winner name kept
 * for both). Same overlapping-models shape as SQLite (confirmed live: e.g.
 * Mercedes "A-CLASS" exists as separate model rows under both brand slugs).
 *
 * Unlike the SQLite script, this deactivates rather than deletes -- avoids
 * the FK-constraint-on-delete issues that script needed extra passes to
 * fix (model_id AND brand_id both FK'd from filter_compatibilities; same
 * risk exists here via ON DELETE CASCADE on every *_lnk table, which would
 * silently cascade-delete product relations rather than erroring, an even
 * worse failure mode for a delete-based approach). Matches the existing
 * dedupe-models.js precedent: migrate relations, deactivate losers.
 *
 * For each loser model (matched by exact name to a winner model, same
 * merge-vs-reparent split as the SQLite version):
 *  - Merge case: migrate battery/wipers/lights/filter_compatibilities
 *    *_model_lnk rows (draft->draft, pub->pub) from loser model to winner
 *    model, update flat brand/model columns on those product rows, migrate
 *    battery_products' flat model_slug like dedupe-models.js already does,
 *    deactivate the loser model (draft+pub).
 *  - Reparent case: repoint models_brand_lnk (draft->draft, pub->pub) from
 *    loser brand to winner brand, update the model's own brand_name flat
 *    column, update flat brand columns on its product rows. Model itself
 *    stays active under its own name/slug.
 *
 * Also updates filter_compatibilities.brand_name/brand_id (flat + relational)
 * catalog-wide (independent of model pairing) and does a brand-level
 * catch-all repoint of product rows whose model_slug never matched a real
 * `models` row (found live in the SQLite pass -- 3 stranded battery_products
 * rows under mercedes-benz with no corresponding models row at all).
 *
 * Usage: node scripts/merge-mercedes-ford-brands.cjs [--dry-run]
 */
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

const MERGES = [
  { loserSlug: 'mercedes-benz', winnerSlug: 'mercedes' },
  { loserSlug: 'ford-usa', winnerSlug: 'ford' },
];

const PRODUCT_TABLES = ['battery_products', 'wipers_products', 'lights_products'];
const MODEL_LNK_TABLES = ['battery_products_model_lnk', 'wipers_products_model_lnk', 'lights_products_model_lnk', 'filter_compatibilities_model_lnk'];
const BRAND_LNK_TABLES = ['battery_products_brand_lnk', 'wipers_products_brand_lnk', 'lights_products_brand_lnk', 'filter_compatibilities_brand_lnk'];

const db = new Database(DB_PATH, { readonly: DRY_RUN });

function getBrandRows(slug) {
  return db.prepare('SELECT id, name, slug, vehicle_type, published_at IS NOT NULL as isPublished FROM brands WHERE slug = ?').all(slug);
}
function getModelsForBrand(brandId) {
  return db.prepare(`
    SELECT m.id, m.document_id as documentId, m.name, m.slug, m.published_at IS NOT NULL as isPublished
    FROM models m JOIN models_brand_lnk lnk ON lnk.model_id = m.id
    WHERE lnk.brand_id = ?
  `).all(brandId);
}

const stats = { merged: 0, reparented: 0, filterCompatRows: 0, catchAllRows: 0, brandsDeactivated: 0 };

function processMerge(loserSlug, winnerSlug) {
  const loserBrandRows = getBrandRows(loserSlug);
  const winnerBrandRows = getBrandRows(winnerSlug);
  if (loserBrandRows.length === 0 || winnerBrandRows.length === 0) {
    console.log(`  SKIP ${loserSlug} -> ${winnerSlug}: brand row(s) missing (loser=${loserBrandRows.length}, winner=${winnerBrandRows.length})`);
    return;
  }
  const loserDraft = loserBrandRows.find(r => !r.isPublished);
  const loserPub = loserBrandRows.find(r => r.isPublished);
  const winnerDraft = winnerBrandRows.find(r => !r.isPublished);
  const winnerPub = winnerBrandRows.find(r => r.isPublished);
  const winnerName = (winnerPub ?? winnerDraft).name;

  // Gather loser models across both draft+pub brand rows, grouped by documentId
  const loserModelRowsAll = [...(loserDraft ? getModelsForBrand(loserDraft.id) : []), ...(loserPub ? getModelsForBrand(loserPub.id) : [])];
  const byDoc = new Map();
  for (const r of loserModelRowsAll) {
    if (!byDoc.has(r.documentId)) byDoc.set(r.documentId, { documentId: r.documentId, name: r.name, rows: [] });
    byDoc.get(r.documentId).rows.push(r);
  }
  const loserModels = [...byDoc.values()];
  console.log(`  ${loserSlug} -> ${winnerSlug}: ${loserModels.length} model documentId(s) to process`);

  for (const lm of loserModels) {
    const loserDraftRow = lm.rows.find(r => !r.isPublished);
    const loserPubRow = lm.rows.find(r => r.isPublished);

    const winnerMatchDraft = winnerDraft ? db.prepare(`
      SELECT m.id, m.slug FROM models m JOIN models_brand_lnk lnk ON lnk.model_id = m.id
      WHERE lnk.brand_id = ? AND UPPER(m.name) = UPPER(?) AND m.published_at IS NULL
    `).get(winnerDraft.id, lm.name) : null;
    const winnerMatchPub = winnerPub ? db.prepare(`
      SELECT m.id, m.slug FROM models m JOIN models_brand_lnk lnk ON lnk.model_id = m.id
      WHERE lnk.brand_id = ? AND UPPER(m.name) = UPPER(?) AND m.published_at IS NOT NULL
    `).get(winnerPub.id, lm.name) : null;

    if (winnerMatchDraft || winnerMatchPub) {
      // Merge case -- all four *_model_lnk tables use `model_id` uniformly
      // for the models-side FK (verified against schema), so a single
      // generic UPDATE works across all of them.
      const pairs = [[loserDraftRow, winnerMatchDraft], [loserPubRow, winnerMatchPub]];
      for (const table of MODEL_LNK_TABLES) {
        for (const [losing, winning] of pairs) {
          if (!losing || !winning) continue;
          const result = db.prepare(`UPDATE ${table} SET model_id = ? WHERE model_id = ?`).run(winning.id, losing.id);
          if (table === 'filter_compatibilities_model_lnk') stats.filterCompatRows += result.changes;
        }
      }
      // Only battery_products has flat brand/model text columns in Strapi
      // (brand_name/brand_slug/model_name/model_slug) -- wipers_products and
      // lights_products are purely relational (no such columns at all), so
      // the *_model_lnk repoint above is already everything they need.
      const winningSlug = (winnerMatchPub ?? winnerMatchDraft).slug;
      db.prepare(`UPDATE battery_products SET brand_name=?, brand_slug=?, model_name=?, model_slug=? WHERE brand_slug=? AND model_slug=?`)
        .run(winnerName, winnerSlug, lm.name, winningSlug, loserSlug, lm.rows[0].slug);

      for (const r of lm.rows) db.prepare('UPDATE models SET is_active = 0 WHERE id = ?').run(r.id);
      stats.merged++;
    } else {
      // Reparent case -- the model row itself is unchanged (same id/slug),
      // only its own brand association moves. wipers_products/lights_products
      // rows linked to that model_id transitively follow with zero changes
      // of their own; only battery_products' flat columns need updating.
      const pairs = [[loserDraftRow, winnerDraft], [loserPubRow, winnerPub]];
      for (const [losing, winningBrand] of pairs) {
        if (!losing || !winningBrand) continue;
        db.prepare('UPDATE models_brand_lnk SET brand_id = ? WHERE model_id = ?').run(winningBrand.id, losing.id);
      }
      db.prepare(`UPDATE battery_products SET brand_name=?, brand_slug=? WHERE brand_slug=? AND model_slug=?`)
        .run(winnerName, winnerSlug, loserSlug, lm.rows[0].slug);
      stats.reparented++;
    }
  }

  // filter_compatibilities has no flat brand_name/brand_id columns at all in
  // Strapi (unlike SQLite) -- purely relational via filter_compatibilities_
  // brand_lnk, one of BRAND_LNK_TABLES below.
  for (const table of BRAND_LNK_TABLES) {
    for (const [loserRow, winnerRow] of [[loserDraft, winnerDraft], [loserPub, winnerPub]]) {
      if (!loserRow || !winnerRow) continue;
      const result = db.prepare(`UPDATE ${table} SET brand_id = ? WHERE brand_id = ?`).run(winnerRow.id, loserRow.id);
      if (table === 'filter_compatibilities_brand_lnk') stats.filterCompatRows += result.changes;
    }
  }

  // Catch-all for battery_products' flat brand_slug column -- orphaned rows
  // whose model_slug never matched a real models row, same class of gap
  // confirmed live in the SQLite pass. wipers_products/lights_products need
  // no equivalent: the BRAND_LNK_TABLES repoint above already caught every
  // row keyed by brand_id alone, independent of model matching.
  const catchAllResult = db.prepare(`UPDATE battery_products SET brand_name=?, brand_slug=? WHERE brand_slug=?`).run(winnerName, winnerSlug, loserSlug);
  if (catchAllResult.changes > 0) { stats.catchAllRows += catchAllResult.changes; console.log(`    catch-all: ${catchAllResult.changes} orphaned battery_products row(s) repointed`); }

  // Union vehicle_type onto winner brand rows
  const loserVType = (loserPub ?? loserDraft).vehicle_type;
  for (const winnerRow of [winnerDraft, winnerPub]) {
    if (!winnerRow || !loserVType || loserVType === winnerRow.vehicle_type) continue;
    const merged = !winnerRow.vehicle_type ? loserVType : (winnerRow.vehicle_type === loserVType ? winnerRow.vehicle_type : 'car-moto');
    db.prepare('UPDATE brands SET vehicle_type=? WHERE id=?').run(merged, winnerRow.id);
  }

  for (const r of [loserDraft, loserPub]) {
    if (!r) continue;
    db.prepare('UPDATE brands SET is_active = 0 WHERE id = ?').run(r.id);
  }
  stats.brandsDeactivated++;
}

if (DRY_RUN) {
  for (const { loserSlug, winnerSlug } of MERGES) {
    const loserBrandRows = getBrandRows(loserSlug);
    const winnerBrandRows = getBrandRows(winnerSlug);
    if (loserBrandRows.length === 0 || winnerBrandRows.length === 0) {
      console.log(`  [dry-run] SKIP ${loserSlug} -> ${winnerSlug}: brand row(s) missing`);
      continue;
    }
    const loserPub = loserBrandRows.find(r => r.isPublished) ?? loserBrandRows[0];
    const winnerPub = winnerBrandRows.find(r => r.isPublished) ?? winnerBrandRows[0];
    const loserModelRows = [...new Set(loserBrandRows.flatMap(b => getModelsForBrand(b.id).map(m => m.documentId)))];
    let merged = 0, reparented = 0;
    for (const docId of loserModelRows) {
      const anyRow = loserBrandRows.flatMap(b => getModelsForBrand(b.id)).find(m => m.documentId === docId);
      const match = db.prepare(`
        SELECT m.id FROM models m JOIN models_brand_lnk lnk ON lnk.model_id=m.id
        WHERE lnk.brand_id=? AND UPPER(m.name)=UPPER(?)
      `).get(winnerPub.id, anyRow.name);
      if (match) merged++; else reparented++;
    }
    const fcCount = loserBrandRows.reduce((sum, b) =>
      sum + db.prepare('SELECT COUNT(*) c FROM filter_compatibilities_brand_lnk WHERE brand_id=?').get(b.id).c, 0);
    console.log(`  [dry-run] ${loserSlug} -> ${winnerSlug}: ${loserModelRows.length} documentId(s), ${merged} merge, ${reparented} reparent, ${fcCount} filter_compatibilities row(s)`);
  }
  db.close();
  process.exit(0);
}

const txn = db.transaction(() => {
  for (const { loserSlug, winnerSlug } of MERGES) processMerge(loserSlug, winnerSlug);
});
txn();
db.close();
console.log(`\nmerged=${stats.merged} reparented=${stats.reparented} filterCompatRows=${stats.filterCompatRows} catchAllRows=${stats.catchAllRows} brandsDeactivated=${stats.brandsDeactivated}`);
