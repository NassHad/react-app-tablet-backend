/**
 * Import IMDICAR wipers positions from "AVRIL 2026" CSV into WipersProduct (SQLite direct)
 *
 * CSV format (11 cols): Car Marker; Model; Commentaire; StartMonth; StartYear;
 *                        EndMonth; EndYear; CÔTE CONDUCTEUR; MONO BALAIS; CÔTE PASSAGER; ;
 *
 * Steps:
 *  1. Remove ALL IMDICAR positions from ALL wipers products (clears any previous import)
 *  2. Parse CSV, match brand+model, add new IMDICAR positions + update dates
 *
 * Usage:
 *   node scripts/import-wipers-imdicar-avril2026.js            # live
 *   node scripts/import-wipers-imdicar-avril2026.js --dry-run  # preview
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const CSV_FILE = path.join(__dirname, 'liste_affectation', "MAJ BEG IMDICAR LISTE D'AFFECTATION - AVRIL 2026.csv");
const DB_PATH  = path.join(__dirname, '..', '.tmp', 'data.db');
const LOG_FILE = path.join(__dirname, 'import-wipers-imdicar-log.json');
const DRY_RUN  = process.argv.includes('--dry-run');

const IMDICAR_BRANDS = new Set(['IMDICAR', 'Imdicar', 'imdicar']);

// ─── CSV utilities ────────────────────────────────────────────────────────────

// Skip header/blank lines: parts[0] must be non-empty, not "Car Marker", and not contain "
function isDataLine(line) {
  const first = line.split(';')[0];
  return first.trim().length > 0 && first.trim() !== 'Car Marker' && !first.includes('"');
}

function cleanField(str) {
  if (!str) return '';
  str = str.trim();
  if (str.startsWith('"') && str.endsWith('"')) str = str.slice(1, -1).replace(/""/g, '"');
  return str.trim();
}

// Returns null if line doesn't have enough fields
function parseCSVLine(line) {
  const parts = line.split(';');
  if (parts.length < 10) return null;
  return {
    marque:      cleanField(parts[0]),
    modele:      cleanField(parts[1]),
    startMonth:  cleanField(parts[3]),
    startYear:   cleanField(parts[4]),
    endMonth:    cleanField(parts[5]),
    endYear:     cleanField(parts[6]),
    conducteur:  cleanField(parts[7]),  // CÔTE CONDUCTEUR → Driver
    monoBalais:  cleanField(parts[8]),  // MONO BALAIS     → Mono
    passager:    cleanField(parts[9])   // CÔTE PASSAGER   → Passenger
  };
}

// "18""(450 mm " → { mm: "450mm", description: "BEG PLAT 450MM 18''" } or null
function parseSize(sizeStr) {
  if (!sizeStr || !sizeStr.trim()) return null;
  const cleaned = sizeStr.trim();

  const p1 = cleaned.match(/(\d+)\s*['"]*\s*\((\d+)\s*mm\)/i);
  if (p1) return { mm: `${p1[2]}mm`, description: `BEG PLAT ${p1[2]}MM ${p1[1]}''` };

  const p2 = cleaned.match(/(\d+)\s*['"]+\s*(\d+)\s*mm/i);
  if (p2) return { mm: `${p2[2]}mm`, description: `BEG PLAT ${p2[2]}MM ${p2[1]}''` };

  const p3 = cleaned.match(/(\d+)\s*mm/i);
  if (p3) return { mm: `${p3[1]}mm`, description: `BEG PLAT ${p3[1]}MM` };

  return null;
}

// month = "06", year = "2016" → "06/2016" ; empty year → ""
function buildDate(month, year, defaultMonth = '01') {
  if (!year || !year.trim()) return '';
  const mm = (month && month.trim()) ? month.trim().padStart(2, '0') : defaultMonth;
  return `${mm}/${year.trim()}`;
}

// Arabic numeral → Roman numeral (1–10)
const ARABIC_TO_ROMAN = { '1':'I','2':'II','3':'III','4':'IV','5':'V','6':'VI','7':'VII','8':'VIII','9':'IX','10':'X' };

// CSV model names use "(N " notation for generation numbers: "Clio (4 " → "Clio IV"
// Returns an array of candidate model names to try (most specific first).
function getModelCandidates(csvModel) {
  const base = csvModel.trim();
  const candidates = [base];

  // Replace "(N " or "(N  " with the Roman numeral
  const withRoman = base
    .replace(/\(\s*(\d+)\s*/g, (_, n) => (ARABIC_TO_ROMAN[n] || n) + ' ')
    .replace(/\s+/g, ' ').trim();

  if (withRoman !== base) {
    candidates.push(withRoman);
    // Also try stripping any trailing descriptor after the Roman numeral
    // "Clio IV break" → "Clio IV"
    const stripped = withRoman.replace(/\b([IVX]+)\s+.+$/, '$1').trim();
    if (stripped !== withRoman) candidates.push(stripped);
  }

  // Handle "Model A / Model B" → try each part
  if (base.includes('/')) {
    for (const part of base.split('/').map(p => p.trim())) {
      const norm = part
        .replace(/\(\s*(\d+)\s*/g, (_, n) => (ARABIC_TO_ROMAN[n] || n) + ' ')
        .replace(/\s+/g, ' ').trim();
      candidates.push(part, norm);
      const str = norm.replace(/\b([IVX]+)\s+.+$/, '$1').trim();
      if (str !== norm) candidates.push(str);
    }
  }

  return [...new Set(candidates)];
}

