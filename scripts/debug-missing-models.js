// Debug script to check what models exist for problematic brands
// Copy and paste this ENTIRE script into your Strapi console

(async () => {
  try {
    console.log('🔍 Debugging missing models...');
    
    const problematicBrands = ['dacia', 'daewoo', 'daimler'];
    
    for (const brandSlug of problematicBrands) {
      console.log(`\n🏷️ Checking brand: ${brandSlug.toUpperCase()}`);
      
      // Check if brand exists
      const brands = await strapi.entityService.findMany('api::brand.brand', {
        filters: { slug: brandSlug }
      });
      
      if (brands.length === 0) {
        console.log(`   ❌ Brand not found: ${brandSlug}`);
        
        // Check for similar brand names
        const allBrands = await strapi.entityService.findMany('api::brand.brand');
        const similarBrands = allBrands.filter(b => 
          b.slug.includes(brandSlug) || 
          b.name.toLowerCase().includes(brandSlug) ||
          brandSlug.includes(b.slug)
        );
        
        if (similarBrands.length > 0) {
          console.log(`   💡 Similar brands found:`);
          similarBrands.forEach(b => {
            console.log(`      - ${b.name} (${b.slug})`);
          });
        }
      } else {
        console.log(`   ✅ Brand found: ${brands[0].name} (${brands[0].slug})`);
        
        // Get models for this brand
        const models = await strapi.entityService.findMany('api::model.model', {
          filters: { 
            brand: { slug: brandSlug }
          },
          populate: { brand: true }
        });
        
        console.log(`   📊 Models found: ${models.length}`);
        
        if (models.length > 0) {
          console.log(`   🚗 Sample models:`);
          models.slice(0, 5).forEach((model, index) => {
            console.log(`      ${index + 1}. ${model.name} (${model.slug})`);
          });
        }
      }
    }
    
    // Check for specific problematic models
    console.log(`\n🔍 Checking specific problematic models...`);
    
    const problematicModels = [
      'dokker-express-box-body-mpv',
      'ds-3',
      'ds-4-ds-4-crossback',
      '500-c',
      '500l',
      '500x',
      'coupe',
      'doblo-box-body-mpv',
      'doblo-cargo',
      'doblo-mpv',
      'doblo-platform-chassis',
      'ducato-bus',
      'ducato-platform-chassis',
      'fiorino-box-body-mpv'
    ];
    
    for (const modelSlug of problematicModels) {
      const models = await strapi.entityService.findMany('api::model.model', {
        filters: { slug: modelSlug },
        populate: { brand: true }
      });
      
      if (models.length > 0) {
        console.log(`   ✅ Found: ${modelSlug} (Brand: ${models[0].brand.name})`);
      } else {
        console.log(`   ❌ Not found: ${modelSlug}`);
        
        // Check for similar model names
        const allModels = await strapi.entityService.findMany('api::model.model', {
          populate: { brand: true }
        });
        
        const similarModels = allModels.filter(m => 
          m.slug.includes(modelSlug.split('-')[0]) || 
          m.name.toLowerCase().includes(modelSlug.split('-')[0])
        );
        
        if (similarModels.length > 0) {
          console.log(`      💡 Similar models:`);
          similarModels.slice(0, 3).forEach(m => {
            console.log(`         - ${m.name} (${m.slug}) - Brand: ${m.brand.name}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
})();
