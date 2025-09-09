// Quick script to check if models exist in the database
const { createStrapi } = require('@strapi/strapi');

async function checkModels() {
  console.log('🔍 Checking for existing models...');
  
  try {
    const strapi = await createStrapi();
    await strapi.start();
    
    const modelCount = await strapi.entityService.count('api::model.model');
    const brandCount = await strapi.entityService.count('api::brand.brand');
    
    console.log(`📊 Found ${modelCount} models in database`);
    console.log(`📊 Found ${brandCount} brands in database`);
    
    if (modelCount > 0) {
      console.log('✅ Models are already imported!');
      const models = await strapi.entityService.findMany('api::model.model', {
        limit: 5,
        populate: { brand: true }
      });
      console.log('📋 Sample models:');
      models.forEach(model => {
        console.log(`  - ${model.name} (${model.brand?.name || 'No brand'})`);
      });
    } else {
      console.log('❌ No models found. You need to run the import script.');
    }
    
    await strapi.destroy();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkModels();
