/**
 * Near-duplicate model dedup — Strapi side, catalog-wide.
 *
 * Mirrors react-app-tablet/scripts/dedupe_models.cjs (which re-fixed a
 * regression: 100 NX/100NX, 200 SX/200SX, 300 ZX/300ZX etc. reappeared in
 * SQLite after a later bulk CSV reimport silently recreated the models
 * table, undoing an earlier dedup pass). Strapi has the exact same
 * regression — it was never mirrored there in the first place.
 *
 * Unlike dedupe-models.js (exact name match only), this groups by
 * normStrict(name) = uppercase + strip all whitespace, catching spacing/
 * casing-only duplicates like "100 NX" vs "100NX". Canonical selection
 * reuses dedupe-models.js's existing data-driven heuristic (isReferenced >
 * dataCount > minId) rather than hardcoding per-pair winners — this
 * heuristic already agrees with every explicit winner decision the
 * frontend script's hardcoded bothSidesWinners map recorded for the
 * Tier1-shaped groups (verified for the Nissan pairs before writing this).
 *
 * Deliberately catalog-wide but conservative: only processes groups where
 * ALL members normalize to the same normStrict key (frontend's "Tier1"
 * shape). Skips normLoose-tier groups and hand-verified special cases
 * (Peugeot 206, Vauxhall sis/Cab fragments, Astra Mk III/IV Convertible,
 * Megane II Coupé-Cabriolet) since those needed hardcoded, human-reviewed
 * winner decisions on the frontend and a generic heuristic could get them
 * wrong -- left for a manual follow-up mirror if ever needed.
 *
 * Deactivates (is_active = 0) rather than deletes the losing rows, exactly
 * like dedupe-models.js -- sidesteps filter_compatibilities' model_id FK
 * entirely (the SQLite-side script needed a real fix for that; deactivate-
 * not-delete avoids the problem by construction here).
 *
 * Usage: node scripts/dedupe-models-near-duplicates.js [--dry-run] [dbPath]
 * (dbPath defaults to .tmp/data.db relative to cwd)
 */

const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DEFAULT_DB_PATH = path.join(process.cwd(), '.tmp', 'data.db');
const dbPath = process.argv.slice(2).find(a => !a.startsWith('--')) || DEFAULT_DB_PATH;

const REFERENCED_VEHICLES_PATH = path.join(
  __dirname, '..', '..', 'react-app-tablet', 'public', 'assets', 'data', 'referenced_vehicles.json'
);

const LNK_TABLES = ['lights_products_model_lnk', 'wipers_products_model_lnk', 'filter_compatibilities_model_lnk'];

function normStrict(name) {
  return (name || '').toUpperCase().replace(/\s+/g, '');
}

function loadReferencedSlugs() {
  const fs = require('fs');
  if (!fs.existsSync(REFERENCED_VEHICLES_PATH)) return new Set();
  const data = JSON.parse(fs.readFileSync(REFERENCED_VEHICLES_PATH, 'utf-8'));
  const all = new Set();
  for (const brand of Object.values(data.brands || {})) {
    for (const slug of Object.keys(brand.models || {})) all.add(slug);
  }
  return all;
}

const db = new Database(dbPath, { readonly: DRY_RUN });
const referencedSlugs = loadReferencedSlugs();

const rows = db.prepare(`
  SELECT m.id, m.document_id as documentId, m.name, m.slug, m.published_at IS NOT NULL as isPublished,
         b.slug as brandSlug
  FROM models m
  JOIN models_brand_lnk lnk ON lnk.model_id = m.id
  JOIN brands b ON b.id = lnk.brand_id
  WHERE m.is_active = 1
  ORDER BY b.slug, m.name, m.id
`).all();

const byDoc = new Map();
for (const r of rows) {
  if (!byDoc.has(r.documentId)) byDoc.set(r.documentId, { documentId: r.documentId, name: r.name, brandSlug: r.brandSlug, rows: [] });
  byDoc.get(r.documentId).rows.push(r);
}
const docs = Array.from(byDoc.values());

// normStrict only strips whitespace, so Roman-numeral tokens can silently
// reassemble into a different number when spacing differs ("SCIROCCO III"
// vs "SCIROCCO I II" both normalize to "SCIROCCOIII" -- 3 vs 1+2 are
// different real generations). Caught on the SQLite mirror of this exact
// script (react-app-tablet/scripts/dedupe_models.cjs) before this ever
// ran for real here -- same two known false positives blocked pair-wise.
const NEVER_GROUP_TOGETHER = [
  ['SCIROCCO I II', 'SCIROCCO III'],
  ['ASTRA Mk II I Saloon', 'ASTRA Mk III Saloon'],
];
function isBlockedPair(names) {
  return NEVER_GROUP_TOGETHER.some(([a, b]) => names.has(a) && names.has(b));
}

