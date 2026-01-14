const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Populate vehicle_type string field using moto_brands.json and moto_models.json
 *
 * This script sets vehicle_type values based on:
 * - For brands: lookup in moto_brands.json (moto/car-moto), default to "car"
 * - For models: lookup in moto_models.json (moto), default to "car"
 *
 * Usage: node scripts/migrate-vehicle-type-to-string.js
 */

const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');
const MOTO_BRANDS_FILE = path.join(__dirname, 'json_data', 'moto_brands.json');
const MOTO_MODELS_FILE = path.join(__dirname, 'json_data', 'moto_models.json');

console.log('🔄 Populating vehicle_type string field\n');
console.log('═══════════════════════════════════════════════\n');

try {
  // Load moto brands
  console.log('📦 Loading moto brands from JSON...');
  if (!fs.existsSync(MOTO_BRANDS_FILE)) {
    throw new Error(`Moto brands file not found: ${MOTO_BRANDS_FILE}`);
  }
  const motoBrands = JSON.parse(fs.readFileSync(MOTO_BRANDS_FILE, 'utf8'));
  const brandVehicleTypeMap = new Map();
  for (const brand of motoBrands) {
    brandVehicleTypeMap.set(brand.slug, brand.vehicleType); // "moto" or "car-moto"
  }
  console.log(`✅ Loaded ${brandVehicleTypeMap.size} moto brands\n`);

  // Load moto models
  console.log('📦 Loading moto models from JSON...');
  if (!fs.existsSync(MOTO_MODELS_FILE)) {
    throw new Error(`Moto models file not found: ${MOTO_MODELS_FILE}`);
  }
  const motoModels = JSON.parse(fs.readFileSync(MOTO_MODELS_FILE, 'utf8'));
  const motoModelSlugs = new Set(motoModels.map(m => m.modelSlug));
  console.log(`✅ Loaded ${motoModelSlugs.size} moto model slugs\n`);

  // Open database
  console.log('💾 Opening database...');
  const db = new Database(DB_PATH);
  console.log('✅ Database opened\n');

  // Migrate brands
  console.log('📦 Updating brands...');
  const brands = db.prepare('SELECT id, slug FROM brands').all();
  const updateBrandStmt = db.prepare('UPDATE brands SET vehicle_type = ? WHERE id = ?');

  let brandsMigrated = 0;
  let motoCount = 0;
  let carMotoCount = 0;
  let carCount = 0;

  for (const brand of brands) {
    let vehicleType;
    const vehicleTypeFromJson = brandVehicleTypeMap.get(brand.slug);

    if (vehicleTypeFromJson === 'moto') {
      vehicleType = 'moto';
      motoCount++;
    } else if (vehicleTypeFromJson === 'car-moto') {
      vehicleType = 'car-moto';
      carMotoCount++;
    } else {
      vehicleType = 'car';
      carCount++;
    }

    updateBrandStmt.run(vehicleType, brand.id);
    brandsMigrated++;

    if (brandsMigrated % 100 === 0) {
      console.log(`  Progress: ${brandsMigrated} brands updated...`);
    }
  }

  console.log(`✅ Updated ${brandsMigrated} brands (${motoCount} moto, ${carMotoCount} car-moto, ${carCount} car)\n`);

  // Migrate models
  console.log('📦 Updating models...');
  const models = db.prepare('SELECT id, slug FROM models').all();
  const updateModelStmt = db.prepare('UPDATE models SET vehicle_type = ? WHERE id = ?');

  let modelsMigrated = 0;
  let motoModelsCount = 0;
  let carModelsCount = 0;

  for (const model of models) {
    let vehicleType;
    if (motoModelSlugs.has(model.slug)) {
      vehicleType = 'moto';
      motoModelsCount++;
    } else {
      vehicleType = 'car';
      carModelsCount++;
    }

    updateModelStmt.run(vehicleType, model.id);
    modelsMigrated++;

    if (modelsMigrated % 1000 === 0) {
      console.log(`  Progress: ${modelsMigrated} models updated...`);
    }
  }

  console.log(`✅ Updated ${modelsMigrated} models (${motoModelsCount} moto, ${carModelsCount} car)\n`);

  db.close();

  // Summary
  console.log('═══════════════════════════════════════════════');
  console.log('📊 Migration Summary:');
  console.log(`   Brands migrated: ${brandsMigrated}`);
  console.log(`   Models migrated: ${modelsMigrated}`);
  console.log('═══════════════════════════════════════════════\n');

  console.log('✅ Migration complete!');
  console.log('ℹ️  Next steps:');
  console.log('   1. Run: npm run build');
  console.log('   2. Restart Strapi');
  console.log('   3. Test API endpoints');
  console.log('   4. (Optional) Drop old link tables: brands_vehicle_type_lnk, models_vehicle_type_lnk\n');

} catch (error) {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
