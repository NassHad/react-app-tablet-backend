// Script to clean model names in wipers_database.json by removing parentheses
const fs = require('fs');
const path = require('path');

// Configuration
const WIPERS_DATA_PATH = path.join(__dirname, 'wipers', 'wipers_database.json');
const BACKUP_PATH = path.join(__dirname, 'wipers', 'wipers_database_backup.json');

// Function to clean model name by removing parentheses and their contents
function cleanModelName(modelName) {
  if (!modelName) return modelName;
  
  // Remove parentheses and their contents
  // Examples: "3-Series M3 (F80)" → "3-Series M3"
  //           "500 Abarth 595 (All models)" → "500 Abarth 595"
  let cleaned = modelName.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  
  // Clean up any extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

async function cleanWipersModelNames() {
  try {
    console.log('🧹 Starting wipers model names cleaning...');
    
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
    let cleanedModels = 0;
    const changes = [];
    
    // Process each brand
    Object.keys(wipersData.brands).forEach(brandName => {
      const brandData = wipersData.brands[brandName];
      if (!Array.isArray(brandData)) return;
      
      brandData.forEach(modelData => {
        if (modelData.model) {
          totalModels++;
          const originalName = modelData.model;
          const cleanedName = cleanModelName(originalName);
          
          if (originalName !== cleanedName) {
            modelData.model = cleanedName;
            cleanedModels++;
            changes.push({
              brand: brandName,
              original: originalName,
              cleaned: cleanedName
            });
          }
        }
      });
    });
    
    console.log(`📊 Processing complete:`);
    console.log(`   - Total models: ${totalModels}`);
    console.log(`   - Models cleaned: ${cleanedModels}`);
    console.log(`   - Models unchanged: ${totalModels - cleanedModels}`);
    
    // Show some examples of changes
    if (changes.length > 0) {
      console.log('\n🔍 Examples of changes made:');
      changes.slice(0, 10).forEach(change => {
        console.log(`   - "${change.brand}": "${change.original}" → "${change.cleaned}"`);
      });
      
      if (changes.length > 10) {
        console.log(`   ... and ${changes.length - 10} more changes`);
      }
    }
    
    // Save the cleaned data
    console.log('\n💾 Saving cleaned data...');
    const cleanedJson = JSON.stringify(wipersData, null, 2);
    fs.writeFileSync(WIPERS_DATA_PATH, cleanedJson);
    
    console.log('✅ Wipers model names cleaning completed!');
    console.log(`📁 Original file: ${WIPERS_DATA_PATH}`);
    console.log(`📁 Backup file: ${BACKUP_PATH}`);
    
    // Save changes log
    const changesPath = path.join(__dirname, 'wipers', 'model-name-changes.json');
    fs.writeFileSync(changesPath, JSON.stringify(changes, null, 2));
    console.log(`📁 Changes log: ${changesPath}`);
    
  } catch (error) {
    console.error('💥 Cleaning failed:', error);
    throw error;
  }
}

// Run the cleaning if this script is executed directly
if (require.main === module) {
  cleanWipersModelNames()
    .then(() => {
      console.log('✅ Cleaning completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleaning failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanWipersModelNames, cleanModelName };
