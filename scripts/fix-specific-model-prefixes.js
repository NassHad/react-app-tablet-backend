const fs = require('fs');
const path = require('path');

// Path to the wipers database
const WIPERS_DATA_PATH = path.join(__dirname, 'wipers', 'wipers_database.json');

// Specific model name fixes for brands that have prefixes
const MODEL_NAME_FIXES = {
  'ALFA ROMEO': {
    'Alfa 6': '6',
    'Alfa 33 Q4': '33 Q4',
    'Alfa 33': '33',
    'Alfa 145': '145',
    'Alfa 147': '147',
    'Alfa 155 Q4': '155 Q4',
    'Alfa 156': '156',
    'Alfa 156 Sportwagon': '156 Sportwagon',
    'Alfa 159': '159',
    'Alfa 159 Sportwagon': '159 Sportwagon',
    'Alfa 164': '164',
    'Alfa 166': '166',
    'Alfa 75': '75',
    'Alfa 90': '90',
    'Alfa 155': '155',
    'Alfa 145 QV': '145 QV',
    'Alfa 146': '146',
    'Alfa 147 GTA': '147 GTA'
  }
};

function fixSpecificModelPrefixes() {
  try {
    console.log('🚀 Starting specific model prefix fixes...');
    
    // Read the wipers database
    console.log('📖 Reading wipers database...');
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, 'utf8'));
    
    if (!wipersData.brands) {
      throw new Error('Invalid wipers data format: brands property not found');
    }
    
    // Create backup
    const backupPath = WIPERS_DATA_PATH.replace('.json', '_backup_before_specific_fixes.json');
    fs.writeFileSync(backupPath, JSON.stringify(wipersData, null, 2));
    console.log(`💾 Backup created: ${backupPath}`);
    
    // Track changes
    const changes = [];
    let totalModelsChanged = 0;
    
    // Process each brand with specific fixes
    for (const [brandName, modelFixes] of Object.entries(MODEL_NAME_FIXES)) {
      if (!wipersData.brands[brandName]) {
        console.log(`⚠️  Brand ${brandName} not found in wipers data`);
        continue;
      }
      
      console.log(`\n🔍 Processing brand: ${brandName}`);
      
      const brandData = wipersData.brands[brandName];
      if (!Array.isArray(brandData)) {
        console.log(`⚠️  Brand ${brandName} data is not an array`);
        continue;
      }
      
      const brandChanges = [];
      
      // Process each model in this brand
      for (const model of brandData) {
        if (!model.model) continue;
        
        const originalModelName = model.model;
        
        // Check if this model has a specific fix
        if (modelFixes[originalModelName]) {
          const newModelName = modelFixes[originalModelName];
          model.model = newModelName;
          totalModelsChanged++;
          
          brandChanges.push({
            original: originalModelName,
            fixed: newModelName
          });
        }
      }
      
      if (brandChanges.length > 0) {
        changes.push({
          brand: brandName,
          changes: brandChanges,
          changeCount: brandChanges.length
        });
        
        console.log(`   📝 Fixed ${brandChanges.length} model names`);
        brandChanges.forEach(change => {
          console.log(`      "${change.original}" → "${change.fixed}"`);
        });
      } else {
        console.log(`   ✅ No changes needed`);
      }
    }
    
    // Update metadata
    wipersData.metadata = {
      ...wipersData.metadata,
      specificModelFixesAt: new Date().toISOString(),
      specificModelFixesCount: changes.length,
      totalModelsFixed: totalModelsChanged
    };
    
    // Write the fixed data
    console.log('\n💾 Writing fixed wipers database...');
    fs.writeFileSync(WIPERS_DATA_PATH, JSON.stringify(wipersData, null, 2));
    
    console.log('\n✅ Specific model prefix fixes completed successfully!');
    console.log(`📊 Results:`);
    console.log(`   - Total models fixed: ${totalModelsChanged}`);
    console.log(`   - Brands with fixes: ${changes.length}`);
    console.log(`   - Backup saved to: ${backupPath}`);
    
    if (changes.length > 0) {
      console.log(`\n🔄 Summary of fixes by brand:`);
      changes.forEach(change => {
        console.log(`   - ${change.brand}: ${change.changeCount} models fixed`);
      });
    }
    
    return {
      totalModelsFixed: totalModelsChanged,
      brandsWithFixes: changes.length,
      changes: changes
    };
    
  } catch (error) {
    console.error('❌ Error fixing model prefixes:', error);
    throw error;
  }
}

// Run the fixes
if (require.main === module) {
  fixSpecificModelPrefixes()
    .then(() => {
      console.log('🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixSpecificModelPrefixes };
