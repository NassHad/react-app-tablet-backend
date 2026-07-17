/**
 * Strapi mirror of react-app-tablet/scripts/fix_vehicle_type_car_gap_and_misclassifications.cjs.
 * Strapi's models.vehicle_type already has the original Tier A (60 pure-moto
 * brands) + Tier B (bmw/honda/suzuki/peugeot classifiers) fix applied
 * (confirmed live: bmw has 0 remaining NULLs, honda/peugeot/suzuki have the
 * same small deliberate leftovers as SQLite) -- this script covers what
 * that pass didn't: the ~230 untouched pure-car brands (Tier C), plus the
 * same 4 confirmed misclassification fixes (BMW C1 scooter, Lifan cars,
 * Piaggio Porter, PGO Cevennes/Hemera). See the frontend script's header
 * for the full reasoning -- not repeated here.
 *
 * Strapi has its own id space and draft+publish row pairs (2 rows per
 * logical model, sometimes more due to duplicate models_brand_lnk rows
 * observed live) -- matched by (brand slug, model name) text instead of
 * hardcoded SQLite ids, and every matching row gets updated regardless of
 * publish state or link-table duplication.
 *
 * Usage:
 *   node scripts/fix-vehicle-type-car-gap-and-misclassifications.cjs --dry-run
 *   node scripts/fix-vehicle-type-car-gap-and-misclassifications.cjs
 */

const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

const ALREADY_HANDLED_MOTO_BRANDS = [
  'aeon', 'aprilia', 'baotian', 'benelli', 'benzhou', 'beta', 'bimota', 'buell', 'cagiva',
  'cf-moto', 'cpi', 'daelim', 'derbi', 'ducati', 'fb-mondial', 'gas-gas', 'generic', 'gilera',
  'harley-davidson', 'hercules', 'hmracing', 'husaberg', 'husqvarna', 'hyosung', 'indian',
  'italjet', 'jinlun', 'kawasaki', 'keeway', 'kreidler', 'ktm', 'kymco', 'laverda-motorcycles',
  'lifan', 'lingben', 'lml', 'malaguti', 'mash', 'mbk', 'moto-guzzi', 'moto-morini', 'motowell',
  'mv-agusta', 'mz', 'pgo', 'piaggio', 'qingqi', 'qjmotor', 'rex', 'royal-enfield', 'sachs',
  'simson', 'swm', 'sym', 'tgb', 'triumph', 'vespa', 'victory-motorcycles', 'yamaha', 'znen',
];
const ALREADY_HANDLED_TIER_B = ['bmw', 'honda', 'suzuki', 'peugeot'];
const EXCLUDED_BRANDS = new Set([...ALREADY_HANDLED_MOTO_BRANDS, ...ALREADY_HANDLED_TIER_B]);

const CONFIRMED_FIXES = [
  { brandSlug: 'bmw', names: ['C1 125 (C1 ABS)', 'C1 125 (C1)', 'C1 200 (C1 ABS)', 'C1 200 (C1)'], newType: 'moto', label: 'BMW C1 scooter' },
  {
    brandSlug: 'lifan',
    names: ['320', '520', '520i', '530', '620', '620 II', '720', '820', 'MYWAY', 'X50', 'X60', 'X70', '320 / SMILY', '520 / BREEZ', '620 / SOLANO'],
    newType: 'car',
    label: 'Lifan cars',
  },
  { brandSlug: 'piaggio', names: ['PORTER', 'Porter / Tipper / Quargo'], newType: 'car', label: 'Piaggio Porter (LCV)' },
  { brandSlug: 'pgo', names: ['Cevennes', 'Hemera'], newType: 'car', label: 'PGO Automobiles' },
];

const db = new Database(DB_PATH, { readonly: DRY_RUN });

// --- Tier C ---
const excludedPlaceholders = [...EXCLUDED_BRANDS].map(() => '?').join(',');
const candidateBrands = db.prepare(`
  SELECT b.slug as brandSlug,
    SUM(CASE WHEN m.vehicle_type IS NULL THEN 1 ELSE 0 END) as nullCount,
    SUM(CASE WHEN m.vehicle_type='car' THEN 1 ELSE 0 END) as carCount,
    SUM(CASE WHEN m.vehicle_type='moto' THEN 1 ELSE 0 END) as motoCount
  FROM models m
  JOIN models_brand_lnk lnk ON lnk.model_id = m.id
  JOIN brands b ON b.id = lnk.brand_id
  WHERE b.slug NOT IN (${excludedPlaceholders})
  GROUP BY b.slug
  HAVING nullCount > 0
`).all(...EXCLUDED_BRANDS);

let tierCIds = [];
let tierCBrands = 0;
const skippedBrands = [];

for (const b of candidateBrands) {
  if (b.motoCount > 0) {
    skippedBrands.push(`${b.brandSlug} (${b.nullCount} NULL, has ${b.motoCount} moto-typed rows -- needs manual classifier)`);
    continue;
  }
  if (b.carCount === 0) {
    const exideCount = db.prepare(`
      SELECT COUNT(*) as c FROM battery_products WHERE brand_slug = ? AND battery_brand = 'Exide'
    `).get(b.brandSlug).c;
    if (exideCount > 0) {
      skippedBrands.push(`${b.brandSlug} (${b.nullCount} NULL, zero typed rows but ${exideCount} Exide/moto battery rows -- needs manual classifier)`);
      continue;
    }
  }
  const ids = db.prepare(`
    SELECT m.id FROM models m
    JOIN models_brand_lnk lnk ON lnk.model_id = m.id
    JOIN brands b ON b.id = lnk.brand_id
    WHERE b.slug = ? AND m.vehicle_type IS NULL
  `).all(b.brandSlug).map(r => r.id);
  tierCIds.push(...ids);
  tierCBrands++;
}

console.log(`Tier C (${tierCBrands} validated car-only brands): ${tierCIds.length} row(s) -> car`);
if (skippedBrands.length) console.log(`  skipped (needs manual review): ${skippedBrands.join('; ')}`);

// --- Confirmed fixes ---
const fixDetails = CONFIRMED_FIXES.map(fix => {
  const placeholders = fix.names.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT m.id, m.name, m.vehicle_type
    FROM models m
    JOIN models_brand_lnk lnk ON lnk.model_id = m.id
    JOIN brands b ON b.id = lnk.brand_id
    WHERE b.slug = ? AND m.name IN (${placeholders})
  `).all(fix.brandSlug, ...fix.names);
  console.log(`${fix.label}: ${rows.length} row(s) -> ${fix.newType}`);
  return { ...fix, ids: [...new Set(rows.map(r => r.id))] };
});

if (DRY_RUN) {
  db.close();
  console.log('\n[DRY RUN] No changes written.');
  process.exit(0);
}

const wdb = new Database(DB_PATH);
const updateStmt = wdb.prepare('UPDATE models SET vehicle_type = ? WHERE id = ?');
const txn = wdb.transaction(() => {
  for (const id of tierCIds) updateStmt.run('car', id);
  for (const fix of fixDetails) for (const id of fix.ids) updateStmt.run(fix.newType, id);
});
txn();
wdb.close();
db.close();
console.log(`\nApplied: ${tierCIds.length} Tier C row(s) + ${fixDetails.reduce((s, f) => s + f.ids.length, 0)} confirmed-fix row(s).`);
