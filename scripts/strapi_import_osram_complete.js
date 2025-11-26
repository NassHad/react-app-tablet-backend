// Complete Osram Lights Import Script for Strapi Console
// Copy and paste this into your Strapi console (http://localhost:1338/admin)

console.log('🚀 Starting Complete Osram Lights Import...');

// Import the data (you'll need to load this from your file)
// For now, we'll create a sample to test the structure

const sampleOsramData = [
  {
    "brand": "ABARTH",
    "model": "124 Spider",
    "constructionYear": { "start": "03/16", "end": "Present" },
    "typeConception": "Halogen",
    "lightType": "H11",
    "position": "Feu de croisement",
    "category": "feu_croisement",
    "partNumber": "",
    "notes": "",
    "source": "OSRAM CSV Guide"
  },
  {
    "brand": "ABARTH", 
    "model": "124 Spider",
    "constructionYear": { "start": "03/16", "end": "Present" },
    "typeConception": "Halogen",
    "lightType": "H15",
    "position": "Feu de route",
    "category": "feu_route",
    "partNumber": "",
    "notes": "",
    "source": "OSRAM CSV Guide"
  }
];

// Step 1: Create all unique brands from the data
console.log('📝 Step 1: Creating brands...');
const uniqueBrands = [...new Set(sampleOsramData.map(item => item.brand))];
const brandIds = {};

for (const brandName of uniqueBrands) {
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

// Step 2: Create all unique positions
console.log('📝 Step 2: Creating positions...');
const uniquePositions = [...new Set(sampleOsramData.map(item => item.position))];
const positionIds = {};

for (const positionName of uniquePositions) {
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

// Step 3: Create models
console.log('📝 Step 3: Creating models...');
const uniqueModels = [...new Set(sampleOsramData.map(item => `${item.brand}-${item.model}`))];
const modelIds = {};

for (const modelKey of uniqueModels) {
  const [brandName, modelName] = modelKey.split('-');
  const modelData = sampleOsramData.find(item => item.brand === brandName && item.model === modelName);
  
  try {
    const model = await strapi.entityService.create('api::lights-model.lights-model', {
      data: {
        name: modelName,
        slug: modelName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
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

// Step 4: Create light position data
console.log('📝 Step 4: Creating light position data...');
let successCount = 0;
let errorCount = 0;

for (const item of sampleOsramData) {
  try {
    const modelKey = `${item.brand}-${item.model}`;
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
    successCount++;
    console.log(`✅ Created light data: ${item.lightType} for ${item.brand} ${item.model}`);
  } catch (error) {
    errorCount++;
    console.error(`❌ Error creating light data for ${item.brand} ${item.model}:`, error.message);
  }
}

console.log('');
console.log('🎉 Import Complete!');
console.log(`✅ Successfully created: ${successCount} light data entries`);
console.log(`❌ Errors: ${errorCount}`);
console.log('');
console.log('📊 Summary:');
console.log(`- Brands: ${Object.keys(brandIds).length}`);
console.log(`- Positions: ${Object.keys(positionIds).length}`);
console.log(`- Models: ${Object.keys(modelIds).length}`);
console.log(`- Light Data: ${successCount}`);

// For the full import, you would replace sampleOsramData with the full dataset
console.log('');
console.log('💡 To import the full dataset:');
console.log('1. Load the full osram_bulbs_parsed.json file');
console.log('2. Replace sampleOsramData with the full data');
console.log('3. Run this script again');
