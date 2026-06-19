/**
 * Fix remaining AUDI A4 variant entries in the Strapi database.
 *
 * After merge-audi-a4-wipers.js and fix-audi-a4-variants.js, the following
 * variant entries remain:
 *   - wiper-valeo-a4-avant       → unique period (06/1994–01/1995), rename + re-link
 *   - wiper-valeo-a4-avant-021995 → has Back VS 30 not in base; merge then delete
 *   - wiper-valeo-a4-avant-021999 → same; merge then delete
 *   - wiper-imdicar-a4-allroad-8kh → has Back 481 not in base; merge then delete
 *
 * Usage (from react-app-tablet-backend/, Strapi must be STOPPED):
 *   node scripts/fix-audi-a4-remaining-variants.js [--dry-run]
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

// ── Positions to inject (verified against DB) ─────────────────────────────────

const BACK_VS30 = {
  position: 'Back',
  ref: 'VS 30',
  description: 'VALEO BALAI E.G. STD VS30 350MM',
  category: 'arriere',
  brand: 'Valeo',
};

const BACK_481 = {
  position: 'Back',
  ref: '481',
  description: 'BEG PLAT 400MM 16 pouces',
  category: 'plats',
  brand: 'IMDICAR',
  originalSize: '400mm',
};

// ── Position injections (slug → positions to add if absent) ───────────────────
const POSITION_INJECTIONS = [
  { slug: 'wiper-valeo-a4-021995',    add: [BACK_VS30] },
  { slug: 'wiper-valeo-a4-021999',    add: [BACK_VS30] },
  { slug: 'wiper-valeo-a4-052009-lhd', add: [BACK_481] },
];

// ── Rename + re-link ──────────────────────────────────────────────────────────
const AVANT_SLUG = 'wiper-valeo-a4-avant';
const AVANT_FIX = {
  name: 'AUDI A4 - Wipers',
  removeModelIds: [181, 29096],
  addModelIds: [175, 29087],
};

// ── Slugs to delete ───────────────────────────────────────────────────────────
const SLUGS_TO_DELETE = [
  'wiper-valeo-a4-avant-021995',
  'wiper-valeo-a4-avant-021999',
  'wiper-imdicar-a4-allroad-8kh',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function posKey(p) {
  return `${p.position}|${p.ref}|${p.category}`;
}

function addPositionsIfAbsent(existing, toAdd) {
  const seen = new Set(existing.map(posKey));
  const result = [...existing];
  for (const p of toAdd) {
    const k = posKey(p);
    if (!seen.has(k)) {
      seen.add(k);
      result.push(p);
    }
  }
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function run() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  console.log(`\n📂 Processing: ${DB_PATH}`);
  const db = new Database(DB_PATH, DRY_RUN ? { readonly: true } : {});
  const now = new Date().toISOString();

  // ── 1. Position injections ──────────────────────────────────────────────────
  console.log('\n── 1. Position injections ──');

  for (const inj of POSITION_INJECTIONS) {
    const rows = db.prepare('SELECT id, slug, wipers_positions FROM wipers_products WHERE slug = ?').all(inj.slug);
    if (rows.length === 0) {
      console.log(`  ℹ️  ${inj.slug} — not found, skipping`);
      continue;
    }

    for (const row of rows) {
      const existing = JSON.parse(row.wipers_positions || '[]');
      const merged = addPositionsIfAbsent(existing, inj.add);
      const added = merged.length - existing.length;

      if (added === 0) {
        console.log(`  ✓  id=${row.id} (${row.slug}) — positions already present`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY-RUN] id=${row.id} (${row.slug}): +${added} position(s)`);
        inj.add.forEach(p => console.log(`    + ${p.position} [${p.ref}] (${p.category})`));
      } else {
        db.prepare('UPDATE wipers_products SET wipers_positions = ?, updated_at = ? WHERE id = ?')
          .run(JSON.stringify(merged), now, row.id);
        console.log(`  ✅ id=${row.id} (${row.slug}): +${added} position(s) added`);
        inj.add.forEach(p => console.log(`    + ${p.position} [${p.ref}] (${p.category})`));
      }
    }
  }

  // ── 2. Rename + re-link wiper-valeo-a4-avant ───────────────────────────────
  console.log('\n── 2. Rename + re-link wiper-valeo-a4-avant ──');

  const avantRows = db.prepare('SELECT id FROM wipers_products WHERE slug = ?').all(AVANT_SLUG);
  if (avantRows.length === 0) {
    console.log('  ℹ️  wiper-valeo-a4-avant not found, skipping');
  } else {
    const avantIds = avantRows.map(r => r.id);
    console.log(`  ids: [${avantIds.join(', ')}]`);
    console.log(`  name → "${AVANT_FIX.name}"`);
    console.log(`  model links: remove [${AVANT_FIX.removeModelIds}], add [${AVANT_FIX.addModelIds}]`);

    if (!DRY_RUN) {
      const idPlaceholders = avantIds.map(() => '?').join(',');
      const removeModelPlaceholders = AVANT_FIX.removeModelIds.map(() => '?').join(',');

      db.transaction(() => {
        db.prepare(`UPDATE wipers_products SET name = ?, updated_at = ? WHERE slug = ?`)
          .run(AVANT_FIX.name, now, AVANT_SLUG);

        db.prepare(`
          DELETE FROM wipers_products_model_lnk
          WHERE wipers_product_id IN (${idPlaceholders})
          AND model_id IN (${removeModelPlaceholders})
        `).run(...avantIds, ...AVANT_FIX.removeModelIds);

        const insertLnk = db.prepare(`
          INSERT OR IGNORE INTO wipers_products_model_lnk (wipers_product_id, model_id)
          VALUES (?, ?)
        `);
        for (const productId of avantIds) {
          for (const modelId of AVANT_FIX.addModelIds) {
            insertLnk.run(productId, modelId);
          }
        }
      })();

      console.log('  ✅ Done');
    } else {
      console.log(`  [DRY-RUN] Would rename ${avantIds.length} rows and re-link model`);
    }
  }

  // ── 3. Delete variant entries ───────────────────────────────────────────────
  console.log('\n── 3. Delete variant entries ──');

  const placeholders = SLUGS_TO_DELETE.map(() => '?').join(',');
  const toDelete = db.prepare(
    `SELECT id, slug FROM wipers_products WHERE slug IN (${placeholders})`
  ).all(...SLUGS_TO_DELETE);

  if (toDelete.length === 0) {
    console.log('  ℹ️  No matching entries found');
  } else {
    const bySlug = {};
    for (const r of toDelete) {
      if (!bySlug[r.slug]) bySlug[r.slug] = [];
      bySlug[r.slug].push(r.id);
    }
    const allIds = toDelete.map(r => r.id);
    const idPlaceholders = allIds.map(() => '?').join(',');

    console.log(`  ${toDelete.length} rows to delete:`);
    for (const [slug, ids] of Object.entries(bySlug)) {
      console.log(`    - ${slug} [ids: ${ids.join(', ')}]`);
    }

    if (!DRY_RUN) {
      db.transaction(() => {
        db.prepare(`DELETE FROM wipers_products_brand_lnk WHERE wipers_product_id IN (${idPlaceholders})`).run(...allIds);
        db.prepare(`DELETE FROM wipers_products_model_lnk WHERE wipers_product_id IN (${idPlaceholders})`).run(...allIds);
        db.prepare(`DELETE FROM wipers_products WHERE id IN (${idPlaceholders})`).run(...allIds);
      })();
      console.log(`  ✅ Deleted ${allIds.length} rows + links`);
    } else {
      console.log(`  [DRY-RUN] Would delete ${allIds.length} rows + links`);
    }
  }

  db.close();
  console.log('\n✅ Done.');
}

console.log('🔧 AUDI A4 — Fix Remaining Variant Entries');
console.log(`   Mode: ${DRY_RUN ? '🔍 DRY-RUN (no changes)' : '✍️  LIVE (Strapi must be stopped)'}`);
run();
