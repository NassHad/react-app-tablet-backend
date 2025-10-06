// Simple test script for one model
// Copy and paste this ENTIRE script into your Strapi console

(async () => {
  try {
    console.log('🧪 Simple test for one model...');
    
    // Test with 124 Spider
    const model = await strapi.entityService.findMany('api::model.model', {
      filters: { 
        slug: '124-spider',
        brand: {
          slug: 'abarth'
        }
      },
      populate: { brand: true }
    });
    
    console.log('Model found:', model.length > 0);
    if (model.length > 0) {
      console.log('Model data:', JSON.stringify(model[0], null, 2));
    }
    
    // Test creating a simple lights product
    if (model.length > 0 && model[0].brand) {
      console.log('\n🔦 Testing lights product creation...');
      
      // Create a test position
      const testPosition = await strapi.entityService.create('api::lights-position.lights-position', {
        data: {
          name: 'Test Position',
          slug: 'test-position',
          isActive: true,
          publishedAt: new Date()
        }
      });
      
      console.log('✅ Created test position:', testPosition.id);
      
      // Create a test product
      const testProduct = await strapi.entityService.create('api::lights-product.lights-product', {
        data: {
          name: 'Test Position',
          ref: 'H11',
          description: 'Test product',
          brand: { id: model[0].brand.id },
          model: { id: model[0].id },
          lights_position: { id: testPosition.id },
          constructionYearStart: '2020',
          constructionYearEnd: 'Present',
          typeConception: 'Test',
          category: 'test',
          isActive: true,
          publishedAt: new Date()
        }
      });
      
      console.log('✅ Created test product:', testProduct.id);
      
      // Clean up
      await strapi.entityService.delete('api::lights-product.lights-product', testProduct.id);
      await strapi.entityService.delete('api::lights-position.lights-position', testPosition.id);
      
      console.log('✅ Cleaned up test data');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
})();
