// Slug-based import script for wipers products
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

async function importWipersProductsSlugBased() {
  try {
    console.log('🚀 Starting slug-based wipers products import...');
    
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
    
    // Create lookup maps using SLUGS for better matching
    const brandMapBySlug = new Map();
    const brandMapByName = new Map();
    
    existingBrands.forEach(brand => {
      if (brand && brand.name && brand.slug) {
        // Map by slug (primary)
        brandMapBySlug.set(brand.slug.toLowerCase(), brand);
        // Map by name (fallback)
        brandMapByName.set(brand.name.toUpperCase(), brand);
      }
    });
    
    const modelMapBySlug = new Map();
    const modelMapByName = new Map();
    
    existingModels.forEach(model => {
      if (model && model.brand && model.brand.name && model.name && model.slug) {
        // Create composite keys for both slug and name matching
        const brandSlug = model.brand.slug.toLowerCase();
        const modelSlug = model.slug.toLowerCase();
        const brandName = model.brand.name.toUpperCase();
        const modelName = model.name.toUpperCase();
        
        // Map by slugs (primary)
        const slugKey = `${brandSlug}-${modelSlug}`;
        modelMapBySlug.set(slugKey, model);
        
        // Map by names (fallback)
        const nameKey = `${brandName}-${modelName}`;
        modelMapByName.set(nameKey, model);
      }
    });
    
    console.log(`📋 Created lookup maps:`);
    console.log(`   - Brands by slug: ${brandMapBySlug.size}`);
    console.log(`   - Brands by name: ${brandMapByName.size}`);
    console.log(`   - Models by slug: ${modelMapBySlug.size}`);
    console.log(`   - Models by name: ${modelMapByName.size}`);
    
    // Process brands and their models (limit to first 5 brands for testing)
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let slugMatches = 0;
    let nameMatches = 0;
    
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
        
        // Try to find brand by slug first, then by name
        const brandSlug = slugify(brandName);
        let existingBrand = brandMapBySlug.get(brandSlug);
        
        if (!existingBrand) {
          existingBrand = brandMapByName.get(brandName.toUpperCase());
          if (existingBrand) {
            console.log(`✅ Found brand by NAME: ${existingBrand.name} (slug: ${existingBrand.slug})`);
            nameMatches++;
          }
        } else {
          console.log(`✅ Found brand by SLUG: ${existingBrand.name} (slug: ${existingBrand.slug})`);
          slugMatches++;
        }
        
        if (!existingBrand) {
          console.log(`⚠️  Skipping brand ${brandName}: not found in existing brands (tried slug: ${brandSlug})`);
          totalSkipped++;
          continue;
        }
        
        // Process each model for this brand (limit to first 3 models per brand)
        const modelsToProcess = brandData.slice(0, 3);
        
        for (const modelData of modelsToProcess) {
          try {
            if (!modelData.model || !modelData.wipers) {
              console.log(`⚠️  Skipping model ${modelData.model || 'Unknown'}: missing required data`);
              totalSkipped++;
              continue;
            }
            
            // Try to find model by slug first, then by name
            const modelSlug = slugify(modelData.model);
            const brandSlug = existingBrand.slug.toLowerCase();
            
            // Try slug-based matching first
            const slugKey = `${brandSlug}-${modelSlug}`;
            let existingModel = modelMapBySlug.get(slugKey);
            
            if (!existingModel) {
              // Fallback to name-based matching
              const nameKey = `${existingBrand.name.toUpperCase()}-${modelData.model.toUpperCase()}`;
              existingModel = modelMapByName.get(nameKey);
              if (existingModel) {
                console.log(`✅ Found model by NAME: ${existingModel.name} (slug: ${existingModel.slug})`);
                nameMatches++;
              }
            } else {
              console.log(`✅ Found model by SLUG: ${existingModel.name} (slug: ${existingModel.slug})`);
              slugMatches++;
            }
            
            if (!existingModel) {
              console.log(`⚠️  Skipping model ${modelData.model}: not found in existing models`);
              console.log(`   Tried slug key: ${slugKey}`);
              console.log(`   Tried name key: ${existingBrand.name.toUpperCase()}-${modelData.model.toUpperCase()}`);
              totalSkipped++;
              continue;
            }
            
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
            
            // Create wipers product with proper relationships
            const wipersProductData = {
              name: `${existingBrand.name} ${existingModel.name} - Wipers`,
              ref: `WIPERS-${existingBrand.slug}-${existingModel.slug}`,
              description: `Wipers for ${existingBrand.name} ${existingModel.name}`,
              brand: existingBrand.id,  // This creates the relationship
              model: existingModel.id,  // This creates the relationship
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
            console.log(`   Brand ID: ${existingBrand.id}, Model ID: ${existingModel.id}`);
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
    
    console.log('\n🎉 Slug-based wipers products import completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total processed: ${totalProcessed}`);
    console.log(`   - Created: ${totalCreated}`);
    console.log(`   - Skipped: ${totalSkipped}`);
    console.log(`   - Errors: ${totalErrors}`);
    console.log(`   - Slug matches: ${slugMatches}`);
    console.log(`   - Name matches: ${nameMatches}`);
    
  } catch (error) {
    console.error('💥 Import failed:', error);
    throw error;
  }
}

// Run the function
importWipersProductsSlugBased();
