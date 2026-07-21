const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, '..', '.tmp', 'data.db'), { readonly: true });

const modelsWithLights = db.prepare(`
  SELECT DISTINCT m.id as model_id, b.slug as brandSlug, b.name as brandName, m.slug as modelSlug, m.name as modelName, m.display_name as displayName
  FROM models m
  JOIN models_brand_lnk mbl ON mbl.model_id = m.id
  JOIN brands b ON b.id = mbl.brand_id
  JOIN lights_products_model_lnk mlnk ON mlnk.model_id = m.id
  JOIN lights_products lp ON lp.id = mlnk.lights_product_id
  WHERE m.published_at IS NOT NULL AND lp.published_at IS NOT NULL
    AND m.display_name IS NOT NULL AND m.display_name != ''
`).all();

const byDisplay = new Map();
for (const r of modelsWithLights) {
  const key = `${r.brandSlug}|${r.displayName}`;
  if (!byDisplay.has(key)) {
    byDisplay.set(key, { brandSlug: r.brandSlug, brandName: r.brandName, displayName: r.displayName, members: new Map() });
  }
  byDisplay.get(key).members.set(r.modelSlug, r.modelName);
}

const families = [...byDisplay.values()]
  .filter((f) => f.members.size > 1)
  .map((f) => ({
    brandSlug: f.brandSlug,
    brandName: f.brandName,
    displayName: f.displayName,
    members: [...f.members.entries()].map(([slug, name]) => ({ slug, name })),
  }))
  .sort((a, b) => (a.brandSlug + a.displayName).localeCompare(b.brandSlug + b.displayName));

const description = [
  'Nameplates whose lights data is already deliberately split across multiple',
  'generation/body-style model slugs sharing one display name (e.g. Nissan Juke',
  '-> juke-f15/juke-f16). The OSRAM CSV importer (react-app-tablet/scripts/',
  'parse_osram_csv_to_json.cjs -> merge_light_positions.cjs ->',
  'add_slugs_to_bulbs.cjs) strips chassis/generation codes and only ever',
  'produces the single generic slug, so it cannot safely route rows to the',
  "correct sibling slug for these families. import_osram_lights_additive.cjs",
  'skips all of them entirely (additive-only, never touches this set) pending',
  "a real reconciliation -- no single heuristic covers all of them, confirmed",
  'empirically 2026-07-18.',
].join(' ');

const report = {
  generatedAt: new Date().toISOString(),
  description,
  familyCount: families.length,
  families,
};

const outPath = path.join(__dirname, 'reports', 'lights_split_families.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`Wrote ${families.length} split families to ${outPath}`);
db.close();
