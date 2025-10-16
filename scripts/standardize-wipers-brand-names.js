const fs = require('fs');
const path = require('path');

// Path to the wipers database
const WIPERS_DATA_PATH = path.join(__dirname, 'wipers', 'wipers_database.json');
const OUTPUT_PATH = path.join(__dirname, 'wipers', 'wipers_database_standardized.json');

// Brand name mappings from wipers data to Strapi Brand table
const BRAND_NAME_MAPPINGS = {
  'CITROËN': 'CITROEN',
  'SSANG-YONG': 'SSANGYONG',
  'DS AUTOMOBILES': 'DS',
  'ROVER / MG': 'ROVER', // or 'MG' - you can choose which one
  'FORTHING (Dongfeng)': 'FORTHING',
  'DFSK (SERES)': 'DFSK',
  'LDV (LEYLAND DAF)': 'LDV',
  'LYNK & CO': 'LYNK',
  'MERCEDES-BENZ': 'MERCEDES-BENZ', // Keep as is since it exists in Strapi
  'AUSTIN ROVER': 'AUSTIN',
  'FORD USA': 'FORD',
  'RENAULT TRUCKS': 'RENAULT'
};

function standardizeWipersBrandNames() {
  try {
    console.log('🚀 Starting standardization of wipers brand names...');
    
    // Read the wipers database
    console.log('📖 Reading wipers database...');
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, 'utf8'));
    
    if (!wipersData.brands) {
      throw new Error('Invalid wipers data format: brands property not found');
    }
    
    // Create backup
    const backupPath = WIPERS_DATA_PATH.replace('.json', '_backup_before_standardization.json');
    fs.writeFileSync(backupPath, JSON.stringify(wipersData, null, 2));
    console.log(`💾 Backup created: ${backupPath}`);
    
    const originalBrands = Object.keys(wipersData.brands);
    console.log(`📊 Found ${originalBrands.length} brands in wipers database`);
    
    // Track changes
    const changes = [];
    const newBrandsData = {};
    
    // Process each brand
    for (const [originalBrandName, brandData] of Object.entries(wipersData.brands)) {
      const standardizedBrandName = BRAND_NAME_MAPPINGS[originalBrandName] || originalBrandName;
      
      if (standardizedBrandName !== originalBrandName) {
        changes.push({
          original: originalBrandName,
          standardized: standardizedBrandName,
          modelCount: Array.isArray(brandData) ? brandData.length : 0
        });
        console.log(`🔄 ${originalBrandName} → ${standardizedBrandName}`);
      }
      
      // Handle potential conflicts (if standardized name already exists)
      if (newBrandsData[standardizedBrandName]) {
        console.log(`⚠️  Conflict: ${standardizedBrandName} already exists. Merging data...`);
        
        // Merge the data
        const existingData = newBrandsData[standardizedBrandName];
        const newData = brandData;
        
        if (Array.isArray(existingData) && Array.isArray(newData)) {
          newBrandsData[standardizedBrandName] = [...existingData, ...newData];
        } else {
          // If not arrays, keep the new data
          newBrandsData[standardizedBrandName] = newData;
        }
      } else {
        newBrandsData[standardizedBrandName] = brandData;
      }
    }
    
    // Update the wipers data with standardized brand names
    wipersData.brands = newBrandsData;
    
    // Update metadata
    wipersData.metadata = {
      ...wipersData.metadata,
      standardizedAt: new Date().toISOString(),
      brandStandardizationChanges: changes.length,
      originalBrandCount: originalBrands.length,
      standardizedBrandCount: Object.keys(newBrandsData).length
    };
    
    // Write the standardized data
    console.log('💾 Writing standardized wipers database...');
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(wipersData, null, 2));
    
    // Also update the original file
    fs.writeFileSync(WIPERS_DATA_PATH, JSON.stringify(wipersData, null, 2));
    
    console.log('✅ Standardization completed successfully!');
    console.log(`📊 Results:`);
    console.log(`   - Original brands: ${originalBrands.length}`);
    console.log(`   - Standardized brands: ${Object.keys(newBrandsData).length}`);
    console.log(`   - Changes made: ${changes.length}`);
    console.log(`   - Backup saved to: ${backupPath}`);
    console.log(`   - Standardized data saved to: ${OUTPUT_PATH}`);
    
    if (changes.length > 0) {
      console.log(`\n🔄 Brand name changes:`);
      changes.forEach(change => {
        console.log(`   - ${change.original} → ${change.standardized} (${change.modelCount} models)`);
      });
    }
    
    // Show summary of standardized brands
    console.log(`\n📋 Standardized brand names:`);
    const standardizedBrands = Object.keys(newBrandsData).sort();
    console.log('[');
    standardizedBrands.forEach((brand, index) => {
      const comma = index < standardizedBrands.length - 1 ? ',' : '';
      console.log(`  "${brand}"${comma}`);
    });
    console.log(']');
    
    return {
      originalBrands: originalBrands.length,
      standardizedBrands: Object.keys(newBrandsData).length,
      changes: changes,
      standardizedBrandNames: standardizedBrands
    };
    
  } catch (error) {
    console.error('❌ Error standardizing brand names:', error);
    throw error;
  }
}

// Run the standardization
if (require.main === module) {
  standardizeWipersBrandNames()
    .then(() => {
      console.log('🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { standardizeWipersBrandNames };
