const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Update existing brands with vehicle_type field
 *
 * This script fetches all brands from Strapi and updates them with the correct
 * vehicle_type based on lookup in moto_brands.json:
 * - If brand slug exists in moto_brands.json → use the vehicleType from file (moto or car-moto)
 * - Otherwise → vehicle_type = "car"
 *
 * Usage:
 *   1. Start Strapi: npm run dev
 *   2. Run this script: node scripts/update-brands-vehicle-type.js
 */

// Configuration
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Data files
const MOTO_BRANDS_FILE = path.join(__dirname, 'json_data', 'moto_brands.json');

/**
 * Make HTTP request to Strapi API
 */
function makeRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${STRAPI_URL}/api${endpoint}`);

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (API_TOKEN) {
      options.headers['Authorization'] = `Bearer ${API_TOKEN}`;
    }

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${parsedData.message || responseData}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Get vehicle type IDs from Strapi
 */
async function getVehicleTypeIds() {
  console.log('📋 Fetching vehicle types...');

  const response = await makeRequest('/vehicle-types?pagination[limit]=100');

  // Handle both response formats: direct array or wrapped in data property
  const vehicleTypesArray = Array.isArray(response) ? response : (response.data || []);

  const vehicleTypeMap = new Map();
  for (const vt of vehicleTypesArray) {
    vehicleTypeMap.set(vt.slug, vt.id);
  }

  const motoId = vehicleTypeMap.get('moto') || vehicleTypeMap.get('motorcycle');
  const carId = vehicleTypeMap.get('car') || vehicleTypeMap.get('voiture');
  const carMotoId = vehicleTypeMap.get('car-moto') || vehicleTypeMap.get('car-motorcycle');

  if (!motoId) {
    throw new Error('Vehicle type "moto" not found in database');
  }
  if (!carId) {
    throw new Error('Vehicle type "car" not found in database');
  }

  console.log(`✅ Vehicle Type IDs:`);
  console.log(`   moto: ${motoId}`);
  console.log(`   car: ${carId}`);
  console.log(`   car-moto: ${carMotoId}\n`);

  return { motoId, carId, carMotoId };
}

/**
 * Load moto brands map from JSON file
 */
function loadMotoBrandMap() {
  console.log('📦 Loading moto brands from JSON file...');

  if (!fs.existsSync(MOTO_BRANDS_FILE)) {
    throw new Error(`Moto brands file not found: ${MOTO_BRANDS_FILE}`);
  }

  const motoBrands = JSON.parse(fs.readFileSync(MOTO_BRANDS_FILE, 'utf8'));

  // Create map: slug -> vehicleType ("moto" or "car-moto")
  const brandVehicleTypeMap = new Map();
  for (const brand of motoBrands) {
    brandVehicleTypeMap.set(brand.slug, brand.vehicleType);
  }

  console.log(`✅ Loaded ${brandVehicleTypeMap.size} moto brands\n`);
  return brandVehicleTypeMap;
}

/**
 * Update brands with vehicle_type
 */
async function updateBrands(brandVehicleTypeMap, vehicleTypeIds) {
  console.log('🔄 Updating brands with vehicle_type...\n');

  let page = 1;
  let hasMore = true;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let total = 0;
  let motoCount = 0;
  let carCount = 0;
  let carMotoCount = 0;

  while (hasMore) {
    const response = await makeRequest(
      `/brands?pagination[page]=${page}&pagination[pageSize]=100&populate=vehicle_type`
    );

    // Handle both response formats
    const brandsArray = Array.isArray(response) ? response : (response.data || []);

    if (brandsArray.length > 0) {
      for (const brand of brandsArray) {
        total++;

        try {
          // Skip if brand already has a vehicle_type
          if (brand.vehicle_type?.id) {
            skipped++;
            continue;
          }

          // Determine vehicle_type based on slug lookup
          let vehicleTypeId;
          const vehicleType = brandVehicleTypeMap.get(brand.slug);

          if (vehicleType === 'moto') {
            vehicleTypeId = vehicleTypeIds.motoId;
            motoCount++;
          } else if (vehicleType === 'car-moto') {
            vehicleTypeId = vehicleTypeIds.carMotoId;
            carMotoCount++;
          } else {
            // Default to car for brands not in moto_brands.json
            vehicleTypeId = vehicleTypeIds.carId;
            carCount++;
          }

          // Update brand with vehicle_type (use documentId for Strapi v5)
          // Use connect syntax for Strapi v5 relations
          await makeRequest(`/brands/${brand.documentId}`, 'PUT', {
            data: {
              vehicle_type: {
                connect: [vehicleTypeId]
              }
            }
          });

          updated++;

          if (updated % 20 === 0) {
            console.log(`📊 Progress: ${updated} brands updated (${motoCount} moto, ${carMotoCount} car-moto, ${carCount} car)...`);
          }

        } catch (err) {
          console.error(`❌ Error updating brand "${brand.name}" (${brand.slug}): ${err.message}`);
          errors++;
        }
      }

      // Check pagination
      if (response.meta?.pagination) {
        const { page: currentPage, pageCount } = response.meta.pagination;
        console.log(`  Processed page ${currentPage}/${pageCount}...`);
        hasMore = currentPage < pageCount;
        page++;
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return { total, updated, skipped, errors, motoCount, carMotoCount, carCount };
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Updating Existing Brands with vehicle_type\n');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // Step 1: Get vehicle type IDs
    const vehicleTypeIds = await getVehicleTypeIds();

    // Step 2: Load moto brands map from JSON
    const brandVehicleTypeMap = loadMotoBrandMap();

    // Step 3: Update all brands
    const stats = await updateBrands(brandVehicleTypeMap, vehicleTypeIds);

    // Final summary
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 Update Summary:');
    console.log(`   Total brands processed: ${stats.total}`);
    console.log(`   ✅ Updated: ${stats.updated}`);
    console.log(`      - Moto: ${stats.motoCount}`);
    console.log(`      - Car-Moto: ${stats.carMotoCount}`);
    console.log(`      - Car: ${stats.carCount}`);
    console.log(`   ⏭️  Skipped (already had vehicle_type): ${stats.skipped}`);
    console.log(`   ❌ Errors: ${stats.errors}`);
    console.log('═══════════════════════════════════════════════\n');

    if (stats.errors > 0) {
      console.log('⚠️  Some brands failed to update. Check the logs above.');
      process.exit(1);
    } else {
      console.log('✅ All brands updated successfully!');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
