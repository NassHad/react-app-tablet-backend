// Debug script to investigate ALFA ROMEO matching issue
// Copy and paste this entire content into Strapi console

async function debugAlfaRomeoMatching() {
  try {
    console.log('🔍 Debugging ALFA ROMEO matching issue...');
    
    // Load wipers data
    const fs = require('fs');
    const path = require('path');
    const WIPERS_DATA_PATH = path.join(process.cwd(), 'scripts', 'wipers', 'wipers_database.json');
    
    if (!fs.existsSync(WIPERS_DATA_PATH)) {
      throw new Error(`Wipers data file not found at: ${WIPERS_DATA_PATH}`);
    }
    
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, 'utf8'));
    
    // Get all brands from Strapi
    console.log('🔍 Fetching brands from Strapi...');
    const strapiBrands = await strapi.entityService.findMany('api::brand.brand', {
      populate: '*',
      sort: 'name:asc'
    });
    
    // Get all models from Strapi
    console.log('🔍 Fetching models from Strapi...');
    const strapiModels = await strapi.entityService.findMany('api::model.model', {
      populate: ['brand'],
      sort: 'name:asc'
    });
    
    // Check ALFA ROMEO brand in Strapi
    console.log('\n📋 ALFA ROMEO in Strapi brands:');
    const alfaRomeoBrand = strapiBrands.find(brand => 
      brand.name && brand.name.toUpperCase().includes('ALFA')
    );
    
    if (alfaRomeoBrand) {
      console.log(`✅ Found ALFA ROMEO brand: "${alfaRomeoBrand.name}" (ID: ${alfaRomeoBrand.id}, Slug: ${alfaRomeoBrand.slug})`);
    } else {
      console.log('❌ ALFA ROMEO brand not found in Strapi');
      console.log('Available brands with "ALFA":');
      strapiBrands.filter(brand => brand.name && brand.name.toUpperCase().includes('ALFA')).forEach(brand => {
        console.log(`   - "${brand.name}"`);
      });
    }
    
    // Check ALFA ROMEO in wipers data
    console.log('\n📋 ALFA ROMEO in wipers data:');
    const wipersBrands = Object.keys(wipersData.brands);
    const alfaRomeoWipers = wipersBrands.find(brand => 
      brand.toUpperCase().includes('ALFA')
    );
    
    if (alfaRomeoWipers) {
      console.log(`✅ Found ALFA ROMEO in wipers: "${alfaRomeoWipers}"`);
      const alfaRomeoData = wipersData.brands[alfaRomeoWipers];
      console.log(`   - Model count: ${Array.isArray(alfaRomeoData) ? alfaRomeoData.length : 0}`);
      if (Array.isArray(alfaRomeoData) && alfaRomeoData.length > 0) {
        console.log(`   - Sample models: ${alfaRomeoData.slice(0, 3).map(m => m.model).join(', ')}`);
      }
    } else {
      console.log('❌ ALFA ROMEO not found in wipers data');
      console.log('Available wipers brands with "ALFA":');
      wipersBrands.filter(brand => brand.toUpperCase().includes('ALFA')).forEach(brand => {
        console.log(`   - "${brand}"`);
      });
    }
    
    // Check ALFA ROMEO models in Strapi
    console.log('\n📋 ALFA ROMEO models in Strapi:');
    const alfaRomeoModels = strapiModels.filter(model => 
      model.brand && model.brand.name && model.brand.name.toUpperCase().includes('ALFA')
    );
    
    console.log(`Found ${alfaRomeoModels.length} ALFA ROMEO models in Strapi:`);
    alfaRomeoModels.slice(0, 10).forEach(model => {
      console.log(`   - "${model.name}" (Brand: "${model.brand.name}")`);
    });
    
    if (alfaRomeoModels.length > 10) {
      console.log(`   ... and ${alfaRomeoModels.length - 10} more models`);
    }
    
    // Test exact matching logic
    console.log('\n🧪 Testing matching logic:');
    if (alfaRomeoBrand && alfaRomeoWipers) {
      const brandMatch = alfaRomeoBrand.name.toUpperCase() === alfaRomeoWipers.toUpperCase();
      console.log(`Brand match: "${alfaRomeoBrand.name}" === "${alfaRomeoWipers}" = ${brandMatch}`);
      
      if (Array.isArray(wipersData.brands[alfaRomeoWipers])) {
        console.log('\n🔍 Testing model matches:');
        const wipersModels = wipersData.brands[alfaRomeoWipers];
        
        for (let i = 0; i < Math.min(5, wipersModels.length); i++) {
          const wipersModel = wipersModels[i];
          const modelKey = `${alfaRomeoWipers.toUpperCase()}-${wipersModel.model.toUpperCase()}`;
          
          const matchingStrapiModel = alfaRomeoModels.find(model => 
            model.name.toUpperCase() === wipersModel.model.toUpperCase()
          );
          
          console.log(`   - "${wipersModel.model}" -> ${matchingStrapiModel ? `✅ "${matchingStrapiModel.name}"` : '❌ No match'}`);
        }
      }
    }
    
    // Show all brands for comparison
    console.log('\n📋 All Strapi brands (for reference):');
    strapiBrands.forEach(brand => {
      console.log(`   - "${brand.name}"`);
    });
    
    console.log('\n📋 All wipers brands (for reference):');
    wipersBrands.forEach(brand => {
      console.log(`   - "${brand}"`);
    });
    
  } catch (error) {
    console.error('❌ Error debugging ALFA ROMEO:', error);
    throw error;
  }
}

// Run the debug
debugAlfaRomeoMatching();
