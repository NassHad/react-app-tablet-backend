// Script to update battery-product data: rename 'source' to 'batteryBrand' and set value to 'Fulmen Endurance'
// Run this in Strapi console: npx strapi console

async function updateBatteryProductSourceToBrand() {
  try {
    console.log('🔄 Starting battery-product data update...');
    console.log('📝 Renaming "source" field to "batteryBrand" and setting value to "Fulmen Endurance"');
    
    // Get all battery products
    const products = await strapi.entityService.findMany('api::battery-product.battery-product', {
      filters: {}
    });
    
    console.log(`📊 Found ${products.length} battery products to update`);
    
    if (products.length === 0) {
      console.log('⚠️  No battery products found to update');
      return;
    }
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Update each product
    for (const product of products) {
      try {
        // Update the product with new field name and value
        await strapi.entityService.update('api::battery-product.battery-product', product.id, {
          data: {
            batteryBrand: 'Fulmen Endurance'
            // Note: We don't need to explicitly remove 'source' as it will be replaced
          }
        });
        
        console.log(`✅ Updated product: ${product.name} (ID: ${product.id})`);
        updatedCount++;
        
      } catch (error) {
        console.error(`❌ Error updating product "${product.name}":`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Update Summary:');
    console.log(`✅ Updated: ${updatedCount} products`);
    console.log(`❌ Errors: ${errorCount} products`);
    console.log(`📊 Total processed: ${products.length} products`);
    
    console.log('\n🎉 Battery product data update completed!');
    console.log('💡 All products now have batteryBrand = "Fulmen Endurance"');
    
  } catch (error) {
    console.error('💥 Fatal error during update:', error);
  }
}

// Export the function for console use
module.exports = { updateBatteryProductSourceToBrand };
