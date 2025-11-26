// Check and fix model-brand relationships
// Copy and paste this ENTIRE script into your Strapi console

(async () => {
  try {
    console.log('🔍 Checking Model-Brand relationships...');
    
    // Get some models to check
    const models = await strapi.entityService.findMany('api::model.model', {
      filters: { name: { $contains: '124' } },
      populate: { brand: true }
    });
    
    console.log(`\n📊 Found ${models.length} models with "124" in name`);
    
    models.forEach((model, index) => {
      console.log(`\n${index + 1}. Model: ${model.name} (${model.slug})`);
      console.log(`   ID: ${model.id}`);
      console.log(`   Brand: ${model.brand ? model.brand.name : 'NULL'} (${model.brand ? model.brand.slug : 'NULL'})`);
    });
    
    // Check ABARTH brand
    const abarthBrand = await strapi.entityService.findMany('api::brand.brand', {
      filters: { slug: 'abarth' }
    });
    
    console.log(`\n🏷️ ABARTH Brand:`, abarthBrand.length > 0 ? `${abarthBrand[0].name} (ID: ${abarthBrand[0].id})` : 'Not found');
    
    if (abarthBrand.length > 0) {
      // Check if 124 Spider model has the correct brand
      const spiderModel = await strapi.entityService.findMany('api::model.model', {
        filters: { 
          slug: '124-spider'
        },
        populate: { brand: true }
      });
      
      if (spiderModel.length > 0) {
        console.log(`\n🚗 124 Spider Model:`);
        console.log(`   ID: ${spiderModel[0].id}`);
        console.log(`   Name: ${spiderModel[0].name}`);
        console.log(`   Brand: ${spiderModel[0].brand ? spiderModel[0].brand.name : 'NULL'}`);
        
        if (!spiderModel[0].brand) {
          console.log(`\n🔧 Fixing brand relationship...`);
          
          // Update the model to link it to ABARTH brand
          const updatedModel = await strapi.entityService.update('api::model.model', spiderModel[0].id, {
            data: {
              brand: { id: abarthBrand[0].id }
            }
          });
          
          console.log(`✅ Updated model ${updatedModel.name} to link to brand ${abarthBrand[0].name}`);
        }
      }
    }
    
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
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  }
})();
