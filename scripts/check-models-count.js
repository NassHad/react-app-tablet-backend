// Script to check the current count of models in Strapi
// Copy and paste this entire content into Strapi console

async function checkModelsCount() {
  try {
    console.log('🔍 Checking current models count in Strapi...');
    
    // Get all existing models from Strapi
    const existingModels = await strapi.entityService.findMany('api::model.model', {
      populate: ['brand'],
      sort: 'name:asc'
    });
    
    console.log(`📊 Total models in Strapi: ${existingModels.length}`);
    
    // Group by brand
    const modelsByBrand = {};
    existingModels.forEach(model => {
      if (model.brand && model.brand.name) {
        if (!modelsByBrand[model.brand.name]) {
          modelsByBrand[model.brand.name] = 0;
        }
        modelsByBrand[model.brand.name]++;
      }
    });
    
    // Sort brands by model count
    const sortedBrands = Object.entries(modelsByBrand)
      .sort(([,a], [,b]) => b - a);
    
    console.log(`\n📋 Models by brand (top 20):`);
    sortedBrands.slice(0, 20).forEach(([brandName, count]) => {
      console.log(`   - ${brandName}: ${count} models`);
    });
    
    if (sortedBrands.length > 20) {
      console.log(`   ... and ${sortedBrands.length - 20} more brands`);
    }
    
    // Check for wipers-specific models
    const wipersModels = existingModels.filter(model => 
      model.source === 'wipers_database.json' || 
      model.category === 'wipers'
    );
    
    console.log(`\n🧽 Wipers-specific models: ${wipersModels.length}`);
    
    if (wipersModels.length > 0) {
      const wipersByBrand = {};
      wipersModels.forEach(model => {
        if (model.brand && model.brand.name) {
          if (!wipersByBrand[model.brand.name]) {
            wipersByBrand[model.brand.name] = 0;
          }
          wipersByBrand[model.brand.name]++;
        }
      });
      
      console.log(`\n📋 Wipers models by brand:`);
      Object.entries(wipersByBrand)
        .sort(([,a], [,b]) => b - a)
        .forEach(([brandName, count]) => {
          console.log(`   - ${brandName}: ${count} models`);
        });
    }
    
    // Check recent models (last 50)
    console.log(`\n🆕 Recent models (last 50):`);
    existingModels.slice(-50).forEach(model => {
      const brandName = model.brand ? model.brand.name : 'Unknown';
      const source = model.source || 'Unknown';
      console.log(`   - ${brandName} ${model.name} (source: ${source})`);
    });
    
    return {
      totalModels: existingModels.length,
      wipersModels: wipersModels.length,
      modelsByBrand: modelsByBrand
    };
    
  } catch (error) {
    console.error('❌ Error checking models count:', error);
    throw error;
  }
}

// Run the check
checkModelsCount();
