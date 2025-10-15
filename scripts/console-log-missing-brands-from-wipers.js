// Script to log missing brands from wipers database
// Copy and paste this entire content into Strapi console

async function logMissingBrandsFromWipers() {
  try {
    console.log('🚀 Starting analysis of missing brands from wipers database...');
    
    // Load wipers data from the file system
    const fs = require('fs');
    const path = require('path');
    const WIPERS_DATA_PATH = path.join(process.cwd(), 'scripts', 'wipers', 'wipers_database.json');
    
    // Check if wipers data file exists
    if (!fs.existsSync(WIPERS_DATA_PATH)) {
      throw new Error(`Wipers data file not found at: ${WIPERS_DATA_PATH}`);
    }
    
    // Read the wipers database
    console.log('📖 Reading wipers database...');
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, 'utf8'));
    
    if (!wipersData.brands) {
      throw new Error('Invalid wipers data format: brands property not found');
    }
    
    // Get all existing brands from Strapi
    console.log('🔍 Fetching existing brands from Strapi...');
    const existingBrands = await strapi.entityService.findMany('api::brand.brand', {
      populate: '*',
      sort: 'name:asc'
    });
    
    console.log(`📊 Found ${Object.keys(wipersData.brands).length} brands in wipers database`);
    console.log(`📊 Found ${existingBrands.length} brands in main database`);
    
    // Create lookup map for existing brands
    const existingBrandMap = new Map();
    existingBrands.forEach(brand => {
      if (brand && brand.name) {
        existingBrandMap.set(brand.name.toUpperCase(), brand);
      }
    });
    
    // Analyze wipers brands
    const wipersBrands = Object.keys(wipersData.brands);
    const missingBrands = [];
    const existingBrandsInWipers = [];
    const brandAnalysis = [];
    
    for (const wipersBrandName of wipersBrands) {
      const existingBrand = existingBrandMap.get(wipersBrandName.toUpperCase());
      
      const brandData = wipersData.brands[wipersBrandName];
      const modelCount = Array.isArray(brandData) ? brandData.length : 0;
      
      const analysis = {
        brandName: wipersBrandName,
        modelCount: modelCount,
        existsInMainDB: !!existingBrand,
        existingBrandSlug: existingBrand?.slug || null,
        existingBrandId: existingBrand?.id || null
      };
      
      brandAnalysis.push(analysis);
      
      if (!existingBrand) {
        missingBrands.push({
          name: wipersBrandName,
          modelCount: modelCount,
          models: Array.isArray(brandData) ? brandData.map(m => m.model).slice(0, 5) : [], // First 5 models as sample
          totalModels: modelCount
        });
      } else {
        existingBrandsInWipers.push({
          name: wipersBrandName,
          modelCount: modelCount,
          existingSlug: existingBrand.slug,
          existingId: existingBrand.id
        });
      }
    }
    
    // Sort missing brands by model count (descending)
    missingBrands.sort((a, b) => b.modelCount - a.modelCount);
    
    // Create comprehensive report
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalWipersBrands: wipersBrands.length,
        totalMainBrands: existingBrands.length,
        missingBrandsCount: missingBrands.length,
        existingBrandsInWipersCount: existingBrandsInWipers.length
      },
      summary: {
        missingBrands: missingBrands.length,
        existingBrandsInWipers: existingBrandsInWipers.length,
        totalWipersBrands: wipersBrands.length
      },
      missingBrands: missingBrands,
      existingBrandsInWipers: existingBrandsInWipers,
      fullAnalysis: brandAnalysis
    };
    
    // Write the report to file
    const OUTPUT_PATH = path.join(process.cwd(), 'missing-brands-from-wipers.json');
    console.log('💾 Writing missing brands report to file...');
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
    
    console.log('✅ Analysis completed successfully!');
    console.log(`📊 Results:`);
    console.log(`   - Total wipers brands: ${wipersBrands.length}`);
    console.log(`   - Missing brands: ${missingBrands.length}`);
    console.log(`   - Existing brands in wipers: ${existingBrandsInWipers.length}`);
    console.log(`   - Report saved to: ${OUTPUT_PATH}`);
    
    console.log(`\n🔝 Top 10 missing brands by model count:`);
    missingBrands.slice(0, 10).forEach((brand, index) => {
      console.log(`   ${index + 1}. ${brand.name} (${brand.modelCount} models)`);
    });
    
    if (missingBrands.length > 10) {
      console.log(`   ... and ${missingBrands.length - 10} more brands`);
    }
    
    console.log(`\n📋 Missing brands with most models:`);
    const topMissingBrands = missingBrands.slice(0, 5);
    topMissingBrands.forEach(brand => {
      console.log(`\n🏷️  ${brand.name} (${brand.modelCount} models):`);
      console.log(`   Sample models: ${brand.models.join(', ')}`);
      if (brand.totalModels > 5) {
        console.log(`   ... and ${brand.totalModels - 5} more models`);
      }
    });
    
    // Also log the missing brands to console for easy copying
    console.log(`\n📋 Missing brands list (for easy copying):`);
    console.log('[');
    missingBrands.forEach((brand, index) => {
      const comma = index < missingBrands.length - 1 ? ',' : '';
      console.log(`  "${brand.name}"${comma}`);
    });
    console.log(']');
    
    return report;
    
  } catch (error) {
    console.error('❌ Error analyzing missing brands:', error);
    throw error;
  }
}

// Run the analysis
logMissingBrandsFromWipers();