// Dedup by ref+position+brand or position+brand+size+description
function deduplicatePositions(positions) {
  const seen = new Set();
  return positions.filter(pos => {
    const ref   = (pos.ref  || '').toLowerCase().trim();
    const posn  = (pos.position || '').toLowerCase().trim();
    const brand = (pos.brand || '').toLowerCase().trim();
    const key = ref
      ? `${ref}|${posn}|${brand}`
      : `${posn}|${brand}|${(pos.size||'').toLowerCase()}|${(pos.description||'').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`);

  // Read CSV (ISO-8859-1)
  const csvContent = fs.readFileSync(CSV_FILE, 'latin1');
  const dataLines = csvContent.split(/\r?\n/).filter(isDataLine);
  console.log(`CSV: ${dataLines.length} data rows`);

  // Open DB
  const db = new Database(DB_PATH, { readonly: DRY_RUN });

  // Load all published wipers products with brand + model names
  const published = db.prepare(`
    SELECT
      UPPER(b.name)  AS brand_upper,
      UPPER(m.name)  AS model_upper,
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

  // Build maps
  const productMap = new Map();  // "BRAND-MODEL" → product
  const allDocIds  = new Map();  // document_id → { keptPositions, hasImdicar }

  for (const p of published) {
    const key = `${p.brand_upper}-${p.model_upper}`;
    productMap.set(key, p);

    if (!allDocIds.has(p.document_id)) {
      let positions = [];
      try { positions = JSON.parse(p.wipers_positions || '[]'); } catch { /* keep empty */ }
      const hasImdicar = positions.some(pos => IMDICAR_BRANDS.has(pos.brand));
      const kept = positions.filter(pos => !IMDICAR_BRANDS.has(pos.brand));
      allDocIds.set(p.document_id, { keptPositions: kept, hasImdicar });
    }
  }

  console.log(`DB: ${published.length} published wipers products (${[...allDocIds.values()].filter(v => v.hasImdicar).length} have existing IMDICAR positions)`);

  // ── Process CSV rows ──────────────────────────────────────────────────────

  // updates: document_id → { keptPositions, imdicarPositions, startDate, endDate }
  const updates    = new Map();
  const missingBrands = [];
  const missingModels = [];
  let skipped = 0;

  for (const line of dataLines) {
    const row = parseCSVLine(line);
    if (!row || !row.marque || !row.modele) { skipped++; continue; }

    const modelCandidates = getModelCandidates(row.modele);

    // Try brand as-is first, then extract parent brand from "(PARENT)"
    const brandCandidates = [row.marque.trim()];
    const parenMatch = row.marque.match(/\(([^)]+)\)/);
    if (parenMatch) brandCandidates.push(parenMatch[1].trim());

    let product = null;
    outer: for (const bName of brandCandidates) {
      for (const mName of modelCandidates) {
        product = productMap.get(`${bName.toUpperCase()}-${mName.toUpperCase()}`);
        if (product) break outer;
      }
    }

    if (!product) {
      const brandFound = brandCandidates.some(b =>
        [...productMap.keys()].some(k => k.startsWith(`${b.toUpperCase()}-`))
      );
      if (brandFound) missingModels.push({ brand: row.marque, model: row.modele });
      else missingBrands.push({ brand: row.marque });
      continue;
    }

    // Parse positions from CSV row
    const newPositions = [];
    for (const [field, posName] of [['conducteur','Driver'], ['monoBalais','Mono'], ['passager','Passenger']]) {
      if (row[field]) {
        const size = parseSize(row[field]);
        if (size) {
          newPositions.push({ position: posName, size: size.mm, description: size.description, brand: 'IMDICAR', category: 'plats' });
        }
      }
    }

    // Parse dates (4-digit year, separate month column)
    const startDate = buildDate(row.startMonth, row.startYear, '01');
    const endDate   = buildDate(row.endMonth,   row.endYear,   '12');

    // Initialise or merge update entry for this document_id
    if (!updates.has(product.document_id)) {
      const docEntry = allDocIds.get(product.document_id);
      updates.set(product.document_id, {
        keptPositions:    docEntry ? docEntry.keptPositions : [],
        imdicarPositions: [],
        startDate,
        endDate
      });
    }

    const entry = updates.get(product.document_id);
    entry.imdicarPositions.push(...newPositions);

    // Keep earliest start date, latest end date ('12' default for end)
    if (startDate && (!entry.startDate || compareMMYYYY(startDate, entry.startDate) < 0)) {
      entry.startDate = startDate;
    }
    if (!endDate) {
      entry.endDate = ''; // present / ongoing
    } else if (entry.endDate !== '' && endDate) {
      if (!entry.endDate || compareMMYYYY(endDate, entry.endDate) > 0) {
        entry.endDate = endDate;
      }
    }
  }

  // Documents that still have old IMDICAR positions but are NOT in the new CSV → cleanup
  const cleanups = [];
  for (const [docId, info] of allDocIds) {
    if (info.hasImdicar && !updates.has(docId)) {
      cleanups.push({ docId, keptPositions: info.keptPositions });
    }
  }

  // ── Summary preview ───────────────────────────────────────────────────────

  const uniqueMissingBrands = [...new Set(missingBrands.map(b => b.brand))];
  const uniqueMissingModels = [...new Set(missingModels.map(m => `${m.brand} / ${m.model}`))];

  if (DRY_RUN) {
    console.log(`\nDRY-RUN: would update ${updates.size} documents, cleanup ${cleanups.length} more`);
    for (const [docId, u] of [...updates].slice(0, 5)) {
      const final = deduplicatePositions([...u.keptPositions, ...u.imdicarPositions]);
      const p = [...published].find(x => x.document_id === docId);
      console.log(`  ${p ? `${p.brand_upper} / ${p.model_upper}` : docId}: ${final.length} positions, ${u.startDate||'?'} → ${u.endDate||'present'}`);
    }
    if (updates.size > 5) console.log(`  ... and ${updates.size - 5} more`);
  }

  // ── Apply to DB ───────────────────────────────────────────────────────────

  if (!DRY_RUN) {
    const stmt = db.prepare(`
      UPDATE wipers_products
      SET wipers_positions        = ?,
          construction_year_start = ?,
          construction_year_end   = ?,
          updated_at              = ?
      WHERE document_id = ?
    `);

    const applyAll = db.transaction(() => {
      // New imports
      for (const [docId, u] of updates) {
        const final = deduplicatePositions([...u.keptPositions, ...u.imdicarPositions]);
        stmt.run(JSON.stringify(final), u.startDate, u.endDate, Date.now(), docId);
      }
      // Cleanup (products with old IMDICAR positions not in new CSV)
      for (const c of cleanups) {
        stmt.run(JSON.stringify(c.keptPositions), undefined, undefined, Date.now(), c.docId);
      }
    });

    applyAll();
    console.log(`\nUpdated ${updates.size} documents, cleaned ${cleanups.length} stale IMDICAR documents.`);
  }

  // ── Final summary ─────────────────────────────────────────────────────────

  console.log(`\nSummary:`);
  console.log(`  Updated:          ${updates.size}`);
  console.log(`  Stale cleaned:    ${cleanups.length}`);
  console.log(`  Missing brands:   ${uniqueMissingBrands.length}`);
  console.log(`  Missing models:   ${uniqueMissingModels.length}`);
  console.log(`  Skipped lines:    ${skipped}`);

  if (uniqueMissingBrands.length) {
    console.log(`\nMissing brands:`);
    uniqueMissingBrands.forEach(b => console.log(`  - ${b}`));
  }
  if (uniqueMissingModels.length) {
    console.log(`\nMissing models (first 20):`);
    uniqueMissingModels.slice(0, 20).forEach(m => console.log(`  - ${m}`));
    if (uniqueMissingModels.length > 20) console.log(`  ... and ${uniqueMissingModels.length - 20} more`);
  }

  // Save log
  fs.writeFileSync(LOG_FILE, JSON.stringify({
    dryRun: DRY_RUN,
    updatedCount: updates.size,
    cleanedCount: cleanups.length,
    missingBrands: uniqueMissingBrands,
    missingModels: uniqueMissingModels
  }, null, 2));
  console.log(`\nLog saved to: ${LOG_FILE}`);

  db.close();
}

function compareMMYYYY(a, b) {
  const parse = s => { const [mm, yyyy] = s.split('/'); return parseInt(yyyy,10)*100 + parseInt(mm,10); };
  return parse(a) - parse(b);
}

main();
