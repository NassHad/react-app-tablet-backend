const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Import Harley Davidson Motorcycle Lights Products
 *
 * This script imports Harley Davidson motorcycle lights data from osram-moto-lamps.json
 * into the LightsProduct content type with proper relationships.
 *
 * Usage: node scripts/import-harley-davidson-lights.js
 */

const API_URL = 'http://localhost:1338/api';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';
const DATA_FILE = path.join(__dirname, 'liste_affectation', 'osram-moto-lamps.json');
const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds
const TARGET_BRAND_SLUG = 'harley-davidson';

// Helper function to make API requests
async function makeRequest(endpoint, method = 'GET', data = null) {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
      ...(data && { data })
    };

    if (API_TOKEN) {
      config.headers['Authorization'] = `Bearer ${API_TOKEN}`;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// Helper function to create delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function importLightsProducts() {
  try {
    console.log('🚀 Starting Import of Harley Davidson Motorcycle Lights Products\n');
    console.log('═══════════════════════════════════════════════\n');

    // Load data
    console.log('📦 Loading OSRAM moto lights data...');
    if (!fs.existsSync(DATA_FILE)) {
      throw new Error(`Data file not found: ${DATA_FILE}`);
    }
    const osramData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log(`✅ Loaded ${osramData.length} total entries\n`);

    // Filter only Harley Davidson entries
    console.log(`🔍 Filtering entries for brand: ${TARGET_BRAND_SLUG}...`);
    const harleyData = osramData.filter(item => 
      item.brandSlug === TARGET_BRAND_SLUG
    );
    console.log(`✅ Found ${harleyData.length} Harley Davidson entries\n`);

    if (harleyData.length === 0) {
      console.log('⚠️  No Harley Davidson entries found in the data file');
      return;
    }

    // First, get the Harley Davidson brand to get its ID
    console.log(`🔍 Fetching Harley Davidson brand...`);
    const brandResponse = await makeRequest(`/brands?filters[slug][$eq]=${TARGET_BRAND_SLUG}&filters[vehicle_type][$eq]=moto`);
    const brands = Array.isArray(brandResponse) ? brandResponse : (brandResponse.data || []);
    
    if (brands.length === 0) {
      throw new Error(`Brand not found: ${TARGET_BRAND_SLUG}`);
    }
    
    const harleyBrand = brands[0];
    const harleyBrandId = harleyBrand.id;
    console.log(`✅ Found brand: ${harleyBrand.name} (ID: ${harleyBrandId})\n`);

    // Fetch Harley Davidson models directly using the working query
    console.log(`🔍 Fetching Harley Davidson models...`);
    const modelsResponse = await makeRequest(
      `/models?pagination[limit]=20000&populate=brand&filters[brand][slug][$eq]=${TARGET_BRAND_SLUG}`
    );
    const models = Array.isArray(modelsResponse) ? modelsResponse : (modelsResponse.data || []);
    console.log(`✅ Loaded ${models.length} Harley Davidson models\n`);

    // Create cache maps - all models returned are Harley Davidson
    const modelCache = new Map();
    models.forEach(model => {
      if (model.slug) {
        const key = `${TARGET_BRAND_SLUG}::${model.slug}`;
        // Ensure brand object is properly set
        if (!model.brand || (typeof model.brand === 'object' && !model.brand.id)) {
          model.brand = harleyBrand;
        }
        modelCache.set(key, model);
      }
    });

    console.log(`📦 Model cache built with ${modelCache.size} Harley Davidson entries\n`);

    // Check for existing lights products to avoid duplicates
    console.log('🔍 Checking for existing Harley Davidson lights products...');
    const existingResponse = await makeRequest(
      `/lights-products?filters[source][$eq]=OSRAM Motorcycle Guide PDF&filters[brand][slug][$eq]=${TARGET_BRAND_SLUG}&pagination[limit]=10000`
    );
    const existingProducts = Array.isArray(existingResponse) ? existingResponse : (existingResponse.data || []);
    console.log(`✅ Found ${existingProducts.length} existing Harley Davidson lights products\n`);

    // Create a set of existing product keys for duplicate checking
    const existingProductKeys = new Set();
    existingProducts.forEach(product => {
      if (product.model && product.brand) {
        const modelId = typeof product.model === 'object' ? product.model.id : product.model;
        const brandId = typeof product.brand === 'object' ? product.brand.id : product.brand;
        const key = `${brandId}::${modelId}::OSRAM Motorcycle Guide PDF`;
        existingProductKeys.add(key);
      }
    });

    // Import counters
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    let batchCount = 0;

    console.log('📝 Importing lights products...\n');

    // Process in batches
    for (let i = 0; i < harleyData.length; i += BATCH_SIZE) {
      const batch = harleyData.slice(i, Math.min(i + BATCH_SIZE, harleyData.length));
      batchCount++;

      console.log(`📦 Processing batch ${batchCount} (entries ${i + 1}-${Math.min(i + BATCH_SIZE, harleyData.length)})...`);

      for (const item of batch) {
        try {
          // Skip invalid entries
          if (!item.brandSlug || !item.modelSlug || item.brandSlug !== TARGET_BRAND_SLUG) {
            skipped++;
            continue;
          }

          // Find model in cache
          const modelKey = `${item.brandSlug}::${item.modelSlug}`;
          const model = modelCache.get(modelKey);

          if (!model) {
            console.log(`  ⚠️  Model not found: ${item.brandSlug}/${item.modelSlug}`);
            skipped++;
            continue;
          }

          // Extract brand ID - use harleyBrandId as fallback
          let brandId = harleyBrandId;
          if (model.brand) {
            if (typeof model.brand === 'object' && model.brand.id) {
              brandId = model.brand.id;
            } else if (typeof model.brand === 'number') {
              brandId = model.brand;
            }
          }

          // Check for duplicates
          const duplicateKey = `${brandId}::${model.id}::OSRAM Motorcycle Guide PDF`;
          if (existingProductKeys.has(duplicateKey)) {
            console.log(`  ⏭️  Duplicate product skipped: ${item.originalBrand} ${item.originalModel}`);
            skipped++;
            continue;
          }

          // Extract light positions
          const lightPositions = [];
          if (item.lightType) {
            Object.values(item.lightType).forEach(pos => {
              if (pos && pos.ref && pos.position && pos.category) {
                lightPositions.push({
                  ref: pos.ref,
                  position: pos.position,
                  category: pos.category
                });
              }
            });
          }

          if (lightPositions.length === 0) {
            console.log(`  ⚠️  No valid light positions for ${item.brandSlug}/${item.modelSlug}`);
            skipped++;
            continue;
          }

          // Get first position ref for product name
          const firstRef = lightPositions[0].ref;

          // Create product name
          const productName = `${item.originalBrand} ${item.originalModel} - ${item.typeConception || 'Standard'}`;

          // Create lights product
          await makeRequest('/lights-products', 'POST', {
            data: {
              name: productName,
              ref: firstRef,
              brand: {
                connect: [brandId]
              },
              model: {
                connect: [model.id]
              },
              lightPositions: lightPositions,
              constructionYearStart: item.constructionYear?.start || '',
              constructionYearEnd: item.constructionYear?.end || '',
              typeConception: item.typeConception || 'Standard',
              partNumber: item.partNumber || '',
              notes: item.notes || '',
              source: 'OSRAM Motorcycle Guide PDF',
              category: item.category || 'multiple',
              isActive: true
            }
          });

          // Add to existing keys to avoid duplicates in the same batch
          existingProductKeys.add(duplicateKey);
          imported++;

        } catch (error) {
          errors++;
          console.error(`  ❌ Error importing entry ${item.id}:`, error.message);
        }
      }

      // Progress update
      console.log(`  ✅ Batch ${batchCount} complete (Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors})\n`);

      // Delay between batches
      if (i + BATCH_SIZE < harleyData.length) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...\n`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    console.log('═══════════════════════════════════════════════');
    console.log('📊 Import Summary:\n');
    console.log(`  Total Harley Davidson entries: ${harleyData.length}`);
    console.log(`  ✅ Successfully imported: ${imported}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log('═══════════════════════════════════════════════\n');

    if (imported > 0) {
      console.log('✅ Import completed successfully!');
      console.log(`   ${imported} Harley Davidson lights products have been added to the database\n`);
    } else {
      console.log('⚠️  No products were imported');
      console.log('   Check the log messages above for details\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the import
importLightsProducts();
