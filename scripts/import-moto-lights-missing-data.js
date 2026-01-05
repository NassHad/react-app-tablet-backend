const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Import missing motorcycle brands and models for lights data
 *
 * This script creates the missing brands and models found in osram-moto-lamps.json
 * before importing the lights data.
 *
 * Usage: node scripts/import-moto-lights-missing-data.js
 */

const API_URL = 'http://localhost:1338/api';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';
const DATA_FILE = path.join(__dirname, 'liste_affectation', 'osram-moto-lamps.json');

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

async function importMissingData() {
  try {
    console.log('🚀 Starting Import of Missing Motorcycle Brands and Models\n');
    console.log('═══════════════════════════════════════════════\n');

    // Load data
    console.log('📦 Loading OSRAM moto data...');
    if (!fs.existsSync(DATA_FILE)) {
      throw new Error(`Data file not found: ${DATA_FILE}`);
    }
    const osramData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log(`✅ Loaded ${osramData.length} entries\n`);

    // Extract unique brands
    const uniqueBrandsMap = new Map();
    osramData.forEach(item => {
      if (item.brandSlug && item.originalBrand) {
        uniqueBrandsMap.set(item.brandSlug, item.originalBrand);
      }
    });
    console.log(`📊 Found ${uniqueBrandsMap.size} unique brands in data\n`);

    // Fetch existing brands
    console.log('🔍 Fetching existing brands...');
    const existingBrandsResponse = await makeRequest('/brands?pagination[limit]=1000');
    const existingBrands = Array.isArray(existingBrandsResponse)
      ? existingBrandsResponse
      : (existingBrandsResponse.data || []);

    const existingBrandSlugs = new Set(existingBrands.map(b => b.slug));
    console.log(`✅ Found ${existingBrands.length} existing brands\n`);

    // Create missing brands
    console.log('📝 Creating missing brands...\n');
    let brandsCreated = 0;
    let brandsSkipped = 0;
    const createdBrandIds = new Map();

    for (const [slug, name] of uniqueBrandsMap) {
      if (existingBrandSlugs.has(slug)) {
        brandsSkipped++;
        const existingBrand = existingBrands.find(b => b.slug === slug);
        if (existingBrand) {
          createdBrandIds.set(slug, existingBrand.id);
        }
        continue;
      }

      // Skip invalid brand slugs
      if (slug === 'led' || slug === 'led-led-led-led' || !slug || slug.length < 2) {
        console.log(`  ⚠️  Skipping invalid brand: "${slug}"`);
        brandsSkipped++;
        continue;
      }

      try {
        const response = await makeRequest('/brands', 'POST', {
          data: {
            name: name,
            slug: slug,
            vehicle_type: 'moto',
            isActive: true
          }
        });

        const brand = response.data || response;
        createdBrandIds.set(slug, brand.id);
        brandsCreated++;
        console.log(`  ✅ Created brand: ${name} (${slug})`);

        await delay(100); // Small delay to avoid overwhelming the API
      } catch (error) {
        console.error(`  ❌ Error creating brand ${name}:`, error.message);
      }
    }

    console.log(`\n📊 Brands Summary:`);
    console.log(`   Created: ${brandsCreated}`);
    console.log(`   Skipped (already exist): ${brandsSkipped}\n`);

    // Extract unique models
    const uniqueModelsMap = new Map();
    osramData.forEach(item => {
      if (item.brandSlug && item.modelSlug && item.originalBrand && item.originalModel) {
        const key = `${item.brandSlug}::${item.modelSlug}`;
        uniqueModelsMap.set(key, {
          brandSlug: item.brandSlug,
          modelSlug: item.modelSlug,
          brandName: item.originalBrand,
          modelName: item.originalModel
        });
      }
    });
    console.log(`📊 Found ${uniqueModelsMap.size} unique models in data\n`);

    // Fetch existing models
    console.log('🔍 Fetching existing models...');
    const existingModelsResponse = await makeRequest('/models?pagination[limit]=20000');
    const existingModels = Array.isArray(existingModelsResponse)
      ? existingModelsResponse
      : (existingModelsResponse.data || []);

    const existingModelSlugs = new Set(existingModels.map(m => m.slug));
    console.log(`✅ Found ${existingModels.length} existing models\n`);

    // Create missing models
    console.log('📝 Creating missing models...\n');
    let modelsCreated = 0;
    let modelsSkipped = 0;
    let modelsErrors = 0;

    for (const [key, modelData] of uniqueModelsMap) {
      if (existingModelSlugs.has(modelData.modelSlug)) {
        modelsSkipped++;
        continue;
      }

      // Skip if brand doesn't exist
      const brandId = createdBrandIds.get(modelData.brandSlug);
      if (!brandId) {
        const existingBrand = existingBrands.find(b => b.slug === modelData.brandSlug);
        if (!existingBrand) {
          console.log(`  ⚠️  Skipping model ${modelData.modelName} - brand ${modelData.brandSlug} not found`);
          modelsErrors++;
          continue;
        }
        createdBrandIds.set(modelData.brandSlug, existingBrand.id);
      }

      try {
        await makeRequest('/models', 'POST', {
          data: {
            name: modelData.modelName,
            slug: modelData.modelSlug,
            brand: {
              connect: [createdBrandIds.get(modelData.brandSlug)]
            },
            vehicle_type: 'moto',
            isActive: true
          }
        });

        modelsCreated++;

        if (modelsCreated % 10 === 0) {
          console.log(`  📊 Progress: ${modelsCreated} models created...`);
        }

        await delay(100); // Small delay to avoid overwhelming the API
      } catch (error) {
        modelsErrors++;
        console.error(`  ❌ Error creating model ${modelData.modelName}:`, error.message);
      }
    }

    console.log(`\n📊 Models Summary:`);
    console.log(`   Created: ${modelsCreated}`);
    console.log(`   Skipped (already exist): ${modelsSkipped}`);
    console.log(`   Errors: ${modelsErrors}\n`);

    console.log('═══════════════════════════════════════════════');
    console.log('✅ Import Complete!\n');
    console.log('📊 Final Summary:');
    console.log(`   Brands created: ${brandsCreated}`);
    console.log(`   Models created: ${modelsCreated}`);
    console.log('═══════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the import
importMissingData();
