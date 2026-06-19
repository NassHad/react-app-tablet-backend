/**
 * Link WiperData refs to IMDICAR positions in wipersPositions JSON
 *
 * For each IMDICAR position in wipers_products.wipers_positions, looks up the
 * matching wipers_data record by size (e.g. "450mm" → "450MM" → ref "482") and
 * adds the ref field + updates the description with the full WiperData description.
 *
 * Usage:
 *   node scripts/link-imdicar-wiperdata-refs.js            # live
 *   node scripts/link-imdicar-wiperdata-refs.js --dry-run  # preview
 */

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');
const DRY_RUN = process.argv.includes('--dry-run');

const IMDICAR_BRANDS = new Set(['IMDICAR', 'Imdicar', 'imdicar']);

function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`);

  const db = new Database(DB_PATH, { readonly: DRY_RUN });

  // Build size → { ref, description } map from published WiperData IMDICAR records
  const wiperDataRows = db.prepare(`
    SELECT ref, size, description FROM wipers_data
    WHERE UPPER(brand) = 'IMDICAR' AND published_at IS NOT NULL
  `).all();

  const sizeMap = new Map();
  for (const row of wiperDataRows) {
    sizeMap.set(row.size.toUpperCase(), { ref: row.ref, description: row.description });
  }

  console.log(`WiperData: ${sizeMap.size} IMDICAR sizes loaded`);
  for (const [size, data] of sizeMap) {
    console.log(`  ${size} → ref ${data.ref} (${data.description})`);
  }

  // Load all published wipers products that have IMDICAR positions
  const products = db.prepare(`
    SELECT document_id, wipers_positions FROM wipers_products
    WHERE published_at IS NOT NULL AND wipers_positions LIKE '%IMDICAR%'
  `).all();

  console.log(`\nProducts with IMDICAR positions: ${products.length}`);

  let updatedCount = 0;
  let skippedCount = 0;
  const unmatchedSizes = new Set();

  const updates = [];

  for (const product of products) {
    let positions;
    try {
      positions = JSON.parse(product.wipers_positions || '[]');
    } catch {
      skippedCount++;
      continue;
    }

    let changed = false;
    const updated = positions.map(pos => {
      if (!IMDICAR_BRANDS.has(pos.brand)) return pos;

      const sizeKey = (pos.size || '').toUpperCase();
      const match = sizeMap.get(sizeKey);

      if (!match) {
        unmatchedSizes.add(sizeKey || '(empty)');
        return pos;
      }

      const newPos = { ...pos, ref: match.ref, description: match.description };
      if (newPos.ref !== pos.ref || newPos.description !== pos.description) {
        changed = true;
      }
      return newPos;
    });

    if (changed) {
      updates.push({ document_id: product.document_id, wipers_positions: JSON.stringify(updated) });
    }
  }

  console.log(`\nDocuments to update: ${updates.length}`);
  if (unmatchedSizes.size > 0) {
    console.log(`Unmatched sizes (no WiperData found): ${[...unmatchedSizes].join(', ')}`);
  }

  if (DRY_RUN) {
    console.log('\nDRY-RUN: sample of first 5 updates:');
    for (const u of updates.slice(0, 5)) {
      const positions = JSON.parse(u.wipers_positions).filter(p => IMDICAR_BRANDS.has(p.brand));
      console.log(`  ${u.document_id}: ${positions.map(p => `${p.position} → ref ${p.ref}`).join(', ')}`);
    }
    if (updates.length > 5) console.log(`  ... and ${updates.length - 5} more`);
    db.close();
    return;
  }

  const stmt = db.prepare(`
    UPDATE wipers_products
    SET wipers_positions = ?, updated_at = ?
    WHERE document_id = ?
  `);

  const applyAll = db.transaction(() => {
    for (const u of updates) {
      stmt.run(u.wipers_positions, Date.now(), u.document_id);
      updatedCount++;
    }
  });

  applyAll();

  console.log(`\nDone. Updated ${updatedCount} documents (draft + published rows each).`);
  if (unmatchedSizes.size > 0) {
    console.log(`Warning: ${unmatchedSizes.size} unmatched size(s): ${[...unmatchedSizes].join(', ')}`);
  }

  db.close();
}

main();
