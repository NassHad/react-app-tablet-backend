/**
 * Check Models Without Brand
 *
 * Finds all models that don't have a brand relationship
 *
 * Usage: Copy and paste this ENTIRE script into Strapi console
 */

(async () => {
  console.log('🔍 Checking Models Without Brand');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // ============ STEP 1: COUNT TOTAL MODELS ============
    console.log('📊 Counting total models...');

    const totalCount = await strapi.db.query('api::model.model').count();
    console.log(`Total models in database: ${totalCount}\n`);

    // ============ STEP 2: FIND MODELS WITHOUT BRAND ============
    console.log('🔎 Finding models without brand relationship...\n');

    let page = 1;
    const pageSize = 100;
    let processedCount = 0;
    const modelsWithoutBrand = [];

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
        }
      }

      processedCount += models.length;
      page++;

      // Progress update
      if (processedCount % 500 === 0 || processedCount === totalCount) {
        console.log(`Progress: ${processedCount}/${totalCount} models checked...`);
      }
    }

    // ============ STEP 3: REPORT RESULTS ============
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 Results:\n');
    console.log(`  Total models checked: ${processedCount}`);
    console.log(`  Models without brand: ${modelsWithoutBrand.length}`);
    console.log(`  Models with brand: ${processedCount - modelsWithoutBrand.length}\n`);

    if (modelsWithoutBrand.length === 0) {
      console.log('✅ All models have a brand relationship!\n');
    } else {
      console.log('⚠️ Models Without Brand:\n');

      // Group by vehicle_type
      const byVehicleType = {};
      modelsWithoutBrand.forEach(model => {
        const type = model.vehicle_type || 'unknown';
        if (!byVehicleType[type]) {
          byVehicleType[type] = [];
        }
        byVehicleType[type].push(model);
      });

      // Show breakdown by vehicle type
      console.log('📈 Breakdown by Vehicle Type:\n');
      Object.entries(byVehicleType).forEach(([type, models]) => {
        console.log(`  ${type}: ${models.length} models`);
      });
      console.log();

      // Show first 50 models without brand
      console.log('📋 Sample Models (first 50):\n');
      modelsWithoutBrand.slice(0, 50).forEach((model, i) => {
        console.log(`  ${i + 1}. ID: ${model.id} | ${model.name}`);
        console.log(`     Slug: ${model.slug}`);
        console.log(`     Type: ${model.vehicle_type || 'not set'}`);
        console.log();
      });

      if (modelsWithoutBrand.length > 50) {
        console.log(`  ... and ${modelsWithoutBrand.length - 50} more models\n`);
      }

      // Export to file
      const fs = require('fs');
      const path = require('path');
      const exportPath = path.join(process.cwd(), 'scripts', 'models-without-brand.json');

      fs.writeFileSync(exportPath, JSON.stringify(modelsWithoutBrand, null, 2));
      console.log(`📁 Full list exported to: ${exportPath}\n`);
    }

    console.log('═══════════════════════════════════════════════\n');

    // ============ STEP 4: ADDITIONAL STATS ============
    console.log('📊 Additional Statistics:\n');

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

    console.log('═══════════════════════════════════════════════\n');
    console.log('✅ Check complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
})();
