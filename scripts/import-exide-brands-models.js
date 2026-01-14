// Import Exide brands and models to Strapi
// Usage: node scripts/import-exide-brands-models.js
// Flags:
//   --test: Import only first 5 brands for testing
//   --verify: Only verify counts, don't import
//   --dry-run: Show what would be imported without actually importing

try {
  require('ts-node/register/transpile-only');
} catch (e) {
  console.error('ts-node is missing. Run: npm i -D ts-node typescript @types/node');
  process.exit(1);
}

const fs = require("fs");
const path = require("path");
const { createStrapi } = require('@strapi/strapi');

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

const BRAND_UID = "api::brand.brand";
const MODEL_UID = "api::model.model";

// Check command-line flags
const TEST_MODE = process.argv.includes('--test');
const VERIFY_MODE = process.argv.includes('--verify');
const DRY_RUN = process.argv.includes('--dry-run');

// Path to JSON file
const dataPath = path.join(process.cwd(), "scripts", "liste_affectation", "exide-vehicles-by-brand.json");

async function verifyDatabase(strapi) {
  console.log("\n📊 Database Verification\n");

  const brandCount = await strapi.entityService.count(BRAND_UID);
  console.log(`✅ Brands in database: ${brandCount}`);

  const modelCount = await strapi.entityService.count(MODEL_UID);
  console.log(`✅ Models in database: ${modelCount}`);

  // Check for brands without models
  const allBrands = await strapi.entityService.findMany(BRAND_UID, {
    limit: -1,
    populate: ['models']
  });

  const brandsWithoutModels = allBrands.filter(b => !b.models || b.models.length === 0);
  if (brandsWithoutModels.length > 0) {
    console.log(`\n⚠️  Brands without models: ${brandsWithoutModels.length}`);
    brandsWithoutModels.slice(0, 5).forEach(b => {
      console.log(`   - ${b.name} (${b.slug})`);
    });
  }

  // Check for models without brands
  const allModels = await strapi.entityService.findMany(MODEL_UID, {
    limit: -1,
    populate: ['brand']
  });

  const modelsWithoutBrand = allModels.filter(m => !m.brand);
  if (modelsWithoutBrand.length > 0) {
    console.log(`\n⚠️  Models without brand: ${modelsWithoutBrand.length}`);
    modelsWithoutBrand.slice(0, 5).forEach(m => {
      console.log(`   - ${m.name} (${m.slug})`);
    });
  }

  console.log('\n✅ Verification complete');
}

async function importBrands(strapi, brandsData) {
  console.log("\n--- Phase 1: Importing Brands ---\n");

  const brandNames = Object.keys(brandsData);
  const totalBrands = TEST_MODE ? Math.min(5, brandNames.length) : brandNames.length;
  const brandsToProcess = brandNames.slice(0, totalBrands);

  console.log(`📊 Found ${brandNames.length} brands in file`);
  if (TEST_MODE) {
    console.log(`🧪 TEST MODE: Processing only first ${totalBrands} brands`);
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;
  const brandSlugToIdMap = new Map();

  for (let i = 0; i < brandsToProcess.length; i++) {
    const brandName = brandsToProcess[i];
    const brandSlug = slugify(brandName);

    try {
      // Check if brand exists
      const existingCount = await strapi.entityService.count(BRAND_UID, {
        filters: { slug: brandSlug }
      });

      if (existingCount > 0) {
        // Brand exists - get ID for model import
        const existingBrand = await strapi.entityService.findMany(BRAND_UID, {
          filters: { slug: brandSlug },
          limit: 1
        });
        brandSlugToIdMap.set(brandSlug, existingBrand[0].id);
        skipped++;
        console.log(`⏭️  Skipped brand: ${brandName} (${brandSlug}) - already exists`);
      } else {
        // Create new brand
        if (DRY_RUN) {
          console.log(`[DRY RUN] Would create brand: ${brandName} (${brandSlug})`);
          created++;
        } else {
          const newBrand = await strapi.entityService.create(BRAND_UID, {
            data: {
              name: brandName,
              slug: brandSlug,
              isActive: true
            }
          });
          brandSlugToIdMap.set(brandSlug, newBrand.id);
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

async function importModels(strapi, brandsData, brandSlugToIdMap) {
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
        // Check if model exists
        const existingCount = await strapi.entityService.count(MODEL_UID, {
          filters: { slug: modelSlug }
        });

        if (existingCount > 0) {
          skipped++;
          // console.log(`⏭️  Skipped model: ${modelName} → ${brandName} (already exists)`);
        } else {
          // Create new model
          if (DRY_RUN) {
            // console.log(`[DRY RUN] Would create model: ${modelName} (${modelSlug}) → ${brandName}`);
            created++;
          } else {
            await strapi.entityService.create(MODEL_UID, {
              data: {
                name: modelName,
                slug: modelSlug,
                brand: brandId,
                isActive: true
              }
            });
            created++;
            // console.log(`✅ Created model: ${modelName} (${modelSlug}) → ${brandName}`);
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
    throw new Error(`Data file not found: ${dataPath}`);
  }

  // Load JSON data
  const brandsData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const totalBrands = Object.keys(brandsData).length;
  const totalModels = Object.values(brandsData).reduce((sum, models) => sum + models.length, 0);

  console.log(`📊 Found ${totalBrands} brands with ${totalModels} models in file\n`);

  // Start Strapi
  console.log('🚀 Starting Strapi instance...');
  const strapi = await createStrapi();
  await strapi.start();
  console.log('✅ Strapi started successfully!\n');

  try {
    if (VERIFY_MODE) {
      await verifyDatabase(strapi);
      return;
    }

    // Phase 1: Import brands
    const brandStats = await importBrands(strapi, brandsData);

    // Phase 2: Import models
    const modelStats = await importModels(strapi, brandsData, brandStats.brandSlugToIdMap);

    // Summary
    console.log('\n🎉 Import completed successfully!\n');
    console.log('📊 Final Summary:');
    console.log(`   Brands - Created: ${brandStats.created}, Skipped: ${brandStats.skipped}, Failed: ${brandStats.errors}`);
    console.log(`   Models - Created: ${modelStats.created}, Skipped: ${modelStats.skipped}, Failed: ${modelStats.errors}`);

    if (DRY_RUN) {
      console.log('\n💡 This was a DRY RUN - no data was actually imported');
    }

    if (TEST_MODE) {
      console.log('\n💡 Test mode completed - run without --test flag to import all data');
    }

  } catch (err) {
    console.error("\n❌ Import error:", err);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await strapi.destroy();
    console.log('\n✅ Strapi instance closed');
  }
}

main();
