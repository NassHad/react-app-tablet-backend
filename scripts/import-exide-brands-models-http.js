// Import Exide brands and models to Strapi via HTTP API
// Works while Strapi is running
// Usage: node scripts/import-exide-brands-models-http.js
// Flags:
//   --test: Import only first 5 brands for testing
//   --verify: Only verify counts, don't import

const fs = require("fs");
const path = require("path");
const http = require("http");

// Slugification function (consistent with existing scripts)
function slugify(str) {
  return String(str)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

const STRAPI_URL = process.env.STRAPI_URL || 'http://0.0.0.0:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Check command-line flags
const TEST_MODE = process.argv.includes('--test');
const VERIFY_MODE = process.argv.includes('--verify');

// Path to JSON file
const dataPath = path.join(process.cwd(), "scripts", "liste_affectation", "exide-vehicles-by-brand.json");

function makeRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${STRAPI_URL}/api${endpoint}`);

    const options = {
      hostname: url.hostname,
      port: url.port || 1338,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
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
            reject(new Error(`HTTP ${res.statusCode}: ${parsedData.error?.message || responseData}`));
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

async function verifyDatabase() {
  console.log("\n📊 Database Verification\n");

  try {
    const brandsResponse = await makeRequest('/brands?pagination[limit]=1');
    const brandCount = brandsResponse.meta?.pagination?.total || 0;
    console.log(`✅ Brands in database: ${brandCount}`);

    const modelsResponse = await makeRequest('/models?pagination[limit]=1');
    const modelCount = modelsResponse.meta?.pagination?.total || 0;
    console.log(`✅ Models in database: ${modelCount}`);

    console.log('\n✅ Verification complete');
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
  }
}

async function importBrands(brandsData) {
  console.log("\n--- Phase 1: Importing Brands ---\n");

  const brandNames = Object.keys(brandsData);
  const totalBrands = TEST_MODE ? Math.min(5, brandNames.length) : brandNames.length;
  const brandsToProcess = brandNames.slice(0, totalBrands);

  console.log(`📊 Found ${brandNames.length} brands in file`);
  if (TEST_MODE) {
    console.log(`🧪 TEST MODE: Processing only first ${totalBrands} brands`);
  }

  // Fetch existing brands to build slug->ID map
  console.log('📥 Fetching existing brands from database...');
  const brandSlugToIdMap = new Map();

  try {
    const allBrands = await makeRequest('/brands?pagination[limit]=1000');
    if (allBrands.data) {
      for (const brand of allBrands.data) {
        brandSlugToIdMap.set(brand.slug, brand.id);
      }
      console.log(`   Found ${brandSlugToIdMap.size} existing brands\n`);
    }
  } catch (err) {
    console.log(`   ⚠️  Could not fetch existing brands: ${err.message}`);
    console.log(`   Will check each brand individually...\n`);
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < brandsToProcess.length; i++) {
    const brandName = brandsToProcess[i];
    const brandSlug = slugify(brandName);

    try {
      if (brandSlugToIdMap.has(brandSlug)) {
        skipped++;
        console.log(`⏭️  Skipped brand: ${brandName} (${brandSlug}) - already exists`);
      } else {
        // Create new brand
        const response = await makeRequest('/brands', 'POST', {
          data: {
            name: brandName,
            slug: brandSlug,
            isActive: true
          }
        });

        if (response.data && response.data.id) {
          brandSlugToIdMap.set(brandSlug, response.data.id);
          created++;
          console.log(`✅ Created brand: ${brandName} (${brandSlug})`);
        }
      }

      // Progress logging every 10 brands
      if ((i + 1) % 10 === 0) {
        console.log(`📊 Progress: ${i + 1}/${totalBrands} brands processed...`);
      }

    } catch (err) {
      console.error(`❌ Error processing brand "${brandName}":`, err.message);
      errors++;
    }
  }

  console.log(`\n📈 Brand Import Summary:`);
  console.log(`   ✅ Created: ${created} brands`);
  console.log(`   ⏭️  Skipped: ${skipped} brands (already existed)`);
  console.log(`   ❌ Failed: ${errors} brands`);

  return { created, skipped, errors, brandSlugToIdMap };
}

async function importModels(brandsData, brandSlugToIdMap) {
  console.log("\n--- Phase 2: Importing Models ---\n");

  const brandNames = Object.keys(brandsData);
  const totalBrands = TEST_MODE ? Math.min(5, brandNames.length) : brandNames.length;
  const brandsToProcess = brandNames.slice(0, totalBrands);

  // Count total models
  let totalModels = 0;
  for (const brandName of brandsToProcess) {
    totalModels += brandsData[brandName].length;
  }

  console.log(`📊 Found ${totalModels} models across ${totalBrands} brands`);

  // Fetch existing models to check duplicates
  console.log('📥 Fetching existing models from database...');
  const existingModelSlugs = new Set();

  try {
    const allModels = await makeRequest('/models?pagination[limit]=10000');
    if (allModels.data) {
      for (const model of allModels.data) {
        existingModelSlugs.add(model.slug);
      }
      console.log(`   Found ${existingModelSlugs.size} existing models\n`);
    }
  } catch (err) {
    console.log(`   ⚠️  Could not fetch existing models: ${err.message}`);
    console.log(`   Proceeding with import (will check individually)...\n`);
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;
  let processedCount = 0;

  for (const brandName of brandsToProcess) {
    const brandSlug = slugify(brandName);
    const brandId = brandSlugToIdMap.get(brandSlug);

    if (!brandId) {
      console.log(`⚠️  Brand ID not found for "${brandName}" (${brandSlug}), skipping ${brandsData[brandName].length} models`);
      errors += brandsData[brandName].length;
      continue;
    }

    const models = brandsData[brandName];

    for (const modelName of models) {
      const modelSlug = slugify(modelName);

      try {
        if (existingModelSlugs.has(modelSlug)) {
          skipped++;
        } else {
          // Create new model
          const response = await makeRequest('/models', 'POST', {
            data: {
              name: modelName,
              slug: modelSlug,
              brand: brandId,
              isActive: true
            }
          });

          if (response.data) {
            existingModelSlugs.add(modelSlug);
            created++;
          }
        }

        processedCount++;

        // Progress logging every 100 models
        if (processedCount % 100 === 0) {
          console.log(`📊 Progress: ${processedCount}/${totalModels} models processed...`);
        }

      } catch (err) {
        console.error(`❌ Error processing model "${modelName}" → ${brandName}:`, err.message);
        errors++;
      }
    }
  }

  console.log(`\n📈 Model Import Summary:`);
  console.log(`   ✅ Created: ${created} models`);
  console.log(`   ⏭️  Skipped: ${skipped} models (already existed)`);
  console.log(`   ❌ Failed: ${errors} models`);

  return { created, skipped, errors };
}

async function main() {
  console.log('🚀 Starting Exide brands and models import...');
  console.log(`📁 Reading: ${dataPath}\n`);

  // Check if file exists
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ Data file not found: ${dataPath}`);
    process.exit(1);
  }

  // Load JSON data
  const brandsData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const totalBrands = Object.keys(brandsData).length;
  const totalModels = Object.values(brandsData).reduce((sum, models) => sum + models.length, 0);

  console.log(`📊 Found ${totalBrands} brands with ${totalModels} models in file\n`);
  console.log(`🌐 Connecting to Strapi at: ${STRAPI_URL}\n`);

  try {
    if (VERIFY_MODE) {
      await verifyDatabase();
      return;
    }

    // Phase 1: Import brands
    const brandStats = await importBrands(brandsData);

    // Phase 2: Import models
    const modelStats = await importModels(brandsData, brandStats.brandSlugToIdMap);

    // Summary
    console.log('\n🎉 Import completed successfully!\n');
    console.log('📊 Final Summary:');
    console.log(`   Brands - Created: ${brandStats.created}, Skipped: ${brandStats.skipped}, Failed: ${brandStats.errors}`);
    console.log(`   Models - Created: ${modelStats.created}, Skipped: ${modelStats.skipped}, Failed: ${modelStats.errors}`);

    if (TEST_MODE) {
      console.log('\n💡 Test mode completed - run without --test flag to import all data');
    }

  } catch (err) {
    console.error("\n❌ Import error:", err);
    console.error(err.stack);
    process.exitCode = 1;
  }
}

main();
