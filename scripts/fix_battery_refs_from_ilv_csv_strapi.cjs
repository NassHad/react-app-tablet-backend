/**
 * Strapi-side mirror of fix_battery_refs_from_ilv_csv.cjs (frontend repo).
 * Same classification logic (exact-then-guarded-substring model match,
 * per-token motorisation match, fill/new-entry/conflict-CSV-wins) --
 * battery_products has flat brand_slug/model_slug columns here too, no
 * relation table, so draft and published rows are just independent rows
 * processed the same way (same pattern as dedupe_battery_motorisations_strapi.cjs).
 *
 * Usage: node scripts/fix_battery_refs_from_ilv_csv_strapi.cjs [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');

const CSV_PATH = path.join(__dirname, '..', '..', 'react-app-tablet', 'scripts', 'ILV-FULMEN-ENDURANCE_manual_complete_battery_fixed.csv');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/^﻿/, '');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].split(';');
  return lines.slice(1).map((line) => {
    const cols = line.split(';');
    const row = {};
    header.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
    return row;
  });
}

function normModel(s) {
  return s.toUpperCase().replace(/\([^)]*\)/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
}
function normMoto(s) {
  return s.toUpperCase().replace(/\s+/g, '');
}
function brandSlug(b) {
  return b.toLowerCase().replace(/\s+/g, '-').replace(/ë/g, 'e').replace(/-benz$/, '');
}

// Returns EVERY candidate row sharing the winning model name, not just one
// -- battery_products has no draft/publish relation table (flat columns),
// so a model's draft and published rows are just two separate rows with
// the identical model_name; returning only the first match would silently
// leave one of the pair unfixed.
function findModelRows(candidates, vehicleField) {
  const vehName = vehicleField.split(',')[0].split('/')[0];
  const vehNorm = normModel(vehName);
  const exact = candidates.filter((c) => normModel(c.model_name) === vehNorm);
  if (exact.length > 0) return exact;

  let bestName = null;
  let bestLen = 0;
  for (const c of candidates) {
    const mn = normModel(c.model_name);
    if (mn.length < 3) continue;
    if ((mn.includes(vehNorm) || vehNorm.includes(mn)) && mn.length > bestLen) {
      bestLen = mn.length;
      bestName = c.model_name;
    }
  }
  if (!bestName) return [];
  return candidates.filter((c) => c.model_name === bestName);
}

const csvRows = parseCsv(CSV_PATH);
console.log(`Loaded ${csvRows.length} CSV rows`);

const db = new Database(DB_PATH);
const allRows = db.prepare('SELECT id, brand_slug, model_name, motorisations FROM battery_products').all();

const byBrand = new Map();
const parsed = new Map();
for (const r of allRows) {
  let motos;
  try { motos = JSON.parse(r.motorisations); } catch { continue; }
  if (!Array.isArray(motos)) continue;
  parsed.set(r.id, { row: r, motos });
  const list = byBrand.get(r.brand_slug) || [];
  list.push({ id: r.id, model_name: r.model_name });
  byBrand.set(r.brand_slug, list);
}

const stats = { fill: 0, newEntry: 0, conflict: 0, agree: 0 };
const unmatchedModels = [];
const dirtyIds = new Set();

for (const csvRow of csvRows) {
  const bslug = brandSlug(csvRow.Brand);
  const candidates = byBrand.get(bslug) || [];
  const matches = findModelRows(candidates, csvRow.Vehicle);
  if (matches.length === 0) {
    unmatchedModels.push(`${csvRow.Brand} / ${csvRow.Vehicle}`);
    continue;
  }
  const csvAgm = csvRow.Battery_AGM.trim();
  const csvEfb = csvRow.Battery_EFB.trim();
  const csvConv = csvRow.Battery_Conventional.trim();
  const tokens = csvRow.Motorisation.split(',').map((t) => t.trim()).filter(Boolean);

  for (const match of matches) {
    const entry = parsed.get(match.id);
    for (const tok of tokens) {
      const tokN = normMoto(tok);
      const m = entry.motos.find((x) => normMoto(x.motorisation || '') === tokN);
      if (!m) {
        entry.motos.push({
          motorisation: tok,
          fuel: csvRow.Fuel || '',
          startDate: csvRow.Start || null,
          endDate: csvRow.End || null,
          batteryAGM: csvAgm,
          batteryEFB: csvEfb,
          batteryConventional: csvConv,
        });
        dirtyIds.add(match.id);
        stats.newEntry++;
        continue;
      }
      for (const [field, csvv] of [['batteryAGM', csvAgm], ['batteryEFB', csvEfb], ['batteryConventional', csvConv]]) {
        const dbv = (m[field] || '').trim();
        if (!csvv && !dbv) continue;
        if (!dbv && csvv) {
          m[field] = csvv;
          dirtyIds.add(match.id);
          stats.fill++;
        } else if (dbv && csvv && dbv !== csvv) {
          m[field] = csvv;
          dirtyIds.add(match.id);
          stats.conflict++;
        } else {
          stats.agree++;
        }
      }
    }
  }
}

console.log(`\n${DB_PATH}`);
console.log(`  fill-ins: ${stats.fill}, new entries: ${stats.newEntry}, conflicts (CSV applied): ${stats.conflict}, already agree: ${stats.agree}`);
console.log(`  rows to update (draft+pub counted separately): ${dirtyIds.size}`);
console.log(`  unmatched CSV vehicles: ${new Set(unmatchedModels).size}`);

if (!DRY_RUN) {
  const update = db.prepare('UPDATE battery_products SET motorisations=? WHERE id=?');
  const run = () => {
    for (const id of dirtyIds) {
      update.run(JSON.stringify(parsed.get(id).motos), id);
    }
  };
  db.transaction(run)();
}
db.close();

console.log(`\n${DRY_RUN ? '[DRY-RUN] Nothing written.' : 'Done.'}`);
