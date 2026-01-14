// Script to enhance wipers data with descriptions and wiperBrand
const fs = require('fs');
const path = require('path');

// Configuration
const WIPERS_DATA_PATH = path.join(__dirname, 'wipers', 'wipers_database.json');
const BACKUP_PATH = path.join(__dirname, 'wipers', 'wipers_database_backup_enhanced.json');

// Valeo descriptions mapping
const VALEO_DESCRIPTIONS = {
  // Standard wipers
  'VS31': 'VALEO BALAI E.G. STD VS31 400MM',
  'VS32': 'VALEO BALAI E.G. STD VS32 450MM',
  'VS33': 'VALEO BALAI E.G. STD VS33 480MM',
  'VS34': 'VALEO BALAI E.G. STD VS34 510MM',
  'VS35': 'VALEO BALAI E.G. STD VS35 530MM',
  'VS36': 'VALEO BALAI E.G. STD VS36 550MM',
  'VS37': 'VALEO BALAI E.G. STD VS37 600MM',
  'VS38': 'VALEO BALAI E.G. STD VS38 650MM',
  
  // Retrofit wipers
  'VS30+': 'VALEO BALAI E.G. PLAT RETROFIT VS30+ 350MM',
  'VS31+': 'VALEO BALAI E.G. PLAT RETROFIT VS31+ 400MM',
  'VS32+': 'VALEO BALAI E.G. PLAT RETROFIT VS32+ 450MM',
  'VS33+': 'VALEO BALAI E.G. PLAT RETROFIT VS33+ 475MM',
  'VS34+': 'VALEO BALAI E.G. PLAT RETROFIT VS34+ 500MM',
  'VS35+': 'VALEO BALAI E.G. PLAT RETROFIT VS35+ 530MM',
  'VS36+': 'VALEO BALAI E.G. PLAT RETROFIT VS36+ 550MM',
  'VS37+': 'VALEO BALAI E.G. PLAT RETROFIT VS37+ 600MM',
  'VS38+': 'VALEO BALAI E.G. PLAT RETROFIT VS38+ 650MM',
  
  // Original flat wipers
  'VS70': 'VALEO BALAI E.G. PLAT ORIGINE VS70 350MM',
  'VS71': 'VALEO BALAI E.G. PLAT ORIGINE VS71 400MM',
  'VS72': 'VALEO BALAI E.G. PLAT ORIGINE VS72 450MM',
  'VS73': 'VALEO BALAI E.G. PLAT ORIGINE VS73 475MM',
  'VS74': 'VALEO BALAI E.G. PLAT ORIGINE VS74 500MM',
  'VS75': 'VALEO BALAI E.G. PLAT ORIGINE VS75 530MM',
  'VS76': 'VALEO BALAI E.G. PLAT ORIGINE VS76 550MM',
  'VS77': 'VALEO BALAI E.G. PLAT ORIGINE VS77 600MM',
  'VS78': 'VALEO BALAI E.G. PLAT ORIGINE VS78 650MM',
  'VS79': 'VALEO BALAI E.G. PLAT ORIGINE VS79 700MM',
  'VS80': 'VALEO BALAI E.G. PLAT ORIGINE VS80 750MM',
  
  // Kit wipers
  'VS90': 'VALEO KIT BALAI E.G. PLAT ORIG. VS90 680+425MM - PSA 3008 II, 5008 II',
  'VS91': 'VALEO KIT BALAI E.G. PLAT ORIGINE VS91 700+300MM RENAULT Clio V',
  'VS92': 'VALEO KIT BALAI E.G. PLAT ORIGINE VS92 650+350MM RENAULT Captur 1',
  
  // Additional common references
  'VS06': 'VALEO BALAI E.G. STD VS06 300MM',
  'VS07': 'VALEO BALAI E.G. STD VS07 350MM',
  'VS08': 'VALEO BALAI E.G. STD VS08 400MM',
  'VS09': 'VALEO BALAI E.G. STD VS09 450MM',
  'VS10': 'VALEO BALAI E.G. STD VS10 500MM',
  'VS11': 'VALEO BALAI E.G. STD VS11 550MM',
  'VS12': 'VALEO BALAI E.G. STD VS12 600MM',
  'VS13': 'VALEO BALAI E.G. STD VS13 650MM',
  'VS14': 'VALEO BALAI E.G. STD VS14 700MM',
  'VS15': 'VALEO BALAI E.G. STD VS15 750MM',
  'VS16': 'VALEO BALAI E.G. STD VS16 800MM',
  'VS17': 'VALEO BALAI E.G. STD VS17 850MM',
  'VS18': 'VALEO BALAI E.G. STD VS18 900MM',
  'VS19': 'VALEO BALAI E.G. STD VS19 950MM',
  'VS20': 'VALEO BALAI E.G. STD VS20 1000MM',
  'VS21': 'VALEO BALAI E.G. STD VS21 1050MM',
  'VS22': 'VALEO BALAI E.G. STD VS22 1100MM',
  'VS23': 'VALEO BALAI E.G. STD VS23 1150MM',
  'VS24': 'VALEO BALAI E.G. STD VS24 1200MM',
  'VS25': 'VALEO BALAI E.G. STD VS25 1250MM',
  'VS26': 'VALEO BALAI E.G. STD VS26 1300MM',
  'VS27': 'VALEO BALAI E.G. STD VS27 1350MM',
  'VS28': 'VALEO BALAI E.G. STD VS28 1400MM',
  'VS29': 'VALEO BALAI E.G. STD VS29 1450MM',
  'VS30': 'VALEO BALAI E.G. STD VS30 1500MM'
};

