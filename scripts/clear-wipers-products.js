// Script to clear all existing wipers products
// Copy and paste this entire content into Strapi console

async function clearWipersProducts() {
  try {
    console.log('🗑️  Starting wipers products cleanup...');
    
    // Get all existing wipers products
    console.log('📖 Fetching existing wipers products...');
    const existingProducts = await strapi.entityService.findMany('api::wipers-product.wipers-product', {
      populate: '*'
    });
    
    console.log(`📊 Found ${existingProducts.length} existing wipers products`);
    
    if (existingProducts.length === 0) {
      console.log('✅ No wipers products to delete');
      return;
    }
    
    // Delete all wipers products
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const product of existingProducts) {
      try {
        await strapi.entityService.delete('api::wipers-product.wipers-product', product.id);
        deletedCount++;
        
        if (deletedCount % 100 === 0) {
          console.log(`🗑️  Deleted ${deletedCount}/${existingProducts.length} products...`);
        }
      } catch (error) {
        console.error(`❌ Error deleting product ${product.id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n🎉 Wipers products cleanup completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total products found: ${existingProducts.length}`);
    console.log(`   - Successfully deleted: ${deletedCount}`);
    console.log(`   - Errors: ${errorCount}`);
    
    if (errorCount > 0) {
      console.log('⚠️  Some products could not be deleted. Check the errors above.');
    } else {
      console.log('✅ All wipers products have been successfully deleted!');
    }
    
  } catch (error) {
    console.error('💥 Cleanup failed:', error);
    throw error;
  }
}

// Run the cleanup
clearWipersProducts();
