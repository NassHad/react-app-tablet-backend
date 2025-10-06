// Fix all model-brand relationships
// Copy and paste this ENTIRE script into your Strapi console

(async () => {
  try {
    console.log('🔧 Fixing all model-brand relationships...');
    
    // Get all brands
    const brands = await strapi.entityService.findMany('api::brand.brand', {
      populate: { models: true }
    });
    
    console.log(`📊 Found ${brands.length} brands`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    // Process each brand
    for (const brand of brands) {
      console.log(`\n🏷️ Processing brand: ${brand.name} (${brand.slug})`);
      
      // Get all models for this brand (including those without brand relationship)
      const allModels = await strapi.entityService.findMany('api::model.model', {
        populate: { brand: true }
      });
      
      // Filter models that should belong to this brand based on naming patterns
      // This is a heuristic approach - you might need to adjust the logic
      const brandModels = allModels.filter(model => {
        // Check if model name contains brand name or similar patterns
        const modelName = model.name.toLowerCase();
        const brandName = brand.name.toLowerCase();
        
        // Common patterns for brand-model relationships
        return modelName.includes(brandName) || 
               modelName.includes(brand.slug.toLowerCase()) ||
               (brand.slug === 'abarth' && (modelName.includes('124') || modelName.includes('500') || modelName.includes('punto'))) ||
               (brand.slug === 'alfa-romeo' && (modelName.includes('145') || modelName.includes('146') || modelName.includes('147'))) ||
               (brand.slug === 'audi' && (modelName.includes('a3') || modelName.includes('a4') || modelName.includes('a6'))) ||
               (brand.slug === 'bmw' && (modelName.includes('3-series') || modelName.includes('5-series'))) ||
               (brand.slug === 'mercedes' && (modelName.includes('c-class') || modelName.includes('e-class'))) ||
               (brand.slug === 'volkswagen' && (modelName.includes('golf') || modelName.includes('polo') || modelName.includes('passat')));
      });
      
      console.log(`   Found ${brandModels.length} potential models for ${brand.name}`);
      
      // Fix models that don't have brand relationship
      for (const model of brandModels) {
        if (!model.brand) {
          try {
            await strapi.entityService.update('api::model.model', model.id, {
              data: {
                brand: { id: brand.id }
              }
            });
            
            console.log(`   ✅ Fixed: ${model.name} → ${brand.name}`);
            fixedCount++;
          } catch (error) {
            console.log(`   ❌ Error fixing ${model.name}: ${error.message}`);
            errorCount++;
          }
        } else {
          console.log(`   ⏭️ Already linked: ${model.name} → ${model.brand.name}`);
        }
      }
    }
    
    console.log(`\n🎉 Fix complete!`);
    console.log(`📊 Summary:`);
    console.log(`- Models fixed: ${fixedCount}`);
    console.log(`- Errors: ${errorCount}`);
    
    // Verify the fix
    console.log(`\n🔍 Verifying fix...`);
    const abarthModels = await strapi.entityService.findMany('api::model.model', {
      filters: { 
        brand: {
          slug: 'abarth'
        }
      },
      populate: { brand: true }
    });
    
    console.log(`📊 ABARTH models now: ${abarthModels.length}`);
    abarthModels.slice(0, 3).forEach((model, index) => {
      console.log(`  ${index + 1}. ${model.name} (Brand: ${model.brand.name})`);
    });
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
})();
