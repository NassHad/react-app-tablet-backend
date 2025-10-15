// Fuzzy matching import script for wipers products
// Copy and paste this entire content into Strapi console

// Helper function to create slug
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Helper function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to transform wipers data to positions array
function transformWipersToPositions(wipersData) {
  const positions = [];
  
  // Process each category
  Object.keys(wipersData).forEach(category => {
    const categoryData = wipersData[category];
    if (!categoryData) return;
    
    // Process each position in the category
    Object.keys(categoryData).forEach(positionKey => {
      const ref = categoryData[positionKey];
      if (!ref) return;
      
      // Map position keys to French names
      const positionNames = {
        'kitAvant': 'Kit Avant',
        'coteConducteur': 'Côté Conducteur',
        'monoBalais': 'Mono Balais',
        'cotePassager': 'Côté Passager',
        'arriere': 'Arrière'
      };
      
      const positionName = positionNames[positionKey] || positionKey;
      
      positions.push({
        position: positionName,
        ref: ref,
        category: category
      });
    });
  });
  
  return positions;
}

// Fuzzy matching function for model names
function findBestModelMatch(modelName, brandModels) {
  if (!modelName || !brandModels || brandModels.length === 0) {
    return null;
  }
  
  const cleanModelName = modelName.toLowerCase().trim();
  
  // 1. Try exact match
  let exactMatch = brandModels.find(model => 
    model.name && model.name.toLowerCase() === cleanModelName
  );
  if (exactMatch) return { model: exactMatch, confidence: 'exact' };
  
  // 2. Try partial match (model name contains the search term)
  let partialMatch = brandModels.find(model => 
    model.name && model.name.toLowerCase().includes(cleanModelName)
  );
  if (partialMatch) return { model: partialMatch, confidence: 'partial' };
  
  // 3. Try reverse partial match (search term contains model name)
  partialMatch = brandModels.find(model => 
    model.name && cleanModelName.includes(model.name.toLowerCase())
  );
  if (partialMatch) return { model: partialMatch, confidence: 'reverse-partial' };
  
  // 4. Try fuzzy matching for common patterns
  const fuzzyMatches = brandModels.filter(model => {
    if (!model.name) return false;
    
    const dbModelName = model.name.toLowerCase();
    
    // Handle special cases
    if (cleanModelName.includes('500') && cleanModelName.includes('abarth') && cleanModelName.includes('595')) {
      return dbModelName.includes('500') && dbModelName.includes('595');
    }
    
    if (cleanModelName.includes('alfa') && cleanModelName.includes('33')) {
      return dbModelName === '33';
    }
    
    if (cleanModelName.includes('alfa') && cleanModelName.includes('6')) {
      return dbModelName === '6';
    }
    
    // Extract numbers and check if they match
    const searchNumbers = cleanModelName.match(/\d+/g) || [];
    const dbNumbers = dbModelName.match(/\d+/g) || [];
    
    if (searchNumbers.length > 0 && dbNumbers.length > 0) {
      return searchNumbers.some(num => dbNumbers.includes(num));
    }
    
    return false;
  });
  
  if (fuzzyMatches.length > 0) {
    return { model: fuzzyMatches[0], confidence: 'fuzzy' };
  }
  
  return null;
}

