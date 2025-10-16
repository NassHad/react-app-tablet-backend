// Test script to import wipers products with the newly added models
// Copy and paste this entire content into Strapi console

async function testWipersImport() {
  try {
    console.log('🚀 Testing wipers import with newly added models...');
    
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
    
    // Test matching for a few brands
    const testBrands = ['ALFA ROMEO', 'RENAULT', 'VOLKSWAGEN', 'CITROEN', 'FORD'];
    let totalMatches = 0;
    let totalMissing = 0;
    
    console.log(`\n🧪 Testing model matching for key brands...`);
    
    for (const brandName of testBrands) {
      const brandData = wipersData.brands[brandName];
      if (!brandData || !Array.isArray(brandData)) continue;
      
      const existingBrand = brandMap.get(brandName.toUpperCase());
      if (!existingBrand) {
        console.log(`❌ Brand ${brandName} not found in Strapi`);
        continue;
      }
      
      console.log(`\n🔍 Testing brand: ${brandName}`);
      
      let brandMatches = 0;
      let brandMissing = 0;
      
      // Test first 10 models
      for (const modelData of brandData.slice(0, 10)) {
        if (!modelData.model) continue;
        
        const modelKey = `${brandName.toUpperCase()}-${modelData.model.toUpperCase()}`;
        const existingModel = modelMap.get(modelKey);
        
        if (existingModel) {
          brandMatches++;
          totalMatches++;
          console.log(`   ✅ ${modelData.model} → ${existingModel.name}`);
        } else {
          brandMissing++;
          totalMissing++;
          console.log(`   ❌ ${modelData.model} → No match`);
        }
      }
      
      console.log(`   📊 ${brandName}: ${brandMatches}/${brandMatches + brandMissing} models matched`);
    }
    
    console.log(`\n📊 Overall Test Results:`);
    console.log(`   - Total matches: ${totalMatches}`);
    console.log(`   - Total missing: ${totalMissing}`);
    console.log(`   - Match rate: ${Math.round((totalMatches / (totalMatches + totalMissing)) * 100)}%`);
    
    // Estimate total improvement
    const estimatedTotalMatches = Math.round((totalMatches / (totalMatches + totalMissing)) * 1443);
    const estimatedMissing = 1443 - estimatedTotalMatches;
    
    console.log(`\n🎯 Estimated Impact:`);
    console.log(`   - Estimated total matches: ${estimatedTotalMatches}`);
    console.log(`   - Estimated missing: ${estimatedMissing}`);
    console.log(`   - Improvement: ${892 - estimatedMissing} fewer missing models`);
    
    return {
      totalMatches,
      totalMissing,
      matchRate: Math.round((totalMatches / (totalMatches + totalMissing)) * 100),
      estimatedTotalMatches,
      estimatedMissing
    };
    
  } catch (error) {
    console.error('❌ Error testing wipers import:', error);
    throw error;
  }
}

// Run the test
testWipersImport();
