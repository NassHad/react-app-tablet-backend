const fs = require('fs');
const path = require('path');

// Path to the wipers database
const WIPERS_DATA_PATH = path.join(__dirname, 'wipers', 'wipers_database.json');
const OUTPUT_PATH = path.join(__dirname, 'wipers-brands-analysis.json');

function analyzeWipersBrands() {
  try {
    console.log('🚀 Starting analysis of wipers brands...');
    
    // Read the wipers database
    console.log('📖 Reading wipers database...');
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, 'utf8'));
    
    if (!wipersData.brands) {
      throw new Error('Invalid wipers data format: brands property not found');
    }
    
    // Analyze wipers brands
    const wipersBrands = Object.keys(wipersData.brands);
    const brandAnalysis = [];
    
    console.log(`📊 Found ${wipersBrands.length} brands in wipers database`);
    
    for (const wipersBrandName of wipersBrands) {
      const brandData = wipersData.brands[wipersBrandName];
      const modelCount = Array.isArray(brandData) ? brandData.length : 0;
      
      // Get sample models (first 5)
      const sampleModels = Array.isArray(brandData) ? brandData.map(m => m.model).slice(0, 5) : [];
      
      // Count models with wipers data
      let modelsWithWipers = 0;
      if (Array.isArray(brandData)) {
        modelsWithWipers = brandData.filter(model => 
          model.wipers && (
            model.wipers.multiconnexion || 
            model.wipers.standard || 
            model.wipers.arriere
          )
        ).length;
      }
      
      const analysis = {
        brandName: wipersBrandName,
        modelCount: modelCount,
        modelsWithWipers: modelsWithWipers,
        sampleModels: sampleModels,
        allModels: Array.isArray(brandData) ? brandData.map(m => m.model) : []
      };
      
      brandAnalysis.push(analysis);
    }
    
    // Sort by model count (descending)
    brandAnalysis.sort((a, b) => b.modelCount - a.modelCount);
    
    // Create comprehensive report
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        wipersDatabasePath: WIPERS_DATA_PATH,
        totalWipersBrands: wipersBrands.length,
        totalModels: brandAnalysis.reduce((sum, brand) => sum + brand.modelCount, 0),
        totalModelsWithWipers: brandAnalysis.reduce((sum, brand) => sum + brand.modelsWithWipers, 0)
      },
      summary: {
        totalBrands: wipersBrands.length,
        totalModels: brandAnalysis.reduce((sum, brand) => sum + brand.modelCount, 0),
        totalModelsWithWipers: brandAnalysis.reduce((sum, brand) => sum + brand.modelsWithWipers, 0),
        brandsWithMostModels: brandAnalysis.slice(0, 10).map(b => ({
          name: b.brandName,
          modelCount: b.modelCount,
          modelsWithWipers: b.modelsWithWipers
        }))
      },
      allBrands: brandAnalysis,
      brandNamesOnly: brandAnalysis.map(b => b.brandName)
    };
    
    // Write the report to file
    console.log('💾 Writing wipers brands analysis to file...');
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
    
    console.log('✅ Analysis completed successfully!');
    console.log(`📊 Results:`);
    console.log(`   - Total wipers brands: ${wipersBrands.length}`);
    console.log(`   - Total models: ${report.summary.totalModels}`);
    console.log(`   - Models with wipers data: ${report.summary.totalModelsWithWipers}`);
    console.log(`   - Report saved to: ${OUTPUT_PATH}`);
    
    console.log(`\n🔝 Top 10 brands by model count:`);
    brandAnalysis.slice(0, 10).forEach((brand, index) => {
      console.log(`   ${index + 1}. ${brand.brandName} (${brand.modelCount} models, ${brand.modelsWithWipers} with wipers)`);
    });
    
    console.log(`\n📋 All brand names (for easy copying):`);
    console.log('[');
    brandAnalysis.forEach((brand, index) => {
      const comma = index < brandAnalysis.length - 1 ? ',' : '';
      console.log(`  "${brand.brandName}"${comma}`);
    });
    console.log(']');
    
    return report;
    
  } catch (error) {
    console.error('❌ Error analyzing wipers brands:', error);
    throw error;
  }
}

// Run the analysis
if (require.main === module) {
  analyzeWipersBrands()
    .then(() => {
      console.log('🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { analyzeWipersBrands };
