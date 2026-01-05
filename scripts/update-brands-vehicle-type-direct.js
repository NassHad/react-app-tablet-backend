const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Update brands with vehicle_type directly in the database
 *
 * This bypasses Strapi API to avoid SQLite compound SELECT limits
 * when brands have many relations (like Peugeot with 1300+ filter compatibilities)
 *
 * Usage: node scripts/update-brands-vehicle-type-direct.js
 */

// Data files
const MOTO_BRANDS_FILE = path.join(__dirname, 'json_data', 'moto_brands.json');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

console.log('🔧 Updating Brands with vehicle_type (Direct DB)\n');
console.log('═══════════════════════════════════════════════\n');

try {
  // Step 1: Load moto brands
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

  // Step 2: Open database
  console.log('💾 Opening database...');
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database not found: ${DB_PATH}`);
  }
  const db = new Database(DB_PATH);
  console.log(`✅ Database opened\n`);

  // Step 3: Get vehicle type IDs
  console.log('📋 Fetching vehicle type IDs...');
  const vehicleTypes = db.prepare('SELECT id, slug FROM vehicle_types').all();
  const vehicleTypeIds = {};
  for (const vt of vehicleTypes) {
    if (vt.slug === 'moto' || vt.slug === 'motorcycle') {
      vehicleTypeIds.motoId = vt.id;
    } else if (vt.slug === 'car' || vt.slug === 'voiture') {
      vehicleTypeIds.carId = vt.id;
    } else if (vt.slug === 'car-moto' || vt.slug === 'car-motorcycle') {
      vehicleTypeIds.carMotoId = vt.id;
    }
  }

  if (!vehicleTypeIds.motoId || !vehicleTypeIds.carId) {
    throw new Error('Could not find required vehicle types in database');
  }

  console.log(`✅ Vehicle Type IDs:`);
  console.log(`   moto: ${vehicleTypeIds.motoId}`);
  console.log(`   car: ${vehicleTypeIds.carId}`);
  console.log(`   car-moto: ${vehicleTypeIds.carMotoId}\n`);

  // Step 4: Update brands via link table
  console.log('🔄 Updating brands...\n');

  // Get all brands (only id and slug needed)
  const brands = db.prepare('SELECT id, slug FROM brands').all();

  // Get existing vehicle_type links to skip already-linked brands
  const existingLinks = db.prepare('SELECT brand_id FROM brands_vehicle_type_lnk').all();
  const brandsWithVehicleType = new Set(existingLinks.map(link => link.brand_id));

  let updated = 0;
  let skipped = 0;
  let motoCount = 0;
  let carMotoCount = 0;
  let carCount = 0;

  // Insert into link table instead of updating brands table
  const insertStmt = db.prepare('INSERT INTO brands_vehicle_type_lnk (brand_id, vehicle_type_id) VALUES (?, ?)');

  for (const brand of brands) {
    // Skip if brand already has vehicle_type link
    if (brandsWithVehicleType.has(brand.id)) {
      skipped++;
      continue;
    }

    // Determine vehicle_type
    let vehicleTypeId;
    const vehicleType = brandVehicleTypeMap.get(brand.slug);

    if (vehicleType === 'moto') {
      vehicleTypeId = vehicleTypeIds.motoId;
      motoCount++;
    } else if (vehicleType === 'car-moto') {
      vehicleTypeId = vehicleTypeIds.carMotoId;
      carMotoCount++;
    } else {
      // Default to car
      vehicleTypeId = vehicleTypeIds.carId;
      carCount++;
    }

    // Insert into link table
    insertStmt.run(brand.id, vehicleTypeId);
    updated++;

    if (updated % 20 === 0) {
      console.log(`📊 Progress: ${updated} brands updated...`);
    }
  }

  db.close();

  // Final summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('📊 Update Summary:');
  console.log(`   Total brands: ${brands.length}`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`      - Moto: ${motoCount}`);
  console.log(`      - Car-Moto: ${carMotoCount}`);
  console.log(`      - Car: ${carCount}`);
  console.log(`   ⏭️  Skipped (already had vehicle_type): ${skipped}`);
  console.log('═══════════════════════════════════════════════\n');

  console.log('✅ All brands updated successfully!');
  console.log('ℹ️  Restart Strapi to see the changes in the admin panel.\n');

} catch (error) {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
}
