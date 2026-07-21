/**
 * Strapi-side mirror of remove_unbalanced_paren_motorisations.cjs (frontend
 * repo). See that script's header for the full explanation.
 *
 * Usage: node scripts/remove_unbalanced_paren_motorisations_strapi.cjs [--dry-run]
 */
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

const RELABEL_INSTEAD_OF_DELETE = new Map([
  ['1.5 dCi (BM0F, BM0T, BM2B, CM0F, CM0T, (BM1E, CM1E,BM1F, CM1F)', '1.5 dCi'],
]);

const db = new Database(DB_PATH);
const rows = db.prepare('SELECT id, brand_slug, model_name, motorisations FROM battery_products').all();
const update = db.prepare('UPDATE battery_products SET motorisations=? WHERE id=?');

let removedCount = 0;
let relabeledCount = 0;
let rowsFixed = 0;

const run = () => {
  for (const row of rows) {
    let motos;
    try { motos = JSON.parse(row.motorisations); } catch { continue; }
    if (!Array.isArray(motos)) continue;
    const before = motos.length;
    let changed = false;
    const filtered = motos.filter((m) => {
      const name = (m.motorisation || '').trim();
      const bad = (name.match(/\(/g) || []).length !== (name.match(/\)/g) || []).length;
      if (!bad) return true;
      if (RELABEL_INSTEAD_OF_DELETE.has(name)) {
        m.motorisation = RELABEL_INSTEAD_OF_DELETE.get(name);
        relabeledCount++;
        changed = true;
        return true;
      }
      return false;
    });
    if (filtered.length !== before || changed) {
      removedCount += before - filtered.length;
      rowsFixed++;
      if (!DRY_RUN) update.run(JSON.stringify(filtered), row.id);
    }
  }
};

if (DRY_RUN) run();
else db.transaction(run)();

console.log(`${DB_PATH}`);
console.log(`  ${removedCount} unbalanced-paren entries removed, ${relabeledCount} relabeled, across ${rowsFixed} row(s) (draft+pub separately)`);
db.close();

console.log(`\n${DRY_RUN ? '[DRY-RUN] Nothing written.' : 'Done.'}`);
