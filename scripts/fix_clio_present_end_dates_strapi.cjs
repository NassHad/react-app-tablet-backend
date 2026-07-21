/**
 * Strapi-side mirror of fix_clio_present_end_dates.cjs (frontend repo). See
 * that script's header for the full explanation.
 *
 * Unlike battery_products, lights_products has NO flat brand_slug/
 * model_slug columns here -- model is a real relation via the
 * lights_products_model_lnk join table to models.slug. Draft and published
 * rows are independent physical rows (confirmed: 12 rows total for the 6
 * Clio model_slugs, 2 each).
 *
 * Usage: node scripts/fix_clio_present_end_dates_strapi.cjs [--dry-run]
 */
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

const CAPS = new Map([
  ['clio-ii', { expectedCurrentEnd: 'Present', newEnd: '12/04' }],
  ['clio-ii-hatchback-van', { expectedCurrentEnd: 'Present', newEnd: '05/05' }],
  ['clio-iii', { expectedCurrentEnd: 'Present', newEnd: '10/12' }],
  ['clio-iii-hatchback-van', { expectedCurrentEnd: 'Present', newEnd: '12/13' }],
  ['clio-iii-grandtour', { expectedCurrentEnd: 'Present', newEnd: '12/12' }],
  ['clio-iv', { expectedCurrentEnd: 'Present', newEnd: '05/19' }],
]);

const db = new Database(DB_PATH);
const select = db.prepare(
  `SELECT lp.id, m.name AS model_name, m.slug AS model_slug, lp.construction_year_end
   FROM lights_products lp
   JOIN lights_products_model_lnk lnk ON lnk.lights_product_id = lp.id
   JOIN models m ON m.id = lnk.model_id
   WHERE m.slug IN (${[...CAPS.keys()].map(() => '?').join(',')})`,
);
const update = db.prepare('UPDATE lights_products SET construction_year_end = ? WHERE id = ?');

const rows = select.all(...CAPS.keys());
let fixed = 0;
let skipped = 0;

const run = () => {
  for (const row of rows) {
    const cap = CAPS.get(row.model_slug);
    if (row.construction_year_end !== cap.expectedCurrentEnd) {
      console.log(`  [SKIP] id=${row.id} ${row.model_name} (${row.model_slug}): expected end="${cap.expectedCurrentEnd}", found "${row.construction_year_end}" -- not touching`);
      skipped++;
      continue;
    }
    console.log(`  [CAP] id=${row.id} ${row.model_name} (${row.model_slug}): end "${row.construction_year_end}" -> "${cap.newEnd}"`);
    if (!DRY_RUN) update.run(cap.newEnd, row.id);
    fixed++;
  }
};

if (DRY_RUN) run(); else db.transaction(run)();

console.log(`\n${DB_PATH}`);
console.log(`  capped: ${fixed} (draft+pub counted separately), skipped: ${skipped}, matched rows total: ${rows.length}`);
db.close();

console.log(`\n${DRY_RUN ? '[DRY-RUN] Nothing written.' : 'Done.'}`);
