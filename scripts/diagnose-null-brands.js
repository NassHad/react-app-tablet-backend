// Diagnostic script to investigate null brands in models
// Copy and paste this entire content into Strapi console

async function diagnoseNullBrands() {
  try {
    console.log('🔍 Starting diagnosis of null brands in models...');
    
    // Get all models with their brand relationships
    console.log('📖 Fetching all models with brand relationships...');
    const allModels = await strapi.entityService.findMany('api::model.model', {
      populate: ['brand']
    });
    
    console.log(`📊 Total models found: ${allModels.length}`);
    
    // Analyze the data
    let modelsWithNullBrand = 0;
    let modelsWithValidBrand = 0;
    let modelsWithMissingBrand = 0;
    const nullBrandModels = [];
    const validBrandModels = [];
    
    allModels.forEach(model => {
      if (model.brand === null) {
        modelsWithNullBrand++;
        nullBrandModels.push({
          id: model.id,
          name: model.name,
          slug: model.slug,
          brand: model.brand
        });
      } else if (model.brand && model.brand.name) {
        modelsWithValidBrand++;
        validBrandModels.push({
          id: model.id,
          name: model.name,
          slug: model.slug,
          brandName: model.brand.name,
          brandId: model.brand.id
        });
      } else {
        modelsWithMissingBrand++;
        console.log(`⚠️  Model with missing brand data: ${model.name} (ID: ${model.id})`);
      }
    });
    
    console.log('\n📊 Analysis Results:');
    console.log(`   - Models with valid brands: ${modelsWithValidBrand}`);
    console.log(`   - Models with null brands: ${modelsWithNullBrand}`);
    console.log(`   - Models with missing brand data: ${modelsWithMissingBrand}`);
    
    if (modelsWithNullBrand > 0) {
      console.log('\n❌ Models with NULL brands:');
      nullBrandModels.slice(0, 10).forEach(model => {
        console.log(`   - ID: ${model.id}, Name: "${model.name}", Slug: "${model.slug}"`);
      });
      
      if (nullBrandModels.length > 10) {
        console.log(`   ... and ${nullBrandModels.length - 10} more`);
      }
    }
    
    // Check if there are any orphaned models (models without valid brand relationships)
    console.log('\n🔍 Checking for orphaned models...');
    
    // Get all brands
    const allBrands = await strapi.entityService.findMany('api::brand.brand', {
      populate: '*'
    });
    
    console.log(`📊 Total brands found: ${allBrands.length}`);
    
    // Check if any models reference non-existent brands
    let orphanedModels = 0;
    const orphanedModelDetails = [];
    
    allModels.forEach(model => {
      if (model.brand && model.brand.id) {
        const brandExists = allBrands.find(brand => brand.id === model.brand.id);
        if (!brandExists) {
          orphanedModels++;
          orphanedModelDetails.push({
            id: model.id,
            name: model.name,
            slug: model.slug,
            brandId: model.brand.id,
            brandName: model.brand.name || 'Unknown'
          });
        }
      }
    });
    
    if (orphanedModels > 0) {
      console.log(`\n⚠️  Found ${orphanedModels} orphaned models (referencing non-existent brands):`);
      orphanedModelDetails.slice(0, 10).forEach(model => {
        console.log(`   - Model: "${model.name}" (ID: ${model.id}) references brand ID: ${model.brandId} (${model.brandName})`);
      });
    } else {
      console.log('✅ No orphaned models found');
    }
    
    // Check brand-model relationships from the brand side
    console.log('\n🔍 Checking brand-model relationships from brand side...');
    
    let brandsWithModels = 0;
    let brandsWithoutModels = 0;
    const brandsWithoutModelsList = [];
    
    allBrands.forEach(brand => {
      const brandModels = allModels.filter(model => 
        model.brand && model.brand.id === brand.id
      );
      
      if (brandModels.length > 0) {
        brandsWithModels++;
      } else {
        brandsWithoutModels++;
        brandsWithoutModelsList.push({
          id: brand.id,
          name: brand.name,
          slug: brand.slug
        });
      }
    });
    
    console.log(`📊 Brand analysis:`);
    console.log(`   - Brands with models: ${brandsWithModels}`);
    console.log(`   - Brands without models: ${brandsWithoutModels}`);
    
    if (brandsWithoutModels > 0) {
      console.log('\n⚠️  Brands without any models:');
      brandsWithoutModelsList.slice(0, 10).forEach(brand => {
        console.log(`   - "${brand.name}" (ID: ${brand.id}, Slug: "${brand.slug}")`);
      });
    }
    
    // Summary and recommendations
    console.log('\n📋 Summary and Recommendations:');
    
    if (modelsWithNullBrand > 0) {
      console.log(`❌ Found ${modelsWithNullBrand} models with null brands`);
      console.log('   Recommendation: These models need to be assigned to valid brands');
      console.log('   Action: Update the brand relationship for these models');
    }
    
    if (orphanedModels > 0) {
      console.log(`❌ Found ${orphanedModels} orphaned models`);
      console.log('   Recommendation: These models reference non-existent brands');
      console.log('   Action: Either delete these models or assign them to valid brands');
    }
    
    if (brandsWithoutModels > 0) {
      console.log(`⚠️  Found ${brandsWithoutModels} brands without models`);
      console.log('   Recommendation: Consider if these brands are needed');
      console.log('   Action: Either add models to these brands or remove unused brands');
    }
    
    if (modelsWithNullBrand === 0 && orphanedModels === 0) {
      console.log('✅ All models have valid brand relationships!');
    }
    
  } catch (error) {
    console.error('💥 Diagnosis failed:', error);
    throw error;
  }
}

// Run the diagnosis
diagnoseNullBrands();
