// Production Osram Lights Import Script for Strapi Console
// This script handles the full dataset efficiently with batching and error handling

console.log('🚀 Starting Production Osram Lights Import...');

// Configuration
const BATCH_SIZE = 100; // Process 100 entries at a time
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

// Helper function to create delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to escape strings for Strapi
const escapeString = (str) => {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
};

// Step 1: Create brands (run this first)
const createBrands = async () => {
  console.log('📝 Step 1: Creating brands...');
  
  // Get unique brands from your data
  const brands = [
    'ABARTH', 'ALFA ROMEO', 'AUDI', 'BMW', 'CITROEN', 'DACIA', 'FIAT', 'FORD', 'HONDA', 'HYUNDAI',
    'JAGUAR', 'KIA', 'LAND ROVER', 'LEXUS', 'MAZDA', 'MERCEDES-BENZ', 'MINI', 'MITSUBISHI', 'NISSAN', 'OPEL',
    'PEUGEOT', 'PORSCHE', 'RENAULT', 'SEAT', 'SKODA', 'SUBARU', 'SUZUKI', 'TOYOTA', 'VOLKSWAGEN', 'VOLVO',
    'ACURA', 'INFINITI', 'LINCOLN', 'CADILLAC', 'BUICK', 'CHEVROLET', 'GMC', 'CHRYSLER', 'DODGE', 'JEEP',
    'RAM', 'ALPINA', 'BENTLEY', 'ROLLS-ROYCE', 'ASTON MARTIN', 'MCLAREN', 'FERRARI', 'LAMBORGHINI', 'MASERATI',
    'ALPINE', 'CUPRA', 'DS', 'GENESIS', 'LADA', 'SAAB', 'TATA', 'MAHINDRA', 'PROTON', 'PERODUA'
  ];
  
  const brandIds = {};
  
  for (const brandName of brands) {
    try {
      const brand = await strapi.entityService.create('api::lights-brand.lights-brand', {
        data: {
          name: brandName,
          slug: brandName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          isActive: true,
          publishedAt: new Date()
        }
      });
      brandIds[brandName] = brand.id;
      console.log(`✅ Created brand: ${brandName} (ID: ${brand.id})`);
    } catch (error) {
      console.error(`❌ Error creating brand ${brandName}:`, error.message);
    }
  }
  
  return brandIds;
};

// Step 2: Create positions (run this second)
const createPositions = async () => {
  console.log('📝 Step 2: Creating positions...');
  
  const positions = [
    'Feu de croisement', 'Feu de route', 'Éclairage jour', 'Feu de position',
    'Feu de brouillard', 'Feu de recul', 'Feu de stop', 'Feu de clignotant',
    'Feu de position arrière', 'Feu de brouillard arrière', 'Feu de plaque', 'Feu de tableau de bord'
  ];
  
  const positionIds = {};
  
  for (const positionName of positions) {
    try {
      const position = await strapi.entityService.create('api::lights-position.lights-position', {
        data: {
          name: positionName,
          slug: positionName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          isActive: true,
          publishedAt: new Date()
        }
      });
      positionIds[positionName] = position.id;
      console.log(`✅ Created position: ${positionName} (ID: ${position.id})`);
    } catch (error) {
      console.error(`❌ Error creating position ${positionName}:`, error.message);
    }
  }
  
  return positionIds;
};

// Step 3: Create models and light data (run this third)
const createModelsAndLightData = async (brandIds, positionIds) => {
  console.log('📝 Step 3: Creating models and light data...');
  
  // You would load your actual data here
  const osramData = JSON.parse(fs.readFileSync('osram_bulbs_parsed.json', 'utf8'));
  
  // For demonstration, using sample data
  // const osramData = [
  //   {
  //     "brand": "ABARTH", "model": "124 Spider", "constructionYear": { "start": "03/16", "end": "Present" },
  //     "typeConception": "Halogen", "lightType": "H11", "position": "Feu de croisement", "category": "feu_croisement",
  //     "partNumber": "", "notes": "", "source": "OSRAM CSV Guide"
  //   }
  // ];
  
  const modelIds = {};
  let totalProcessed = 0;
  let totalErrors = 0;
  
  // Process in batches
  for (let i = 0; i < osramData.length; i += BATCH_SIZE) {
    const batch = osramData.slice(i, i + BATCH_SIZE);
    console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(osramData.length / BATCH_SIZE)}`);
    
    for (const item of batch) {
      try {
        // Create model if it doesn't exist
        const modelKey = `${item.brand}-${item.model}`;
        if (!modelIds[modelKey]) {
          const model = await strapi.entityService.create('api::lights-model.lights-model', {
            data: {
              name: item.model,
              slug: item.model.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
              constructionYearStart: item.constructionYear.start,
              constructionYearEnd: item.constructionYear.end === 'Present' ? null : item.constructionYear.end,
              isActive: true,
              lightsBrand: brandIds[item.brand],
              publishedAt: new Date()
            }
          });
          modelIds[modelKey] = model.id;
          console.log(`✅ Created model: ${item.model} (ID: ${model.id})`);
        }
        
        // Create light position data
        const lightData = await strapi.entityService.create('api::light-position-data.light-position-data', {
          data: {
            lightType: item.lightType,
            position: item.position,
            category: item.category,
            typeConception: item.typeConception,
            partNumber: item.partNumber || '',
            notes: item.notes || '',
            source: item.source,
            isActive: true,
            lightsPosition: positionIds[item.position],
            publishedAt: new Date()
          }
        });
        
        totalProcessed++;
        if (totalProcessed % 1000 === 0) {
          console.log(`📊 Processed ${totalProcessed} entries...`);
        }
        
      } catch (error) {
        totalErrors++;
        console.error(`❌ Error processing ${item.brand} ${item.model}:`, error.message);
      }
    }
    
    // Delay between batches to avoid overwhelming the server
    if (i + BATCH_SIZE < osramData.length) {
      await delay(DELAY_BETWEEN_BATCHES);
    }
  }
  
  console.log(`✅ Completed processing ${totalProcessed} entries with ${totalErrors} errors`);
  return { modelIds, totalProcessed, totalErrors };
};

// Main execution function
const runImport = async () => {
  try {
    // Step 1: Create brands
    const brandIds = await createBrands();
    console.log('✅ Brands created successfully');
    
    // Step 2: Create positions  
    const positionIds = await createPositions();
    console.log('✅ Positions created successfully');
    
    // Step 3: Create models and light data
    const result = await createModelsAndLightData(brandIds, positionIds);
    console.log('✅ Models and light data created successfully');
    
    console.log('');
    console.log('🎉 Import Complete!');
    console.log(`📊 Final Summary:`);
    console.log(`- Brands: ${Object.keys(brandIds).length}`);
    console.log(`- Positions: ${Object.keys(positionIds).length}`);
    console.log(`- Models: ${Object.keys(result.modelIds).length}`);
    console.log(`- Light Data Entries: ${result.totalProcessed}`);
    console.log(`- Errors: ${result.totalErrors}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  }
};

// Uncomment the line below to run the import
runImport();

console.log('📋 Instructions:');
console.log('1. Uncomment the last line: runImport();');
console.log('2. Make sure your Strapi server is running on localhost:1338');
console.log('3. Run this script in your Strapi console');
console.log('4. Monitor the console for progress and any errors');
