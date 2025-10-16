// Enhanced import script for wipers products with descriptions and wiperBrand
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

// Helper function to transform wipers data to positions array with descriptions
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

async function importWipersProductsEnhanced() {
  try {
    console.log('🚀 Starting enhanced wipers products import...');
    
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
      populate: '*'
    });
    const existingModels = await strapi.entityService.findMany('api::model.model', {
      populate: ['brand']
    });
    
    // Create lookup maps for exact matching
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
    
    // Process brands and their models (limit to first 10 brands for testing)
    const brands = Object.keys(wipersData.brands).slice(0, 10);
    
    console.log(`🧪 Processing first ${brands.length} brands for testing...`);
    
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
        
        // Find existing brand (exact match only)
        const existingBrand = brandMap.get(brandName.toUpperCase());
        if (!existingBrand) {
          console.log(`❌ Brand "${brandName}" not found in database`);
          problems.missingBrands.push({
            brand: brandName,
            slug: slugify(brandName),
            modelsCount: brandData.length
          });
          totalSkipped++;
          continue;
        }
        
        console.log(`✅ Found brand: ${existingBrand.name} (slug: ${existingBrand.slug})`);
        
        // Process each model for this brand
        for (const modelData of brandData) {
          try {
            if (!modelData.model || !modelData.wipers) {
              console.log(`⚠️  Skipping model ${modelData.model || 'Unknown'}: missing required data`);
              problems.skippedModels.push({
                type: 'missing_data',
                brand: brandName,
                model: modelData.model || 'Unknown',
                reason: 'Missing model name or wipers data'
              });
              totalSkipped++;
              continue;
            }
            
            // Find existing model (exact match only)
            const modelKey = `${brandName.toUpperCase()}-${modelData.model.toUpperCase()}`;
            const existingModel = modelMap.get(modelKey);
            
            if (!existingModel) {
              console.log(`❌ Model "${modelData.model}" not found for brand "${brandName}"`);
              problems.missingModels.push({
                brand: brandName,
                brandSlug: existingBrand.slug,
                model: modelData.model,
                modelSlug: slugify(modelData.model),
                key: modelKey,
                wipersData: modelData.wipers
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
              constructionYearStart: modelData.productionYears?.start || null,
              constructionYearEnd: modelData.productionYears?.end || null,
              direction: modelData.direction || null,
              wiperBrand: modelData.wiperBrand || 'Valeo',
              source: 'Database_PerfectVision_Mai2025.csv',
              category: 'wipers',
              isActive: true,
              publishedAt: new Date()
            };
            
            const createdProduct = await strapi.entityService.create('api::wipers-product.wipers-product', {
              data: wipersProductData
            });
            
            console.log(`✅ Created wipers product for ${existingBrand.name} ${existingModel.name} (${wipersPositions.length} positions)`);
            console.log(`   Slug: ${createdProduct.slug}`);
            totalCreated++;
            
            // Small delay to avoid overwhelming the database
            await delay(100);
            
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
          
          totalProcessed++;
        }
        
      } catch (brandError) {
        console.error(`❌ Error processing brand ${brandName}:`, brandError.message);
        totalErrors++;
      }
    }
    
    console.log('\n🎉 Enhanced wipers products import completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total processed: ${totalProcessed}`);
    console.log(`   - Created: ${totalCreated}`);
    console.log(`   - Skipped: ${totalSkipped}`);
    console.log(`   - Errors: ${totalErrors}`);
    
    // Detailed problem analysis
    console.log('\n📋 Problem Analysis:');
    console.log(`   - Missing brands: ${problems.missingBrands.length}`);
    console.log(`   - Missing models: ${problems.missingModels.length}`);
    console.log(`   - Exact matches: ${problems.exactMatches.length}`);
    console.log(`   - Skipped models: ${problems.skippedModels.length}`);
    
    // Log exact matches
    if (problems.exactMatches.length > 0) {
      console.log('\n✅ Exact Matches:');
      problems.exactMatches.forEach(match => {
        console.log(`   - "${match.brand}" "${match.model}" → "${match.matchedBrand}" "${match.matchedModel}"`);
      });
    }
    
    // Save problems to a file for later analysis
    const problemsPath = path.join(process.cwd(), 'scripts', 'wipers-import-problems-enhanced.json');
    fs.writeFileSync(problemsPath, JSON.stringify(problems, null, 2));
    console.log(`\n💾 Problems saved to: ${problemsPath}`);
    
  } catch (error) {
    console.error('💥 Import failed:', error);
    throw error;
  }
}

// Run the function
importWipersProductsEnhanced();
