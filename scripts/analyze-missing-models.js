// Analyze Missing Models - Compare Database with cleaned_models.json
// Copy and paste this ENTIRE script into your Strapi console

const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log('🔍 Starting Missing Models Analysis...');
    
    // Read the cleaned_models.json file
    const cleanedModelsPath = path.join(process.cwd(), 'scripts', 'json_data', 'cleaned_models.json');
    const cleanedModelsData = fs.readFileSync(cleanedModelsPath, 'utf8');
    const cleanedModels = JSON.parse(cleanedModelsData);
    
    console.log(`📊 Found ${cleanedModels.length} models in cleaned_models.json`);
    
    // Get all models from database
    const dbModels = await strapi.entityService.findMany('api::model.model', {
      populate: { brand: true }
    });
    
    console.log(`📊 Found ${dbModels.length} models in database`);
    
    // Check for models with null brand relationships
    const modelsWithNullBrands = dbModels.filter(model => !model.brand || !model.brand.slug);
    if (modelsWithNullBrands.length > 0) {
      console.log(`⚠️ Found ${modelsWithNullBrands.length} models with null/missing brand relationships`);
    }
    
    // Create maps for easier comparison
    const dbModelMap = new Map();
    const dbBrandModelMap = new Map();
    
    dbModels.forEach(model => {
      if (model.brand && model.brand.slug) {
        const key = `${model.brand.slug}-${model.slug}`;
        dbModelMap.set(key, model);
        dbBrandModelMap.set(model.brand.slug, dbBrandModelMap.get(model.brand.slug) || []);
        dbBrandModelMap.get(model.brand.slug).push(model);
      }
    });
    
    // Analyze cleaned_models.json
    const cleanedModelMap = new Map();
    const cleanedBrandModelMap = new Map();
    
    cleanedModels.forEach(model => {
      const key = `${model.brandSlug}-${model.modelSlug}`;
      cleanedModelMap.set(key, model);
      cleanedBrandModelMap.set(model.brandSlug, cleanedBrandModelMap.get(model.brandSlug) || []);
      cleanedBrandModelMap.get(model.brandSlug).push(model);
    });
    
    console.log('\n📋 Brand Comparison:');
    console.log('='.repeat(50));
    
    const dbBrands = Array.from(dbBrandModelMap.keys()).sort();
    const cleanedBrands = Array.from(cleanedBrandModelMap.keys()).sort();
    
    console.log(`Database brands: ${dbBrands.length}`);
    console.log(`Cleaned brands: ${cleanedBrands.length}`);
    
    // Find brands in cleaned but not in database
    const missingBrands = cleanedBrands.filter(brand => !dbBrands.includes(brand));
    console.log(`\n❌ Brands in cleaned_models.json but NOT in database: ${missingBrands.length}`);
    if (missingBrands.length > 0) {
      console.log('Missing brands:', missingBrands.slice(0, 10).join(', '));
      if (missingBrands.length > 10) console.log(`... and ${missingBrands.length - 10} more`);
    }
    
    // Find brands in database but not in cleaned
    const extraBrands = dbBrands.filter(brand => !cleanedBrands.includes(brand));
    console.log(`\n➕ Brands in database but NOT in cleaned_models.json: ${extraBrands.length}`);
    if (extraBrands.length > 0) {
      console.log('Extra brands:', extraBrands.slice(0, 10).join(', '));
      if (extraBrands.length > 10) console.log(`... and ${extraBrands.length - 10} more`);
    }
    
    // Analyze model counts per brand
    console.log('\n📊 Model Counts by Brand:');
    console.log('='.repeat(50));
    
    const brandComparison = [];
    cleanedBrands.forEach(brand => {
      const dbCount = dbBrandModelMap.get(brand)?.length || 0;
      const cleanedCount = cleanedBrandModelMap.get(brand)?.length || 0;
      const missing = cleanedCount - dbCount;
      
      if (missing > 0) {
        brandComparison.push({
          brand,
          dbCount,
          cleanedCount,
          missing
        });
      }
    });
    
    // Sort by missing count (descending)
    brandComparison.sort((a, b) => b.missing - a.missing);
    
    console.log('Top 20 brands with missing models:');
    brandComparison.slice(0, 20).forEach((item, index) => {
      console.log(`${index + 1}. ${item.brand}: ${item.dbCount}/${item.cleanedCount} (missing: ${item.missing})`);
    });
    
    // Analyze specific missing models
    console.log('\n🔍 Detailed Missing Models Analysis:');
    console.log('='.repeat(50));
    
    let totalMissing = 0;
    let totalExtra = 0;
    
    cleanedBrands.forEach(brand => {
      const dbModels = dbBrandModelMap.get(brand) || [];
      const cleanedModels = cleanedBrandModelMap.get(brand) || [];
      
      const dbModelSlugs = new Set(dbModels.map(m => m.slug));
      const cleanedModelSlugs = new Set(cleanedModels.map(m => m.modelSlug));
      
      const missing = cleanedModels.filter(m => !dbModelSlugs.has(m.modelSlug));
      const extra = dbModels.filter(m => !cleanedModelSlugs.has(m.slug));
      
      if (missing.length > 0 || extra.length > 0) {
        console.log(`\n${brand.toUpperCase()}:`);
        console.log(`  Missing: ${missing.length} models`);
        console.log(`  Extra: ${extra.length} models`);
        
        if (missing.length > 0) {
          console.log(`  Missing models: ${missing.slice(0, 5).map(m => m.modelSlug).join(', ')}`);
          if (missing.length > 5) console.log(`    ... and ${missing.length - 5} more`);
        }
        
        totalMissing += missing.length;
        totalExtra += extra.length;
      }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`Total missing models: ${totalMissing}`);
    console.log(`Total extra models: ${totalExtra}`);
    
    // Check for common patterns in missing models
    console.log('\n🔍 Pattern Analysis:');
    console.log('='.repeat(50));
    
    const allMissingModels = [];
    cleanedBrands.forEach(brand => {
      const dbModels = dbBrandModelMap.get(brand) || [];
      const cleanedModels = cleanedBrandModelMap.get(brand) || [];
      const dbModelSlugs = new Set(dbModels.map(m => m.slug));
      
      cleanedModels.forEach(model => {
        if (!dbModelSlugs.has(model.modelSlug)) {
          allMissingModels.push({
            brand,
            modelSlug: model.modelSlug,
            originalModel: model.originalModel
          });
        }
      });
    });
    
    // Analyze patterns
    const patterns = {
      withHyphens: allMissingModels.filter(m => m.modelSlug && m.modelSlug.includes('-')).length,
      withNumbers: allMissingModels.filter(m => m.modelSlug && /\d/.test(m.modelSlug)).length,
      withSpaces: allMissingModels.filter(m => m.originalModel && m.originalModel.includes(' ')).length,
      withSpecialChars: allMissingModels.filter(m => m.modelSlug && /[^a-zA-Z0-9\-]/.test(m.modelSlug)).length
    };
    
    console.log('Missing model patterns:');
    console.log(`- With hyphens: ${patterns.withHyphens}`);
    console.log(`- With numbers: ${patterns.withNumbers}`);
    console.log(`- With spaces in original: ${patterns.withSpaces}`);
    console.log(`- With special chars: ${patterns.withSpecialChars}`);
    
    // Sample missing models for investigation
    console.log('\n🔍 Sample Missing Models for Investigation:');
    console.log('='.repeat(50));
    
    allMissingModels.slice(0, 20).forEach((model, index) => {
      console.log(`${index + 1}. ${model.brand}/${model.modelSlug} (${model.originalModel})`);
    });
    
    console.log('\n✅ Analysis complete!');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
})();
