const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Import OSRAM Motorcycle Lights Products
 *
 * This script imports motorcycle lights data from osram-moto-lamps.json
 * into the LightsProduct content type with proper relationships.
 *
 * Usage: node scripts/import-moto-lights-products.js
 */

const API_URL = 'http://localhost:1338/api';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';
const DATA_FILE = path.join(__dirname, 'liste_affectation', 'osram-moto-lamps.json');
const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds

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
    console.log('🚀 Starting Import of Motorcycle Lights Products\n');
    console.log('═══════════════════════════════════════════════\n');

    // Load data
    console.log('📦 Loading OSRAM moto lights data...');
    if (!fs.existsSync(DATA_FILE)) {
      throw new Error(`Data file not found: ${DATA_FILE}`);
    }
    const osramData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log(`✅ Loaded ${osramData.length} entries\n`);

    // Fetch all models and brands upfront for caching
    console.log('🔍 Fetching existing models and brands...');
    const modelsResponse = await makeRequest('/models?pagination[limit]=20000&populate=brand&filters[vehicle_type][$eq]=moto');
    const models = Array.isArray(modelsResponse) ? modelsResponse : (modelsResponse.data || []);
    console.log(`✅ Loaded ${models.length} moto models\n`);

    // Create cache maps
    const modelCache = new Map();
    models.forEach(model => {
      if (model.brand) {
        const brandSlug = typeof model.brand === 'object' ? model.brand.slug : null;
        if (brandSlug) {
          const key = `${brandSlug}::${model.slug}`;
          modelCache.set(key, model);
        }
      }
    });

    console.log(`📦 Model cache built with ${modelCache.size} entries\n`);

    // Check for existing lights products to avoid duplicates
    console.log('🔍 Checking for existing motorcycle lights products...');
    const existingResponse = await makeRequest('/lights-products?filters[source][$eq]=OSRAM Motorcycle Guide PDF&pagination[limit]=10000');
    const existingProducts = Array.isArray(existingResponse) ? existingResponse : (existingResponse.data || []);
    console.log(`✅ Found ${existingProducts.length} existing motorcycle lights products\n`);

    // Import counters
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    let batchCount = 0;

    console.log('📝 Importing lights products...\n');

    // Process in batches
    for (let i = 0; i < osramData.length; i += BATCH_SIZE) {
      const batch = osramData.slice(i, Math.min(i + BATCH_SIZE, osramData.length));
      batchCount++;

      console.log(`📦 Processing batch ${batchCount} (entries ${i + 1}-${Math.min(i + BATCH_SIZE, osramData.length)})...`);

      for (const item of batch) {
        try {
          // Skip invalid brands
          if (!item.brandSlug || !item.modelSlug ||
              item.brandSlug === 'led' || item.brandSlug === 'led-led-led-led' ||
              item.brandSlug.length < 2) {
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

          // Extract brand ID
          const brandId = typeof model.brand === 'object' ? model.brand.id : model.brand;

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

          imported++;

        } catch (error) {
          errors++;
          console.error(`  ❌ Error importing entry ${item.id}:`, error.message);
        }
      }

      // Progress update
      console.log(`  ✅ Batch ${batchCount} complete (Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors})\n`);

      // Delay between batches
      if (i + BATCH_SIZE < osramData.length) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...\n`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    console.log('═══════════════════════════════════════════════');
    console.log('📊 Import Summary:\n');
    console.log(`  Total entries processed: ${osramData.length}`);
    console.log(`  ✅ Successfully imported: ${imported}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log('═══════════════════════════════════════════════\n');

    if (imported > 0) {
      console.log('✅ Import completed successfully!');
      console.log(`   ${imported} motorcycle lights products have been added to the database\n`);
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