// Function to get description for a wiper reference
function getWiperDescription(ref) {
  if (!ref) return null;
  return VALEO_DESCRIPTIONS[ref] || `VALEO BALAI E.G. ${ref}`;
}

// Function to enhance wipers data with descriptions
function enhanceWipersData(wipersData) {
  const enhanced = { ...wipersData };
  
  // Add wiperBrand to metadata
  enhanced.metadata = {
    ...enhanced.metadata,
    wiperBrand: 'Valeo',
    enhancedAt: new Date().toISOString()
  };
  
  // Process each brand
  Object.keys(enhanced.brands).forEach(brandName => {
    const brandData = enhanced.brands[brandName];
    if (!Array.isArray(brandData)) return;
    
    brandData.forEach(modelData => {
      if (modelData.wipers) {
        // Add wiperBrand to each model
        modelData.wiperBrand = 'Valeo';
        
        // Process each category
        Object.keys(modelData.wipers).forEach(category => {
          const categoryData = modelData.wipers[category];
          if (!categoryData) return;
          
          // Process each position
          Object.keys(categoryData).forEach(position => {
            const ref = categoryData[position];
            if (ref) {
              // Add description for this position
              const descriptionKey = `${position}Description`;
              categoryData[descriptionKey] = getWiperDescription(ref);
            }
          });
        });
      }
    });
  });
  
  return enhanced;
}

async function enhanceWipersDataWithDescriptions() {
  try {
    console.log('🔧 Starting wipers data enhancement...');
    
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
    
    // Enhance the data
    console.log('🔧 Enhancing wipers data with descriptions...');
    const enhancedData = enhanceWipersData(wipersData);
    
    // Count enhancements
    let totalModels = 0;
    let enhancedModels = 0;
    let totalDescriptions = 0;
    
    Object.keys(enhancedData.brands).forEach(brandName => {
      const brandData = enhancedData.brands[brandName];
      if (!Array.isArray(brandData)) return;
      
      brandData.forEach(modelData => {
        totalModels++;
        if (modelData.wiperBrand === 'Valeo') {
          enhancedModels++;
        }
        
        if (modelData.wipers) {
          Object.keys(modelData.wipers).forEach(category => {
            const categoryData = modelData.wipers[category];
            if (categoryData) {
              Object.keys(categoryData).forEach(key => {
                if (key.endsWith('Description')) {
                  totalDescriptions++;
                }
              });
            }
          });
        }
      });
    });
    
    console.log(`📊 Enhancement complete:`);
    console.log(`   - Total models: ${totalModels}`);
    console.log(`   - Models with wiperBrand: ${enhancedModels}`);
    console.log(`   - Total descriptions added: ${totalDescriptions}`);
    
    // Save the enhanced data
    console.log('\n💾 Saving enhanced data...');
    const enhancedJson = JSON.stringify(enhancedData, null, 2);
    fs.writeFileSync(WIPERS_DATA_PATH, enhancedJson);
    
    console.log('✅ Wipers data enhancement completed!');
    console.log(`📁 Enhanced file: ${WIPERS_DATA_PATH}`);
    console.log(`📁 Backup file: ${BACKUP_PATH}`);
    
  } catch (error) {
    console.error('💥 Enhancement failed:', error);
    throw error;
  }
}

// Run the enhancement if this script is executed directly
if (require.main === module) {
  enhanceWipersDataWithDescriptions()
    .then(() => {
      console.log('✅ Enhancement completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Enhancement failed:', error);
      process.exit(1);
    });
}

module.exports = { enhanceWipersDataWithDescriptions, getWiperDescription };
