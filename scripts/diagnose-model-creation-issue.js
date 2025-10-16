// Script to diagnose why wipers models weren't created
// Copy and paste this entire content into Strapi console

async function diagnoseModelCreationIssue() {
  try {
    console.log('🔍 Diagnosing model creation issue...');
    
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
    
    // Check for models with wipers source
    const wipersModels = existingModels.filter(model => 
      model.source === 'wipers_database.json' || 
      model.category === 'wipers'
    );
    
    console.log(`\n🧽 Models with wipers source: ${wipersModels.length}`);
    
    // Check for models created today
    const today = new Date().toISOString().split('T')[0];
    const recentModels = existingModels.filter(model => {
      if (!model.createdAt) return false;
      const modelDate = new Date(model.createdAt).toISOString().split('T')[0];
      return modelDate === today;
    });
    
    console.log(`📅 Models created today: ${recentModels.length}`);
    
    if (recentModels.length > 0) {
      console.log(`\n🆕 Recent models created today:`);
      recentModels.slice(0, 10).forEach(model => {
        const brandName = model.brand ? model.brand.name : 'Unknown';
        const source = model.source || 'Unknown';
        const category = model.category || 'Unknown';
        console.log(`   - ${brandName} ${model.name} (source: ${source}, category: ${category})`);
      });
    }
    
    // Test creating a single model to see if it works
    console.log(`\n🧪 Testing model creation...`);
    
    // Find a brand that exists
    const testBrand = existingBrands.find(brand => brand.name === 'ALFA ROMEO');
    if (testBrand) {
      console.log(`✅ Found test brand: ${testBrand.name} (ID: ${testBrand.id})`);
      
      // Try to create a test model
      try {
        const testModelData = {
          name: 'Test Model from Wipers',
          slug: 'test-model-from-wipers',
          brand: testBrand.id,
          isActive: true,
          source: 'wipers_database.json',
          category: 'wipers'
        };
        
        console.log(`📝 Attempting to create test model...`);
        const createdModel = await strapi.entityService.create('api::model.model', {
          data: testModelData
        });
        
        console.log(`✅ Test model created successfully: ${createdModel.name} (ID: ${createdModel.id})`);
        
        // Clean up - delete the test model
        await strapi.entityService.delete('api::model.model', createdModel.id);
        console.log(`🗑️  Test model deleted`);
        
      } catch (error) {
        console.error(`❌ Error creating test model:`, error.message);
        console.error(`   Full error:`, error);
      }
    } else {
      console.log(`❌ Could not find ALFA ROMEO brand for testing`);
    }
    
    // Check what models should have been created
    console.log(`\n📋 Checking what models should have been created...`);
    
    let totalWipersModels = 0;
    let missingModels = 0;
    
    // Check a few brands
    const testBrands = ['ALFA ROMEO', 'RENAULT', 'VOLKSWAGEN'];
    
    for (const brandName of testBrands) {
      const brandData = wipersData.brands[brandName];
      if (!brandData || !Array.isArray(brandData)) continue;
      
      const existingBrand = brandMap.get(brandName.toUpperCase());
      if (!existingBrand) continue;
      
      console.log(`\n🔍 Checking brand: ${brandName}`);
      console.log(`   - Wipers models: ${brandData.length}`);
      
      let brandMissingModels = 0;
      
      for (const modelData of brandData.slice(0, 5)) { // Check first 5 models
        if (!modelData.model) continue;
        
        totalWipersModels++;
        
        const modelKey = `${brandName.toUpperCase()}-${modelData.model.toUpperCase()}`;
        const existingModel = modelMap.get(modelKey);
        
        if (!existingModel) {
          brandMissingModels++;
          missingModels++;
          console.log(`   ❌ Missing: ${modelData.model}`);
        } else {
          console.log(`   ✅ Exists: ${modelData.model}`);
        }
      }
      
      console.log(`   - Missing models: ${brandMissingModels}`);
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   - Total wipers models checked: ${totalWipersModels}`);
    console.log(`   - Missing models: ${missingModels}`);
    console.log(`   - Models with wipers source: ${wipersModels.length}`);
    console.log(`   - Models created today: ${recentModels.length}`);
    
    return {
      totalWipersModels,
      missingModels,
      wipersModels: wipersModels.length,
      recentModels: recentModels.length
    };
    
  } catch (error) {
    console.error('❌ Error diagnosing model creation issue:', error);
    throw error;
  }
}

// Run the diagnosis
diagnoseModelCreationIssue();
