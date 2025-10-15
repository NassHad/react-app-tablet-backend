// Full import script for wipers products with enhanced data
// Copy and paste this entire content into Strapi console

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
      
      // Skip description keys
      if (positionKey.endsWith('Description')) return;
      
      // Map position keys to French names
      const positionNames = {
        'kitAvant': 'Kit Avant',
        'coteConducteur': 'Côté Conducteur',
        'monoBalais': 'Mono Balais',
        'cotePassager': 'Côté Passager',
        'arriere': 'Arrière'
      };
      
      const positionName = positionNames[positionKey] || positionKey;
      const descriptionKey = `${positionKey}Description`;
      const description = categoryData[descriptionKey] || null;
      
      positions.push({
        position: positionName,
        ref: ref,
        description: description,
        category: category
      });
    });
  });
  
  return positions;
}

async function importWipersProductsFull() {
  try {
    console.log('🚀 Starting FULL wipers products import...');
    
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
    console.log(`📊 Wiper brand: ${wipersData.metadata?.wiperBrand || 'Not specified'}`);
    
    // Get all existing brands and models for reference
    console.log('🔍 Fetching existing brands and models...');
    const existingBrands = await strapi.entityService.findMany('api::brand.brand', {
      populate: '*',
      sort: 'name:asc'
    });
    
    const existingModels = await strapi.entityService.findMany('api::model.model', {
      populate: ['brand'],
      sort: 'name:asc'
    });
    
    console.log(`📋 Found ${existingBrands.length} existing brands and ${existingModels.length} existing models`);
    
    // Create lookup maps for faster matching
    const brandMap = new Map();
    existingBrands.forEach(brand => {
      if (brand && brand.name && brand.slug) {
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
    
    console.log(`📋 Created lookup maps:`);
    console.log(`   - Brands: ${brandMap.size}`);
    console.log(`   - Models: ${modelMap.size}`);
    
    // Tracking variables
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    // Problem tracking
    const problems = {
      missingBrands: [],
      missingModels: [],
      exactMatches: [],
      skippedModels: []
    };
    
    // Process ALL brands and their models (FULL IMPORT)
    const brands = Object.keys(wipersData.brands);
    
    console.log(`🚀 Processing ALL ${brands.length} brands for FULL import...`);
    
    for (const brandName of brands) {
      try {
        console.log(`\n🔍 Processing brand: ${brandName}`);
        
        const brandData = wipersData.brands[brandName];
        if (!brandData || !Array.isArray(brandData)) {
          console.log(`⚠️  Skipping brand ${brandName}: invalid data format`);
          problems.skippedModels.push({
            type: 'invalid_brand_data',
            brand: brandName,
            reason: 'Invalid data format'
          });
          totalSkipped++;
          continue;
        }
        
        console.log(`📊 Found ${brandData.length} models for brand ${brandName}`);
        
        // Find existing brand
        const existingBrand = brandMap.get(brandName.toUpperCase());
        if (!existingBrand) {
          console.log(`⚠️  Skipping brand ${brandName}: not found in existing brands`);
          problems.missingBrands.push(brandName);
          totalSkipped += brandData.length;
          continue;
        }
        
        console.log(`✅ Found existing brand: ${existingBrand.name} (slug: ${existingBrand.slug})`);
        
        // Process each model in this brand
        for (const modelData of brandData) {
          totalProcessed++;
          
          try {
            console.log(`\n  🔍 Processing model: ${modelData.model}`);
            
            // Find existing model
            const modelKey = `${brandName.toUpperCase()}-${modelData.model.toUpperCase()}`;
            const existingModel = modelMap.get(modelKey);
            
            if (!existingModel) {
              console.log(`⚠️  Skipping model ${modelData.model}: not found in existing models`);
              problems.missingModels.push({
                brand: brandName,
                model: modelData.model
              });
              totalSkipped++;
              continue;
            }
            
            console.log(`✅ Found exact match: ${existingModel.name} (slug: ${existingModel.slug})`);
            problems.exactMatches.push({
              brand: brandName,
              model: modelData.model,
              matchedBrand: existingBrand.name,
              matchedModel: existingModel.name
            });
            
            // Transform wipers data to positions array with descriptions
            const wipersPositions = transformWipersToPositions(modelData.wipers);
            
            if (wipersPositions.length === 0) {
              console.log(`⚠️  Skipping model ${modelData.model}: no wiper positions found`);
              problems.skippedModels.push({
                type: 'no_positions',
                brand: brandName,
                model: modelData.model,
                reason: 'No wiper positions found'
              });
              totalSkipped++;
              continue;
            }
            
            console.log(`📋 Found ${wipersPositions.length} wiper positions with descriptions`);
            
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
              problems.skippedModels.push({
                type: 'already_exists',
                brand: brandName,
                model: modelData.model,
                reason: 'Wipers product already exists'
              });
              totalSkipped++;
              continue;
            }
            
            // Create wipers product with enhanced data
            const wipersProductData = {
              name: `${existingBrand.name} ${existingModel.name} - Wipers`,
              ref: `wiper-valeo-${slugify(existingModel.name)}`,
              description: `Wipers for ${existingBrand.name} ${existingModel.name}`,
              brand: existingBrand.id,
              model: existingModel.id,
              wipersPositions: wipersPositions,
              slug: `wiper-valeo-${slugify(existingModel.name)}`,
              constructionYearStart: modelData.productionYears?.start || null,
              constructionYearEnd: modelData.productionYears?.end || null,
              direction: modelData.direction || null,
              wiperBrand: modelData.wiperBrand || 'Valeo',
              source: 'wipers_database.json',
              category: 'wipers',
              isActive: true
            };
            
            // Create the wipers product
            const createdProduct = await strapi.entityService.create('api::wipers-product.wipers-product', {
              data: wipersProductData
            });
            
            console.log(`✅ Created wipers product for ${existingBrand.name} ${existingModel.name} (${wipersPositions.length} positions)`);
            totalCreated++;
            
          } catch (modelError) {
            console.error(`❌ Error processing model ${modelData.model}:`, modelError.message);
            problems.skippedModels.push({
              type: 'error',
              brand: brandName,
              model: modelData.model,
              reason: modelError.message
            });
            totalErrors++;
          }
        }
        
        // Progress indicator
        if (totalProcessed % 100 === 0) {
          console.log(`\n📊 Progress: ${totalProcessed} models processed, ${totalCreated} created, ${totalSkipped} skipped`);
        }
        
      } catch (brandError) {
        console.error(`❌ Error processing brand ${brandName}:`, brandError.message);
        totalErrors++;
      }
    }
    
    console.log('\n🎉 Wipers products FULL import completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total processed: ${totalProcessed}`);
    console.log(`   - Created: ${totalCreated}`);
    console.log(`   - Skipped: ${totalSkipped}`);
    console.log(`   - Errors: ${totalErrors}`);
    
    console.log(`\n📋 Problem Summary:`);
    console.log(`   - Missing brands: ${problems.missingBrands.length}`);
    console.log(`   - Missing models: ${problems.missingModels.length}`);
    console.log(`   - Exact matches: ${problems.exactMatches.length}`);
    console.log(`   - Skipped models: ${problems.skippedModels.length}`);
    
    if (problems.missingBrands.length > 0) {
      console.log(`\n⚠️  Missing brands (${problems.missingBrands.length}):`);
      problems.missingBrands.slice(0, 10).forEach(brand => console.log(`   - ${brand}`));
      if (problems.missingBrands.length > 10) {
        console.log(`   ... and ${problems.missingBrands.length - 10} more`);
      }
    }
    
    if (problems.missingModels.length > 0) {
      console.log(`\n⚠️  Missing models (${problems.missingModels.length}):`);
      problems.missingModels.slice(0, 10).forEach(item => console.log(`   - ${item.brand} ${item.model}`));
      if (problems.missingModels.length > 10) {
        console.log(`   ... and ${problems.missingModels.length - 10} more`);
      }
    }
    
    return {
      totalProcessed,
      totalCreated,
      totalSkipped,
      totalErrors,
      problems
    };
    
  } catch (error) {
    console.error('💥 Import failed:', error);
    throw error;
  }
}

// Run the full import
importWipersProductsFull();
