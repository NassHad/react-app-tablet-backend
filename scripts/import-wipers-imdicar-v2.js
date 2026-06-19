/**
 * Import IMDICAR wipers positions from v2 CSV into WipersProduct (SQLite direct)
 * Removes existing IMDICAR positions and replaces them with data from the CSV.
 * Updates construction_year_start / construction_year_end.
 * Usage:
 *   node scripts/import-wipers-imdicar-v2.js            # real import
 *   node scripts/import-wipers-imdicar-v2.js --dry-run  # preview only
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const CSV_FILE = path.join(__dirname, 'liste_affectation', 'Liste affectations BEG PLATS IMDICAR_v2.csv');
const DB_PATH  = path.join(__dirname, '..', '.tmp', 'data.db');
const LOG_FILE = path.join(__dirname, 'import-wipers-imdicar-log.json');
const DRY_RUN  = process.argv.includes('--dry-run');

// ─── CSV utilities (adapted from import-imdicar-wipers-positions.js) ────────

function parseCSVLine(line) {
  const parts = line.split(';');
  if (parts.length < 7) return null;

  const clean = (str) => {
    if (!str) return '';
    str = str.trim();
    if (str.startsWith('"') && str.endsWith('"')) {
      str = str.slice(1, -1).replace(/""/g, '"');
    }
    return str.trim();
  };

  return {
    marque:     clean(parts[0]),
    modele:     clean(parts[1]),
    version:    clean(parts[2]),
    annee:      clean(parts[3]),
    conducteur: clean(parts[4]),
    passager:   clean(parts[5]),
    arriere:    clean(parts[6])
  };
}

// "24''(600mm)" or '13"(340mm)' → { mm, inch, description } or null
function parseSize(sizeStr) {
  if (!sizeStr || !sizeStr.trim()) return null;
  const cleaned = sizeStr.trim();

  const p1 = cleaned.match(/(\d+)\s*['"]*\s*\((\d+)\s*mm\)/i);
  if (p1) {
    return { mm: `${p1[2]}mm`, inch: `${p1[1]}''`, description: `BEG PLAT ${p1[2]}MM ${p1[1]}''` };
  }

  const p2 = cleaned.match(/(\d+)\s*['"]+\s*(\d+)\s*mm/i);
  if (p2) {
    return { mm: `${p2[2]}mm`, inch: `${p2[1]}''`, description: `BEG PLAT ${p2[2]}MM ${p2[1]}''` };
  }

  const p3 = cleaned.match(/(\d+)\s*mm/i);
  if (p3) {
    return { mm: `${p3[1]}mm`, inch: null, description: `BEG PLAT ${p3[1]}MM` };
  }

  return null;
}

// "ABARTH (FIAT)" → ["ABARTH (FIAT)", "ABARTH", "FIAT"]
function extractBrandNames(brandStr) {
  if (!brandStr) return [];
  const cleaned = brandStr.trim();
  const names = [cleaned];
  const primary = cleaned.match(/^([^(]+)/);
  if (primary && primary[1].trim() !== cleaned) names.push(primary[1].trim());
  const paren = cleaned.match(/\(([^)]+)\)/);
  if (paren) names.push(paren[1].trim());
  return [...new Set(names)];
}

// Deduplicate positions by ref+position+brand (or position+brand+size+description if no ref)
function deduplicatePositions(positions) {
  const seen = new Set();
  return positions.filter(pos => {
    const ref  = (pos.ref  || '').toString().trim().toLowerCase();
    const posn = (pos.position || '').toString().trim().toLowerCase();
    const brand = (pos.brand || '').toString().trim().toLowerCase();
    const key = ref
      ? `${ref}|${posn}|${brand}`
      : `${posn}|${brand}|${(pos.size||'').toLowerCase()}|${(pos.description||'').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Year parsing ────────────────────────────────────────────────────────────

// YY → YYYY: 00-29 → 20YY, 30-99 → 19YY
function expandYear(yy) {
  const n = parseInt(yy, 10);
  return n < 30 ? `20${yy}` : `19${yy}`;
}

// "MM/YYYY" pair from a single M.YY token
function tokenToMMYYYY(token) {
  const m = token.match(/^(\d{1,2})\.(\d{2})$/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}/${expandYear(m[2])}`;
}

// "8.08?" → { start: "08/2008", end: "" }
// "12.07-12.12" → { start: "12/2007", end: "12/2012" }
// "12.07-12.12?" → { start: "12/2007", end: "" }
function parseYearRange(yearStr) {
  if (!yearStr || !yearStr.trim()) return { start: '', end: '' };
  let str = yearStr.trim();
  const ongoing = str.endsWith('?');
  if (ongoing) str = str.slice(0, -1).trim();

  // Range: "MM.YY-MM.YY"
  const rangeM = str.match(/^(\d{1,2}\.\d{2})\s*-\s*(\d{1,2}\.\d{2})$/);
  if (rangeM) {
    return {
      start: tokenToMMYYYY(rangeM[1]) ?? '',
      end:   ongoing ? '' : (tokenToMMYYYY(rangeM[2]) ?? '')
    };
  }

  // Single: "MM.YY"
  const single = tokenToMMYYYY(str);
  if (single) return { start: single, end: ongoing ? '' : '' };

  return { start: '', end: '' };
}

// Compare two "MM/YYYY" strings; returns negative/0/positive
function compareMMYYYY(a, b) {
  const parse = (s) => {
    const [mm, yyyy] = s.split('/');
    return parseInt(yyyy, 10) * 100 + parseInt(mm, 10);
  };
  return parse(a) - parse(b);
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`);

  // Read CSV (ISO-8859-1)
  const csvContent = fs.readFileSync(CSV_FILE, 'latin1');
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
  const dataLines = lines.slice(3); // skip blank, title, header rows
  console.log(`CSV: ${dataLines.length} data rows`);

  // Open DB
  const db = new Database(DB_PATH, { readonly: DRY_RUN });

  // Load all published wipers products with brand + model names
  const published = db.prepare(`
    SELECT
      UPPER(b.name)  AS brand_upper,
      UPPER(m.name)  AS model_upper,
      b.name         AS brand_name,
      m.name         AS model_name,
      wp.document_id,
      wp.wipers_positions,
      wp.construction_year_start,
      wp.construction_year_end
    FROM wipers_products wp
    JOIN wipers_products_brand_lnk bln ON bln.wipers_product_id = wp.id
    JOIN brands b ON b.id = bln.brand_id
    JOIN wipers_products_model_lnk mln ON mln.wipers_product_id = wp.id
    JOIN models m ON m.id = mln.model_id
    WHERE wp.published_at IS NOT NULL
  `).all();

  // Build lookup map: "BRAND-MODEL" → product row
  const productMap = new Map();
  for (const p of published) {
    const key = `${p.brand_upper}-${p.model_upper}`;
    productMap.set(key, p);
  }
  console.log(`DB: ${published.length} published wipers products loaded`);

  // ── Process CSV rows ──────────────────────────────────────────────────────

  // updates: document_id → { brandName, modelName, keptPositions, imdicarPositions, startDate, endDate }
  const updates = new Map();
  const missingBrands = [];
  const missingModels = [];
  let skipped = 0;

  for (const line of dataLines) {
    const row = parseCSVLine(line);
    if (!row || !row.marque || !row.modele) { skipped++; continue; }

    const modelUpper = row.modele.trim().toUpperCase();
    const brandNames = extractBrandNames(row.marque);

    // Find matching product
    let product = null;
    for (const bName of brandNames) {
      product = productMap.get(`${bName.toUpperCase()}-${modelUpper}`);
      if (product) break;
    }

    if (!product) {
      // Determine if brand exists at all
      const brandFound = brandNames.some(b =>
        [...productMap.keys()].some(k => k.startsWith(`${b.toUpperCase()}-`))
      );
      if (brandFound) {
        missingModels.push({ brand: row.marque, model: row.modele });
      } else {
        missingBrands.push({ brand: row.marque });
      }
      continue;
    }

    // Parse new IMDICAR positions from this CSV row
    const newPositions = [];
    for (const [field, posName] of [['conducteur', 'Driver'], ['passager', 'Passenger'], ['arriere', 'Back']]) {
      if (row[field]) {
        const size = parseSize(row[field]);
        if (size) {
          newPositions.push({ position: posName, size: size.mm, description: size.description, brand: 'IMDICAR', category: 'plats' });
        }
      }
    }

    // Parse year range
    const year = parseYearRange(row.annee);

    // Initialise update entry (first encounter for this document_id)
    if (!updates.has(product.document_id)) {
      let existingPositions = [];
      try { existingPositions = JSON.parse(product.wipers_positions || '[]'); } catch { /* keep empty */ }
      const kept = existingPositions.filter(p => !['IMDICAR', 'Imdicar', 'imdicar'].includes(p.brand));
      updates.set(product.document_id, {
        brandName:        product.brand_name,
        modelName:        product.model_name,
        keptPositions:    kept,
        imdicarPositions: [],
        startDate:        year.start,
        endDate:          year.end
      });
    }

    const entry = updates.get(product.document_id);
    entry.imdicarPositions.push(...newPositions);

    // Merge dates: keep earliest start, latest end ('' = present = stays '')
    if (year.start && (!entry.startDate || compareMMYYYY(year.start, entry.startDate) < 0)) {
      entry.startDate = year.start;
    }
    if (year.end === '') {
      entry.endDate = '';
    } else if (entry.endDate !== '' && year.end) {
      if (!entry.endDate || compareMMYYYY(year.end, entry.endDate) > 0) {
        entry.endDate = year.end;
      }
    }
  }

  // ── Apply updates ─────────────────────────────────────────────────────────

  if (!DRY_RUN) {
    const stmt = db.prepare(`
      UPDATE wipers_products
      SET wipers_positions = ?,
          construction_year_start = ?,
          construction_year_end   = ?,
          updated_at              = ?
      WHERE document_id = ?
    `);

    const applyAll = db.transaction(() => {
      for (const [docId, u] of updates) {
        const finalPositions = deduplicatePositions([...u.keptPositions, ...u.imdicarPositions]);
        stmt.run(JSON.stringify(finalPositions), u.startDate, u.endDate, Date.now(), docId);
      }
    });
    applyAll();
    console.log(`\nUpdated ${updates.size} documents in DB.`);
  } else {
    console.log(`\nDRY-RUN: would update ${updates.size} documents.`);
    for (const [docId, u] of [...updates].slice(0, 5)) {
      const final = deduplicatePositions([...u.keptPositions, ...u.imdicarPositions]);
      console.log(`  ${u.brandName} ${u.modelName}: ${final.length} positions, years ${u.startDate || '?'} → ${u.endDate || 'present'}`);
    }
    if (updates.size > 5) console.log(`  ... and ${updates.size - 5} more`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const uniqueMissingBrands = [...new Set(missingBrands.map(b => b.brand))];
  const uniqueMissingModels = [...new Set(missingModels.map(m => `${m.brand} / ${m.model}`))];

  console.log(`\nSummary:`);
  console.log(`  Updated:          ${updates.size}`);
  console.log(`  Missing brands:   ${uniqueMissingBrands.length}`);
  console.log(`  Missing models:   ${uniqueMissingModels.length}`);
  console.log(`  Skipped lines:    ${skipped}`);

  if (uniqueMissingBrands.length) {
    console.log(`\nMissing brands (first 20):`);
    uniqueMissingBrands.slice(0, 20).forEach(b => console.log(`  - ${b}`));
    if (uniqueMissingBrands.length > 20) console.log(`  ... and ${uniqueMissingBrands.length - 20} more`);
  }
  if (uniqueMissingModels.length) {
    console.log(`\nMissing models (first 20):`);
    uniqueMissingModels.slice(0, 20).forEach(m => console.log(`  - ${m}`));
    if (uniqueMissingModels.length > 20) console.log(`  ... and ${uniqueMissingModels.length - 20} more`);
  }

  // Save detailed log
  fs.writeFileSync(LOG_FILE, JSON.stringify({
    dryRun: DRY_RUN,
    updatedCount: updates.size,
    missingBrands: uniqueMissingBrands,
    missingModels: uniqueMissingModels
  }, null, 2));
  console.log(`\nLog saved to: ${LOG_FILE}`);

  db.close();
}

main();
