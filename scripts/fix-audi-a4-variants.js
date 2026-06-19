/**
 * Fix AUDI A4 variant entries in the Strapi database.
 *
 * Remaining issues after merge-audi-a4-wipers.js:
 *  1. wiper-valeo-a4-s4-rs4      → duplicate of 012008-lhd (same positions, same period)
 *  2. wiper-imdicar-a4-avant-8d5   → duplicate of 072016-lhd (07/2016+, corrupt positions)
 *  3. wiper-imdicar-a4-avant-8d5-1 → same as above
 *  4. wiper-imdicar-a4-convertible-8h7 → unique period (04/2002–05/2009), but linked to
 *     wrong model (A4 Convertible) and missing dates + incomplete positions
 *
 * Usage (from react-app-tablet-backend/, Strapi must be STOPPED):
 *   node scripts/fix-audi-a4-variants.js [--dry-run]
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

// ── Slugs to DELETE outright ───────────────────────────────────────────────────
const SLUGS_TO_DELETE = [
  'wiper-valeo-a4-s4-rs4',        // identical to wiper-valeo-a4-012008-lhd
  'wiper-imdicar-a4-avant-8d5',   // duplicate 07/2016+, corrupt positions
  'wiper-imdicar-a4-avant-8d5-1', // same
];

// ── Convertible fix ────────────────────────────────────────────────────────────
// Re-link to base A4 model (model_ids 175 + 29087), fix dates + name + positions.
// Positions sourced from the local SQLite (react-app-tablet/public/assets/databases).
const CONVERTIBLE_SLUG = 'wiper-imdicar-a4-convertible-8h7';
const CONVERTIBLE_FIX = {
  name: 'AUDI A4 - Wipers',
  construction_year_start: '04/2002',
  construction_year_end: '05/2009',
  wipers_positions: JSON.stringify([
    { position: 'Passenger', ref: '486', description: 'BEG PLAT 550MM 22 pouces', category: 'plats', brand: 'IMDICAR', originalSize: '550mm' },
    { position: 'Back',      ref: '486', description: 'BEG PLAT 550MM 22 pouces', category: 'plats', brand: 'IMDICAR', originalSize: '550mm' },
    { position: 'Driver',    ref: '487', description: 'BEG PLAT 600MM 24 pouces', category: 'plats', brand: 'IMDICAR', originalSize: '600mm' },
    { position: 'Passenger', ref: '484', description: 'BEG PLAT 500MM 20 pouces', category: 'plats', brand: 'IMDICAR', originalSize: '500mm' },
  ]),
  // Remove links to old models (A4 Convertible), add links to base A4
  removeModelIds: [199, 29109],
  addModelIds: [175, 29087],
};

// ── Main ──────────────────────────────────────────────────────────────────────

function run() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  console.log(`\n📂 Processing: ${DB_PATH}`);
  const db = new Database(DB_PATH, DRY_RUN ? { readonly: true } : {});

  // ── 1. Deletions ─────────────────────────────────────────────────────────────
  const placeholders = SLUGS_TO_DELETE.map(() => '?').join(',');
  const toDelete = db.prepare(`SELECT id, slug FROM wipers_products WHERE slug IN (${placeholders})`)
    .all(...SLUGS_TO_DELETE);

  const deleteIds = toDelete.map(r => r.id);
  const bySlug = {};
  for (const r of toDelete) {
    if (!bySlug[r.slug]) bySlug[r.slug] = [];
    bySlug[r.slug].push(r.id);
  }

  console.log(`\n  🗑️  Entries to DELETE (${Object.keys(bySlug).length} slugs, ${deleteIds.length} rows):`);
  for (const [slug, ids] of Object.entries(bySlug)) {
    console.log(`    - ${slug} [ids: ${ids.join(', ')}]`);
  }

  if (!DRY_RUN && deleteIds.length > 0) {
    const idPlaceholders = deleteIds.map(() => '?').join(',');
    db.transaction(() => {
      db.prepare(`DELETE FROM wipers_products_brand_lnk WHERE wipers_product_id IN (${idPlaceholders})`).run(...deleteIds);
      db.prepare(`DELETE FROM wipers_products_model_lnk WHERE wipers_product_id IN (${idPlaceholders})`).run(...deleteIds);
      db.prepare(`DELETE FROM wipers_products WHERE id IN (${idPlaceholders})`).run(...deleteIds);
    })();
    console.log(`    ✅ Deleted ${deleteIds.length} rows + links`);
  } else if (DRY_RUN) {
    console.log(`    [DRY-RUN] Would delete ${deleteIds.length} rows + links`);
  }

  // ── 2. Convertible fix ────────────────────────────────────────────────────────
  const convRows = db.prepare(`SELECT id FROM wipers_products WHERE slug = ?`).all(CONVERTIBLE_SLUG);

  if (convRows.length === 0) {
    console.log(`\n  ℹ️  Convertible entry not found — skipping fix`);
  } else {
    const convIds = convRows.map(r => r.id);
    console.log(`\n  🔧 Convertible fix (ids: ${convIds.join(', ')}):`);
    console.log(`    name: "${CONVERTIBLE_FIX.name}"`);
    console.log(`    dates: ${CONVERTIBLE_FIX.construction_year_start} → ${CONVERTIBLE_FIX.construction_year_end}`);
    console.log(`    model links: remove [${CONVERTIBLE_FIX.removeModelIds}], add [${CONVERTIBLE_FIX.addModelIds}]`);

    if (!DRY_RUN) {
      const now = new Date().toISOString();
      const idPlaceholders = convIds.map(() => '?').join(',');

      db.transaction(() => {
        // Update name, dates, positions on both rows
        db.prepare(`
          UPDATE wipers_products
          SET name = ?, construction_year_start = ?, construction_year_end = ?,
              wipers_positions = ?, updated_at = ?
          WHERE slug = ?
        `).run(
          CONVERTIBLE_FIX.name,
          CONVERTIBLE_FIX.construction_year_start,
          CONVERTIBLE_FIX.construction_year_end,
          CONVERTIBLE_FIX.wipers_positions,
          now,
          CONVERTIBLE_SLUG
        );

        // Remove old model links
        const removeModelPlaceholders = CONVERTIBLE_FIX.removeModelIds.map(() => '?').join(',');
        db.prepare(`
          DELETE FROM wipers_products_model_lnk
          WHERE wipers_product_id IN (${idPlaceholders})
          AND model_id IN (${removeModelPlaceholders})
        `).run(...convIds, ...CONVERTIBLE_FIX.removeModelIds);

        // Add new model links (one per product_id × model_id combination)
        const insertLnk = db.prepare(`
          INSERT OR IGNORE INTO wipers_products_model_lnk (wipers_product_id, model_id)
          VALUES (?, ?)
        `);
        for (const productId of convIds) {
          for (const modelId of CONVERTIBLE_FIX.addModelIds) {
            insertLnk.run(productId, modelId);
          }
        }
      })();

      console.log(`    ✅ Convertible fixed`);
    } else {
      console.log(`    [DRY-RUN] Would update ${convIds.length} rows and re-link model`);
    }
  }

  db.close();
  console.log('\n✅ Done.');
}

console.log(`🔧 AUDI A4 — Fix Variant Entries`);
console.log(`   Mode: ${DRY_RUN ? '🔍 DRY-RUN (no changes)' : '✍️  LIVE (Strapi must be stopped)'}`);
run();
