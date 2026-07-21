/**
 * Strapi-side mirror of fix_battery_refs_from_ilv_csv_v2.cjs (frontend repo).
 * See that script's header for the full explanation of the two bugs fixed
 * here relative to fix_battery_refs_from_ilv_csv_strapi.cjs (v1):
 *
 * 1. DATE-BLIND MATCHING: v1's `.find()` always grabbed the FIRST
 *    motorisation entry sharing a name, ignoring date range, so CSV rows
 *    for a later generation could silently overwrite an earlier
 *    generation's refs (e.g. BMW 525d E39 vs E60). Fixed with a greedy
 *    best-date-overlap matcher between db entries and CSV candidates
 *    sharing the same normalized name, instead of naive positional zip
 *    (which itself breaks when the two lists have different lengths).
 * 2. ACCENT-STRIPPING SUBSTRING COLLISION: normModel() treated accented
 *    characters as separators instead of folding them, so "SCÉNIC"
 *    normalized differently from "SCENIC" and fell through to a substring
 *    fallback match, contaminating "GRAND SCÉNIC" rows with regular
 *    "SCÉNIC" data. Fixed via NFD-decompose + diacritic-strip folding.
 *
 * battery_products has flat brand_slug/model_slug columns, no relation
 * table -- draft and published rows are independent rows, each processed
 * on its own.
 *
 * Usage: node scripts/fix_battery_refs_from_ilv_csv_v2_strapi.cjs [--dry-run]
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

function foldAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function normModel(s) {
  return foldAccents(s).toUpperCase().replace(/\([^)]*\)/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
}
function normMoto(s) {
  return foldAccents(s).toUpperCase().replace(/\s+/g, '');
}
function brandSlug(b) {
  return b.toLowerCase().replace(/\s+/g, '-').replace(/ë/g, 'e').replace(/-benz$/, '');
}
function parenAwareSplit(s) {
  const tokens = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ',' && depth === 0) { if (cur.trim()) tokens.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) tokens.push(cur.trim());
  return tokens;
}
function findModelRows(candidates, vehicleField) {
  const vehName = vehicleField.split(',')[0].split('/')[0];
  const vehNorm = normModel(vehName);
  const exact = candidates.filter((c) => normModel(c.model_name) === vehNorm);
  if (exact.length > 0) return exact;
  let bestName = null, bestLen = 0;
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

function toTime(dateStr) {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  return Number.isNaN(t) ? null : t;
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

// Step 1: collect every (matched db row id, normalized name) -> list of
// CSV candidates {start, end, agm, efb, conv, label}.
const candidatesByGroup = new Map();
const unmatchedModels = [];

for (const csvRow of csvRows) {
  const bslug = brandSlug(csvRow.Brand);
  const candidates = byBrand.get(bslug) || [];
  const matches = findModelRows(candidates, csvRow.Vehicle);
  if (matches.length === 0) {
    unmatchedModels.push(`${csvRow.Brand} / ${csvRow.Vehicle}`);
    continue;
  }
  const tokens = parenAwareSplit(csvRow.Motorisation);
  const start = toTime(csvRow.Start);
  const end = toTime(csvRow.End);
  for (const match of matches) {
    for (const tok of tokens) {
      const key = `${match.id} ${normMoto(tok)}`;
      const list = candidatesByGroup.get(key) || [];
      list.push({
        start, end,
        label: tok,
        fuel: csvRow.Fuel || '',
        startDate: csvRow.Start || null,
        endDate: csvRow.End || null,
        agm: csvRow.Battery_AGM.trim(),
        efb: csvRow.Battery_EFB.trim(),
        conv: csvRow.Battery_Conventional.trim(),
      });
      candidatesByGroup.set(key, list);
    }
  }
}

// Step 2: for each db row, group its motorisation entries by normalized
// name, and greedily best-overlap-pair each name-group against its CSV
// candidates.
const stats = { fill: 0, newEntry: 0, conflict: 0, agree: 0 };
const dirtyIds = new Set();

for (const [id, entry] of parsed) {
  const byName = new Map();
  for (const m of entry.motos) {
    const n = normMoto(m.motorisation || '');
    const list = byName.get(n) || [];
    list.push(m);
    byName.set(n, list);
  }
  for (const [normName, dbEntries] of byName) {
    const key = `${id} ${normName}`;
    const csvCandidates = candidatesByGroup.get(key);
    if (!csvCandidates) continue;

    const dbPool = [...dbEntries];
    const csvPool = [...csvCandidates];
    const pairs = [];
    while (dbPool.length && csvPool.length) {
      let best = null;
      for (let di = 0; di < dbPool.length; di++) {
        const m = dbPool[di];
        const mStart = toTime(m.startDate) ?? -Infinity;
        const mEnd = toTime(m.endDate) ?? Infinity;
        for (let ci = 0; ci < csvPool.length; ci++) {
          const c = csvPool[ci];
          const cStart = c.start ?? -Infinity;
          const cEnd = c.end ?? Infinity;
          const overlapStart = Math.max(mStart, cStart);
          const overlapEnd = Math.min(mEnd, cEnd);
          const score = overlapEnd > overlapStart
            ? overlapEnd - overlapStart
            : -Math.min(Math.abs(mStart - cEnd), Math.abs(cStart - mEnd));
          if (!best || score > best.score) best = { di, ci, score };
        }
      }
      pairs.push([dbPool[best.di], csvPool[best.ci]]);
      dbPool.splice(best.di, 1);
      csvPool.splice(best.ci, 1);
    }

    for (const [m, c] of pairs) {
      for (const [field, csvv] of [['batteryAGM', c.agm], ['batteryEFB', c.efb], ['batteryConventional', c.conv]]) {
        const dbv = (m[field] || '').trim();
        if (!csvv && !dbv) continue;
        if (!dbv && csvv) {
          m[field] = csvv;
          dirtyIds.add(id);
          stats.fill++;
        } else if (dbv && csvv && dbv !== csvv) {
          console.log(`  [CONFLICT -> CSV wins] ${entry.row.brand_slug} / ${entry.row.model_name} (id=${id}) / "${m.motorisation}" [${m.startDate}..${m.endDate}] / ${field}: ${dbv} -> ${csvv}`);
          m[field] = csvv;
          dirtyIds.add(id);
          stats.conflict++;
        } else {
          stats.agree++;
        }
      }
    }
    for (const c of csvPool) {
      entry.motos.push({
        motorisation: c.label,
        fuel: c.fuel,
        startDate: c.startDate,
        endDate: c.endDate,
        batteryAGM: c.agm,
        batteryEFB: c.efb,
        batteryConventional: c.conv,
      });
      dirtyIds.add(id);
      stats.newEntry++;
      console.log(`  [NEW ENTRY] ${entry.row.brand_slug} / ${entry.row.model_name} (id=${id}) / "${c.label}" [${c.startDate}..${c.endDate}]`);
    }
  }
}

console.log(`\n${DB_PATH}`);
console.log(`  fill-ins: ${stats.fill}, new entries: ${stats.newEntry}, conflicts (CSV applied): ${stats.conflict}, already agree: ${stats.agree}`);
console.log(`  rows to update (draft+pub counted separately): ${dirtyIds.size}`);
console.log(`  unmatched CSV vehicles: ${new Set(unmatchedModels).size}`);

if (!DRY_RUN) {
  const update = db.prepare('UPDATE battery_products SET motorisations=? WHERE id=?');
  db.transaction(() => {
    for (const id of dirtyIds) update.run(JSON.stringify(parsed.get(id).motos), id);
  })();
}
db.close();

console.log(`\n${DRY_RUN ? '[DRY-RUN] Nothing written.' : 'Done.'}`);
