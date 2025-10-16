// Script to consolidate LHD/RHD entries when wiper references are identical
const fs = require('fs');
const path = require('path');

// Configuration
const WIPERS_DATA_PATH = path.join(__dirname, 'wipers', 'wipers_database.json');
const BACKUP_PATH = path.join(__dirname, 'wipers', 'wipers_database_backup_consolidation.json');

// Function to compare wipers data objects
function wipersDataEqual(wipers1, wipers2) {
  if (!wipers1 || !wipers2) return false;
  
  // Compare each category
  const categories = ['multiconnexion', 'standard', 'arriere'];
  
  for (const category of categories) {
    const cat1 = wipers1[category];
    const cat2 = wipers2[category];
    
    // If one is null and the other isn't, they're different
    if ((cat1 === null) !== (cat2 === null)) return false;
    
    // If both are null, continue
    if (cat1 === null && cat2 === null) continue;
    
    // Compare each position in the category
    const positions = ['kitAvant', 'coteConducteur', 'monoBalais', 'cotePassager', 'arriere'];
    
    for (const position of positions) {
      if (cat1[position] !== cat2[position]) {
        return false;
      }
    }
  }
  
  return true;
}

// Function to consolidate model entries
function consolidateModelEntries(models) {
  const consolidated = [];
  const processed = new Set();
  
  for (let i = 0; i < models.length; i++) {
    if (processed.has(i)) continue;
    
    const currentModel = models[i];
    const currentWipers = currentModel.wipers;
    const sameWipersModels = [currentModel];
    processed.add(i);
    
    // Look for other models with the same wipers data
    for (let j = i + 1; j < models.length; j++) {
      if (processed.has(j)) continue;
      
      const otherModel = models[j];
      const otherWipers = otherModel.wipers;
      
      // Check if wipers data is identical
      if (wipersDataEqual(currentWipers, otherWipers)) {
        sameWipersModels.push(otherModel);
        processed.add(j);
      }
    }
    
    if (sameWipersModels.length === 1) {
      // No consolidation needed
      consolidated.push(currentModel);
    } else {
      // Consolidate multiple models
      const consolidatedModel = {
        ...currentModel,
        direction: 'LHD/RHD', // Indicate it covers both directions
        notes: `Consolidated from ${sameWipersModels.length} entries: ${sameWipersModels.map(m => m.direction).join(', ')}`
      };
      
      // Add production years info if different
      const years = sameWipersModels.map(m => m.productionYears).filter(Boolean);
      if (years.length > 0) {
        const startYears = years.map(y => y.start).filter(Boolean);
        const endYears = years.map(y => y.end).filter(Boolean);
        
        if (startYears.length > 0) {
          consolidatedModel.productionYears = {
            start: startYears[0], // Use first start year
            end: endYears.length > 0 ? endYears[0] : null
          };
        }
      }
      
      consolidated.push(consolidatedModel);
    }
  }
  
  return consolidated;
}

async function consolidateWipersLhdRhd() {
  try {
    console.log('🔄 Starting LHD/RHD consolidation...');
    
    // Check if wipers data file exists
    if (!fs.existsSync(WIPERS_DATA_PATH)) {
      throw new Error(`Wipers data file not found at: ${WIPERS_DATA_PATH}`);
    }
    
    // Create backup first
    console.log('💾 Creating backup...');
    const originalData = fs.readFileSync(WIPERS_DATA_PATH, 'utf8');
    fs.writeFileSync(BACKUP_PATH, originalData);
    console.log(`✅ Backup created at: ${BACKUP_PATH}`);
    
    // Load wipers data
    console.log('📖 Loading wipers data...');
    const wipersData = JSON.parse(originalData);
    
    if (!wipersData.brands) {
      throw new Error('Invalid wipers data format: brands property not found');
    }
    
    console.log(`📊 Found ${Object.keys(wipersData.brands).length} brands in wipers data`);
    
    // Track changes
    let totalModels = 0;
    let consolidatedModels = 0;
    let totalConsolidated = 0;
    const consolidationLog = [];
    
    // Process each brand
    Object.keys(wipersData.brands).forEach(brandName => {
      const brandData = wipersData.brands[brandName];
      if (!Array.isArray(brandData)) return;
      
      const originalCount = brandData.length;
      const consolidatedBrandData = consolidateModelEntries(brandData);
      const newCount = consolidatedBrandData.length;
      
      if (originalCount !== newCount) {
        const saved = originalCount - newCount;
        consolidatedModels += saved;
        totalConsolidated++;
        
        consolidationLog.push({
          brand: brandName,
          originalCount,
          newCount,
          saved,
          consolidationRatio: ((saved / originalCount) * 100).toFixed(1) + '%'
        });
      }
      
      totalModels += originalCount;
      wipersData.brands[brandName] = consolidatedBrandData;
    });
    
    console.log(`📊 Consolidation complete:`);
    console.log(`   - Total models processed: ${totalModels}`);
    console.log(`   - Models consolidated: ${consolidatedModels}`);
    console.log(`   - Brands with consolidations: ${totalConsolidated}`);
    console.log(`   - Final model count: ${totalModels - consolidatedModels}`);
    console.log(`   - Reduction: ${((consolidatedModels / totalModels) * 100).toFixed(1)}%`);
    
    // Show consolidation examples
    if (consolidationLog.length > 0) {
      console.log('\n🔍 Consolidation examples:');
      consolidationLog.slice(0, 10).forEach(log => {
        console.log(`   - "${log.brand}": ${log.originalCount} → ${log.newCount} models (saved ${log.saved}, ${log.consolidationRatio})`);
      });
      
      if (consolidationLog.length > 10) {
        console.log(`   ... and ${consolidationLog.length - 10} more brands with consolidations`);
      }
    }
    
    // Save the consolidated data
    console.log('\n💾 Saving consolidated data...');
    const consolidatedJson = JSON.stringify(wipersData, null, 2);
    fs.writeFileSync(WIPERS_DATA_PATH, consolidatedJson);
    
    console.log('✅ LHD/RHD consolidation completed!');
    console.log(`📁 Original file: ${WIPERS_DATA_PATH}`);
    console.log(`📁 Backup file: ${BACKUP_PATH}`);
    
    // Save consolidation log
    const logPath = path.join(__dirname, 'wipers', 'consolidation-log.json');
    fs.writeFileSync(logPath, JSON.stringify(consolidationLog, null, 2));
    console.log(`📁 Consolidation log: ${logPath}`);
    
  } catch (error) {
    console.error('💥 Consolidation failed:', error);
    throw error;
  }
}

// Run the consolidation if this script is executed directly
if (require.main === module) {
  consolidateWipersLhdRhd()
    .then(() => {
      console.log('✅ Consolidation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Consolidation failed:', error);
      process.exit(1);
    });
}

module.exports = { consolidateWipersLhdRhd, wipersDataEqual };
