const fs = require('fs');
const path = require('path');

// Path to the wipers database
const WIPERS_DATA_PATH = path.join(__dirname, 'wipers', 'wipers_database.json');

function removeBrandPrefixesFromModels() {
  try {
    console.log('🚀 Starting removal of brand prefixes from model names...');
    
    // Read the wipers database
    console.log('📖 Reading wipers database...');
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, 'utf8'));
    
    if (!wipersData.brands) {
      throw new Error('Invalid wipers data format: brands property not found');
    }
    
    // Create backup
    const backupPath = WIPERS_DATA_PATH.replace('.json', '_backup_before_model_cleanup.json');
    fs.writeFileSync(backupPath, JSON.stringify(wipersData, null, 2));
    console.log(`💾 Backup created: ${backupPath}`);
    
    const originalBrands = Object.keys(wipersData.brands);
    console.log(`📊 Found ${originalBrands.length} brands in wipers database`);
    
    // Track changes
    const changes = [];
    let totalModelsProcessed = 0;
    let totalModelsChanged = 0;
    
    // Process each brand
    for (const [brandName, brandData] of Object.entries(wipersData.brands)) {
      if (!Array.isArray(brandData)) continue;
      
      console.log(`\n🔍 Processing brand: ${brandName}`);
      
      const brandChanges = [];
      
      // Process each model in this brand
      for (const model of brandData) {
        totalModelsProcessed++;
        
        if (!model.model) continue;
        
        const originalModelName = model.model;
        let cleanedModelName = originalModelName;
        
        // Remove brand name prefix (case insensitive)
        const brandNameUpper = brandName.toUpperCase();
        const modelNameUpper = originalModelName.toUpperCase();
        
        // Check if model name starts with brand name
        if (modelNameUpper.startsWith(brandNameUpper + ' ')) {
          cleanedModelName = originalModelName.substring(brandName.length + 1).trim();
          totalModelsChanged++;
          
          brandChanges.push({
            original: originalModelName,
            cleaned: cleanedModelName
          });
        }
        
        // Update the model name
        model.model = cleanedModelName;
      }
      
      if (brandChanges.length > 0) {
        changes.push({
          brand: brandName,
          changes: brandChanges,
          changeCount: brandChanges.length
        });
        
        console.log(`   📝 Changed ${brandChanges.length} model names`);
        brandChanges.slice(0, 3).forEach(change => {
          console.log(`      "${change.original}" → "${change.cleaned}"`);
        });
        if (brandChanges.length > 3) {
          console.log(`      ... and ${brandChanges.length - 3} more`);
        }
      } else {
        console.log(`   ✅ No changes needed`);
      }
    }
    
    // Update metadata
    wipersData.metadata = {
      ...wipersData.metadata,
      modelCleanupAt: new Date().toISOString(),
      modelCleanupChanges: changes.length,
      totalModelsProcessed: totalModelsProcessed,
      totalModelsChanged: totalModelsChanged
    };
    
    // Write the cleaned data
    console.log('\n💾 Writing cleaned wipers database...');
    fs.writeFileSync(WIPERS_DATA_PATH, JSON.stringify(wipersData, null, 2));
    
    console.log('\n✅ Model name cleanup completed successfully!');
    console.log(`📊 Results:`);
    console.log(`   - Total models processed: ${totalModelsProcessed}`);
    console.log(`   - Total models changed: ${totalModelsChanged}`);
    console.log(`   - Brands with changes: ${changes.length}`);
    console.log(`   - Backup saved to: ${backupPath}`);
    
    if (changes.length > 0) {
      console.log(`\n🔄 Summary of changes by brand:`);
      changes.forEach(change => {
        console.log(`   - ${change.brand}: ${change.changeCount} models changed`);
      });
      
      console.log(`\n📋 Detailed changes:`);
      changes.forEach(change => {
        console.log(`\n🏷️  ${change.brand} (${change.changeCount} changes):`);
        change.changes.forEach(modelChange => {
          console.log(`   "${modelChange.original}" → "${modelChange.cleaned}"`);
        });
      });
    }
    
    return {
      totalModelsProcessed,
      totalModelsChanged,
      brandsWithChanges: changes.length,
      changes: changes
    };
    
  } catch (error) {
    console.error('❌ Error cleaning model names:', error);
    throw error;
  }
}

// Run the cleanup
if (require.main === module) {
  removeBrandPrefixesFromModels()
    .then(() => {
      console.log('🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { removeBrandPrefixesFromModels };
