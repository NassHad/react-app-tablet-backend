// Diagnostic script to see what models exist for specific brands
// Copy and paste this entire content into Strapi console

async function diagnoseBrandModels() {
  try {
    console.log('🔍 Diagnosing brand-model relationships...');
    
    // Get all brands and models
    const allBrands = await strapi.entityService.findMany('api::brand.brand', {
      populate: '*'
    });
    
    const allModels = await strapi.entityService.findMany('api::model.model', {
      populate: ['brand']
    });
    
    console.log(`📊 Total brands: ${allBrands.length}`);
    console.log(`📊 Total models: ${allModels.length}`);
    
    // Check specific brands from wipers data
    const wipersBrands = ['ABARTH', 'ALFA ROMEO', 'AUDI', 'AIXAM', 'ASTON MARTIN'];
    
    for (const brandName of wipersBrands) {
      console.log(`\n🔍 Checking brand: ${brandName}`);
      
      // Find brand by name (case insensitive)
      const brand = allBrands.find(b => 
        b.name && b.name.toUpperCase() === brandName.toUpperCase()
      );
      
      if (!brand) {
        console.log(`❌ Brand "${brandName}" not found`);
        continue;
      }
      
      console.log(`✅ Found brand: "${brand.name}" (slug: ${brand.slug})`);
      
      // Find all models for this brand
      const brandModels = allModels.filter(model => 
        model.brand && model.brand.id === brand.id
      );
      
      console.log(`📋 Found ${brandModels.length} models for ${brand.name}:`);
      
      if (brandModels.length > 0) {
        brandModels.slice(0, 10).forEach(model => {
          console.log(`   - "${model.name}" (slug: ${model.slug})`);
        });
        
        if (brandModels.length > 10) {
          console.log(`   ... and ${brandModels.length - 10} more models`);
        }
      } else {
        console.log(`   ⚠️  No models found for ${brand.name}`);
      }
    }
    
    // Let's also check what models exist that might match the wipers data
    console.log('\n🔍 Checking for potential model matches...');
    
    const wipersModelNames = [
      '124 Spider',
      '500 Abarth 595 (All models)',
      'Alfa 6',
      'Alfa 33',
      '50',
      '60',
      '75'
    ];
    
    for (const modelName of wipersModelNames) {
      console.log(`\n🔍 Looking for model: "${modelName}"`);
      
      // Try exact match
      const exactMatch = allModels.find(model => 
        model.name && model.name === modelName
      );
      
      if (exactMatch) {
        console.log(`✅ Exact match found: "${exactMatch.name}" (brand: ${exactMatch.brand.name})`);
        continue;
      }
      
      // Try partial match
      const partialMatches = allModels.filter(model => 
        model.name && model.name.toLowerCase().includes(modelName.toLowerCase())
      );
      
      if (partialMatches.length > 0) {
        console.log(`🔍 Partial matches found:`);
        partialMatches.slice(0, 5).forEach(model => {
          console.log(`   - "${model.name}" (brand: ${model.brand.name})`);
        });
      } else {
        console.log(`❌ No matches found for "${modelName}"`);
      }
    }
    
    // Show some sample model names to understand the naming pattern
    console.log('\n📋 Sample model names in database:');
    allModels.slice(0, 20).forEach(model => {
      console.log(`   - "${model.name}" (brand: ${model.brand.name})`);
    });
    
  } catch (error) {
    console.error('💥 Diagnosis failed:', error);
    throw error;
  }
}

// Run the diagnosis
diagnoseBrandModels();
