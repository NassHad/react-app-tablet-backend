/**
 * Merge duplicate wipers_products entries for AUDI A4 in the Strapi database.
 *
 * The Strapi DB has multiple entries per period (LHD/RHD splits, IMDICAR duplicates,
 * stale entries). This script consolidates them to one entry per period.
 *
 * Result: 16 published A4 entries → 7 entries
 *
 * Usage (from react-app-tablet-backend/):
 *   node scripts/merge-audi-a4-wipers.js [--dry-run]
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');

const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

// ── Slugs to DELETE (consolidated into the kept entry for the same period) ────
//
// Each slug listed here has an identical or redundant counterpart that will be kept.
//
// Period coverage after deletion:
//   02/1995–01/1999  → wiper-valeo-a4-021995         (kept)
//   02/1999–01/2001  → wiper-valeo-a4-021999         (kept)
//   01/2008–10/2015  → wiper-valeo-a4-012008-lhd     (kept)
//   05/2008–10/2015  → wiper-valeo-a4-052008-lhd     (kept)
//   05/2009–06/2016  → wiper-valeo-a4-052009-lhd     (kept)
//   11/2015–present  → wiper-valeo-a4-112015-lhd     (kept)
//   07/2016–present  → wiper-valeo-a4-072016-lhd     (kept)

const SLUGS_TO_DELETE = [
  // 01/2008–10/2015: RHD identical to LHD
  'wiper-valeo-a4-012008-rhd',
  // 05/2008–10/2015: RHD identical to LHD
  'wiper-valeo-a4-052008-rhd',
  // 05/2009–06/2016: RHD identical to LHD
  'wiper-valeo-a4-052009-rhd',
  // 11/2015–present: RHD identical to LHD, IMDICAR duplicates, stale entry with wrong dates
  'wiper-valeo-a4-112015-rhd',
  'wiper-imdicar-a4-8d2',
  'wiper-imdicar-a4-8e2',
  'wiper-imdicar-a4-8e2-1',
  'wiper-valeo-a4',       // stale: wrong dates (06/1994 in Strapi instead of 11/2015)
  // 07/2016–present: RHD identical to LHD
  'wiper-valeo-a4-072016-rhd',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getIdsForSlugs(db, slugs) {
  if (slugs.length === 0) return [];
  const placeholders = slugs.map(() => '?').join(',');
  return db.prepare(`SELECT id, slug, document_id FROM wipers_products WHERE slug IN (${placeholders})`)
    .all(...slugs);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function processDatabase(dbPath) {
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found: ${dbPath}`);
    process.exit(1);
  }

  console.log(`\n📂 Processing: ${dbPath}`);
  const db = new Database(dbPath, DRY_RUN ? { readonly: true } : {});

  const rows = getIdsForSlugs(db, SLUGS_TO_DELETE);

  if (rows.length === 0) {
    console.log('  ℹ️  No matching entries found.');
    db.close();
    return;
  }

  // Group by slug for display
  const bySlug = {};
  for (const row of rows) {
    if (!bySlug[row.slug]) bySlug[row.slug] = [];
    bySlug[row.slug].push(row.id);
  }

  const allIds = rows.map(r => r.id);
  const idPlaceholders = allIds.map(() => '?').join(',');

  console.log(`\n  📋 Entries to delete (${Object.keys(bySlug).length} slugs, ${allIds.length} rows):`);
  for (const [slug, ids] of Object.entries(bySlug)) {
    console.log(`    - ${slug} [ids: ${ids.join(', ')}]`);
  }

  if (DRY_RUN) {
    console.log(`\n  [DRY-RUN] Would DELETE ${allIds.length} rows from wipers_products`);
    console.log(`  [DRY-RUN] Would DELETE related rows from wipers_products_brand_lnk`);
    console.log(`  [DRY-RUN] Would DELETE related rows from wipers_products_model_lnk`);
    db.close();
    return;
  }

  const deleteAll = db.transaction(() => {
    // Clean up link tables first (foreign key constraints)
    const brandLnkDel = db.prepare(`DELETE FROM wipers_products_brand_lnk WHERE wipers_product_id IN (${idPlaceholders})`);
    const modelLnkDel = db.prepare(`DELETE FROM wipers_products_model_lnk WHERE wipers_product_id IN (${idPlaceholders})`);
    const productDel  = db.prepare(`DELETE FROM wipers_products WHERE id IN (${idPlaceholders})`);

    const r1 = brandLnkDel.run(...allIds);
    const r2 = modelLnkDel.run(...allIds);
    const r3 = productDel.run(...allIds);

    return { brandLinks: r1.changes, modelLinks: r2.changes, products: r3.changes };
  });

  const stats = deleteAll();

  console.log(`\n  ✅ Deleted:`);
  console.log(`     ${stats.products} rows from wipers_products`);
  console.log(`     ${stats.brandLinks} rows from wipers_products_brand_lnk`);
  console.log(`     ${stats.modelLinks} rows from wipers_products_model_lnk`);

  db.close();
}

// ── Entry point ───────────────────────────────────────────────────────────────

console.log(`🔧 AUDI A4 Strapi DB — Merge Duplicates`);
console.log(`   Mode: ${DRY_RUN ? '🔍 DRY-RUN (no changes)' : '✍️  LIVE (will modify DB)'}`);
console.log(`   Slugs to remove: ${SLUGS_TO_DELETE.length}`);

processDatabase(DB_PATH);

if (!DRY_RUN) {
  console.log(`
✅ Done. Verify with:
   curl -s "http://localhost:1338/api/wipers-selection/products-by-slugs?brandSlug=audi&modelSlug=a4" \\
     | python3 -c "import sys,json; d=json.load(sys.stdin); items=d if isinstance(d,list) else d.get('data',[]); print('Count:',len(items)); [print(' ',i.get('slug','?'),i.get('constructionYearStart','?'),'-',i.get('constructionYearEnd','?')) for i in items]"
`);
}
