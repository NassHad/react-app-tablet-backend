// Fixed console-friendly version for Strapi console execution
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

async function importWipersProducts() {
  try {
    console.log('🚀 Starting wipers products import...');
    
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
    
    // Create lookup maps with null checks
    const brandMap = new Map();
    existingBrands.forEach(brand => {
      if (brand && brand.name) {
        brandMap.set(brand.name.toUpperCase(), brand);
      }
    });
    
    const modelMap = new Map();
    existingModels.forEach(model => {
      if (model && model.brand && model.brand.name && model.name) {
        const key = `${model.brand.name.toUpperCase()}-${model.name.toUpperCase()}`;
        modelMap.set(key, model);
      }
    });
    
    console.log(`📋 Found ${existingBrands.length} existing brands and ${existingModels.length} existing models`);
    console.log(`📋 Created lookup maps: ${brandMap.size} brands, ${modelMap.size} models`);
    
    // Process brands and their models (limit to first 5 brands for testing)
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
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
        
        console.log(`✅ Found existing brand: ${existingBrand.name}`);
        
        // Process each model for this brand (limit to first 3 models per brand)
        const modelsToProcess = brandData.slice(0, 3);
        
        for (const modelData of modelsToProcess) {
          try {
            if (!modelData.model || !modelData.wipers) {
              console.log(`⚠️  Skipping model ${modelData.model || 'Unknown'}: missing required data`);
              totalSkipped++;
              continue;
            }
            
            // Find existing model
            const modelKey = `${brandName.toUpperCase()}-${modelData.model.toUpperCase()}`;
            const existingModel = modelMap.get(modelKey);
            if (!existingModel) {
              console.log(`⚠️  Skipping model ${modelData.model}: not found in existing models (key: ${modelKey})`);
              totalSkipped++;
              continue;
            }
            
            console.log(`✅ Found existing model: ${existingModel.name}`);
            
            // Transform wipers data to positions array
            const wipersPositions = transformWipersToPositions(modelData.wipers);
            
            if (wipersPositions.length === 0) {
              console.log(`⚠️  Skipping model ${modelData.model}: no wiper positions found`);
              totalSkipped++;
              continue;
            }
            
            console.log(`📋 Found ${wipersPositions.length} wiper positions for ${modelData.model}`);
            
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
            
            // Create wipers product
            const wipersProductData = {
              name: `${existingBrand.name} ${existingModel.name} - Wipers`,
              ref: `WIPERS-${existingBrand.slug}-${existingModel.slug}`,
              description: `Wipers for ${existingBrand.name} ${existingModel.name}`,
              brand: existingBrand.id,
              model: existingModel.id,
              wipersPositions: wipersPositions,
              constructionYearStart: modelData.productionYears?.start || null,
              constructionYearEnd: modelData.productionYears?.end || null,
              direction: modelData.direction || null,
              partNumber: modelData.id || null,
              notes: `Picto1: ${modelData.picto1 || ''}, Picto2: ${modelData.picto2 || ''}`.trim(),
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
    
    console.log('\n🎉 Wipers products import completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total processed: ${totalProcessed}`);
    console.log(`   - Created: ${totalCreated}`);
    console.log(`   - Skipped: ${totalSkipped}`);
    console.log(`   - Errors: ${totalErrors}`);
    
  } catch (error) {
    console.error('💥 Import failed:', error);
    throw error;
  }
}

// Run the function
importWipersProducts();
