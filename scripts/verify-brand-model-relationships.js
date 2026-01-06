/**
 * Verify Brand-Model Relationships
 *
 * Verifies that brand-model relationships are correctly established
 * after running the fix script
 *
 * Usage: Copy and paste this ENTIRE script into Strapi console
 */

(async () => {
  console.log('🔍 Verifying Brand-Model Relationships');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // ============ STEP 1: COUNT TOTAL MODELS ============
    console.log('📊 Counting total models...');

    const totalCount = await strapi.db.query('api::model.model').count();
    console.log(`Total models in database: ${totalCount}\n`);

    // ============ STEP 2: FIND MODELS WITHOUT BRAND ============
    console.log('🔎 Checking models without brand relationship...\n');

    let page = 1;
    const pageSize = 100;
    let processedCount = 0;
    const modelsWithoutBrand = [];
    const modelsByVehicleType = {
      car: 0,
      moto: 0,
      'car-moto': 0,
      unknown: 0
    };

    while (processedCount < totalCount) {
      const models = await strapi.entityService.findMany(
        'api::model.model',
        {
          populate: {
            brand: { fields: ['id', 'name', 'slug'] }
          },
          pagination: { page, pageSize },
          fields: ['id', 'documentId', 'name', 'slug', 'vehicle_type']
        }
      );

      if (models.length === 0) break;

      // Check each model
      for (const model of models) {
        if (!model.brand || !model.brand.id) {
          modelsWithoutBrand.push({
            id: model.id,
            documentId: model.documentId,
            name: model.name,
            slug: model.slug,
            vehicle_type: model.vehicle_type
          });

          // Count by vehicle type
          const type = model.vehicle_type || 'unknown';
          if (modelsByVehicleType.hasOwnProperty(type)) {
            modelsByVehicleType[type]++;
          } else {
            modelsByVehicleType.unknown++;
          }
        }
      }

      processedCount += models.length;
      page++;

      // Progress update
      if (processedCount % 1000 === 0 || processedCount === totalCount) {
        console.log(`Progress: ${processedCount}/${totalCount} models checked...`);
      }
    }

    // ============ STEP 3: BASIC STATISTICS ============
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 Basic Statistics:\n');
    console.log(`  Total models checked: ${processedCount}`);
    console.log(`  Models without brand: ${modelsWithoutBrand.length}`);
    console.log(`  Models with brand: ${processedCount - modelsWithoutBrand.length}`);
    console.log(`  Coverage: ${((processedCount - modelsWithoutBrand.length) / processedCount * 100).toFixed(1)}%\n`);

    // ============ STEP 4: BREAKDOWN BY VEHICLE TYPE ============
    console.log('📈 Models Without Brand by Vehicle Type:\n');
    Object.entries(modelsByVehicleType).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`  ${type}: ${count} models`);
      }
    });
    console.log();

    // ============ STEP 5: RESULT ============
    if (modelsWithoutBrand.length === 0) {
      console.log('✅ VERIFICATION PASSED');
      console.log('   All models have brand relationships!\n');
    } else {
      console.log('⚠️ VERIFICATION INCOMPLETE');
      console.log(`   ${modelsWithoutBrand.length} models still without brand\n`);

      // Show sample of models without brand
      console.log('📋 Sample Models Without Brand (first 20):\n');
      modelsWithoutBrand.slice(0, 20).forEach((model, i) => {
        console.log(`  ${i + 1}. ID: ${model.id} | ${model.name}`);
        console.log(`     Slug: ${model.slug}`);
        console.log(`     Type: ${model.vehicle_type || 'not set'}`);
        console.log();
      });

      if (modelsWithoutBrand.length > 20) {
        console.log(`  ... and ${modelsWithoutBrand.length - 20} more models\n`);
      }

      // Export remaining models
      const fs = require('fs');
      const path = require('path');
      const exportPath = path.join(process.cwd(), 'scripts', 'remaining-models-without-brand.json');

      fs.writeFileSync(exportPath, JSON.stringify(modelsWithoutBrand, null, 2));
      console.log(`📁 Full list exported to: ${exportPath}\n`);
    }

    console.log('═══════════════════════════════════════════════\n');

    // ============ STEP 6: BRAND DISTRIBUTION ANALYSIS ============
    console.log('📊 Brand Distribution Analysis:\n');

    // Count models per brand
    page = 1;
    processedCount = 0;
    const brandCounts = new Map();

    while (processedCount < totalCount) {
      const models = await strapi.entityService.findMany(
        'api::model.model',
        {
          populate: {
            brand: { fields: ['id', 'name', 'slug'] }
          },
          pagination: { page, pageSize: 200 },
          fields: ['id']
        }
      );

      if (models.length === 0) break;

      models.forEach(model => {
        if (model.brand && model.brand.name) {
          brandCounts.set(model.brand.name, (brandCounts.get(model.brand.name) || 0) + 1);
        }
      });

      processedCount += models.length;
      page++;
    }

    console.log('Top 20 Brands by Model Count:\n');
    const sortedBrands = [...brandCounts.entries()].sort((a, b) => b[1] - a[1]);
    sortedBrands.slice(0, 20).forEach(([brand, count], i) => {
      console.log(`  ${i + 1}. ${brand}: ${count} models`);
    });

    if (sortedBrands.length > 20) {
      console.log(`  ... and ${sortedBrands.length - 20} more brands`);
    }
    console.log();

    console.log('═══════════════════════════════════════════════\n');

    // ============ STEP 7: ADDITIONAL CHECKS ============
    console.log('🔍 Additional Validation Checks:\n');

    // Count models by vehicle_type
    const carModels = await strapi.db.query('api::model.model').count({
      where: { vehicle_type: 'car' }
    });

    const motoModels = await strapi.db.query('api::model.model').count({
      where: { vehicle_type: 'moto' }
    });

    const carMotoModels = await strapi.db.query('api::model.model').count({
      where: { vehicle_type: 'car-moto' }
    });

    const noTypeModels = await strapi.db.query('api::model.model').count({
      where: { vehicle_type: null }
    });

    console.log(`  Car models: ${carModels}`);
    console.log(`  Moto models: ${motoModels}`);
    console.log(`  Car-Moto models: ${carMotoModels}`);
    console.log(`  Models without type: ${noTypeModels}`);
    console.log();

    // Check for duplicate brand relationships
    console.log('🔗 Checking for duplicate brand relationships...');
    page = 1;
    processedCount = 0;
    const duplicates = [];

    while (processedCount < totalCount) {
      const models = await strapi.entityService.findMany(
        'api::model.model',
        {
          populate: {
            brand: { fields: ['id', 'name'] }
          },
          pagination: { page, pageSize: 200 },
          fields: ['id', 'name', 'slug']
        }
      );

      if (models.length === 0) break;

      // This is a basic check - in Strapi v5, a model should only have one brand
      // If we find any anomalies, report them
      models.forEach(model => {
        if (model.brand && Array.isArray(model.brand)) {
          duplicates.push({
            id: model.id,
            name: model.name,
            brands: model.brand.map(b => b.name)
          });
        }
      });

      processedCount += models.length;
      page++;
    }

    if (duplicates.length === 0) {
      console.log('✅ No duplicate brand relationships found\n');
    } else {
      console.log(`⚠️ Found ${duplicates.length} models with multiple brands:\n`);
      duplicates.slice(0, 10).forEach((dup, i) => {
        console.log(`  ${i + 1}. Model ${dup.id}: ${dup.name}`);
        console.log(`     Brands: ${dup.brands.join(', ')}\n`);
      });
    }

    console.log('═══════════════════════════════════════════════\n');

    // ============ STEP 8: FINAL VERDICT ============
    const allChecksPass = modelsWithoutBrand.length === 0 && duplicates.length === 0;

    if (allChecksPass) {
      console.log('🎉 ALL CHECKS PASSED!');
      console.log('   Brand-model relationships are correctly established.\n');
    } else {
      console.log('⚠️ ISSUES FOUND - Review the results above.\n');

      if (modelsWithoutBrand.length > 0) {
        console.log(`   - ${modelsWithoutBrand.length} models still without brand`);
      }

      if (duplicates.length > 0) {
        console.log(`   - ${duplicates.length} models with duplicate brands`);
      }

      console.log('\n💡 Next Steps:');
      console.log('   1. Review the exported JSON file for unmatched models');
      console.log('   2. Consider running the fix script again with updated mappings');
      console.log('   3. Manually fix remaining models if needed\n');
    }

    console.log('═══════════════════════════════════════════════\n');
    console.log('✅ Verification complete!\n');

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
  }
})();
