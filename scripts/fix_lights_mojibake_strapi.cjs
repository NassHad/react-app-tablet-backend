/**
 * Strapi-side mirror of fix_lights_mojibake.cjs (frontend repo). See that
 * script's header for the full explanation. Draft and published rows are
 * independent physical rows (lights_products has no relation table), so
 * this processes every row that matches, not just one per pair.
 *
 * Usage: node scripts/fix_lights_mojibake_strapi.cjs [--dry-run]
 */
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

const TYPE_CONCEPTION_FIXES = new Map([
  ['avec phare principal � �clairage int�gral LED3', 'avec phare principal à éclairage intégral LED3'],
  ['Halogen, sans �clairage de jour12', 'Halogen, sans éclairage de jour12'],
  ['avec phare � r�?ecteur16', 'avec phare à réflecteur16'],
  ['Halogen, Feu arri�re rouge18', 'Halogen, Feu arrière rouge18'],
  ['Halogen, avec �clairage de jour11', 'Halogen, avec éclairage de jour11'],
  ['Bi-Xenon, avec syst�me de nivellement automatique des pharesl20', 'Bi-Xenon, avec système de nivellement automatique des pharesl20'],
  ['Bi-Xenon, avec syst�me de nivellement automatique des phares20', 'Bi-Xenon, avec système de nivellement automatique des phares20'],
  ['sans �clairage adaptatif2', 'sans éclairage adaptatif2'],
  ['sans �clairage de jour12', 'sans éclairage de jour12'],
  ['avec phare ellipso�dal10', 'avec phare ellipsoïdal10'],
  ['Bi-Xenon, sans �clairage adaptatif2', 'Bi-Xenon, sans éclairage adaptatif2'],
  ['Halogen, sans �clairage adaptatif2', 'Halogen, sans éclairage adaptatif2'],
  ['avec �clairage adaptatif1, Halogen', 'avec éclairage adaptatif1, Halogen'],
  ['avec �clairage de jour11', 'avec éclairage de jour11'],
  ['> 2014, sans �clairage adaptatif2', '> 2014, sans éclairage adaptatif2'],
]);

const NAME_FIXES = new Map([
  ['HYUNDAI GRAND SANTA F�', 'HYUNDAI GRAND SANTA FÉ'],
  ["PRO CEE�D - Lights (Halogen, sans éclairage de jour12)", "PRO CEE'D - Lights (Halogen, sans éclairage de jour12)"],
  ["PRO CEE�D - Lights (Halogen, avec éclairage de jour11)", "PRO CEE'D - Lights (Halogen, avec éclairage de jour11)"],
  ["PRO CEE�D - Lights (Xenon)", "PRO CEE'D - Lights (Xenon)"],
  ["PRO CEE�D - Lights (Standard)", "PRO CEE'D - Lights (Standard)"],
]);

const DESCRIPTION_FIXES = new Map([
  ['Light positions for HYUNDAI GRAND SANTA F�', 'Light positions for HYUNDAI GRAND SANTA FÉ'],
  ["Lights pour PRO CEE�D", "Lights pour PRO CEE'D"],
]);

const db = new Database(DB_PATH);

function fixColumn(column, fixes) {
  const select = db.prepare(`SELECT id, ${column} FROM lights_products WHERE ${column} LIKE '%' || X'EFBFBD' || '%'`);
  const update = db.prepare(`UPDATE lights_products SET ${column} = ? WHERE id = ?`);
  const rows = select.all();
  let fixed = 0;
  let unmapped = 0;
  for (const row of rows) {
    const raw = row[column];
    if (fixes.has(raw)) {
      if (!DRY_RUN) update.run(fixes.get(raw), row.id);
      console.log(`  [${column}] id=${row.id}: "${raw}" -> "${fixes.get(raw)}"`);
      fixed++;
    } else {
      console.log(`  [${column}] id=${row.id}: NO MAPPING FOUND for "${raw}"`);
      unmapped++;
    }
  }
  return { fixed, unmapped };
}

const run = () => {
  const a = fixColumn('type_conception', TYPE_CONCEPTION_FIXES);
  const b = fixColumn('name', NAME_FIXES);
  const c = fixColumn('description', DESCRIPTION_FIXES);
  return {
    fixed: a.fixed + b.fixed + c.fixed,
    unmapped: a.unmapped + b.unmapped + c.unmapped,
  };
};
const result = DRY_RUN ? run() : db.transaction(run)();

console.log(`\n${DB_PATH}`);
console.log(`  fixed: ${result.fixed} (draft+pub counted separately), unmapped: ${result.unmapped}`);
db.close();

console.log(`\n${DRY_RUN ? '[DRY-RUN] Nothing written.' : 'Done.'}`);
