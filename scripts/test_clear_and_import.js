// Test script to clear and import a small sample of lights data
// Copy and paste this ENTIRE script into your Strapi console

(async () => {
  console.log('🧪 Testing clear and import process...');

  // Import fs module for file reading
  const fs = require('fs');
  const path = require('path');

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
    // Step 1: Clear existing data
    console.log('🧹 Step 1: Clearing existing data...');
    
    // Clear light position data
    const lightDataCount = await strapi.entityService.count('api::light-position-data.light-position-data');
    if (lightDataCount > 0) {
      const allLightData = await strapi.entityService.findMany('api::light-position-data.light-position-data', {
        pagination: { pageSize: 1000 }
      });
      for (const item of allLightData) {
        await strapi.entityService.delete('api::light-position-data.light-position-data', item.id);
      }
      console.log(`✅ Cleared ${lightDataCount} light data entries`);
    }

    // Clear positions
    const positionCount = await strapi.entityService.count('api::lights-position.lights-position');
    if (positionCount > 0) {
      const allPositions = await strapi.entityService.findMany('api::lights-position.lights-position', {
        pagination: { pageSize: 1000 }
      });
      for (const item of allPositions) {
        await strapi.entityService.delete('api::lights-position.lights-position', item.id);
      }
      console.log(`✅ Cleared ${positionCount} position entries`);
    }

    // Clear models
    const modelCount = await strapi.entityService.count('api::lights-model.lights-model');
    if (modelCount > 0) {
      const allModels = await strapi.entityService.findMany('api::lights-model.lights-model', {
        pagination: { pageSize: 1000 }
      });
      for (const item of allModels) {
        await strapi.entityService.delete('api::lights-model.lights-model', item.id);
      }
      console.log(`✅ Cleared ${modelCount} model entries`);
    }

    // Clear brands
    const brandCount = await strapi.entityService.count('api::lights-brand.lights-brand');
    if (brandCount > 0) {
      const allBrands = await strapi.entityService.findMany('api::lights-brand.lights-brand', {
        pagination: { pageSize: 1000 }
      });
      for (const item of allBrands) {
        await strapi.entityService.delete('api::lights-brand.lights-brand', item.id);
      }
      console.log(`✅ Cleared ${brandCount} brand entries`);
    }

    // Step 2: Load test data (first 5 records)
    console.log('📂 Step 2: Loading test data...');
    const dataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_parsed.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const fullData = JSON.parse(rawData);
    const testData = fullData.slice(0, 5); // Only first 5 records for testing
    console.log(`✅ Loaded ${testData.length} test records`);

    // Step 3: Create brands
    console.log('📝 Step 3: Creating brands...');
    const uniqueBrands = [...new Set(testData.map(item => item.brand))];
    const brandIds = {};

    for (const brandName of uniqueBrands) {
      const brand = await strapi.entityService.create('api::lights-brand.lights-brand', {
        data: {
          name: brandName,
          slug: createSlug(brandName),
          isActive: true,
          publishedAt: new Date()
        }
      });
      brandIds[brandName] = brand.id;
      console.log(`✅ Created brand: ${brandName} (ID: ${brand.id})`);
    }

    // Step 4: Create positions
    console.log('📝 Step 4: Creating positions...');
    const uniquePositions = [...new Set(testData.map(item => item.position))];
    const positionIds = {};

    for (const positionName of uniquePositions) {
      const position = await strapi.entityService.create('api::lights-position.lights-position', {
        data: {
          name: positionName,
          slug: createSlug(positionName),
          isActive: true,
          publishedAt: new Date()
        }
      });
      positionIds[positionName] = position.id;
      console.log(`✅ Created position: ${positionName} (ID: ${position.id})`);
    }

    // Step 5: Create models
    console.log('📝 Step 5: Creating models...');
    const uniqueModels = [...new Set(testData.map(item => `${item.brand}-${item.model}`))];
    const modelIds = {};

    for (const modelKey of uniqueModels) {
      const [brandName, modelName] = modelKey.split('-');
      const modelData = testData.find(item => item.brand === brandName && item.model === modelName);
      
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
      console.log(`✅ Created model: ${modelName} (ID: ${model.id})`);
    }

    // Step 6: Link models to positions
    console.log('📝 Step 6: Linking models to positions...');
    const uniqueModelPositions = [...new Set(testData.map(item => `${item.brand}-${item.model}-${item.position}`))];

    for (const modelPositionKey of uniqueModelPositions) {
      const [brandName, modelName, positionName] = modelPositionKey.split('-');
      const modelKey = `${brandName}-${modelName}`;
      
      await strapi.entityService.update('api::lights-model.lights-model', modelIds[modelKey], {
        data: {
          lightsPositions: {
            connect: [positionIds[positionName]]
          }
        }
      });
      console.log(`✅ Linked ${modelName} to ${positionName}`);
    }

    // Step 7: Create light data
    console.log('📝 Step 7: Creating light data...');
    for (const item of testData) {
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
      console.log(`✅ Created light data: ${item.lightType} for ${item.brand} ${item.model}`);
    }

    // Final summary
    console.log('');
    console.log('🎉 Test Complete!');
    console.log('📊 Final Summary:');
    console.log(`- Brands: ${Object.keys(brandIds).length}`);
    console.log(`- Positions: ${Object.keys(positionIds).length}`);
    console.log(`- Models: ${Object.keys(modelIds).length}`);
    console.log(`- Light Data: ${testData.length}`);
    console.log('');
    console.log('✅ Test successful! The corrected import script should work now.');
    console.log('🔗 You can now test the API at: http://localhost:1338/api/lights-selection');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
})();