const byKey = new Map();
for (const doc of docs) {
  const key = doc.brandSlug + '|' + normStrict(doc.name);
  if (!byKey.has(key)) byKey.set(key, []);
  byKey.get(key).push(doc);
}

function countProductRows(ids) {
  let total = 0;
  for (const table of LNK_TABLES) {
    for (const id of ids) total += db.prepare(`SELECT COUNT(*) as cnt FROM ${table} WHERE model_id = ?`).get(id).cnt;
  }
  return total;
}
function countBatteryRows(brandSlug, slugs) {
  let total = 0;
  for (const slug of slugs) total += db.prepare(`SELECT COUNT(*) as cnt FROM battery_products WHERE brand_slug = ? AND model_slug = ?`).get(brandSlug, slug).cnt;
  return total;
}

const groups = [];
for (const [key, group] of byKey) {
  if (group.length <= 1) continue;
  const distinctNames = new Set(group.map(d => d.name));
  if (distinctNames.size <= 1) continue; // exact-name dupes already handled by dedupe-models.js
  if (isBlockedPair(distinctNames)) continue;
  groups.push(group);
}

console.log(`${groups.length} near-duplicate group(s) found (normStrict, catalog-wide).\n`);

const migrateLnk = {};
for (const table of LNK_TABLES) migrateLnk[table] = db.prepare(`UPDATE ${table} SET model_id = ? WHERE model_id = ?`);
const migrateBattery = db.prepare(`UPDATE battery_products SET model_slug = ? WHERE brand_slug = ? AND model_slug = ?`);
const deactivateModel = db.prepare(`UPDATE models SET is_active = 0 WHERE id = ?`);

let migratedLnkRows = 0, migratedBatteryRows = 0, deactivatedModels = 0, groupsProcessed = 0;

function processGroup(group) {
  const brandSlug = group[0].brandSlug;
  const scored = group.map(doc => {
    const ids = doc.rows.map(r => r.id);
    const slugs = [...new Set(doc.rows.map(r => r.slug))];
    const isReferenced = slugs.some(s => referencedSlugs.has(s));
    const dataCount = countProductRows(ids) + countBatteryRows(brandSlug, slugs);
    return { ...doc, isReferenced, dataCount, minId: Math.min(...ids) };
  });
  scored.sort((a, b) => {
    if (a.isReferenced !== b.isReferenced) return a.isReferenced ? -1 : 1;
    if (a.dataCount !== b.dataCount) return b.dataCount - a.dataCount;
    return a.minId - b.minId;
  });

  const canonical = scored[0];
  const losers = scored.slice(1);
  const canonicalDraft = canonical.rows.find(r => !r.isPublished);
  const canonicalPublished = canonical.rows.find(r => r.isPublished);
  const canonicalSlug = (canonicalPublished ?? canonicalDraft).slug;

  console.log(`[${brandSlug}] "${canonical.name}" (documentId ${canonical.documentId}, slug ${canonicalSlug}, referenced=${canonical.isReferenced}, data=${canonical.dataCount}) wins over:`);
  for (const loser of losers) {
    console.log(`    "${loser.name}" (documentId ${loser.documentId}, slug ${loser.rows[0].slug}, data=${loser.dataCount})`);
  }

  if (DRY_RUN) return;

  groupsProcessed++;
  for (const loser of losers) {
    const losingDraft = loser.rows.find(r => !r.isPublished);
    const losingPublished = loser.rows.find(r => r.isPublished);
    const pairs = [[losingDraft, canonicalDraft], [losingPublished, canonicalPublished]];

    for (const table of LNK_TABLES) {
      for (const [losing, canonicalRow] of pairs) {
        if (!losing || !canonicalRow) continue;
        const result = migrateLnk[table].run(canonicalRow.id, losing.id);
        migratedLnkRows += result.changes;
      }
    }

    for (const losingSlug of [...new Set(loser.rows.map(r => r.slug))]) {
      const result = migrateBattery.run(canonicalSlug, brandSlug, losingSlug);
      migratedBatteryRows += result.changes;
    }

    for (const r of loser.rows) {
      deactivateModel.run(r.id);
      deactivatedModels++;
    }
  }
}

if (DRY_RUN) {
  for (const group of groups) processGroup(group);
  console.log(`\n[DRY RUN] ${groups.length} group(s) would be processed. No changes written.`);
  process.exit(0);
}

const txn = db.transaction(() => {
  for (const group of groups) processGroup(group);
});
txn();
db.close();

console.log('\n=== Summary ===');
console.log(`Groups processed: ${groupsProcessed}`);
console.log(`_model_lnk rows migrated: ${migratedLnkRows}`);
console.log(`battery_products rows migrated: ${migratedBatteryRows}`);
console.log(`Models deactivated: ${deactivatedModels}`);
