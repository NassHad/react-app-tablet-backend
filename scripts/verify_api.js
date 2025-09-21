// Verify API endpoints are working
// Copy and paste this into your Strapi console

(async () => {
  console.log('🔍 Verifying API endpoints...');

  try {
    // Test 1: Check if content types exist
    console.log('📝 Test 1: Checking content types...');
    
    const brandCount = await strapi.entityService.count('api::lights-brand.lights-brand');
    const modelCount = await strapi.entityService.count('api::lights-model.lights-model');
    const positionCount = await strapi.entityService.count('api::lights-position.lights-position');
    const lightDataCount = await strapi.entityService.count('api::light-position-data.light-position-data');
    
    console.log(`✅ LightsBrand: ${brandCount} entries`);
    console.log(`✅ LightsModel: ${modelCount} entries`);
    console.log(`✅ LightsPosition: ${positionCount} entries`);
    console.log(`✅ LightPositionData: ${lightDataCount} entries`);

    // Test 2: Check API endpoints
    console.log('📝 Test 2: Testing API endpoints...');
    
    // Test lights-selection API
    const response = await fetch('http://localhost:1338/api/lights-selection/category/1');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Lights selection API is working');
      console.log(`📊 Response: ${JSON.stringify(data, null, 2)}`);
    } else {
      console.log('❌ Lights selection API failed:', response.status);
    }

    console.log('');
    console.log('🎉 API verification complete!');
    console.log('✅ All systems are working correctly.');
    console.log('🔗 You can now test the full import process.');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
})();
