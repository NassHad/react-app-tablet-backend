// Test script to check if battery-product entity is working
// Run this in Strapi console: npx strapi console

async function testBatteryProductEntity() {
  try {
    console.log('🔍 Testing battery-product entity...');
    
    // Test 1: Check if entity exists
    console.log('Test 1: Checking if entity exists...');
    const entityExists = strapi.contentTypes['api::battery-product.battery-product'];
    console.log('Entity exists:', !!entityExists);
    
    if (entityExists) {
      console.log('Entity info:', {
        kind: entityExists.kind,
        collectionName: entityExists.collectionName,
        displayName: entityExists.info?.displayName
      });
    }
    
    // Test 2: Try to find entities
    console.log('\nTest 2: Trying to find entities...');
    const products = await strapi.entityService.findMany('api::battery-product.battery-product', {
      filters: {}
    });
    console.log('Found products:', products.length);
    
    // Test 3: Check routes
    console.log('\nTest 3: Checking routes...');
    const routes = strapi.server.router.stack;
    const batteryRoutes = routes.filter(route => 
      route.path && route.path.includes('battery-product')
    );
    console.log('Battery product routes found:', batteryRoutes.length);
    batteryRoutes.forEach(route => {
      console.log(`  - ${route.methods} ${route.path}`);
    });
    
    console.log('\n✅ Battery product entity test completed!');
    
  } catch (error) {
    console.error('❌ Error testing battery product entity:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Export the function for console use
module.exports = { testBatteryProductEntity };
