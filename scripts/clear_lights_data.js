// Clear All Lights Data Script for Strapi Console
// Copy and paste this ENTIRE script into your Strapi console

(async () => {
  console.log('🧹 Starting to clear all lights data...');

  try {
    // Step 1: Clear Light Position Data (most specific data)
    console.log('📝 Step 1: Clearing light position data...');
    const lightDataCount = await strapi.entityService.count('api::light-position-data.light-position-data');
    console.log(`Found ${lightDataCount} light position data entries`);

    if (lightDataCount > 0) {
      const allLightData = await strapi.entityService.findMany('api::light-position-data.light-position-data', {
        pagination: { pageSize: 1000 }
      });

      let deletedCount = 0;
      for (const item of allLightData) {
        try {
          await strapi.entityService.delete('api::light-position-data.light-position-data', item.id);
          deletedCount++;
          if (deletedCount % 100 === 0) {
            console.log(`🗑️ Deleted ${deletedCount} light data entries...`);
          }
        } catch (error) {
          console.error(`❌ Error deleting light data ${item.id}:`, error.message);
        }
      }
      console.log(`✅ Deleted ${deletedCount} light position data entries`);
    }

    // Step 2: Clear Lights Positions
    console.log('📝 Step 2: Clearing lights positions...');
    const positionCount = await strapi.entityService.count('api::lights-position.lights-position');
    console.log(`Found ${positionCount} lights position entries`);

    if (positionCount > 0) {
      const allPositions = await strapi.entityService.findMany('api::lights-position.lights-position', {
        pagination: { pageSize: 1000 }
      });

      let deletedCount = 0;
      for (const item of allPositions) {
        try {
          await strapi.entityService.delete('api::lights-position.lights-position', item.id);
          deletedCount++;
          console.log(`🗑️ Deleted position: ${item.name}`);
        } catch (error) {
          console.error(`❌ Error deleting position ${item.name}:`, error.message);
        }
      }
      console.log(`✅ Deleted ${deletedCount} lights position entries`);
    }

    // Step 3: Clear Lights Models
    console.log('📝 Step 3: Clearing lights models...');
    const modelCount = await strapi.entityService.count('api::lights-model.lights-model');
    console.log(`Found ${modelCount} lights model entries`);

    if (modelCount > 0) {
      const allModels = await strapi.entityService.findMany('api::lights-model.lights-model', {
        pagination: { pageSize: 1000 }
      });

      let deletedCount = 0;
      for (const item of allModels) {
        try {
          await strapi.entityService.delete('api::lights-model.lights-model', item.id);
          deletedCount++;
          if (deletedCount % 100 === 0) {
            console.log(`🗑️ Deleted ${deletedCount} model entries...`);
          }
        } catch (error) {
          console.error(`❌ Error deleting model ${item.name}:`, error.message);
        }
      }
      console.log(`✅ Deleted ${deletedCount} lights model entries`);
    }

    // Step 4: Clear Lights Brands
    console.log('📝 Step 4: Clearing lights brands...');
    const brandCount = await strapi.entityService.count('api::lights-brand.lights-brand');
    console.log(`Found ${brandCount} lights brand entries`);

    if (brandCount > 0) {
      const allBrands = await strapi.entityService.findMany('api::lights-brand.lights-brand', {
        pagination: { pageSize: 1000 }
      });

      let deletedCount = 0;
      for (const item of allBrands) {
        try {
          await strapi.entityService.delete('api::lights-brand.lights-brand', item.id);
          deletedCount++;
          console.log(`🗑️ Deleted brand: ${item.name}`);
        } catch (error) {
          console.error(`❌ Error deleting brand ${item.name}:`, error.message);
        }
      }
      console.log(`✅ Deleted ${deletedCount} lights brand entries`);
    }

    // Final summary
    console.log('');
    console.log('🎉 Clear Complete!');
    console.log('📊 Final Summary:');
    console.log(`- Light Position Data: Cleared`);
    console.log(`- Lights Positions: Cleared`);
    console.log(`- Lights Models: Cleared`);
    console.log(`- Lights Brands: Cleared`);
    console.log('');
    console.log('✅ All lights data has been cleared!');
    console.log('🔧 Content type entities are still intact and ready for new data.');

  } catch (error) {
    console.error('❌ Clear operation failed:', error.message);
  }
})();
