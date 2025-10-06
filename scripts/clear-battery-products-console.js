// Console-friendly script to clear all battery products
// Run this in Strapi console: npx strapi console

async function clearBatteryProducts() {
  try {
    console.log('🗑️  Starting to clear all battery products...');
    
    // Get all battery products
    const batteryProducts = await strapi.entityService.findMany('api::battery-product.battery-product', {
      filters: {}
    });
    
    console.log(`📊 Found ${batteryProducts.length} battery products to delete`);
    
    if (batteryProducts.length === 0) {
      console.log('✅ No battery products found to delete');
      return;
    }
    
    let deletedCount = 0;
    let errorCount = 0;
    
    // Delete each battery product
    for (const product of batteryProducts) {
      try {
        await strapi.entityService.delete('api::battery-product.battery-product', product.id);
        console.log(`✅ Deleted battery product: ${product.name} (ID: ${product.id})`);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Error deleting battery product "${product.name}":`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Deletion Summary:');
    console.log(`✅ Deleted: ${deletedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${batteryProducts.length}`);
    
    console.log('\n🎉 Battery products clearing completed!');
    console.log('💡 You can now run the import script to import the updated data');
    
  } catch (error) {
    console.error('💥 Fatal error during clearing:', error);
  }
}

// Export the function for console use
module.exports = { clearBatteryProducts };
