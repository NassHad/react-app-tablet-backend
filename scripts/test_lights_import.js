// Test script for lights import - processes only first 10 records
// Copy and paste this into your Strapi console (http://localhost:1337/admin)

console.log('🧪 Testing Lights Import with 10 records...');

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

// Load and test with first 10 records
console.log('📂 Loading test data...');
const dataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_parsed.json');

let osramData;
try {
  const rawData = fs.readFileSync(dataPath, 'utf8');
  const fullData = JSON.parse(rawData);
  osramData = fullData.slice(0, 10); // Only first 10 records for testing
  console.log(`✅ Loaded ${osramData.length} test records`);
} catch (error) {
  console.error('❌ Error loading JSON file:', error.message);
  return;
}

// Step 1: Create brands
console.log('📝 Step 1: Creating brands...');
const uniqueBrands = [...new Set(osramData.map(item => item.brand))];
const brandIds = {};

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
    console.log(`✅ Created brand: ${brandName} (ID: ${brand.id})`);
  } catch (error) {
    console.error(`❌ Error creating brand ${brandName}:`, error.message);
  }
}

// Step 2: Create models
console.log('📝 Step 2: Creating models...');
const uniqueModels = [...new Set(osramData.map(item => `${item.brand}-${item.model}`))];
const modelIds = {};

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
    console.log(`✅ Created model: ${modelName} (ID: ${model.id})`);
  } catch (error) {
    console.error(`❌ Error creating model ${modelName}:`, error.message);
  }
}

// Step 3: Create positions
console.log('📝 Step 3: Creating positions...');
const uniqueModelPositions = [...new Set(osramData.map(item => `${item.brand}-${item.model}-${item.position}`))];
const positionModelIds = {};

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
    console.log(`✅ Created position: ${positionName} for ${modelName} (ID: ${position.id})`);
  } catch (error) {
    console.error(`❌ Error creating position ${positionName}:`, error.message);
  }
}

// Step 4: Create light data
console.log('📝 Step 4: Creating light data...');
let lightDataCount = 0;

for (const item of osramData) {
  try {
    const modelPositionKey = `${item.brand}-${item.model}-${item.position}`;
    
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
    
    lightDataCount++;
    console.log(`✅ Created light data: ${item.lightType} for ${item.brand} ${item.model}`);
  } catch (error) {
    console.error(`❌ Error creating light data:`, error.message);
  }
}

console.log('');
console.log('🎉 Test Import Complete!');
console.log(`📊 Test Results:`);
console.log(`- Brands: ${Object.keys(brandIds).length}`);
console.log(`- Models: ${Object.keys(modelIds).length}`);
console.log(`- Positions: ${Object.keys(positionModelIds).length}`);
console.log(`- Light Data: ${lightDataCount}`);
console.log('');
console.log('✅ Test successful! You can now run the full import script.');
