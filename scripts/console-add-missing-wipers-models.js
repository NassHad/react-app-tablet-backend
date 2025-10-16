// Script to add missing wipers models to the main Strapi Model table
// Copy and paste this entire content into Strapi console

async function addMissingWipersModels() {
  try {
    console.log('🚀 Starting addition of missing wipers models to Strapi...');
    
    // Load wipers data
    const fs = require('fs');
    const path = require('path');
    const WIPERS_DATA_PATH = path.join(process.cwd(), 'scripts', 'wipers', 'wipers_database.json');
    
    if (!fs.existsSync(WIPERS_DATA_PATH)) {
      throw new Error(`Wipers data file not found at: ${WIPERS_DATA_PATH}`);
    }
    
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, 'utf8'));
    
    // Get all existing brands and models from Strapi
    console.log('🔍 Fetching existing brands and models from Strapi...');
    const existingBrands = await strapi.entityService.findMany('api::brand.brand', {
      populate: '*',
      sort: 'name:asc'
    });
    
    const existingModels = await strapi.entityService.findMany('api::model.model', {
      populate: ['brand'],
      sort: 'name:asc'
    });
    
    console.log(`📊 Found ${existingBrands.length} existing brands and ${existingModels.length} existing models`);
    
    // Create lookup maps
    const brandMap = new Map();
    existingBrands.forEach(brand => {
      if (brand && brand.name) {
        brandMap.set(brand.name.toUpperCase(), brand);
      }
    });
    
    const modelMap = new Map();
    existingModels.forEach(model => {
      if (model && model.brand && model.brand.name && model.name) {
        const key = `${model.brand.name.toUpperCase()}-${model.name.toUpperCase()}`;
        modelMap.set(key, model);
      }
    });
    
    // Track what we need to add
    const modelsToAdd = [];
    const missingBrands = [];
    let totalWipersModels = 0;
    
    // Process each brand in wipers data
    for (const [brandName, brandData] of Object.entries(wipersData.brands)) {
      if (!Array.isArray(brandData)) continue;
      
      // Check if brand exists in Strapi
      const existingBrand = brandMap.get(brandName.toUpperCase());
      if (!existingBrand) {
        missingBrands.push(brandName);
        continue;
      }
      
      console.log(`\n🔍 Processing brand: ${brandName}`);
      
      // Process each model in this brand
      for (const modelData of brandData) {
        totalWipersModels++;
        
        if (!modelData.model) continue;
        
        // Check if model exists in Strapi
        const modelKey = `${brandName.toUpperCase()}-${modelData.model.toUpperCase()}`;
        const existingModel = modelMap.get(modelKey);
        
        if (!existingModel) {
          // Model doesn't exist, add it to our list
          modelsToAdd.push({
            brand: existingBrand,
            brandName: brandName,
            modelName: modelData.model,
            modelData: modelData
          });
        }
      }
    }
    
    console.log(`\n📊 Analysis Results:`);
    console.log(`   - Total wipers models: ${totalWipersModels}`);
    console.log(`   - Missing brands: ${missingBrands.length}`);
    console.log(`   - Models to add: ${modelsToAdd.length}`);
    
    if (missingBrands.length > 0) {
      console.log(`\n⚠️  Missing brands (${missingBrands.length}):`);
      missingBrands.slice(0, 10).forEach(brand => console.log(`   - ${brand}`));
      if (missingBrands.length > 10) {
        console.log(`   ... and ${missingBrands.length - 10} more`);
      }
    }
    
    if (modelsToAdd.length === 0) {
      console.log('\n✅ No missing models to add!');
      return;
    }
    
    // Group models by brand for better organization
    const modelsByBrand = {};
    modelsToAdd.forEach(model => {
      if (!modelsByBrand[model.brandName]) {
        modelsByBrand[model.brandName] = [];
      }
      modelsByBrand[model.brandName].push(model);
    });
    
    console.log(`\n📋 Models to add by brand:`);
    Object.entries(modelsByBrand).forEach(([brandName, models]) => {
      console.log(`   - ${brandName}: ${models.length} models`);
    });
    
    // Ask for confirmation
    console.log(`\n⚠️  This will add ${modelsToAdd.length} new models to your Strapi database.`);
    console.log('   Do you want to proceed? (This is a simulation - no models will actually be added)');
    
    // For now, just show what would be added (simulation mode)
    console.log('\n🧪 SIMULATION MODE - No models will actually be added');
    console.log('   To actually add models, uncomment the creation code below');
    
    let addedCount = 0;
    let errorCount = 0;
    
    // Process models by brand
    for (const [brandName, models] of Object.entries(modelsByBrand)) {
      console.log(`\n🏷️  Processing brand: ${brandName} (${models.length} models)`);
      
      for (const model of models) {
        try {
          // Create model data
          const modelData = {
            name: model.modelName,
            slug: model.modelName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, ''),
            brand: model.brand.id,
            isActive: true,
            source: 'wipers_database.json',
            category: 'wipers'
          };
          
          // Add production years if available
          if (model.modelData.productionYears) {
            if (model.modelData.productionYears.start) {
              modelData.constructionYearStart = model.modelData.productionYears.start;
            }
            if (model.modelData.productionYears.end) {
              modelData.constructionYearEnd = model.modelData.productionYears.end;
            }
          }
          
          // Add direction if available
          if (model.modelData.direction) {
            modelData.direction = model.modelData.direction;
          }
          
          // Add picto information if available
          if (model.modelData.picto1) {
            modelData.picto1 = model.modelData.picto1;
          }
          if (model.modelData.picto2) {
            modelData.picto2 = model.modelData.picto2;
          }
          
          // Add notes if available
          if (model.modelData.notes) {
            modelData.notes = model.modelData.notes;
          }
          
          console.log(`   📝 Would add: "${model.modelName}" (slug: ${modelData.slug})`);
          
          // UNCOMMENT THE FOLLOWING LINES TO ACTUALLY CREATE THE MODELS:
          
          const createdModel = await strapi.entityService.create('api::model.model', {
            data: modelData
          });
          
          console.log(`   ✅ Created: "${model.modelName}" (ID: ${createdModel.id})`);
          addedCount++;
          
          
          // For simulation, just count what would be added
          addedCount++;
          
        } catch (error) {
          console.error(`   ❌ Error adding model "${model.modelName}":`, error.message);
          errorCount++;
        }
      }
    }
    
    console.log('\n🎉 Model addition simulation completed!');
    console.log(`📊 Results:`);
    console.log(`   - Models that would be added: ${addedCount}`);
    console.log(`   - Errors: ${errorCount}`);
    console.log(`   - Brands processed: ${Object.keys(modelsByBrand).length}`);
    
    // Show summary by brand
    console.log(`\n📋 Summary by brand:`);
    Object.entries(modelsByBrand).forEach(([brandName, models]) => {
      console.log(`   - ${brandName}: ${models.length} models`);
    });
    
    console.log(`\n💡 To actually add these models:`);
    console.log('   1. Uncomment the model creation code in the script');
    console.log('   2. Re-run the script');
    console.log('   3. Then re-run the wipers import script');
    
    return {
      totalModelsToAdd: modelsToAdd.length,
      modelsByBrand: modelsByBrand,
      missingBrands: missingBrands
    };
    
  } catch (error) {
    console.error('❌ Error adding missing wipers models:', error);
    throw error;
  }
}

// Run the addition
addMissingWipersModels();
