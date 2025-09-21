// Bulk Clear All Lights Data Script for Strapi Console
// More efficient for large datasets - uses bulk operations
// Copy and paste this ENTIRE script into your Strapi console

(async () => {
  console.log('🧹 Starting bulk clear of all lights data...');

  try {
    // Step 1: Clear Light Position Data in batches
    console.log('📝 Step 1: Clearing light position data...');
    let totalDeleted = 0;
    let hasMore = true;
    let page = 1;
    const pageSize = 1000;

    while (hasMore) {
      const lightData = await strapi.entityService.findMany('api::light-position-data.light-position-data', {
        pagination: { page, pageSize }
      });

      if (lightData.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`🗑️ Deleting batch ${page} (${lightData.length} entries)...`);

      // Delete in parallel for better performance
      const deletePromises = lightData.map(item => 
        strapi.entityService.delete('api::light-position-data.light-position-data', item.id)
          .catch(error => {
            console.error(`❌ Error deleting light data ${item.id}:`, error.message);
            return null;
          })
      );

      await Promise.all(deletePromises);
      totalDeleted += lightData.length;
      page++;

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Deleted ${totalDeleted} light position data entries`);

    // Step 2: Clear Lights Positions
    console.log('📝 Step 2: Clearing lights positions...');
    const allPositions = await strapi.entityService.findMany('api::lights-position.lights-position', {
      pagination: { pageSize: 1000 }
    });

    console.log(`🗑️ Deleting ${allPositions.length} positions...`);
    const positionDeletePromises = allPositions.map(item => 
      strapi.entityService.delete('api::lights-position.lights-position', item.id)
        .catch(error => {
          console.error(`❌ Error deleting position ${item.name}:`, error.message);
          return null;
        })
    );

    await Promise.all(positionDeletePromises);
    console.log(`✅ Deleted ${allPositions.length} lights position entries`);

    // Step 3: Clear Lights Models
    console.log('📝 Step 3: Clearing lights models...');
    const allModels = await strapi.entityService.findMany('api::lights-model.lights-model', {
      pagination: { pageSize: 1000 }
    });

    console.log(`🗑️ Deleting ${allModels.length} models...`);
    const modelDeletePromises = allModels.map(item => 
      strapi.entityService.delete('api::lights-model.lights-model', item.id)
        .catch(error => {
          console.error(`❌ Error deleting model ${item.name}:`, error.message);
          return null;
        })
    );

    await Promise.all(modelDeletePromises);
    console.log(`✅ Deleted ${allModels.length} lights model entries`);

    // Step 4: Clear Lights Brands
    console.log('📝 Step 4: Clearing lights brands...');
    const allBrands = await strapi.entityService.findMany('api::lights-brand.lights-brand', {
      pagination: { pageSize: 1000 }
    });

    console.log(`🗑️ Deleting ${allBrands.length} brands...`);
    const brandDeletePromises = allBrands.map(item => 
      strapi.entityService.delete('api::lights-brand.lights-brand', item.id)
        .catch(error => {
          console.error(`❌ Error deleting brand ${item.name}:`, error.message);
          return null;
        })
    );

    await Promise.all(brandDeletePromises);
    console.log(`✅ Deleted ${allBrands.length} lights brand entries`);

    // Final summary
    console.log('');
    console.log('🎉 Bulk Clear Complete!');
    console.log('📊 Final Summary:');
    console.log(`- Light Position Data: ${totalDeleted} entries cleared`);
    console.log(`- Lights Positions: ${allPositions.length} entries cleared`);
    console.log(`- Lights Models: ${allModels.length} entries cleared`);
    console.log(`- Lights Brands: ${allBrands.length} entries cleared`);
    console.log('');
    console.log('✅ All lights data has been cleared!');
    console.log('🔧 Content type entities are still intact and ready for new data.');

  } catch (error) {
    console.error('❌ Bulk clear operation failed:', error.message);
  }
})();
