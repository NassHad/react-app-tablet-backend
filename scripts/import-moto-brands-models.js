const fs = require('fs');
const path = require('path');
const http = require('http');

/**
 * Import motorcycle brands and models into Strapi
 * Follows the pattern from import-exide-brands-models-http.js
 *
 * Usage:
 *   1. Start Strapi: npm run dev
 *   2. Run this script: node scripts/import-moto-brands-models.js
 */

// Configuration
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Data files
const BRANDS_FILE = path.join(__dirname, 'json_data', 'moto_brands.json');
const MODELS_FILE = path.join(__dirname, 'json_data', 'moto_models.json');

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
  const vehicleTypeMap = new Map();

  // Handle both response formats: direct array or wrapped in data property
  const vehicleTypesArray = Array.isArray(response) ? response : (response.data || []);

  for (const vt of vehicleTypesArray) {
    vehicleTypeMap.set(vt.slug, vt.id);
  }

  const motoId = vehicleTypeMap.get('moto') || vehicleTypeMap.get('motorcycle');
  const carId = vehicleTypeMap.get('car') || vehicleTypeMap.get('voiture');
  const carMotoId = vehicleTypeMap.get('car-moto') || vehicleTypeMap.get('car-motorcycle');

  if (!motoId) {
    throw new Error('Vehicle type "moto" not found in database');
  }

  return {
    motoId,
    carId,
    carMotoId
  };
}

/**
 * Import motorcycle brands
 */
