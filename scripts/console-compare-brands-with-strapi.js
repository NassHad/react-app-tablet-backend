// Script to compare wipers brands with actual Strapi Brand table
// Copy and paste this entire content into Strapi console

async function compareBrandsWithStrapi() {
  try {
    console.log('🚀 Starting comparison of wipers brands with Strapi Brand table...');
    
    // Load wipers brands analysis
    const fs = require('fs');
    const path = require('path');
    const WIPERS_ANALYSIS_PATH = path.join(process.cwd(), 'scripts', 'wipers-brands-analysis.json');
    
    // Check if wipers analysis file exists
    if (!fs.existsSync(WIPERS_ANALYSIS_PATH)) {
      throw new Error(`Wipers analysis file not found at: ${WIPERS_ANALYSIS_PATH}`);
    }
    
    // Read the wipers brands analysis
    console.log('📖 Reading wipers brands analysis...');
    const wipersAnalysis = JSON.parse(fs.readFileSync(WIPERS_ANALYSIS_PATH, 'utf8'));
    
    // Get all brands from Strapi Brand table
    console.log('🔍 Fetching all brands from Strapi Brand table...');
    const strapiBrands = await strapi.entityService.findMany('api::brand.brand', {
      populate: '*',
      sort: 'name:asc'
    });
    
    console.log(`📊 Found ${wipersAnalysis.allBrands.length} brands in wipers database`);
    console.log(`📊 Found ${strapiBrands.length} brands in Strapi Brand table`);
    
    // Create lookup maps
    const strapiBrandMap = new Map();
    strapiBrands.forEach(brand => {
      if (brand && brand.name) {
        strapiBrandMap.set(brand.name.toUpperCase(), brand);
      }
    });
    
    // Analyze which wipers brands are missing from Strapi
    const missingBrands = [];
    const existingBrands = [];
    const brandComparison = [];
    
    for (const wipersBrand of wipersAnalysis.allBrands) {
      const strapiBrand = strapiBrandMap.get(wipersBrand.brandName.toUpperCase());
      
      const comparison = {
        wipersBrandName: wipersBrand.brandName,
        modelCount: wipersBrand.modelCount,
        modelsWithWipers: wipersBrand.modelsWithWipers,
        sampleModels: wipersBrand.sampleModels,
        existsInStrapi: !!strapiBrand,
        strapiBrandName: strapiBrand?.name || null,
        strapiBrandSlug: strapiBrand?.slug || null,
        strapiBrandId: strapiBrand?.id || null
      };
      
      brandComparison.push(comparison);
      
      if (!strapiBrand) {
        missingBrands.push({
          name: wipersBrand.brandName,
          modelCount: wipersBrand.modelCount,
          modelsWithWipers: wipersBrand.modelsWithWipers,
          sampleModels: wipersBrand.sampleModels,
          allModels: wipersBrand.allModels
        });
      } else {
        existingBrands.push({
          name: wipersBrand.brandName,
          modelCount: wipersBrand.modelCount,
          modelsWithWipers: wipersBrand.modelsWithWipers,
          strapiSlug: strapiBrand.slug,
          strapiId: strapiBrand.id
        });
      }
    }
    
    // Sort missing brands by model count (descending)
    missingBrands.sort((a, b) => b.modelCount - a.modelCount);
    
    // Calculate statistics
    const totalWipersModels = wipersAnalysis.allBrands.reduce((sum, brand) => sum + brand.modelCount, 0);
    const totalExistingModels = existingBrands.reduce((sum, brand) => sum + brand.modelCount, 0);
    const totalMissingModels = missingBrands.reduce((sum, brand) => sum + brand.modelCount, 0);
    
    // Create comprehensive report
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalWipersBrands: wipersAnalysis.allBrands.length,
        totalStrapiBrands: strapiBrands.length,
        totalExistingBrands: existingBrands.length,
        totalMissingBrands: missingBrands.length,
        totalWipersModels: totalWipersModels,
        totalExistingModels: totalExistingModels,
        totalMissingModels: totalMissingModels
      },
      summary: {
        existingBrands: existingBrands.length,
        missingBrands: missingBrands.length,
        totalWipersBrands: wipersAnalysis.allBrands.length,
        coveragePercentage: Math.round((existingBrands.length / wipersAnalysis.allBrands.length) * 100),
        modelCoveragePercentage: Math.round((totalExistingModels / totalWipersModels) * 100)
      },
      existingBrands: existingBrands,
      missingBrands: missingBrands,
      missingBrandNamesOnly: missingBrands.map(b => b.name),
      existingBrandNamesOnly: existingBrands.map(b => b.name),
      fullComparison: brandComparison,
      strapiBrands: strapiBrands.map(b => ({
        id: b.id,
        name: b.name,
        slug: b.slug
      }))
    };
    
    // Write the report to file
    const OUTPUT_PATH = path.join(process.cwd(), 'strapi-brands-comparison.json');
    console.log('💾 Writing Strapi brands comparison to file...');
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
    
    console.log('✅ Comparison completed successfully!');
    console.log(`📊 Results:`);
    console.log(`   - Total wipers brands: ${wipersAnalysis.allBrands.length}`);
    console.log(`   - Total Strapi brands: ${strapiBrands.length}`);
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
    
    console.log(`\n📋 All Strapi brands:`);
    console.log('[');
    strapiBrands.forEach((brand, index) => {
      const comma = index < strapiBrands.length - 1 ? ',' : '';
      console.log(`  "${brand.name}"${comma}`);
    });
    console.log(']');
    
    return report;
    
  } catch (error) {
    console.error('❌ Error comparing brands with Strapi:', error);
    throw error;
  }
}

// Run the comparison
compareBrandsWithStrapi();
