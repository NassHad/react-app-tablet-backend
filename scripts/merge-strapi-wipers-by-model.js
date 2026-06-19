/**
 * Merge all wipers_products entries for AUDI A4 (and any model) in Strapi DB
 * into one entry per model. Each position is tagged with validFrom/validTo.
 *
 * Model is identified by model_id via wipers_products_model_lnk.
 * Both draft and published rows are kept for the canonical document_id;
 * all other document rows are deleted along with their link table entries.
 *
 * Usage (from react-app-tablet-backend/, Strapi must be STOPPED):
 *   node scripts/merge-strapi-wipers-by-model.js [--dry-run]
 *
 * To restrict to a specific model (pair of model_ids, one per locale row):
 *   node scripts/merge-strapi-wipers-by-model.js --model-ids=175,29087 [--dry-run]
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

// Optional filter: only process documents linked to these model_ids
const modelIdsArg = process.argv.find(a => a.startsWith('--model-ids='))?.split('=')[1];
const FILTER_MODEL_IDS = modelIdsArg
  ? modelIdsArg.split(',').map(Number)
  : null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function posKey(p) {
  return `${p.position}|${p.ref}|${p.category}|${p.validFrom ?? ''}|${p.validTo ?? ''}`;
}

function mmYYYYtoNum(s) {
  if (!s) return Infinity;
  const [m, y] = s.split('/');
  return parseInt(y) * 100 + parseInt(m);
}

function minDate(a, b) {
  return mmYYYYtoNum(a) <= mmYYYYtoNum(b) ? a : b;
}

function maxDate(a, b) {
  if (!a || !b) return null;
  return mmYYYYtoNum(a) >= mmYYYYtoNum(b) ? a : b;
}

// ── Find documents for a model ────────────────────────────────────────────────

function getDocumentsForModel(db, modelIds) {
  // A document consists of 2 rows sharing the same document_id (draft + published).
  // We find all document_ids that have at least one row linked to ANY of the modelIds.
  const phs = modelIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT DISTINCT wp.document_id
     FROM wipers_products wp
     JOIN wipers_products_model_lnk lnk ON lnk.wipers_product_id = wp.id
     WHERE lnk.model_id IN (${phs})`
  ).all(...modelIds);
  return rows.map(r => r.document_id);
}

// ── Merge a group of document_ids into one ────────────────────────────────────

function mergeDocumentGroup(db, documentIds, label) {
  if (documentIds.length === 0) {
    console.log(`  ℹ️  ${label}: no entries found`);
    return;
  }
  if (documentIds.length === 1) {
    console.log(`  ✓  ${label}: already 1 document — skipping`);
    return;
  }

  console.log(`\n  📦 ${label}: ${documentIds.length} documents`);

  // Fetch all rows for these documents
  const docPhs = documentIds.map(() => '?').join(',');
  const allRows = db.prepare(
    `SELECT id, document_id, slug, construction_year_start, construction_year_end,
            wipers_positions, published_at
     FROM wipers_products WHERE document_id IN (${docPhs})
     ORDER BY construction_year_start ASC NULLS LAST, id ASC`
  ).all(...documentIds);

  // Pick canonical document: earliest construction_year_start (numeric, not string sort)
  const published = allRows.filter(r => r.published_at !== null);
  const sortedPublished = [...published].sort((a, b) =>
    mmYYYYtoNum(a.construction_year_start || '01/1900') -
    mmYYYYtoNum(b.construction_year_start || '01/1900')
  );
  const canonical = sortedPublished[0];
  const canonicalDocId = canonical.document_id;
  const otherDocIds = documentIds.filter(d => d !== canonicalDocId);

  const canonicalRows = allRows.filter(r => r.document_id === canonicalDocId);
  const otherRows     = allRows.filter(r => r.document_id !== canonicalDocId);

  console.log(`    canonical doc=${canonicalDocId} (${canonical.slug}, ${canonical.construction_year_start})`);
  console.log(`    delete ${otherDocIds.length} other documents (${otherRows.length} rows)`);

  // Build merged positions from ONE row per document (use published row if available)
  const seen = new Set();
  const mergedPositions = [];

  for (const docId of documentIds) {
    const pubRow = allRows.find(r => r.document_id === docId && r.published_at !== null);
    const repr   = pubRow ?? allRows.find(r => r.document_id === docId);
    if (!repr) continue;

    const positions = JSON.parse(repr.wipers_positions || '[]');
    for (const pos of positions) {
      const tagged = {
        ...pos,
        validFrom: repr.construction_year_start || undefined,
        validTo:   repr.construction_year_end   || undefined,
      };
      const key = posKey(tagged);
      if (!seen.has(key)) {
        seen.add(key);
        mergedPositions.push(tagged);
      }
    }
  }

  // Compute full date range from published rows
  const allStarts = published.map(r => r.construction_year_start).filter(Boolean);
  const allEnds   = published.map(r => r.construction_year_end || null);
  const newStart  = allStarts.length > 0 ? allStarts.reduce((a, b) => minDate(a, b)) : null;
  const validEnds = allEnds.filter(Boolean);
  const newEnd    = allEnds.includes(null) ? null
                  : validEnds.length > 0 ? validEnds.reduce((a, b) => maxDate(a, b))
                  : null;

  console.log(`    dates: ${newStart} → ${newEnd ?? 'present'}`);
  console.log(`    positions: ${mergedPositions.length}`);

  if (DRY_RUN) {
    console.log('    [DRY-RUN] no changes written');
    return;
  }

  const now = new Date().toISOString();
  const otherIds = otherRows.map(r => r.id);
  const otherIdPhs = otherIds.map(() => '?').join(',');

  db.transaction(() => {
    // Update all canonical rows (draft + published) with merged data
    for (const row of canonicalRows) {
      db.prepare(
        `UPDATE wipers_products
         SET construction_year_start = ?, construction_year_end = ?,
             wipers_positions = ?, updated_at = ?
         WHERE id = ?`
      ).run(newStart, newEnd ?? null, JSON.stringify(mergedPositions), now, row.id);
    }

    // Delete non-canonical rows + their links
    if (otherIds.length > 0) {
      db.prepare(`DELETE FROM wipers_products_brand_lnk WHERE wipers_product_id IN (${otherIdPhs})`).run(...otherIds);
      db.prepare(`DELETE FROM wipers_products_model_lnk WHERE wipers_product_id IN (${otherIdPhs})`).run(...otherIds);
      db.prepare(`DELETE FROM wipers_products WHERE id IN (${otherIdPhs})`).run(...otherIds);
    }
  })();

  console.log(`    ✅ Done (canonical id=${canonicalRows.map(r=>r.id).join(',')})`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function run() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  console.log(`\n📂 Processing: ${DB_PATH}`);
  const db = new Database(DB_PATH, DRY_RUN ? { readonly: true } : {});

  if (FILTER_MODEL_IDS) {
    // Process one specific model group
    const docIds = getDocumentsForModel(db, FILTER_MODEL_IDS);
    mergeDocumentGroup(db, docIds, `model_ids=[${FILTER_MODEL_IDS.join(',')}]`);
  } else {
    // Find all (model_id) groups with > 1 document
    const modelRows = db.prepare(
      `SELECT lnk.model_id, COUNT(DISTINCT wp.document_id) as doc_count
       FROM wipers_products_model_lnk lnk
       JOIN wipers_products wp ON wp.id = lnk.wipers_product_id
       GROUP BY lnk.model_id
       HAVING doc_count > 1
       ORDER BY lnk.model_id`
    ).all();

    // Group model_ids that share documents (same product linked to 2 model_ids = draft/published pair)
    // Build a union-find to cluster model_ids pointing to the same documents
    const docToModelIds = {};
    for (const row of modelRows) {
      const docIds = getDocumentsForModel(db, [row.model_id]);
      const key = docIds.sort().join(',');
      if (!docToModelIds[key]) docToModelIds[key] = { docIds, modelIds: [] };
      docToModelIds[key].modelIds.push(row.model_id);
    }

    console.log(`  Found ${Object.keys(docToModelIds).length} model group(s) with > 1 document`);

    for (const { docIds, modelIds } of Object.values(docToModelIds)) {
      mergeDocumentGroup(db, docIds, `model_ids=[${modelIds.join(',')}]`);
    }
  }

  db.close();
  console.log('\n✅ Done.');
}

console.log('🔧 Merge Strapi wipers entries by model (add validFrom/validTo)');
console.log(`   Mode: ${DRY_RUN ? '🔍 DRY-RUN (no changes)' : '✍️  LIVE (Strapi must be stopped)'}`);
if (FILTER_MODEL_IDS) {
  console.log(`   Scope: model_ids=[${FILTER_MODEL_IDS.join(',')}]`);
}
run();
