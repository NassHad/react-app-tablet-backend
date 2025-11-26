// Clear All Battery Models Script for Strapi Console
// Copy and paste this entire script into the Strapi console

async function clearAllBatteryModels() {
  try {
    console.log('🗑️  Starting to clear all battery models...');
    
    // First, get all battery models
    const allModels = await strapi.entityService.findMany('api::battery-model.battery-model', {
      filters: {},
      limit: -1 // Get all records
    });
    
    console.log(`📊 Found ${allModels.length} battery models to delete`);
    
    if (allModels.length === 0) {
      console.log('✅ No battery models found. Nothing to clear.');
      return;
    }
    
    let deletedCount = 0;
    let errorCount = 0;
    
    // Delete each model
    for (const model of allModels) {
      try {
        await strapi.entityService.delete('api::battery-model.battery-model', model.id);
        console.log(`✅ Deleted model: ${model.name} (ID: ${model.id})`);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Error deleting model "${model.name}" (ID: ${model.id}):`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Clear Summary:');
    console.log(`✅ Deleted: ${deletedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${allModels.length}`);
    
    console.log('\n🎉 Battery models clearing completed!');
    
  } catch (error) {
    console.error('💥 Fatal error during clearing:', error);
  }
}

// Run the clear function
clearAllBatteryModels();
