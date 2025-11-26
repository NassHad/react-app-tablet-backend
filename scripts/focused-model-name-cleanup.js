const fs = require('fs');
const path = require('path');

// Path to the wipers database
const WIPERS_DATA_PATH = path.join(__dirname, 'wipers', 'wipers_database.json');

function focusedModelNameCleanup() {
  try {
    console.log('🚀 Starting focused model name cleanup...');
    
    // Read the wipers database
    console.log('📖 Reading wipers database...');
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, 'utf8'));
    
    if (!wipersData.brands) {
      throw new Error('Invalid wipers data format: brands property not found');
    }
    
    // Create backup
    const backupPath = WIPERS_DATA_PATH.replace('.json', '_backup_before_focused_cleanup.json');
    fs.writeFileSync(backupPath, JSON.stringify(wipersData, null, 2));
    console.log(`💾 Backup created: ${backupPath}`);
    
    const originalBrands = Object.keys(wipersData.brands);
    console.log(`📊 Found ${originalBrands.length} brands in wipers database`);
    
    // Track changes
    const changes = [];
    let totalModelsProcessed = 0;
    let totalModelsChanged = 0;
    
    // Focused cleaning rules for common naming issues
    const cleaningRules = [
      // Remove common suffixes that often cause mismatches
      { pattern: / Q4$/, replacement: '', name: 'Remove Q4 suffix' },
      { pattern: / Sportwagon$/, replacement: '', name: 'Remove Sportwagon suffix' },
      { pattern: / Cabrio$/, replacement: '', name: 'Remove Cabrio suffix' },
      { pattern: / Coupé$/, replacement: '', name: 'Remove Coupé suffix' },
      { pattern: / Convertible$/, replacement: '', name: 'Remove Convertible suffix' },
      { pattern: / Estate$/, replacement: '', name: 'Remove Estate suffix' },
      { pattern: / Tourer$/, replacement: '', name: 'Remove Tourer suffix' },
      { pattern: / Wagon$/, replacement: '', name: 'Remove Wagon suffix' },
      { pattern: / Van$/, replacement: '', name: 'Remove Van suffix' },
      { pattern: / Pickup$/, replacement: '', name: 'Remove Pickup suffix' },
      { pattern: / Combi$/, replacement: '', name: 'Remove Combi suffix' },
      { pattern: / SW$/, replacement: '', name: 'Remove SW suffix' },
      { pattern: / Hatchback$/, replacement: '', name: 'Remove Hatchback suffix' },
      { pattern: / Sedan$/, replacement: '', name: 'Remove Sedan suffix' },
      { pattern: / Saloon$/, replacement: '', name: 'Remove Saloon suffix' },
      { pattern: / Limousine$/, replacement: '', name: 'Remove Limousine suffix' },
      { pattern: / Crossback$/, replacement: '', name: 'Remove Crossback suffix' },
      { pattern: / All 4$/, replacement: '', name: 'Remove All 4 suffix' },
      { pattern: / Electric$/, replacement: '', name: 'Remove Electric suffix' },
      { pattern: / E-Tech$/, replacement: '', name: 'Remove E-Tech suffix' },
      { pattern: / EV$/, replacement: '', name: 'Remove EV suffix' },
      { pattern: / Hybrid$/, replacement: '', name: 'Remove Hybrid suffix' },
      { pattern: / PHEV$/, replacement: '', name: 'Remove PHEV suffix' },
      { pattern: / GTA$/, replacement: '', name: 'Remove GTA suffix' },
      { pattern: / QV$/, replacement: '', name: 'Remove QV suffix' },
      { pattern: / Turbo$/, replacement: '', name: 'Remove Turbo suffix' },
      { pattern: / TDI$/, replacement: '', name: 'Remove TDI suffix' },
      { pattern: / CDI$/, replacement: '', name: 'Remove CDI suffix' },
      { pattern: / HDI$/, replacement: '', name: 'Remove HDI suffix' },
      { pattern: / TSI$/, replacement: '', name: 'Remove TSI suffix' },
      { pattern: / GTI$/, replacement: '', name: 'Remove GTI suffix' },
      { pattern: / GTD$/, replacement: '', name: 'Remove GTD suffix' },
      
      // Remove common single letter suffixes
      { pattern: / [A-Z]$/, replacement: '', name: 'Remove single letter suffix' },
      
      // Remove common single digit suffixes
      { pattern: / [0-9]$/, replacement: '', name: 'Remove single digit suffix' },
      
      // Remove trailing punctuation and spaces
      { pattern: /[ \/\-\_\.\,\;\:\!\?\(\)\[\]\{\}\<\>\@\#\$\%\^\&\*\+\=\|\~`\'\"\\]+$/, replacement: '', name: 'Remove trailing punctuation' },
      
      // Remove trailing whitespace
      { pattern: /\s+$/, replacement: '', name: 'Remove trailing whitespace' },
      
      // Remove leading whitespace
      { pattern: /^\s+/, replacement: '', name: 'Remove leading whitespace' },
      
      // Remove multiple spaces
      { pattern: /\s{2,}/, replacement: ' ', name: 'Remove multiple spaces' },
      
      // Remove leading/trailing slashes
      { pattern: /^\/+|\/+$/, replacement: '', name: 'Remove leading/trailing slashes' },
      
      // Remove leading/trailing dashes
      { pattern: /^-+|-+$/, replacement: '', name: 'Remove leading/trailing dashes' },
      
      // Remove leading/trailing underscores
      { pattern: /^_+|_+$/, replacement: '', name: 'Remove leading/trailing underscores' },
      
      // Remove leading/trailing dots
      { pattern: /^\.+|\.+$/, replacement: '', name: 'Remove leading/trailing dots' },
      
      // Remove leading/trailing commas
      { pattern: /^,+|,+$/, replacement: '', name: 'Remove leading/trailing commas' },
      
      // Remove leading/trailing semicolons
      { pattern: /^;+|;+$/, replacement: '', name: 'Remove leading/trailing semicolons' },
      
      // Remove leading/trailing colons
      { pattern: /^:+|:+$/, replacement: '', name: 'Remove leading/trailing colons' },
      
      // Remove leading/trailing exclamation marks
      { pattern: /^!+|!+$/, replacement: '', name: 'Remove leading/trailing exclamation marks' },
      
      // Remove leading/trailing question marks
      { pattern: /^\?+|\?+$/, replacement: '', name: 'Remove leading/trailing question marks' },
      
      // Remove leading/trailing parentheses
      { pattern: /^\(+|\)+$/, replacement: '', name: 'Remove leading/trailing parentheses' },
      
      // Remove leading/trailing brackets
      { pattern: /^\[+|\]+$/, replacement: '', name: 'Remove leading/trailing brackets' },
      
      // Remove leading/trailing braces
      { pattern: /^\{+|\}+$/, replacement: '', name: 'Remove leading/trailing braces' },
      
      // Remove leading/trailing angle brackets
      { pattern: /^<+|>+$/, replacement: '', name: 'Remove leading/trailing angle brackets' },
      
      // Remove leading/trailing at signs
      { pattern: /^@+|@+$/, replacement: '', name: 'Remove leading/trailing at signs' },
      
      // Remove leading/trailing hash signs
      { pattern: /^#+|#+$/, replacement: '', name: 'Remove leading/trailing hash signs' },
      
      // Remove leading/trailing dollar signs
      { pattern: /^\$+|\$+$/, replacement: '', name: 'Remove leading/trailing dollar signs' },
      
      // Remove leading/trailing percent signs
      { pattern: /^%+|%+$/, replacement: '', name: 'Remove leading/trailing percent signs' },
      
      // Remove leading/trailing caret signs
      { pattern: /^\^+|\^+$/, replacement: '', name: 'Remove leading/trailing caret signs' },
      
      // Remove leading/trailing ampersands
      { pattern: /^&+|&+$/, replacement: '', name: 'Remove leading/trailing ampersands' },
      
      // Remove leading/trailing asterisks
      { pattern: /^\*+|\*+$/, replacement: '', name: 'Remove leading/trailing asterisks' },
      
      // Remove leading/trailing plus signs
      { pattern: /^\++|\++$/, replacement: '', name: 'Remove leading/trailing plus signs' },
      
      // Remove leading/trailing equals signs
      { pattern: /^=+|=+$/, replacement: '', name: 'Remove leading/trailing equals signs' },
      
      // Remove leading/trailing pipe signs
      { pattern: /^\|+|\|+$/, replacement: '', name: 'Remove leading/trailing pipe signs' },
      
      // Remove leading/trailing backslashes
      { pattern: /^\\+|\\+$/, replacement: '', name: 'Remove leading/trailing backslashes' },
      
      // Remove leading/trailing tildes
      { pattern: /^~+|~+$/, replacement: '', name: 'Remove leading/trailing tildes' },
      
      // Remove leading/trailing backticks
      { pattern: /^`+|`+$/, replacement: '', name: 'Remove leading/trailing backticks' },
      
      // Remove leading/trailing single quotes
      { pattern: /^'+|'+$/, replacement: '', name: 'Remove leading/trailing single quotes' },
      
      // Remove leading/trailing double quotes
      { pattern: /^"+|"+$/, replacement: '', name: 'Remove leading/trailing double quotes' }
    ];
    
    // Process each brand
    for (const [brandName, brandData] of Object.entries(wipersData.brands)) {
      if (!Array.isArray(brandData)) continue;
      
      console.log(`\n🔍 Processing brand: ${brandName}`);
      
      const brandChanges = [];
      
      // Process each model in this brand
      for (const model of brandData) {
        totalModelsProcessed++;
        
        if (!model.model) continue;
        
        let currentModelName = model.model;
        let originalModelName = model.model;
        let modelChanges = [];
        
        // Apply all cleaning rules
        for (const rule of cleaningRules) {
          const beforeRule = currentModelName;
          currentModelName = currentModelName.replace(rule.pattern, rule.replacement);
          
          if (beforeRule !== currentModelName) {
            modelChanges.push({
              rule: rule.name,
              before: beforeRule,
              after: currentModelName
            });
          }
        }
        
        // Update the model name if it changed
        if (currentModelName !== originalModelName) {
          model.model = currentModelName;
          totalModelsChanged++;
          
          brandChanges.push({
            original: originalModelName,
            cleaned: currentModelName,
            changes: modelChanges
          });
        }
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
      focusedCleanupAt: new Date().toISOString(),
      focusedCleanupChanges: changes.length,
      totalModelsProcessed: totalModelsProcessed,
      totalModelsChanged: totalModelsChanged
    };
    
    // Write the cleaned data
    console.log('\n💾 Writing focused cleaned wipers database...');
    fs.writeFileSync(WIPERS_DATA_PATH, JSON.stringify(wipersData, null, 2));
    
    console.log('\n✅ Focused model name cleanup completed successfully!');
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
    }
    
    return {
      totalModelsProcessed,
      totalModelsChanged,
      brandsWithChanges: changes.length,
      changes: changes
    };
    
  } catch (error) {
    console.error('❌ Error in focused model name cleanup:', error);
    throw error;
  }
}

// Run the focused cleanup
if (require.main === module) {
  focusedModelNameCleanup()
    .then(() => {
      console.log('🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { focusedModelNameCleanup };
