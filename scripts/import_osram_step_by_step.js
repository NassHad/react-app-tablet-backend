// Step-by-Step Osram Lights Import Script for Strapi Console
// Run each step separately in your Strapi console

console.log('🚀 Osram Lights Import - Step by Step');
console.log('Run each step separately by copying the code for each step');

// ========================================
// STEP 1: Load and analyze data
// ========================================
const step1 = async () => {
  console.log('📂 Step 1: Loading and analyzing data...');
  
  const fs = require('fs');
  const path = require('path');
  
  const dataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_parsed.json');
  
  try {
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const osramData = JSON.parse(rawData);
    
    console.log(`✅ Loaded ${osramData.length} records`);
    
    // Analyze data
    const brands = [...new Set(osramData.map(item => item.brand))];
    const positions = [...new Set(osramData.map(item => item.position))];
    const categories = [...new Set(osramData.map(item => item.category))];
    
    console.log(`📊 Analysis:`);
    console.log(`- Unique brands: ${brands.length}`);
    console.log(`- Unique positions: ${positions.length}`);
    console.log(`- Unique categories: ${categories.length}`);
    console.log(`- Sample brands: ${brands.slice(0, 5).join(', ')}`);
    console.log(`- Sample positions: ${positions.slice(0, 5).join(', ')}`);
    console.log(`- Categories: ${categories.join(', ')}`);
    
    return { osramData, brands, positions, categories };
  } catch (error) {
    console.error('❌ Error loading data:', error.message);
    return null;
  }
};

// ========================================
// STEP 2: Create brands
// ========================================
const step2 = async (brands) => {
  console.log('📝 Step 2: Creating brands...');
  
  const brandIds = {};
  let successCount = 0;
  let errorCount = 0;
  
  const createSlug = (str) => {
    return str.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };
  
  for (const brandName of brands) {
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
      successCount++;
      console.log(`✅ Created brand: ${brandName} (ID: ${brand.id})`);
    } catch (error) {
      errorCount++;
      console.error(`❌ Error creating brand ${brandName}:`, error.message);
    }
  }
  
  console.log(`📊 Brands: ${successCount} created, ${errorCount} errors`);
  return brandIds;
};

// ========================================
// STEP 3: Create positions
// ========================================
const step3 = async (positions) => {
  console.log('📝 Step 3: Creating positions...');
  
  const positionIds = {};
  let successCount = 0;
  let errorCount = 0;
  
  const createSlug = (str) => {
    return str.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };
  
  for (const positionName of positions) {
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
      successCount++;
      console.log(`✅ Created position: ${positionName} (ID: ${position.id})`);
    } catch (error) {
      errorCount++;
      console.error(`❌ Error creating position ${positionName}:`, error.message);
    }
  }
  
  console.log(`📊 Positions: ${successCount} created, ${errorCount} errors`);
  return positionIds;
};

// ========================================
// STEP 4: Create models (first 1000 records)
// ========================================
const step4 = async (osramData, brandIds) => {
  console.log('📝 Step 4: Creating models (first 1000 records)...');
  
  const modelIds = {};
  let successCount = 0;
  let errorCount = 0;
  
  const createSlug = (str) => {
    return str.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };
  
  // Process only first 1000 records for testing
  const testData = osramData.slice(0, 1000);
  const uniqueModels = [...new Set(testData.map(item => `${item.brand}-${item.model}`))];
  
  console.log(`Processing ${uniqueModels.length} unique models from first 1000 records...`);
  
  for (const modelKey of uniqueModels) {
    const [brandName, modelName] = modelKey.split('-');
    const modelData = testData.find(item => item.brand === brandName && item.model === modelName);
    
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
      successCount++;
      console.log(`✅ Created model: ${modelName} (ID: ${model.id})`);
    } catch (error) {
      errorCount++;
      console.error(`❌ Error creating model ${modelName}:`, error.message);
    }
  }
  
  console.log(`📊 Models: ${successCount} created, ${errorCount} errors`);
  return modelIds;
};

// ========================================
// STEP 5: Create light data (first 1000 records)
// ========================================
const step5 = async (osramData, positionIds, modelIds) => {
  console.log('📝 Step 5: Creating light data (first 1000 records)...');
  
  let successCount = 0;
  let errorCount = 0;
  
  // Process only first 1000 records for testing
  const testData = osramData.slice(0, 1000);
  
  for (const item of testData) {
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
      
      if (successCount % 100 === 0) {
        console.log(`📊 Processed ${successCount} light data entries...`);
      }
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Error creating light data for ${item.brand} ${item.model}:`, error.message);
    }
  }
  
  console.log(`📊 Light Data: ${successCount} created, ${errorCount} errors`);
  return { successCount, errorCount };
};

// ========================================
// INSTRUCTIONS
// ========================================
console.log('');
console.log('📋 INSTRUCTIONS:');
console.log('');
console.log('1. First, run: const data = await step1();');
console.log('2. Then run: const brandIds = await step2(data.brands);');
console.log('3. Then run: const positionIds = await step3(data.positions);');
console.log('4. Then run: const modelIds = await step4(data.osramData, brandIds);');
console.log('5. Finally run: const result = await step5(data.osramData, positionIds, modelIds);');
console.log('');
console.log('This will import the first 1000 records for testing.');
console.log('If successful, you can modify the scripts to import all data.');
