// Clear all LightsPosition records (since we're using grouped approach)
// Copy and paste this ENTIRE script into your Strapi console

(async () => {
  try {
    console.log('🗑️ Clearing all LightsPosition records...');
    
    // Get all existing lights positions
    const existingPositions = await strapi.entityService.findMany('api::lights-position.lights-position');
    
    console.log(`📊 Found ${existingPositions.length} existing LightsPosition records`);
    
    if (existingPositions.length === 0) {
      console.log('✅ No records to clear');
      return;
    }
    
    let deletedCount = 0;
    let errorCount = 0;
    
    // Delete all positions
    for (const position of existingPositions) {
      try {
        await strapi.entityService.delete('api::lights-position.lights-position', position.id);
        deletedCount++;
        
        // Log progress every 50 deletions
        if (deletedCount % 50 === 0) {
          console.log(`📊 Deleted ${deletedCount} positions...`);
        }
        
      } catch (error) {
        console.error(`❌ Error deleting position ${position.id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n🎉 Clear complete!');
    console.log('📊 Summary:');
    console.log(`- Positions deleted: ${deletedCount}`);
    console.log(`- Errors: ${errorCount}`);
    
    // Verify the clear
    const remainingPositions = await strapi.entityService.findMany('api::lights-position.lights-position');
    console.log(`📊 Remaining positions: ${remainingPositions.length}`);
    
    if (remainingPositions.length === 0) {
      console.log('✅ All LightsPosition records cleared successfully!');
    } else {
      console.log('⚠️ Some positions may still remain');
    }
    
  } catch (error) {
    console.error('❌ Clear failed:', error);
  }
})();