async function importBrands(brandsData, vehicleTypeIds) {
  console.log('📦 Importing brands...\n');

  // Pre-load existing brands
  const brandSlugToIdMap = new Map();
  const allBrands = await makeRequest('/brands?pagination[limit]=1000');

  // Handle both response formats: direct array or wrapped in data property
  const brandsArray = Array.isArray(allBrands) ? allBrands : (allBrands.data || []);

  for (const brand of brandsArray) {
    brandSlugToIdMap.set(brand.slug, {
      id: brand.id,
      documentId: brand.documentId
    });
  }

  console.log(`Found ${brandSlugToIdMap.size} existing brands\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  // Process each brand
  for (let i = 0; i < brandsData.length; i++) {
    const brand = brandsData[i];

    // Determine vehicle_type ID
    let vehicleTypeId;
    if (brand.vehicleType === 'car-moto') {
      vehicleTypeId = vehicleTypeIds.carMotoId;
    } else if (brand.vehicleType === 'moto') {
      vehicleTypeId = vehicleTypeIds.motoId;
    } else {
      vehicleTypeId = vehicleTypeIds.carId;
    }

    if (!vehicleTypeId) {
      console.warn(`⚠️  No vehicle_type ID for: ${brand.name} (${brand.vehicleType})`);
      errors++;
      continue;
    }

    try {
      if (brandSlugToIdMap.has(brand.slug)) {
        // UPDATE existing brand
        const existingBrand = brandSlugToIdMap.get(brand.slug);

        await makeRequest(`/brands/${existingBrand.documentId}`, 'PUT', {
          data: {
            vehicle_type: {
              connect: [vehicleTypeId]
            }
          }
        });

        updated++;
        console.log(`🔄 Updated: ${brand.name} → ${brand.vehicleType}`);
      } else {
        // CREATE new brand with Strapi v5 relation syntax
        const response = await makeRequest('/brands', 'POST', {
          data: {
            name: brand.name,
            slug: brand.slug,
            isActive: brand.isActive,
            vehicle_type: {
              connect: [vehicleTypeId]
            }
          }
        });

        if (response.data) {
          brandSlugToIdMap.set(brand.slug, {
            id: response.data.id,
            documentId: response.data.documentId
          });
          created++;
          console.log(`✅ Created: ${brand.name} (${brand.vehicleType})`);
        }
      }

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        console.log(`📊 Progress: ${i + 1}/${brandsData.length} brands processed...\n`);
      }

    } catch (err) {
      console.error(`❌ Error processing "${brand.name}": ${err.message}`);
      errors++;
    }
  }

  // Rebuild the map with all brands after import to ensure accuracy
  console.log('\n🔄 Refreshing brand mapping...');
  brandSlugToIdMap.clear();

  const refreshedBrands = await makeRequest('/brands?pagination[limit]=1000');

  // Handle both response formats: direct array or wrapped in data property
  const refreshedBrandsArray = Array.isArray(refreshedBrands) ? refreshedBrands : (refreshedBrands.data || []);

  for (const brand of refreshedBrandsArray) {
    brandSlugToIdMap.set(brand.slug, {
      id: brand.id,
      documentId: brand.documentId
    });
  }

  console.log(`✅ Brand map refreshed with ${brandSlugToIdMap.size} brands`);

  return { created, updated, errors, brandSlugToIdMap };
}

/**
 * Import motorcycle models
 */
async function importModels(modelsData, brandSlugToIdMap, vehicleTypeIds) {
  console.log('\n📦 Importing models...\n');

  // Pre-load existing models with pagination
  const existingModelSlugs = new Set();
  let page = 1;
  let hasMore = true;

  console.log('Loading existing models...');

  while (hasMore) {
    const response = await makeRequest(
      `/models?pagination[page]=${page}&pagination[pageSize]=100`
    );

    // Handle both response formats: direct array or wrapped in data property
    const modelsArray = Array.isArray(response) ? response : (response.data || []);

    if (modelsArray.length > 0) {
      for (const model of modelsArray) {
        existingModelSlugs.add(model.slug);
      }

      // Check if there's pagination metadata (only present when wrapped in data property)
      if (response.meta?.pagination) {
        const { page: currentPage, pageCount } = response.meta.pagination;
        console.log(`  Loaded page ${currentPage}/${pageCount}...`);
        hasMore = currentPage < pageCount;
        page++;
      } else {
        // No pagination metadata, assume all data loaded
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  console.log(`\nFound ${existingModelSlugs.size} existing models\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Process each model
  for (let i = 0; i < modelsData.length; i++) {
    const model = modelsData[i];

    try {
      // Check if model already exists
      if (existingModelSlugs.has(model.modelSlug)) {
        skipped++;
        continue;
      }

      // Find brand
      const brand = brandSlugToIdMap.get(model.brandSlug);
      if (!brand) {
        console.warn(`⚠️  Brand not found: "${model.brandSlug}" for model "${model.name}"`);
        errors++;
        continue;
      }

      // Determine vehicle_type ID based on model's vehicleType
      const vehicleTypeId = model.vehicleType === 'moto'
        ? vehicleTypeIds.motoId
        : vehicleTypeIds.carId;

      if (!vehicleTypeId) {
        console.warn(`⚠️  No vehicle_type ID for: "${model.name}" (${model.vehicleType})`);
        errors++;
        continue;
      }

      // Create model with Strapi v5 relation syntax
      const response = await makeRequest('/models', 'POST', {
        data: {
          name: model.name,
          slug: model.modelSlug,
          brand: {
            connect: [brand.id]
          },
          isActive: true,
          vehicle_type: {
            connect: [vehicleTypeId]
          }
        }
      });

      if (response.data) {
        existingModelSlugs.add(model.modelSlug);
        created++;

        // Progress logging every 100 models
        if (created % 100 === 0) {
          console.log(`📊 Created ${created}/${modelsData.length} models...`);
        }
      }

    } catch (err) {
      console.error(`❌ Error creating model "${model.name}": ${err.message}`);
      errors++;
    }
  }

  return { created, skipped, errors };
}

/**
 * Main import function
 */
async function main() {
  console.log('🏍️  Starting Motorcycle Brands and Models Import\n');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // Load data files
    console.log('📁 Loading data files...\n');
    const brands = JSON.parse(fs.readFileSync(BRANDS_FILE, 'utf-8'));
    const models = JSON.parse(fs.readFileSync(MODELS_FILE, 'utf-8'));

    console.log(`   Brands: ${brands.length}`);
    console.log(`   Models: ${models.length}\n`);

    // Phase 1: Get vehicle type IDs
    console.log('───────────────────────────────────────────────');
    console.log('Phase 1: Vehicle Types');
    console.log('───────────────────────────────────────────────\n');

    const vehicleTypeIds = await getVehicleTypeIds();
    console.log(`✅ Vehicle Type IDs:`);
    console.log(`   moto: ${vehicleTypeIds.motoId}`);
    console.log(`   car: ${vehicleTypeIds.carId}`);
    console.log(`   car-moto: ${vehicleTypeIds.carMotoId}\n`);

    // Phase 2: Import brands
    console.log('───────────────────────────────────────────────');
    console.log('Phase 2: Brands');
    console.log('───────────────────────────────────────────────\n');

    const brandStats = await importBrands(brands, vehicleTypeIds);

    console.log(`\n📊 Brand Import Summary:`);
    console.log(`   ✅ Created: ${brandStats.created}`);
    console.log(`   🔄 Updated: ${brandStats.updated}`);
    console.log(`   ❌ Failed: ${brandStats.errors}`);

    // Phase 3: Import models
    console.log('\n───────────────────────────────────────────────');
    console.log('Phase 3: Models');
    console.log('───────────────────────────────────────────────');

    const modelStats = await importModels(models, brandStats.brandSlugToIdMap, vehicleTypeIds);

    console.log(`\n📊 Model Import Summary:`);
    console.log(`   ✅ Created: ${modelStats.created}`);
    console.log(`   ⏭️  Skipped: ${modelStats.skipped}`);
    console.log(`   ❌ Failed: ${modelStats.errors}`);

    // Final summary
    console.log('\n═══════════════════════════════════════════════');
    console.log('✨ Import Completed!');
    console.log('═══════════════════════════════════════════════\n');

    console.log('📈 Final Summary:');
    console.log(`   Brands - Created: ${brandStats.created}, Updated: ${brandStats.updated}`);
    console.log(`   Models - Created: ${modelStats.created}, Skipped: ${modelStats.skipped}\n`);

    if (brandStats.errors > 0 || modelStats.errors > 0) {
      console.warn(`⚠️  Warning: ${brandStats.errors + modelStats.errors} errors occurred during import`);
    }

  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run import
if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ Script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { main, importBrands, importModels, getVehicleTypeIds };
