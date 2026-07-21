/**
 * Strapi-side mirror of fix_battery_paren_comma_split.cjs (frontend repo).
 * See that script's header for the full explanation.
 *
 * Usage: node scripts/fix_battery_paren_comma_split_strapi.cjs [--dry-run]
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
function naiveSplit(s) {
  return s.split(',').map((t) => t.trim()).filter(Boolean);
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

const csvRows = parseCsv(CSV_PATH);
const affectedRows = csvRows.filter((row) => {
  const naive = naiveSplit(row.Motorisation);
  return naive.some((t) => (t.match(/\(/g) || []).length !== (t.match(/\)/g) || []).length);
});
console.log(`Affected CSV rows (comma-inside-parens): ${affectedRows.length}`);

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

const dirtyIds = new Set();
let removed = 0, added = 0;

for (const csvRow of affectedRows) {
  const bslug = brandSlug(csvRow.Brand);
  const candidates = byBrand.get(bslug) || [];
  const matches = findModelRows(candidates, csvRow.Vehicle);
  if (matches.length === 0) continue;

  const oldFragments = naiveSplit(csvRow.Motorisation).map(normMoto);
  const correctTokens = parenAwareSplit(csvRow.Motorisation);
  const correctNorm = new Set(correctTokens.map(normMoto));
  const csvAgm = csvRow.Battery_AGM.trim();
  const csvEfb = csvRow.Battery_EFB.trim();
  const csvConv = csvRow.Battery_Conventional.trim();

  for (const match of matches) {
    const entry = parsed.get(match.id);
    entry.motos = entry.motos.filter((m) => {
      const mn = normMoto(m.motorisation || '');
      const isFragment = oldFragments.includes(mn) && !correctNorm.has(mn);
      if (isFragment) {
        dirtyIds.add(match.id);
        removed++;
      }
      return !isFragment;
    });
    for (const tok of correctTokens) {
      const tokN = normMoto(tok);
      const exists = entry.motos.some((m) => normMoto(m.motorisation || '') === tokN);
      if (!exists) {
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
        added++;
      }
    }
  }
}

console.log(`\n${DB_PATH}`);
console.log(`  fragments removed: ${removed}, corrected entries added: ${added}, rows touched (draft+pub separately): ${dirtyIds.size}`);

if (!DRY_RUN) {
  const update = db.prepare('UPDATE battery_products SET motorisations=? WHERE id=?');
  db.transaction(() => {
    for (const id of dirtyIds) update.run(JSON.stringify(parsed.get(id).motos), id);
  })();
}
db.close();

console.log(`\n${DRY_RUN ? '[DRY-RUN] Nothing written.' : 'Done.'}`);
