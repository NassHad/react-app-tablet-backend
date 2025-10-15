// Script to fix incorrect arriere descriptions in wipers database
// Run this with: node scripts/fix-wipers-database-descriptions.js

const fs = require('fs');
const path = require('path');

// Correct descriptions from our mapping
const CORRECT_ARRIERE_DESCRIPTIONS = {
  "VS 01": "VALEO BALAI E.G. ARRIERE VS01 240MM",
  "VS 02": "VALEO BALAI E.G. ARRIERE VS02 240MM", 
  "VS 03": "VALEO BALAI E.G. ARRIERE VS03 260MM",
  "VS 05": "VALEO BALAI E.G. ARRIERE VS05 280MM",
  "VS 06": "VALEO BALAI E.G. ARRIERE VS06 290MM",
  "VS 07": "VALEO BALAI E.G. ARRIERE VS07 300MM",
  "VS 08": "VALEO BALAI E.G. ARRIERE VS08 300MM",
  "VS 09": "VALEO BALAI E.G. ARRIERE VS09 300MM",
  "VS 10": "VALEO BALAI E.G. ARRIERE VS10 335MM",
  "VS 11": "VALEO BALAI E.G. ARRIERE VS11 350MM",
  "VS 12": "VALEO BALAI E.G. ARRIERE VS12 350MM",
  "VS 13": "VALEO BALAI E.G. ARRIERE VS13 400MM",
  "VS 14": "VALEO BALAI E.G. ARRIERE VS14 280MM",
  "VS 17": "VALEO BALAI E.G. ARRIERE VS17 400MM",
  "VS 31": "VALEO BALAI E.G. STD VS31 400MM",
  "VS 32": "VALEO BALAI E.G. STD VS32 450MM",
  "VS 33": "VALEO BALAI E.G. STD VS33 480MM",
  "VS 34": "VALEO BALAI E.G. STD VS34 510MM",
  "VS 35": "VALEO BALAI E.G. STD VS35 530MM",
  "VS 36": "VALEO BALAI E.G. STD VS36 550MM",
  "VS 37": "VALEO BALAI E.G. STD VS37 600MM",
  "VS 38": "VALEO BALAI E.G. STD VS38 650MM",
  "VS 30+": "VALEO BALAI E.G. PLAT RETROFIT VS30+ 350MM",
  "VS 31+": "VALEO BALAI E.G. PLAT RETROFIT VS31+ 400MM",
  "VS 32+": "VALEO BALAI E.G. PLAT RETROFIT VS32+ 450MM",
  "VS 33+": "VALEO BALAI E.G. PLAT RETROFIT VS33+ 475MM",
  "VS 34+": "VALEO BALAI E.G. PLAT RETROFIT VS34+ 500MM",
  "VS 35+": "VALEO BALAI E.G. PLAT RETROFIT VS35+ 530MM",
  "VS 36+": "VALEO BALAI E.G. PLAT RETROFIT VS36+ 550MM",
  "VS 37+": "VALEO BALAI E.G. PLAT RETROFIT VS37+ 600MM",
  "VS 38+": "VALEO BALAI E.G. PLAT RETROFIT VS38+ 650MM",
  "VS 70": "VALEO BALAI E.G. PLAT ORIGINE VS70 350MM",
  "VS 71": "VALEO BALAI E.G. PLAT ORIGINE VS71 400MM",
  "VS 72": "VALEO BALAI E.G. PLAT ORIGINE VS72 450MM",
  "VS 73": "VALEO BALAI E.G. PLAT ORIGINE VS73 475MM",
  "VS 74": "VALEO BALAI E.G. PLAT ORIGINE VS74 500MM",
  "VS 75": "VALEO BALAI E.G. PLAT ORIGINE VS75 530MM",
  "VS 76": "VALEO BALAI E.G. PLAT ORIGINE VS76 550MM",
  "VS 77": "VALEO BALAI E.G. PLAT ORIGINE VS77 600MM",
  "VS 78": "VALEO BALAI E.G. PLAT ORIGINE VS78 650MM",
  "VS 79": "VALEO BALAI E.G. PLAT ORIGINE VS79 700MM",
  "VS 80": "VALEO BALAI E.G. PLAT ORIGINE VS80 750MM",
  "VS 90": "VALEO KIT BALAI E.G. PLAT ORIG. VS90 680+425MM - PSA 3008 II, 5008 II",
  "VS 91": "VALEO KIT BALAI E.G. PLAT ORIGINE VS91 700+300MM RENAULT Clio V",
  "VS 92": "VALEO KIT BALAI E.G. PLAT ORIGINE VS92 650+350MM RENAULT Captur 1"
};

async function fixWipersDatabaseDescriptions() {
  try {
    console.log('🚀 Starting fix of wipers database descriptions...');
    
    const WIPERS_DATA_PATH = path.join(process.cwd(), 'scripts', 'wipers', 'wipers_database.json');
    
    // Check if wipers data file exists
    if (!fs.existsSync(WIPERS_DATA_PATH)) {
      throw new Error(`Wipers data file not found at: ${WIPERS_DATA_PATH}`);
    }
    
    // Load wipers data
    console.log('📖 Loading wipers data...');
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, 'utf8'));
    
    if (!wipersData.brands) {
      throw new Error('Invalid wipers data format: brands property not found');
    }
    
    // Create backup
    const backupPath = WIPERS_DATA_PATH.replace('.json', '_backup_before_description_fix.json');
    fs.writeFileSync(backupPath, JSON.stringify(wipersData, null, 2));
    console.log(`💾 Backup created: ${backupPath}`);
    
    let totalFixed = 0;
    let totalProcessed = 0;
    
    // Process each brand and their models
    const brands = Object.keys(wipersData.brands);
    
    console.log(`🔍 Processing ${brands.length} brands...`);
    
    for (const brandName of brands) {
      const brandData = wipersData.brands[brandName];
      if (!Array.isArray(brandData)) continue;
      
      for (const modelData of brandData) {
        totalProcessed++;
        
        if (modelData.wipers && modelData.wipers.arriere && modelData.wipers.arriereDescription) {
          const arriereRef = modelData.wipers.arriere.trim();
          const currentDescription = modelData.wipers.arriereDescription;
          const correctDescription = CORRECT_ARRIERE_DESCRIPTIONS[arriereRef];
          
          if (correctDescription && currentDescription !== correctDescription) {
            console.log(`🔧 Fixing ${brandName} ${modelData.model}:`);
            console.log(`   Old: ${currentDescription}`);
            console.log(`   New: ${correctDescription}`);
            
            modelData.wipers.arriereDescription = correctDescription;
            totalFixed++;
          }
        }
        
        // Progress indicator
        if (totalProcessed % 1000 === 0) {
          console.log(`📊 Processed ${totalProcessed} models, fixed ${totalFixed} descriptions...`);
        }
      }
    }
    
    // Write the corrected data back to file
    console.log('💾 Writing corrected data to file...');
    fs.writeFileSync(WIPERS_DATA_PATH, JSON.stringify(wipersData, null, 2));
    
    console.log('\n✅ Description fix completed successfully!');
    console.log('📊 Statistics:');
    console.log(`   - Models processed: ${totalProcessed}`);
    console.log(`   - Descriptions fixed: ${totalFixed}`);
    console.log(`   - Backup file: ${backupPath}`);
    console.log('🎉 Script completed successfully!');
    
  } catch (error) {
    console.error('💥 Script failed:', error);
    throw error;
  }
}

fixWipersDatabaseDescriptions();