async function importWipersProductsFuzzyMatching() {
  try {
    console.log('🚀 Starting fuzzy matching wipers products import...');
    
    // Load wipers data from the file system
    const fs = require('fs');
    const path = require('path');
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
    
    console.log(`📊 Found ${Object.keys(wipersData.brands).length} brands in wipers data`);
    
    // Get all existing brands and models for reference
    console.log('🔍 Fetching existing brands and models...');
    const existingBrands = await strapi.entityService.findMany('api::brand.brand', {
      populate: '*'
    });
    const existingModels = await strapi.entityService.findMany('api::model.model', {
      populate: ['brand']
    });
    
    // Create lookup maps
    const brandMap = new Map();
    existingBrands.forEach(brand => {
      if (brand && brand.name && brand.slug) {
        brandMap.set(brand.name.toUpperCase(), brand);
      }
    });
    
    // Group models by brand for easier searching
    const modelsByBrand = new Map();
    existingModels.forEach(model => {
      if (model && model.brand && model.brand.name && model.name) {
        const brandName = model.brand.name.toUpperCase();
        if (!modelsByBrand.has(brandName)) {
          modelsByBrand.set(brandName, []);
        }
        modelsByBrand.get(brandName).push(model);
      }
    });
    
    console.log(`📋 Created lookup maps:`);
    console.log(`   - Brands: ${brandMap.size}`);
    console.log(`   - Models grouped by brand: ${modelsByBrand.size}`);
    
    // Process brands and their models (limit to first 5 brands for testing)
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let exactMatches = 0;
    let partialMatches = 0;
    let fuzzyMatches = 0;
    
    const brands = Object.keys(wipersData.brands).slice(0, 5); // Limit for testing
    
    console.log(`🧪 Processing first ${brands.length} brands for testing...`);
    
    for (const brandName of brands) {
      try {
        console.log(`\n🔍 Processing brand: ${brandName}`);
        
        const brandData = wipersData.brands[brandName];
        if (!brandData || !Array.isArray(brandData)) {
          console.log(`⚠️  Skipping brand ${brandName}: invalid data format`);
          totalSkipped++;
          continue;
        }
        
        // Find existing brand
        const existingBrand = brandMap.get(brandName.toUpperCase());
        if (!existingBrand) {
          console.log(`⚠️  Skipping brand ${brandName}: not found in existing brands`);
          totalSkipped++;
          continue;
        }
        
        console.log(`✅ Found brand: ${existingBrand.name} (slug: ${existingBrand.slug})`);
        
        // Get models for this brand
        const brandModels = modelsByBrand.get(brandName.toUpperCase()) || [];
        console.log(`📋 Found ${brandModels.length} models for ${existingBrand.name}`);
        
        // Process each model for this brand (limit to first 3 models per brand)
        const modelsToProcess = brandData.slice(0, 3);
        
        for (const modelData of modelsToProcess) {
          try {
            if (!modelData.model || !modelData.wipers) {
              console.log(`⚠️  Skipping model ${modelData.model || 'Unknown'}: missing required data`);
              totalSkipped++;
              continue;
            }
            
            console.log(`\n🔍 Looking for model: "${modelData.model}"`);
            
            // Use fuzzy matching to find the best model match
            const matchResult = findBestModelMatch(modelData.model, brandModels);
            
            if (!matchResult) {
              console.log(`❌ No match found for "${modelData.model}"`);
              totalSkipped++;
              continue;
            }
            
            const { model: existingModel, confidence } = matchResult;
            console.log(`✅ Found ${confidence} match: "${existingModel.name}" (confidence: ${confidence})`);
            
            // Track match types
            if (confidence === 'exact') exactMatches++;
            else if (confidence === 'partial' || confidence === 'reverse-partial') partialMatches++;
            else if (confidence === 'fuzzy') fuzzyMatches++;
            
            // Transform wipers data to positions array
            const wipersPositions = transformWipersToPositions(modelData.wipers);
            
            if (wipersPositions.length === 0) {
              console.log(`⚠️  Skipping model ${modelData.model}: no wiper positions found`);
              totalSkipped++;
              continue;
            }
            
            console.log(`📋 Found ${wipersPositions.length} wiper positions`);
            
            // Check if wipers product already exists for this model
            const existingProducts = await strapi.entityService.findMany('api::wipers-product.wipers-product', {
              filters: {
                model: {
                  id: existingModel.id
                }
              }
            });
            
            if (existingProducts.length > 0) {
              console.log(`⏭️  Skipping model ${modelData.model}: wipers product already exists`);
              totalSkipped++;
              continue;
            }
            
            // Create wipers product with proper relationships
            const wipersProductData = {
              name: `${existingBrand.name} ${existingModel.name} - Wipers`,
              ref: `WIPERS-${existingBrand.slug}-${existingModel.slug}`,
              description: `Wipers for ${existingBrand.name} ${existingModel.name} (matched from "${modelData.model}")`,
              brand: existingBrand.id,
              model: existingModel.id,
              wipersPositions: wipersPositions,
              constructionYearStart: modelData.productionYears?.start || null,
              constructionYearEnd: modelData.productionYears?.end || null,
              direction: modelData.direction || null,
              partNumber: modelData.id || null,
              notes: `Original model: "${modelData.model}", Match confidence: ${confidence}. Picto1: ${modelData.picto1 || ''}, Picto2: ${modelData.picto2 || ''}`.trim(),
              source: 'Database_PerfectVision_Mai2025.csv',
              category: 'wipers',
              isActive: true,
              publishedAt: new Date()
            };
            
            const createdProduct = await strapi.entityService.create('api::wipers-product.wipers-product', {
              data: wipersProductData
            });
            
            console.log(`✅ Created wipers product for ${existingBrand.name} ${existingModel.name} (${wipersPositions.length} positions)`);
            totalCreated++;
            
            // Small delay to avoid overwhelming the database
            await delay(100);
            
          } catch (modelError) {
            console.error(`❌ Error processing model ${modelData.model}:`, modelError.message);
            totalErrors++;
          }
          
          totalProcessed++;
        }
        
      } catch (brandError) {
        console.error(`❌ Error processing brand ${brandName}:`, brandError.message);
        totalErrors++;
      }
    }
    
    console.log('\n🎉 Fuzzy matching wipers products import completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total processed: ${totalProcessed}`);
    console.log(`   - Created: ${totalCreated}`);
    console.log(`   - Skipped: ${totalSkipped}`);
    console.log(`   - Errors: ${totalErrors}`);
    console.log(`   - Exact matches: ${exactMatches}`);
    console.log(`   - Partial matches: ${partialMatches}`);
    console.log(`   - Fuzzy matches: ${fuzzyMatches}`);
    
  } catch (error) {
    console.error('💥 Import failed:', error);
    throw error;
  }
}

// Run the function
importWipersProductsFuzzyMatching();
