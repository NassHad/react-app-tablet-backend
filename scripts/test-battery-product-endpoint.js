// Test script to check the battery-product endpoint directly
// Run this in Strapi console: npx strapi console

async function testBatteryProductEndpoint() {
  try {
    console.log('🔍 Testing battery-product endpoint directly...');
    
    // Test 1: Check if the controller exists
    console.log('\nTest 1: Checking controller...');
    const controller = strapi.controllers['api::battery-product.battery-product'];
    console.log('Controller exists:', !!controller);
    
    if (controller) {
      console.log('Controller methods:', Object.keys(controller));
    }
    
    // Test 2: Check if the service exists
    console.log('\nTest 2: Checking service...');
    const service = strapi.services['api::battery-product.battery-product'];
    console.log('Service exists:', !!service);
    
    if (service) {
      console.log('Service methods:', Object.keys(service));
    }
    
    // Test 3: Try to call the service directly
    console.log('\nTest 3: Testing service directly...');
    try {
      if (service) {
        const result = await service.findMany({});
        console.log('✅ Service findMany succeeded, found:', result.length, 'items');
      }
    } catch (error) {
      console.error('❌ Service error:', error.message);
    }
    
    // Test 4: Check routes
    console.log('\nTest 4: Checking routes...');
    const routes = strapi.server.router.stack;
    const batteryRoutes = routes.filter(route => 
      route.path && route.path.includes('battery-product')
    );
    console.log('Battery product routes found:', batteryRoutes.length);
    batteryRoutes.forEach(route => {
      console.log(`  - ${route.methods} ${route.path}`);
      console.log(`    Handler: ${route.handler}`);
    });
    
    // Test 5: Try to simulate the HTTP request
    console.log('\nTest 5: Simulating HTTP request...');
    try {
      // Create a mock context
      const mockCtx = {
        query: {},
        send: (data) => {
          console.log('✅ Mock response:', data);
          return data;
        },
        badRequest: (message) => {
          console.log('❌ Bad request:', message);
          return { error: message };
        },
        internalServerError: (message) => {
          console.log('❌ Internal server error:', message);
          return { error: message };
        }
      };
      
      if (controller && controller.find) {
        console.log('Attempting to call controller.find...');
        await controller.find(mockCtx);
      }
    } catch (error) {
      console.error('❌ Controller simulation error:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    console.log('\n🎯 Endpoint test completed!');
    
  } catch (error) {
    console.error('💥 Fatal endpoint test error:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Export the function for console use
module.exports = { testBatteryProductEndpoint };
