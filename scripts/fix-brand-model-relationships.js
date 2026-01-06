/**
 * Fix Brand-Model Relationships
 *
 * Links models without brand relationships to their correct brands
 * using cleaned_models.json as the source of truth
 *
 * Usage: Copy and paste this ENTIRE script into Strapi console
 */

(async () => {
  const fs = require('fs');
  const path = require('path');

  // ============ CONFIGURATION ============
  const DRY_RUN = true;  // Set to false to actually update
  const BATCH_SIZE = 100;
  const DELAY_MS = 100;

  console.log('🔧 Fix Brand-Model Relationships');
  console.log('═══════════════════════════════════════════════\n');
  console.log(`Mode: ${DRY_RUN ? '🧪 DRY-RUN' : '⚡ LIVE UPDATE'}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Delay: ${DELAY_MS}ms\n`);

  try {
    // ============ STEP 1: LOAD SOURCE OF TRUTH ============
    console.log('📦 Loading cleaned_models.json...');
    const cleanedModelsPath = path.join(process.cwd(), 'scripts', 'json_data', 'cleaned_models.json');

    if (!fs.existsSync(cleanedModelsPath)) {
      console.error(`❌ File not found: ${cleanedModelsPath}\n`);
      return;
    }

    const cleanedModels = JSON.parse(fs.readFileSync(cleanedModelsPath, 'utf8'));
    console.log(`✅ Loaded ${cleanedModels.length} models from cleaned_models.json\n`);

    // ============ STEP 2: BUILD LOOKUP MAPS ============
    console.log('🔍 Building lookup maps...');

    // Map: brandSlug -> brandId
    const brandMap = new Map();
    let brandPage = 1;
    let totalBrands = 0;

    while (true) {
      const brands = await strapi.entityService.findMany('api::brand.brand', {
        fields: ['id', 'slug', 'name'],
        pagination: { page: brandPage, pageSize: 1000 }
      });

      if (brands.length === 0) break;

      brands.forEach(brand => {
        brandMap.set(brand.slug, { id: brand.id, name: brand.name });
      });

      totalBrands += brands.length;
      brandPage++;
    }

    console.log(`✅ Loaded ${totalBrands} brands from database\n`);

    // Map: modelSlug -> [models with that slug]
    const dbModelsBySlug = new Map();
    const dbModelsById = new Map();

    console.log('📊 Loading models without brands from database...');
    let modelPage = 1;
    let modelsWithoutBrand = [];

    while (true) {
      const models = await strapi.entityService.findMany('api::model.model', {
        populate: { brand: { fields: ['id'] } },
        pagination: { page: modelPage, pageSize: 1000 },
        fields: ['id', 'documentId', 'name', 'slug', 'vehicle_type']
      });

      if (models.length === 0) break;

      models.forEach(model => {
        if (!model.brand || !model.brand.id) {
          modelsWithoutBrand.push(model);

          if (!dbModelsBySlug.has(model.slug)) {
            dbModelsBySlug.set(model.slug, []);
          }
          dbModelsBySlug.get(model.slug).push(model);
          dbModelsById.set(model.id, model);
        }
      });

      modelPage++;
    }

    console.log(`✅ Found ${modelsWithoutBrand.length} models without brand\n`);

    if (modelsWithoutBrand.length === 0) {
      console.log('🎉 All models already have brands!\n');
      return;
    }

    // ============ STEP 3: BUILD MAPPING ============
    console.log('🔗 Building brand-model mappings...');

    // Map: cleanedModelSlug -> { brandSlug, modelName }
    const mappings = new Map();
    cleanedModels.forEach(cleaned => {
      mappings.set(cleaned.modelSlug, {
        brandSlug: cleaned.brandSlug,
        modelName: cleaned.name,
        vehicleType: cleaned.vehicleType
      });
    });

    console.log(`✅ Built ${mappings.size} mappings\n`);

    // ============ STEP 4: MATCH AND UPDATE ============
    console.log('🔄 Matching models to brands...\n');

    let processedCount = 0;
    let matchedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];
    const unmatchedModels = [];
    const matchStats = new Map();

    // Process in batches
    for (let i = 0; i < modelsWithoutBrand.length; i += BATCH_SIZE) {
      const batch = modelsWithoutBrand.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(modelsWithoutBrand.length / BATCH_SIZE);

      console.log(`🔧 Batch ${batchNumber}/${totalBatches} (Models ${i + 1}-${Math.min(i + BATCH_SIZE, modelsWithoutBrand.length)})`);

      for (const dbModel of batch) {
        try {
          // Try to find mapping by slug
          const mapping = mappings.get(dbModel.slug);

          if (!mapping) {
            unmatchedModels.push({
              id: dbModel.id,
              name: dbModel.name,
              slug: dbModel.slug,
              vehicle_type: dbModel.vehicle_type,
              reason: 'No mapping in cleaned_models.json'
            });
            skippedCount++;
            continue;
          }

          // Get brand ID from mapping
          const brandInfo = brandMap.get(mapping.brandSlug);

          if (!brandInfo) {
            unmatchedModels.push({
              id: dbModel.id,
              name: dbModel.name,
              slug: dbModel.slug,
              vehicle_type: dbModel.vehicle_type,
              expectedBrand: mapping.brandSlug,
              reason: 'Brand not found in database'
            });
            skippedCount++;
            continue;
          }

          matchedCount++;

          // Track match statistics
          const statKey = `${brandInfo.name} (${mapping.brandSlug})`;
          matchStats.set(statKey, (matchStats.get(statKey) || 0) + 1);

          // Update model (if not dry-run)
          if (!DRY_RUN) {
            await strapi.entityService.update(
              'api::model.model',
              dbModel.id,
              {
                data: {
                  brand: brandInfo.id
                }
              }
            );
          }

          updatedCount++;

        } catch (error) {
          errors.push({
            modelId: dbModel.id,
            modelName: dbModel.name,
            modelSlug: dbModel.slug,
            error: error.message
          });
        }
      }

      processedCount += batch.length;

      console.log(`  ✅ Processed: ${batch.length}`);
      console.log(`  🔗 Matched: ${matchedCount}`);
      console.log(`  ⏭️  Skipped: ${skippedCount}`);
      console.log(`  ❌ Errors: ${errors.length}`);

      // Delay between batches
      if (i + BATCH_SIZE < modelsWithoutBrand.length) {
        console.log(`⏳ Waiting ${DELAY_MS}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    // ============ STEP 5: SUMMARY ============
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 Final Summary:\n');
    console.log(`  Total models without brand: ${modelsWithoutBrand.length}`);
    console.log(`  Models processed: ${processedCount}`);
    console.log(`  ${DRY_RUN ? 'Would update' : 'Updated'}: ${updatedCount}`);
    console.log(`  Skipped (no match): ${skippedCount}`);
    console.log(`  Errors: ${errors.length}\n`);

    // Show brand distribution
    if (matchStats.size > 0) {
      console.log('📈 Matched Models by Brand (Top 20):\n');
      const sortedStats = [...matchStats.entries()].sort((a, b) => b[1] - a[1]);
      sortedStats.slice(0, 20).forEach(([brand, count]) => {
        console.log(`  ${brand}: ${count} models`);
      });
      if (sortedStats.length > 20) {
        console.log(`  ... and ${sortedStats.length - 20} more brands`);
      }
      console.log();
    }

    // Show errors
    if (errors.length > 0) {
      console.log('❌ Errors:\n');
      errors.slice(0, 10).forEach((err, i) => {
        console.log(`  ${i + 1}. Model ${err.modelId} (${err.modelName})`);
        console.log(`     Slug: ${err.modelSlug}`);
        console.log(`     Error: ${err.error}\n`);
      });

      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors\n`);
      }
    }

    // Export unmatched models
    if (unmatchedModels.length > 0) {
      const exportPath = path.join(process.cwd(), 'scripts', 'unmatched-models.json');
      fs.writeFileSync(exportPath, JSON.stringify(unmatchedModels, null, 2));
      console.log(`📁 Unmatched models exported to: ${exportPath}`);
      console.log(`   ${unmatchedModels.length} models could not be matched\n`);

      // Show sample unmatched
      console.log('⚠️ Sample Unmatched Models (first 10):\n');
      unmatchedModels.slice(0, 10).forEach((model, i) => {
        console.log(`  ${i + 1}. ID: ${model.id} | ${model.name}`);
        console.log(`     Slug: ${model.slug}`);
        console.log(`     Type: ${model.vehicle_type}`);
        console.log(`     Reason: ${model.reason}`);
        if (model.expectedBrand) {
          console.log(`     Expected Brand: ${model.expectedBrand}`);
        }
        console.log();
      });

      if (unmatchedModels.length > 10) {
        console.log(`  ... and ${unmatchedModels.length - 10} more unmatched models\n`);
      }
    }

    console.log('═══════════════════════════════════════════════\n');

    // Calculate match rate
    const matchRate = modelsWithoutBrand.length > 0
      ? ((matchedCount / modelsWithoutBrand.length) * 100).toFixed(1)
      : 0;

    console.log(`📊 Match Rate: ${matchRate}% (${matchedCount}/${modelsWithoutBrand.length})\n`);

    if (DRY_RUN) {
      console.log('🧪 DRY-RUN COMPLETE');
      console.log('ℹ️  No changes were made. Set DRY_RUN = false to apply updates.\n');
    } else {
      console.log('✅ UPDATE COMPLETE');
      console.log('ℹ️  Brand relationships have been established.\n');
      console.log('🔍 Run the verification script to confirm:\n');
      console.log('   Paste verify-brand-model-relationships.js script\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
  }
})();
