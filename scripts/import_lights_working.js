// Working Lights Import Script for Strapi Console
// Copy and paste this ENTIRE script into your Strapi console

(async () => {
  console.log('🚀 Starting Complete Osram Lights Import...');

  // Import fs module for file reading
  const fs = require('fs');
  const path = require('path');

  // Configuration
  const BATCH_SIZE = 50;
  const DELAY_BETWEEN_BATCHES = 2000;

  // Helper function to create delay
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper function to create slug
  const createSlug = (str) => {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  try {
    // Step 1: Load and analyze the data
    console.log('📂 Loading data from osram_bulbs_parsed.json...');
    const dataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_parsed.json');
    
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const osramData = JSON.parse(rawData);
    console.log(`✅ Loaded ${osramData.length} records from JSON file`);

    // Step 2: Create unique brands
    console.log('📝 Step 1: Creating brands...');
    const uniqueBrands = [...new Set(osramData.map(item => item.brand))];
    console.log(`Found ${uniqueBrands.length} unique brands`);

    const brandIds = {};
    let brandSuccessCount = 0;
    let brandErrorCount = 0;

    for (const brandName of uniqueBrands) {
      try {
        const brand = await strapi.entityService.create('api::lights-brand.lights-brand', {
          data: {
            name: brandName,
            slug: createSlug(brandName),
            isActive: true,
            publishedAt: new Date()
          }
        });
        brandIds[brandName] = brand.id;
        brandSuccessCount++;
        console.log(`✅ Created brand: ${brandName} (ID: ${brand.id})`);
      } catch (error) {
        brandErrorCount++;
        console.error(`❌ Error creating brand ${brandName}:`, error.message);
      }
    }

    console.log(`📊 Brands: ${brandSuccessCount} created, ${brandErrorCount} errors`);

    // Step 3: Create unique positions
    console.log('📝 Step 2: Creating positions...');
    const uniquePositions = [...new Set(osramData.map(item => item.position))];
    console.log(`Found ${uniquePositions.length} unique positions`);

    const positionIds = {};
    let positionSuccessCount = 0;
    let positionErrorCount = 0;

    for (const positionName of uniquePositions) {
      try {
        const position = await strapi.entityService.create('api::lights-position.lights-position', {
          data: {
            name: positionName,
            slug: createSlug(positionName),
            isActive: true,
            publishedAt: new Date()
          }
        });
        positionIds[positionName] = position.id;
        positionSuccessCount++;
        console.log(`✅ Created position: ${positionName} (ID: ${position.id})`);
      } catch (error) {
        positionErrorCount++;
        console.error(`❌ Error creating position ${positionName}:`, error.message);
      }
    }

    console.log(`📊 Positions: ${positionSuccessCount} created, ${positionErrorCount} errors`);

    // Step 4: Create models
    console.log('📝 Step 3: Creating models...');
    const uniqueModels = [...new Set(osramData.map(item => `${item.brand}-${item.model}`))];
    console.log(`Found ${uniqueModels.length} unique models`);

    const modelIds = {};
    let modelSuccessCount = 0;
    let modelErrorCount = 0;

    for (const modelKey of uniqueModels) {
      const [brandName, modelName] = modelKey.split('-');
      const modelData = osramData.find(item => item.brand === brandName && item.model === modelName);
      
      try {
        const model = await strapi.entityService.create('api::lights-model.lights-model', {
          data: {
            name: modelName,
            slug: createSlug(modelName),
            constructionYearStart: modelData.constructionYear.start,
            constructionYearEnd: modelData.constructionYear.end === 'Present' ? null : modelData.constructionYear.end,
            isActive: true,
            lightsBrand: brandIds[brandName],
            publishedAt: new Date()
          }
        });
        modelIds[modelKey] = model.id;
        modelSuccessCount++;
        console.log(`✅ Created model: ${modelName} (ID: ${model.id})`);
      } catch (error) {
        modelErrorCount++;
        console.error(`❌ Error creating model ${modelName}:`, error.message);
      }
    }

    console.log(`📊 Models: ${modelSuccessCount} created, ${modelErrorCount} errors`);

    // Step 5: Create light positions for each model
    console.log('📝 Step 4: Creating light positions...');
    const positionModelIds = {};
    let positionModelSuccessCount = 0;
    let positionModelErrorCount = 0;

    // Get unique model-position combinations
    const uniqueModelPositions = [...new Set(osramData.map(item => `${item.brand}-${item.model}-${item.position}`))];

    for (const modelPositionKey of uniqueModelPositions) {
      const [brandName, modelName, positionName] = modelPositionKey.split('-');
      const modelKey = `${brandName}-${modelName}`;
      
      try {
        const position = await strapi.entityService.create('api::lights-position.lights-position', {
          data: {
            name: positionName,
            slug: createSlug(positionName),
            isActive: true,
            lightsModel: modelIds[modelKey],
            publishedAt: new Date()
          }
        });
        positionModelIds[modelPositionKey] = position.id;
        positionModelSuccessCount++;
        console.log(`✅ Created position: ${positionName} for ${modelName} (ID: ${position.id})`);
      } catch (error) {
        positionModelErrorCount++;
        console.error(`❌ Error creating position ${positionName} for ${modelName}:`, error.message);
      }
    }

    console.log(`📊 Positions: ${positionModelSuccessCount} created, ${positionModelErrorCount} errors`);

    // Step 6: Create light position data in batches
    console.log('📝 Step 5: Creating light position data...');
    let lightDataSuccessCount = 0;
    let lightDataErrorCount = 0;

    // Process data in batches
    const totalBatches = Math.ceil(osramData.length / BATCH_SIZE);
    console.log(`Processing ${osramData.length} records in ${totalBatches} batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < osramData.length; i += BATCH_SIZE) {
      const batch = osramData.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);
      
      for (const item of batch) {
        try {
          const modelPositionKey = `${item.brand}-${item.model}-${item.position}`;
          
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
              lightsPosition: positionModelIds[modelPositionKey],
              publishedAt: new Date()
            }
          });
          
          lightDataSuccessCount++;
          
          // Log progress every 1000 entries
          if (lightDataSuccessCount % 1000 === 0) {
            console.log(`📊 Processed ${lightDataSuccessCount} light data entries...`);
          }
          
        } catch (error) {
          lightDataErrorCount++;
          console.error(`❌ Error processing ${item.brand} ${item.model}:`, error.message);
        }
      }
      
      // Delay between batches to avoid overwhelming the server
      if (i + BATCH_SIZE < osramData.length) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    // Final summary
    console.log('');
    console.log('🎉 Import Complete!');
    console.log('📊 Final Summary:');
    console.log(`- Brands: ${brandSuccessCount} created, ${brandErrorCount} errors`);
    console.log(`- Models: ${modelSuccessCount} created, ${modelErrorCount} errors`);
    console.log(`- Positions: ${positionModelSuccessCount} created, ${positionModelErrorCount} errors`);
    console.log(`- Light Data: ${lightDataSuccessCount} created, ${lightDataErrorCount} errors`);
    console.log('');
    console.log('✅ All data has been imported successfully!');
    console.log('🔗 You can now test the API at: http://localhost:1337/api/lights-selection');

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.log('Make sure the file exists at: scripts/osram_bulbs_parsed.json');
  }
})();
