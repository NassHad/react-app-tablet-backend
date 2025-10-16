const fs = require('fs');
const path = require('path');

// Path to the wipers brands analysis
const WIPERS_ANALYSIS_PATH = path.join(__dirname, 'wipers-brands-analysis.json');
const OUTPUT_PATH = path.join(__dirname, 'missing-brands-comparison.json');

// Based on the import results, these are the brands that exist in your main database
// (extracted from the successful imports)
const EXISTING_BRANDS_IN_MAIN_DB = [
  'AUDI',
  'BMW', 
  'CADILLAC',
  'CHEVROLET',
  'CHRYSLER',
  'CUPRA',
  'DACIA',
  'FIAT',
  'FORD',
  'HONDA',
  'HYUNDAI',
  'INFINITI',
  'JAGUAR',
  'JEEP',
  'KIA',
  'LANCIA',
  'LEXUS',
  'MAZDA',
  'MERCEDES-BENZ',
  'MINI',
  'MITSUBISHI',
  'NISSAN',
  'OPEL',
  'PEUGEOT',
  'PORSCHE',
  'RENAULT',
  'SEAT',
  'SKODA',
  'SMART',
  'SUBARU',
  'SUZUKI',
  'TOYOTA',
  'VAUXHALL',
  'VOLKSWAGEN',
  'VOLVO'
];

function compareWipersWithExistingBrands() {
  try {
    console.log('🚀 Starting comparison of wipers brands with existing brands...');
    
    // Read the wipers brands analysis
    console.log('📖 Reading wipers brands analysis...');
    const wipersAnalysis = JSON.parse(fs.readFileSync(WIPERS_ANALYSIS_PATH, 'utf8'));
    
    const wipersBrands = wipersAnalysis.allBrands;
    const existingBrandsSet = new Set(EXISTING_BRANDS_IN_MAIN_DB.map(b => b.toUpperCase()));
    
    console.log(`📊 Found ${wipersBrands.length} brands in wipers database`);
    console.log(`📊 Found ${EXISTING_BRANDS_IN_MAIN_DB.length} brands in main database`);
    
    // Analyze which brands are missing
    const missingBrands = [];
    const existingBrands = [];
    
    for (const brand of wipersBrands) {
      const exists = existingBrandsSet.has(brand.brandName.toUpperCase());
      
      if (exists) {
        existingBrands.push({
          name: brand.brandName,
          modelCount: brand.modelCount,
          modelsWithWipers: brand.modelsWithWipers,
          sampleModels: brand.sampleModels
        });
      } else {
        missingBrands.push({
          name: brand.brandName,
          modelCount: brand.modelCount,
          modelsWithWipers: brand.modelsWithWipers,
          sampleModels: brand.sampleModels,
          allModels: brand.allModels
        });
      }
    }
    
    // Sort missing brands by model count (descending)
    missingBrands.sort((a, b) => b.modelCount - a.modelCount);
    
    // Calculate statistics
    const totalWipersModels = wipersBrands.reduce((sum, brand) => sum + brand.modelCount, 0);
    const totalExistingModels = existingBrands.reduce((sum, brand) => sum + brand.modelCount, 0);
    const totalMissingModels = missingBrands.reduce((sum, brand) => sum + brand.modelCount, 0);
    
    // Create comprehensive report
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalWipersBrands: wipersBrands.length,
        totalExistingBrands: existingBrands.length,
        totalMissingBrands: missingBrands.length,
        totalWipersModels: totalWipersModels,
        totalExistingModels: totalExistingModels,
        totalMissingModels: totalMissingModels
      },
      summary: {
        existingBrands: existingBrands.length,
        missingBrands: missingBrands.length,
        totalWipersBrands: wipersBrands.length,
        coveragePercentage: Math.round((existingBrands.length / wipersBrands.length) * 100),
        modelCoveragePercentage: Math.round((totalExistingModels / totalWipersModels) * 100)
      },
      existingBrands: existingBrands,
      missingBrands: missingBrands,
      missingBrandNamesOnly: missingBrands.map(b => b.name),
      existingBrandNamesOnly: existingBrands.map(b => b.name)
    };
    
    // Write the report to file
    console.log('💾 Writing missing brands comparison to file...');
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
    
    console.log('✅ Comparison completed successfully!');
    console.log(`📊 Results:`);
    console.log(`   - Total wipers brands: ${wipersBrands.length}`);
    console.log(`   - Existing brands: ${existingBrands.length} (${report.summary.coveragePercentage}%)`);
    console.log(`   - Missing brands: ${missingBrands.length} (${100 - report.summary.coveragePercentage}%)`);
    console.log(`   - Total wipers models: ${totalWipersModels}`);
    console.log(`   - Existing models: ${totalExistingModels} (${report.summary.modelCoveragePercentage}%)`);
    console.log(`   - Missing models: ${totalMissingModels} (${100 - report.summary.modelCoveragePercentage}%)`);
    console.log(`   - Report saved to: ${OUTPUT_PATH}`);
    
    console.log(`\n🔝 Top 10 missing brands by model count:`);
    missingBrands.slice(0, 10).forEach((brand, index) => {
      console.log(`   ${index + 1}. ${brand.name} (${brand.modelCount} models)`);
    });
    
    console.log(`\n📋 Missing brands with most models:`);
    const topMissingBrands = missingBrands.slice(0, 5);
    topMissingBrands.forEach(brand => {
      console.log(`\n🏷️  ${brand.name} (${brand.modelCount} models):`);
      console.log(`   Sample models: ${brand.sampleModels.join(', ')}`);
      if (brand.modelCount > 5) {
        console.log(`   ... and ${brand.modelCount - 5} more models`);
      }
    });
    
    console.log(`\n📋 Missing brands list (for easy copying):`);
    console.log('[');
    missingBrands.forEach((brand, index) => {
      const comma = index < missingBrands.length - 1 ? ',' : '';
      console.log(`  "${brand.name}"${comma}`);
    });
    console.log(']');
    
    console.log(`\n✅ Existing brands in wipers database:`);
    console.log('[');
    existingBrands.forEach((brand, index) => {
      const comma = index < existingBrands.length - 1 ? ',' : '';
      console.log(`  "${brand.name}"${comma}`);
    });
    console.log(']');
    
    return report;
    
  } catch (error) {
    console.error('❌ Error comparing brands:', error);
    throw error;
  }
}

// Run the comparison
if (require.main === module) {
  compareWipersWithExistingBrands()
    .then(() => {
      console.log('🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { compareWipersWithExistingBrands };
