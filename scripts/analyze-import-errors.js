// Analyze Import Errors - Investigate the 749 errors from osram import
// Copy and paste this ENTIRE script into your Strapi console

const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log('🔍 Starting Import Errors Analysis...');
    
    // Read the osram data
    const osramPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_with_slugs.json');
    const osramData = fs.readFileSync(osramPath, 'utf8');
    const osramRecords = JSON.parse(osramData);
    
    console.log(`📊 Found ${osramRecords.length} records in osram_bulbs_with_slugs.json`);
    
    // Get all models from database
    const dbModels = await strapi.entityService.findMany('api::model.model', {
      populate: { brand: true }
    });
    
    // Create lookup maps
    const dbModelMap = new Map();
    const dbBrandMap = new Map();
    
    dbModels.forEach(model => {
      const key = `${model.brand.slug}-${model.slug}`;
      dbModelMap.set(key, model);
      dbBrandMap.set(model.brand.slug, dbBrandMap.get(model.brand.slug) || []);
      dbBrandMap.get(model.brand.slug).push(model);
    });
    
    // Analyze each osram record
    const analysis = {
      total: osramRecords.length,
      found: 0,
      notFound: 0,
      brandNotFound: 0,
      modelNotFound: 0,
      exactMatch: 0,
      partialMatch: 0,
      noMatch: 0,
      errors: []
    };
    
    const brandStats = new Map();
    const modelPatterns = new Map();
    
    for (const record of osramRecords) {
      const brandSlug = record.brandSlug;
      const modelSlug = record.modelSlug;
      
      // Initialize brand stats
      if (!brandStats.has(brandSlug)) {
        brandStats.set(brandSlug, {
          total: 0,
          found: 0,
          notFound: 0,
          models: new Set()
        });
      }
      
      const brandStat = brandStats.get(brandSlug);
      brandStat.total++;
      brandStat.models.add(modelSlug);
      
      // Check if brand exists
      const brandExists = dbBrandMap.has(brandSlug);
      if (!brandExists) {
        analysis.brandNotFound++;
        brandStat.notFound++;
        analysis.errors.push({
          type: 'brand_not_found',
          brand: brandSlug,
          model: modelSlug,
          originalBrand: record.originalBrand,
          originalModel: record.originalModel
        });
        continue;
      }
      
      // Check for exact model match
      const exactKey = `${brandSlug}-${modelSlug}`;
      const exactMatch = dbModelMap.has(exactKey);
      
      if (exactMatch) {
        analysis.found++;
        analysis.exactMatch++;
        brandStat.found++;
        continue;
      }
      
      // Check for partial match
      const brandModels = dbBrandMap.get(brandSlug) || [];
      const partialMatches = brandModels.filter(model => 
        model.slug.includes(modelSlug) || 
        modelSlug.includes(model.slug) ||
        model.slug.replace(/-/g, '') === modelSlug.replace(/-/g, '')
      );
      
      if (partialMatches.length > 0) {
        analysis.found++;
        analysis.partialMatch++;
        brandStat.found++;
        
        // Track pattern
        const pattern = `${modelSlug} -> ${partialMatches[0].slug}`;
        modelPatterns.set(pattern, (modelPatterns.get(pattern) || 0) + 1);
        continue;
      }
      
      // No match found
      analysis.notFound++;
      analysis.modelNotFound++;
      brandStat.notFound++;
      
      analysis.errors.push({
        type: 'model_not_found',
        brand: brandSlug,
        model: modelSlug,
        originalBrand: record.originalBrand,
        originalModel: record.originalModel,
        availableModels: brandModels.slice(0, 3).map(m => m.slug)
      });
      
      // Track model patterns for analysis
      const modelPattern = modelSlug.replace(/[0-9]/g, 'X').replace(/-/g, '_');
      modelPatterns.set(modelPattern, (modelPatterns.get(modelPattern) || 0) + 1);
    }
    
    // Print analysis results
    console.log('\n📊 Import Analysis Results:');
    console.log('='.repeat(50));
    console.log(`Total records: ${analysis.total}`);
    console.log(`Found matches: ${analysis.found} (${((analysis.found/analysis.total)*100).toFixed(1)}%)`);
    console.log(`Not found: ${analysis.notFound} (${((analysis.notFound/analysis.total)*100).toFixed(1)}%)`);
    console.log(`  - Brand not found: ${analysis.brandNotFound}`);
    console.log(`  - Model not found: ${analysis.modelNotFound}`);
    console.log(`Exact matches: ${analysis.exactMatch}`);
    console.log(`Partial matches: ${analysis.partialMatch}`);
    
    // Brand analysis
    console.log('\n📊 Brand Analysis:');
    console.log('='.repeat(50));
    
    const brandArray = Array.from(brandStats.entries())
      .map(([brand, stats]) => ({
        brand,
        total: stats.total,
        found: stats.found,
        notFound: stats.notFound,
        successRate: ((stats.found / stats.total) * 100).toFixed(1)
      }))
      .sort((a, b) => b.notFound - a.notFound);
    
    console.log('Top 20 brands with most errors:');
    brandArray.slice(0, 20).forEach((item, index) => {
      console.log(`${index + 1}. ${item.brand}: ${item.found}/${item.total} (${item.successRate}% success)`);
    });
    
    // Model pattern analysis
    console.log('\n🔍 Model Pattern Analysis:');
    console.log('='.repeat(50));
    
    const patternArray = Array.from(modelPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    
    console.log('Most common model patterns:');
    patternArray.forEach(([pattern, count], index) => {
      console.log(`${index + 1}. ${pattern}: ${count} occurrences`);
    });
    
    // Sample errors for investigation
    console.log('\n🔍 Sample Errors for Investigation:');
    console.log('='.repeat(50));
    
    const brandErrors = analysis.errors.filter(e => e.type === 'brand_not_found');
    const modelErrors = analysis.errors.filter(e => e.type === 'model_not_found');
    
    console.log(`\nBrand not found errors (${brandErrors.length}):`);
    brandErrors.slice(0, 10).forEach((error, index) => {
      console.log(`${index + 1}. ${error.brand} (${error.originalBrand})`);
    });
    
    console.log(`\nModel not found errors (${modelErrors.length}):`);
    modelErrors.slice(0, 10).forEach((error, index) => {
      console.log(`${index + 1}. ${error.brand}/${error.model} (${error.originalModel})`);
      if (error.availableModels.length > 0) {
        console.log(`   Available: ${error.availableModels.join(', ')}`);
      }
    });
    
    // Specific brand investigations
    console.log('\n🔍 Specific Brand Investigations:');
    console.log('='.repeat(50));
    
    const problemBrands = brandArray.filter(b => b.successRate < 50).slice(0, 5);
    
    for (const brand of problemBrands) {
      console.log(`\n${brand.brand.toUpperCase()} (${brand.successRate}% success):`);
      
      const brandErrors = analysis.errors.filter(e => e.brand === brand.brand);
      const uniqueModels = new Set(brandErrors.map(e => e.model));
      
      console.log(`  Unique missing models: ${uniqueModels.size}`);
      console.log(`  Sample missing: ${Array.from(uniqueModels).slice(0, 5).join(', ')}`);
      
      // Check if brand exists in database
      const dbBrand = await strapi.entityService.findMany('api::brand.brand', {
        filters: { slug: brand.brand }
      });
      
      if (dbBrand.length === 0) {
        console.log(`  ❌ Brand does not exist in database`);
      } else {
        console.log(`  ✅ Brand exists in database`);
        const brandModels = await strapi.entityService.findMany('api::model.model', {
          filters: { brand: { slug: brand.brand } },
          populate: { brand: true }
        });
        console.log(`  Models in DB: ${brandModels.length}`);
        console.log(`  Sample models: ${brandModels.slice(0, 3).map(m => m.slug).join(', ')}`);
      }
    }
    
    console.log('\n✅ Analysis complete!');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
})();
