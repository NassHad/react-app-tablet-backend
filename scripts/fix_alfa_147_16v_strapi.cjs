/**
 * Strapi-side mirror of fix_alfa_147_16v.cjs -- removes the bogus standalone
 * "16V" motorisation entry from Alfa Romeo 147's battery_products rows
 * (draft + published, both have the same document_id and identical
 * motorisations JSON).
 *
 * Usage: node scripts/fix_alfa_147_16v_strapi.cjs [--dry-run]
 */
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const STRAPI_DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

const db = new Database(STRAPI_DB_PATH);

function removeBogusEntry(motorisationsJson) {
  const arr = JSON.parse(motorisationsJson);
  const filtered = arr.filter((m) => m.motorisation !== '16V');
  if (filtered.length === arr.length) return null;
  return filtered;
}

function run() {
  const rows = db.prepare(
    "SELECT id, motorisations FROM battery_products WHERE brand_slug='alfa-romeo' AND model_slug='147'"
  ).all();
  const update = db.prepare('UPDATE battery_products SET motorisations=? WHERE id=?');

  let fixedRows = 0;
  for (const row of rows) {
    const fixed = removeBogusEntry(row.motorisations);
    if (fixed === null) continue;
    fixedRows++;
    console.log(`  id=${row.id}: removing bogus "16V" entry (${JSON.parse(row.motorisations).length} -> ${fixed.length} entries)`);
    update.run(JSON.stringify(fixed), row.id);
  }
  console.log(`  ${fixedRows} row(s) fixed (draft+pub counted separately)`);
}

try {
  db.transaction(() => {
    run();
    if (DRY_RUN) throw new Error('__DRY_RUN_ROLLBACK__');
  })();
} catch (e) {
  if (e.message !== '__DRY_RUN_ROLLBACK__') throw e;
}

console.log(`\n${DRY_RUN ? '[DRY-RUN] Nothing written.' : 'Done.'}`);
