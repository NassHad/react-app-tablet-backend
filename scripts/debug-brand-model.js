// Debug script to check brand and model relationships
// Copy and paste this ENTIRE script into your Strapi console

(async () => {
  try {
    console.log('🔍 Debugging Brand and Model relationships...');
    
    // Check ABARTH brand
    const abarthBrand = await strapi.entityService.findMany('api::brand.brand', {
      filters: { slug: 'abarth' }
    });
    
    console.log(`\n🏷️ ABARTH Brand:`, abarthBrand.length > 0 ? abarthBrand[0] : 'Not found');
    
    // Check 124 Spider model
    const spiderModel = await strapi.entityService.findMany('api::model.model', {
      filters: { 
        slug: '124-spider',
        brand: {
          slug: 'abarth'
        }
      },
      populate: { brand: true }
    });
    
    console.log(`\n🚗 124 Spider Model:`, spiderModel.length > 0 ? spiderModel[0] : 'Not found');
    
    // Check all ABARTH models
    const abarthModels = await strapi.entityService.findMany('api::model.model', {
      filters: { 
        brand: {
          slug: 'abarth'
        }
      },
      populate: { brand: true }
    });
    
    console.log(`\n📊 Total ABARTH models: ${abarthModels.length}`);
    console.log('Sample ABARTH models:');
    abarthModels.slice(0, 3).forEach((model, index) => {
      console.log(`  ${index + 1}. ${model.name} (${model.slug})`);
      console.log(`     Brand: ${model.brand ? model.brand.name : 'NULL'} (${model.brand ? model.brand.slug : 'NULL'})`);
    });
    
    // Check if there are any models without brand relationships
    const modelsWithoutBrand = abarthModels.filter(model => !model.brand);
    console.log(`\n⚠️ Models without brand: ${modelsWithoutBrand.length}`);
    
    if (modelsWithoutBrand.length > 0) {
      console.log('Models without brand:');
      modelsWithoutBrand.slice(0, 3).forEach((model, index) => {
        console.log(`  ${index + 1}. ${model.name} (${model.slug})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
})();
