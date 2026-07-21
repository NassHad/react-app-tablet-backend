/**
 * Strapi-side mirror of dedupe_battery_motorisations.cjs. battery_products
 * uses flat brand_slug/model_slug columns (no *_lnk join tables) in Strapi,
 * same shape as SQLite -- both draft and published rows need fixing
 * independently since they're separate physical rows with their own
 * (identically duplicated) motorisations JSON.
 *
 * Usage: node scripts/dedupe_battery_motorisations_strapi.cjs [--dry-run]
 */
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const STRAPI_DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

const db = new Database(STRAPI_DB_PATH);

function dedupeRow(motorisationsJson) {
  const arr = JSON.parse(motorisationsJson);
  if (!Array.isArray(arr)) return null;
  const seen = new Set();
  const deduped = [];
  for (const m of arr) {
    const key = JSON.stringify(m);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(m);
  }
  return deduped.length === arr.length ? null : deduped;
}

function run() {
  const rows = db.prepare('SELECT id, motorisations FROM battery_products').all();
  const update = db.prepare('UPDATE battery_products SET motorisations=? WHERE id=?');

  let fixedRows = 0;
  let removedEntries = 0;

  for (const row of rows) {
    let deduped;
    try {
      deduped = dedupeRow(row.motorisations);
    } catch {
      continue;
    }
    if (deduped === null) continue;
    const original = JSON.parse(row.motorisations);
    removedEntries += original.length - deduped.length;
    fixedRows++;
    update.run(JSON.stringify(deduped), row.id);
  }

  console.log(`  ${fixedRows} row(s) fixed (draft+pub counted separately), ${removedEntries} redundant entrie(s) removed`);
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
