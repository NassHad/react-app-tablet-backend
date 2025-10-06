// Script to fix model-brand relationships
// Run this in Strapi console: npm run strapi console

async function fixModelBrandRelationships() {
  try {
    console.log('🔧 Starting model-brand relationship fixes...');
    
    // Get all models
    const models = await strapi.entityService.findMany('api::model.model', {
      populate: {
        brand: true
      }
    });
    
    console.log(`📊 Found ${models.length} models to check`);
    
    // Get all brands for reference
    const brands = await strapi.entityService.findMany('api::brand.brand');
    const brandMap = new Map();
    brands.forEach(brand => {
      brandMap.set(brand.name.toLowerCase(), brand);
    });
    
    console.log(`📊 Found ${brands.length} brands for mapping`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const model of models) {
      // Skip if model already has a brand
      if (model.brand && model.brand.id) {
        skippedCount++;
        continue;
      }
      
      // Try to find the brand based on model name patterns
      let targetBrand = null;
      
      // Check for BMW models (3 series, X3, etc.)
      if (model.name.includes('3') || model.name.includes('X3') || model.name.includes('BMW')) {
        targetBrand = brandMap.get('bmw');
      }
      // Check for other brand patterns
      else if (model.name.includes('ABARTH') || model.slug.includes('abarth')) {
        targetBrand = brandMap.get('abarth');
      }
      else if (model.name.includes('ALFA') || model.slug.includes('alfa')) {
        targetBrand = brandMap.get('alfa romeo');
      }
      else if (model.name.includes('AUDI') || model.slug.includes('audi')) {
        targetBrand = brandMap.get('audi');
      }
      // Add more patterns as needed
      
      if (targetBrand) {
        try {
          await strapi.entityService.update('api::model.model', model.id, {
            data: {
              brand: targetBrand.id
            }
          });
          
          console.log(`✅ Fixed: ${model.name} → ${targetBrand.name}`);
          fixedCount++;
        } catch (error) {
          console.error(`❌ Error fixing ${model.name}:`, error.message);
        }
      } else {
        console.log(`⏭️  No brand found for: ${model.name} (slug: ${model.slug})`);
        skippedCount++;
      }
    }
    
    console.log(`\n🎉 Model-brand relationship fixes complete!`);
    console.log(`📈 Summary:`);
    console.log(`   - Models fixed: ${fixedCount}`);
    console.log(`   - Models skipped: ${skippedCount}`);
    console.log(`   - Total models: ${models.length}`);
    
    return { fixed: fixedCount, skipped: skippedCount, total: models.length };
    
  } catch (error) {
    console.error('💥 Error during model-brand relationship fixes:', error);
    return null;
  }
}

// Run the fix
fixModelBrandRelationships();
