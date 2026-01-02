const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Update existing models with vehicle_type field
 *
 * This script fetches all models from Strapi and updates them with the correct
 * vehicle_type based on slug lookup in moto_models.json:
 * - If model slug exists in moto_models.json → vehicle_type = "moto"
 * - Otherwise → vehicle_type = "car"
 *
 * Usage:
 *   1. Start Strapi: npm run dev
 *   2. Run this script: node scripts/update-existing-models-vehicle-type.js
 */

// Configuration
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Data files
const MOTO_MODELS_FILE = path.join(__dirname, 'json_data', 'moto_models.json');

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
 * Get vehicle type IDs
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

  console.log(`✅ Vehicle Type IDs:`);
  console.log(`   moto: ${motoId}`);
  console.log(`   car: ${carId}\n`);

  return { motoId, carId };
}

/**
 * Load moto model slugs from JSON file
 */
function loadMotoModelSlugs() {
  console.log('📦 Loading moto model slugs from JSON file...');

  if (!fs.existsSync(MOTO_MODELS_FILE)) {
    throw new Error(`Moto models file not found: ${MOTO_MODELS_FILE}`);
  }

  const motoModels = JSON.parse(fs.readFileSync(MOTO_MODELS_FILE, 'utf8'));
  const motoModelSlugs = new Set(motoModels.map(m => m.modelSlug));

  console.log(`✅ Loaded ${motoModelSlugs.size} moto model slugs\n`);
  return motoModelSlugs;
}

/**
 * Update models with vehicle_type
 */
async function updateModels(motoModelSlugs, vehicleTypeIds) {
  console.log('🔄 Updating models with vehicle_type...\n');

  let page = 1;
  let hasMore = true;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let total = 0;
  let motoCount = 0;
  let carCount = 0;

  while (hasMore) {
    const response = await makeRequest(
      `/models?pagination[page]=${page}&pagination[pageSize]=100&populate=vehicle_type`
    );

    // Handle both response formats
    const modelsArray = Array.isArray(response) ? response : (response.data || []);

    if (modelsArray.length > 0) {
      for (const model of modelsArray) {
        total++;

        try {
          // Skip if model already has a vehicle_type
          if (model.vehicle_type?.id) {
            skipped++;
            continue;
          }

          // Determine vehicle_type based on slug lookup
          let vehicleTypeId;
          if (motoModelSlugs.has(model.slug)) {
            vehicleTypeId = vehicleTypeIds.motoId;
            motoCount++;
          } else {
            vehicleTypeId = vehicleTypeIds.carId;
            carCount++;
          }

          // Update model with vehicle_type (use documentId for Strapi v5)
          // Use connect syntax for Strapi v5 relations
          await makeRequest(`/models/${model.documentId}`, 'PUT', {
            data: {
              vehicle_type: {
                connect: [vehicleTypeId]
              }
            }
          });

          updated++;

          if (updated % 50 === 0) {
            console.log(`📊 Progress: ${updated} models updated (${motoCount} moto, ${carCount} car)...`);
          }

        } catch (err) {
          console.error(`❌ Error updating model "${model.name}" (${model.slug}): ${err.message}`);
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

  return { total, updated, skipped, errors, motoCount, carCount };
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Updating Existing Models with vehicle_type\n');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // Step 1: Get vehicle type IDs
    const vehicleTypeIds = await getVehicleTypeIds();

    // Step 2: Load moto model slugs from JSON
    const motoModelSlugs = loadMotoModelSlugs();

    // Step 3: Update all models
    const stats = await updateModels(motoModelSlugs, vehicleTypeIds);

    // Final summary
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 Update Summary:');
    console.log(`   Total models processed: ${stats.total}`);
    console.log(`   ✅ Updated: ${stats.updated}`);
    console.log(`      - Moto: ${stats.motoCount}`);
    console.log(`      - Car: ${stats.carCount}`);
    console.log(`   ⏭️  Skipped (already had vehicle_type): ${stats.skipped}`);
    console.log(`   ❌ Errors: ${stats.errors}`);
    console.log('═══════════════════════════════════════════════\n');

    if (stats.errors > 0) {
      console.log('⚠️  Some models failed to update. Check the logs above.');
      process.exit(1);
    } else {
      console.log('✅ All models updated successfully!');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
