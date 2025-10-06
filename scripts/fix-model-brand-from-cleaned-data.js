// Fix model-brand relationships using cleaned_models.json data
// Copy and paste this ENTIRE script into your Strapi console

const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log('🔧 Fixing model-brand relationships using cleaned_models.json...');
    
    // Read the cleaned models data
    const dataPath = path.join(process.cwd(), 'scripts', 'json_data', 'cleaned_models.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const cleanedModels = JSON.parse(rawData);
    
    console.log(`📊 Found ${cleanedModels.length} models in cleaned_models.json`);
    
    let fixedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Process each cleaned model
    for (const cleanedModel of cleanedModels) {
      try {
        const brandSlug = cleanedModel.brandSlug;
        const modelSlug = cleanedModel.modelSlug;
        
        // Find the brand
        const brands = await strapi.entityService.findMany('api::brand.brand', {
          filters: { slug: brandSlug }
        });
        
        if (brands.length === 0) {
          console.log(`⚠️ Brand not found: ${brandSlug}, skipping model ${modelSlug}`);
          skippedCount++;
          continue;
        }
        
        const brand = brands[0];
        
        // Find the model
        const models = await strapi.entityService.findMany('api::model.model', {
          filters: { slug: modelSlug },
          populate: { brand: true }
        });
        
        if (models.length === 0) {
          console.log(`⚠️ Model not found: ${modelSlug}, skipping`);
          skippedCount++;
          continue;
        }
        
        const model = models[0];
        
        // Check if model already has the correct brand
        if (model.brand && model.brand.slug === brandSlug) {
          console.log(`⏭️ Model ${modelSlug} already linked to ${brandSlug}`);
          skippedCount++;
          continue;
        }
        
        // Fix the brand relationship
        await strapi.entityService.update('api::model.model', model.id, {
          data: {
            brand: { id: brand.id }
          }
        });
        
        console.log(`✅ Fixed: ${model.name} (${modelSlug}) → ${brand.name} (${brandSlug})`);
        fixedCount++;
        
        // Log progress every 100 fixes
        if (fixedCount % 100 === 0) {
          console.log(`📊 Progress: ${fixedCount} models fixed...`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${cleanedModel.name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 Fix complete!`);
    console.log(`📊 Summary:`);
    console.log(`- Models fixed: ${fixedCount}`);
    console.log(`- Models skipped: ${skippedCount}`);
    console.log(`- Errors: ${errorCount}`);
    
    // Verify the fix with some examples
    console.log(`\n🔍 Verifying fix...`);
    
    const testBrands = ['abarth', 'alfa-romeo', 'audi', 'bmw', 'mercedes', 'volkswagen'];
    
    for (const brandSlug of testBrands) {
      const brandModels = await strapi.entityService.findMany('api::model.model', {
        filters: { 
          brand: {
            slug: brandSlug
          }
        },
        populate: { brand: true }
      });
      
      console.log(`📊 ${brandSlug.toUpperCase()} models: ${brandModels.length}`);
      if (brandModels.length > 0) {
        brandModels.slice(0, 2).forEach((model, index) => {
          console.log(`  ${index + 1}. ${model.name} (Brand: ${model.brand.name})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
})();
