// Clean Corrupted OSRAM Data - Remove corrupted entries and create clean dataset
// Copy and paste this ENTIRE script into your Strapi console

const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log('🧹 Starting OSRAM Data Cleanup...');
    
    // Read the original osram data
    const osramPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_with_slugs.json');
    const osramData = fs.readFileSync(osramPath, 'utf8');
    const osramRecords = JSON.parse(osramData);
    
    console.log(`📊 Original records: ${osramRecords.length}`);
    
    // Filter out corrupted entries
    const cleanRecords = osramRecords.filter(record => {
      // Check for corrupted brand slugs
      if (!record.brandSlug || 
          record.brandSlug.includes('*') || 
          record.brandSlug.includes(';') ||
          record.brandSlug.includes('"') ||
          record.brandSlug.length < 2) {
        return false;
      }
      
      // Check for corrupted model slugs
      if (!record.modelSlug || 
          record.modelSlug.includes('*') || 
          record.modelSlug.includes(';') ||
          record.modelSlug.includes('"') ||
          record.modelSlug.length < 2) {
        return false;
      }
      
      // Check for corrupted original names
      if (record.originalBrand && 
          (record.originalBrand.includes('*') || 
           record.originalBrand.includes(';'))) {
        return false;
      }
      
      if (record.originalModel && 
          (record.originalModel.includes('*') || 
           record.originalModel.includes(';'))) {
        return false;
      }
      
      return true;
    });
    
    console.log(`📊 Clean records: ${cleanRecords.length}`);
    console.log(`📊 Removed corrupted: ${osramRecords.length - cleanRecords.length}`);
    
    // Analyze the cleaned data
    console.log('\n📊 Clean Data Analysis:');
    
    const brandCounts = {};
    const modelCounts = {};
    
    cleanRecords.forEach(record => {
      brandCounts[record.brandSlug] = (brandCounts[record.brandSlug] || 0) + 1;
      modelCounts[`${record.brandSlug}/${record.modelSlug}`] = (modelCounts[`${record.brandSlug}/${record.modelSlug}`] || 0) + 1;
    });
    
    const uniqueBrands = Object.keys(brandCounts).length;
    const uniqueModels = Object.keys(modelCounts).length;
    
    console.log(`Unique brands: ${uniqueBrands}`);
    console.log(`Unique models: ${uniqueModels}`);
    
    // Show top brands
    const topBrands = Object.entries(brandCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    console.log('\nTop 10 brands by record count:');
    topBrands.forEach(([brand, count], index) => {
      console.log(`${index + 1}. ${brand}: ${count} records`);
    });
    
    // Check CITROEN specifically
    const citroenRecords = cleanRecords.filter(record => record.brandSlug === 'citroen');
    console.log(`\nCITROEN records: ${citroenRecords.length}`);
    
    if (citroenRecords.length > 0) {
      console.log('CITROEN model slugs:');
      const citroenModels = [...new Set(citroenRecords.map(r => r.modelSlug))];
      citroenModels.slice(0, 10).forEach((model, index) => {
        console.log(`  ${index + 1}. ${model}`);
      });
    }
    
    // Save cleaned data
    const cleanDataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_cleaned.json');
    fs.writeFileSync(cleanDataPath, JSON.stringify(cleanRecords, null, 2));
    
    console.log(`\n✅ Cleaned data saved to: ${cleanDataPath}`);
    
    // Show sample of cleaned data
    console.log('\n📋 Sample of cleaned data:');
    cleanRecords.slice(0, 5).forEach((record, index) => {
      console.log(`${index + 1}. ${record.brandSlug}/${record.modelSlug} (${record.originalBrand} ${record.originalModel})`);
    });
    
    console.log('\n✅ Data cleanup complete!');
    console.log('\nNext steps:');
    console.log('1. Use the cleaned data for import');
    console.log('2. Run the import script with the cleaned data');
    console.log('3. This should significantly improve success rates');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
})();
