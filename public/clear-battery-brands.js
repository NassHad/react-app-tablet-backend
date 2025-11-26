// Clear All Battery Brands Script for Strapi Console
// Copy and paste this entire script into the Strapi console

async function clearAllBatteryBrands() {
  try {
    console.log('🗑️  Starting to clear all battery brands...');
    
    // First, get all battery brands
    const allBrands = await strapi.entityService.findMany('api::battery-brand.battery-brand', {
      filters: {},
      limit: -1 // Get all records
    });
    
    console.log(`📊 Found ${allBrands.length} battery brands to delete`);
    
    if (allBrands.length === 0) {
      console.log('✅ No battery brands found. Nothing to clear.');
      return;
    }
    
    let deletedCount = 0;
    let errorCount = 0;
    
    // Delete each brand
    for (const brand of allBrands) {
      try {
        await strapi.entityService.delete('api::battery-brand.battery-brand', brand.id);
        console.log(`✅ Deleted brand: ${brand.name} (ID: ${brand.id})`);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Error deleting brand "${brand.name}" (ID: ${brand.id}):`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Clear Summary:');
    console.log(`✅ Deleted: ${deletedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${allBrands.length}`);
    
    console.log('\n🎉 Battery brands clearing completed!');
    
  } catch (error) {
    console.error('💥 Fatal error during clearing:', error);
  }
}

// Run the clear function
clearAllBatteryBrands();
