// Clear all LightsProduct records
// Copy and paste this ENTIRE script into your Strapi console

(async () => {
  try {
    console.log('🗑️ Clearing all LightsProduct records...');
    
    // Get all existing lights products
    const existingProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
      populate: {
        brand: true,
        model: true
      }
    });
    
    console.log(`📊 Found ${existingProducts.length} existing LightsProduct records`);
    
    if (existingProducts.length === 0) {
      console.log('✅ No records to clear');
      return;
    }
    
    let deletedCount = 0;
    let errorCount = 0;
    
    // Delete all products
    for (const product of existingProducts) {
      try {
        await strapi.entityService.delete('api::lights-product.lights-product', product.id);
        deletedCount++;
        
        // Log progress every 100 deletions
        if (deletedCount % 100 === 0) {
          console.log(`📊 Deleted ${deletedCount} products...`);
        }
        
      } catch (error) {
        console.error(`❌ Error deleting product ${product.id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n🎉 Clear complete!');
    console.log('📊 Summary:');
    console.log(`- Products deleted: ${deletedCount}`);
    console.log(`- Errors: ${errorCount}`);
    
    // Verify the clear
    const remainingProducts = await strapi.entityService.findMany('api::lights-product.lights-product');
    console.log(`📊 Remaining products: ${remainingProducts.length}`);
    
    if (remainingProducts.length === 0) {
      console.log('✅ All LightsProduct records cleared successfully!');
    } else {
      console.log('⚠️ Some products may still remain');
    }
    
  } catch (error) {
    console.error('❌ Clear failed:', error);
  }
})();
