// Quick test to verify ALFA ROMEO matching now works
// Copy and paste this entire content into Strapi console

async function testAlfaRomeoMatching() {
  try {
    console.log('🧪 Testing ALFA ROMEO matching after fixes...');
    
    // Load wipers data
    const fs = require('fs');
    const path = require('path');
    const WIPERS_DATA_PATH = path.join(process.cwd(), 'scripts', 'wipers', 'wipers_database.json');
    
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, 'utf8'));
    
    // Get ALFA ROMEO models from Strapi
    const alfaRomeoModels = await strapi.entityService.findMany('api::model.model', {
      filters: {
        brand: {
          name: 'ALFA ROMEO'
        }
      },
      populate: ['brand']
    });
    
    console.log(`📊 Found ${alfaRomeoModels.length} ALFA ROMEO models in Strapi`);
    
    // Get ALFA ROMEO models from wipers data
    const wipersAlfaRomeoModels = wipersData.brands['ALFA ROMEO'] || [];
    console.log(`📊 Found ${wipersAlfaRomeoModels.length} ALFA ROMEO models in wipers data`);
    
    // Test matching
    console.log('\n🔍 Testing model matches:');
    let matches = 0;
    
    for (const wipersModel of wipersAlfaRomeoModels.slice(0, 10)) {
      const matchingStrapiModel = alfaRomeoModels.find(model => 
        model.name.toUpperCase() === wipersModel.model.toUpperCase()
      );
      
      if (matchingStrapiModel) {
        console.log(`   ✅ "${wipersModel.model}" → "${matchingStrapiModel.name}"`);
        matches++;
      } else {
        console.log(`   ❌ "${wipersModel.model}" → No match`);
      }
    }
    
    console.log(`\n📊 Results: ${matches}/${Math.min(10, wipersAlfaRomeoModels.length)} models matched`);
    
    if (matches > 0) {
      console.log('🎉 ALFA ROMEO matching is now working!');
    } else {
      console.log('⚠️  ALFA ROMEO matching still has issues');
    }
    
  } catch (error) {
    console.error('❌ Error testing ALFA ROMEO matching:', error);
    throw error;
  }
}

// Run the test
testAlfaRomeoMatching();
