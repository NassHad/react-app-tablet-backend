const fs = require('fs');
const path = require('path');

// Path to the wipers database
const WIPERS_DATA_PATH = path.join(__dirname, 'wipers', 'wipers_database.json');

// Valeo rear wiper descriptions mapping
const ARRIERE_DESCRIPTIONS = {
  'VS 01': 'VALEO BALAI ARRIERE VS01 300MM',
  'VS 02': 'VALEO BALAI ARRIERE VS02 350MM', 
  'VS 03': 'VALEO BALAI ARRIERE VS03 400MM',
  'VS 05': 'VALEO BALAI ARRIERE VS05 450MM',
  'VS 06': 'VALEO BALAI ARRIERE VS06 500MM',
  'VS 07': 'VALEO BALAI ARRIERE VS07 550MM',
  'VS 08': 'VALEO BALAI ARRIERE VS08 600MM',
  'VS 09': 'VALEO BALAI ARRIERE VS09 650MM',
  'VS 10': 'VALEO BALAI ARRIERE VS10 700MM',
  'VS 11': 'VALEO BALAI ARRIERE VS11 750MM',
  'VS 12': 'VALEO BALAI ARRIERE VS12 800MM',
  'VS 13': 'VALEO BALAI ARRIERE VS13 850MM',
  'VS 14': 'VALEO BALAI ARRIERE VS14 900MM',
  'VS 17': 'VALEO BALAI ARRIERE VS17 950MM',
  'VS 30': 'VALEO BALAI ARRIERE VS30 1000MM',
  'VS 31': 'VALEO BALAI ARRIERE VS31 1050MM',
  'VS 31+': 'VALEO BALAI ARRIERE VS31+ 1050MM',
  'VS 32': 'VALEO BALAI ARRIERE VS32 1100MM',
  'VS 33': 'VALEO BALAI ARRIERE VS33 1150MM',
  'VS 34': 'VALEO BALAI ARRIERE VS34 1200MM',
  'VS 35': 'VALEO BALAI ARRIERE VS35 1250MM',
  'VS 36': 'VALEO BALAI ARRIERE VS36 1300MM',
  'VS 71': 'VALEO BALAI ARRIERE VS71 1350MM',
  'VS 74': 'VALEO BALAI ARRIERE VS74 1400MM'
};

async function enhanceWipersDataWithArriereDescriptions() {
  try {
    console.log('🚀 Starting enhancement of wipers data with arriere descriptions...');
    
    // Read the current wipers database
    console.log('📖 Reading wipers database...');
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, 'utf8'));
    
    // Create backup
    const backupPath = WIPERS_DATA_PATH.replace('.json', '_backup_before_arriere.json');
    fs.writeFileSync(backupPath, JSON.stringify(wipersData, null, 2));
    console.log(`💾 Backup created: ${backupPath}`);
    
    let totalArriereDescriptions = 0;
    let processedModels = 0;
    
    // Process each brand and their models
    const brands = wipersData.brands || {};
    
    for (const [brandName, models] of Object.entries(brands)) {
      if (Array.isArray(models)) {
        for (const model of models) {
          processedModels++;
          
          if (model.wipers && model.wipers.arriere && model.wipers.arriere !== null && model.wipers.arriere !== 'Arriere (column 18)') {
            const arriereRef = model.wipers.arriere.trim();
            
            if (ARRIERE_DESCRIPTIONS[arriereRef]) {
              model.wipers.arriereDescription = ARRIERE_DESCRIPTIONS[arriereRef];
              totalArriereDescriptions++;
            } else {
              console.log(`⚠️  No description found for arriere reference: ${arriereRef}`);
            }
          }
          
          // Progress indicator
          if (processedModels % 100 === 0) {
            console.log(`📊 Processed ${processedModels} models...`);
          }
        }
      }
    }
    
    // Write the enhanced data back to file
    console.log('💾 Writing enhanced data to file...');
    fs.writeFileSync(WIPERS_DATA_PATH, JSON.stringify(wipersData, null, 2));
    
    console.log('✅ Enhancement completed successfully!');
    console.log(`📊 Statistics:`);
    console.log(`   - Models processed: ${processedModels}`);
    console.log(`   - Arriere descriptions added: ${totalArriereDescriptions}`);
    console.log(`   - Backup file: ${backupPath}`);
    
  } catch (error) {
    console.error('❌ Error enhancing wipers data:', error);
    throw error;
  }
}

// Run the enhancement
if (require.main === module) {
  enhanceWipersDataWithArriereDescriptions()
    .then(() => {
      console.log('🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { enhanceWipersDataWithArriereDescriptions };
