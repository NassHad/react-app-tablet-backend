// FINAL FIX - Corrected import script for wipers products
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

// Updated description mappings based on user's provided list
const ARRIERE_DESCRIPTIONS = {
  "VS 01": "VALEO BALAI E.G. ARRIERE VS01 240MM",
  "VS 02": "VALEO BALAI E.G. ARRIERE VS02 240MM", 
  "VS 03": "VALEO BALAI E.G. ARRIERE VS03 260MM",
  "VS 05": "VALEO BALAI E.G. ARRIERE VS05 280MM",
  "VS 06": "VALEO BALAI E.G. ARRIERE VS06 290MM",
  "VS 07": "VALEO BALAI E.G. ARRIERE VS07 300MM",
  "VS 08": "VALEO BALAI E.G. ARRIERE VS08 300MM",
  "VS 09": "VALEO BALAI E.G. ARRIERE VS09 300MM",
  "VS 10": "VALEO BALAI E.G. ARRIERE VS10 335MM",
  "VS 11": "VALEO BALAI E.G. ARRIERE VS11 350MM",
  "VS 12": "VALEO BALAI E.G. ARRIERE VS12 350MM",
  "VS 13": "VALEO BALAI E.G. ARRIERE VS13 400MM",
  "VS 14": "VALEO BALAI E.G. ARRIERE VS14 280MM",
  "VS 17": "VALEO BALAI E.G. ARRIERE VS17 400MM",
  "VS 31": "VALEO BALAI E.G. STD VS31 400MM",
  "VS 32": "VALEO BALAI E.G. STD VS32 450MM",
  "VS 33": "VALEO BALAI E.G. STD VS33 480MM",
  "VS 34": "VALEO BALAI E.G. STD VS34 510MM",
  "VS 35": "VALEO BALAI E.G. STD VS35 530MM",
  "VS 36": "VALEO BALAI E.G. STD VS36 550MM",
  "VS 37": "VALEO BALAI E.G. STD VS37 600MM",
  "VS 38": "VALEO BALAI E.G. STD VS38 650MM",
  "VS 30+": "VALEO BALAI E.G. PLAT RETROFIT VS30+ 350MM",
  "VS 31+": "VALEO BALAI E.G. PLAT RETROFIT VS31+ 400MM",
  "VS 32+": "VALEO BALAI E.G. PLAT RETROFIT VS32+ 450MM",
  "VS 33+": "VALEO BALAI E.G. PLAT RETROFIT VS33+ 475MM",
  "VS 34+": "VALEO BALAI E.G. PLAT RETROFIT VS34+ 500MM",
  "VS 35+": "VALEO BALAI E.G. PLAT RETROFIT VS35+ 530MM",
  "VS 36+": "VALEO BALAI E.G. PLAT RETROFIT VS36+ 550MM",
  "VS 37+": "VALEO BALAI E.G. PLAT RETROFIT VS37+ 600MM",
  "VS 38+": "VALEO BALAI E.G. PLAT RETROFIT VS38+ 650MM",
  "VS 70": "VALEO BALAI E.G. PLAT ORIGINE VS70 350MM",
  "VS 71": "VALEO BALAI E.G. PLAT ORIGINE VS71 400MM",
  "VS 72": "VALEO BALAI E.G. PLAT ORIGINE VS72 450MM",
  "VS 73": "VALEO BALAI E.G. PLAT ORIGINE VS73 475MM",
  "VS 74": "VALEO BALAI E.G. PLAT ORIGINE VS74 500MM",
  "VS 75": "VALEO BALAI E.G. PLAT ORIGINE VS75 530MM",
  "VS 76": "VALEO BALAI E.G. PLAT ORIGINE VS76 550MM",
  "VS 77": "VALEO BALAI E.G. PLAT ORIGINE VS77 600MM",
  "VS 78": "VALEO BALAI E.G. PLAT ORIGINE VS78 650MM",
  "VS 79": "VALEO BALAI E.G. PLAT ORIGINE VS79 700MM",
  "VS 80": "VALEO BALAI E.G. PLAT ORIGINE VS80 750MM",
  "VS 90": "VALEO KIT BALAI E.G. PLAT ORIG. VS90 680+425MM - PSA 3008 II, 5008 II",
  "VS 91": "VALEO KIT BALAI E.G. PLAT ORIGINE VS91 700+300MM RENAULT Clio V",
  "VS 92": "VALEO KIT BALAI E.G. PLAT ORIGINE VS92 650+350MM RENAULT Captur 1"
};

function transformWipersToPositions(wipersData) {
  const positions = [];
  
  // Handle standalone arriere position first (most common case)
  if (wipersData.arriere && typeof wipersData.arriere === 'string') {
    const description = wipersData.arriereDescription || ARRIERE_DESCRIPTIONS[wipersData.arriere] || null;
    
    positions.push({
      position: 'Arrière',
      ref: wipersData.arriere,
      description: description,
      category: 'arriere'
    });
  }
  
  // Process each category (standard, multiconnexion, etc.)
  // CRITICAL FIX: Skip 'arriere' and 'arriereDescription' when processing categories
  Object.keys(wipersData).forEach(category => {
    // Skip standalone fields that are not categories
    if (category === 'arriere' || category === 'arriereDescription') {
      return;
    }
    
    const categoryData = wipersData[category];
    if (!categoryData || typeof categoryData !== 'object') {
      return;
    }
    
    // Process each position in the category
    Object.keys(categoryData).forEach(positionKey => {
      // Skip description keys
      if (positionKey.endsWith('Description')) {
        return;
      }
      
      const ref = categoryData[positionKey];
      if (!ref || typeof ref !== 'string') {
        return;
      }
      
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
      let description = categoryData[descriptionKey] || null;
      
      // Special handling for arriere descriptions
      if (positionKey === 'arriere' && !description) {
        description = ARRIERE_DESCRIPTIONS[ref] || null;
      }
      
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

async function clearAllWipersProducts() {
  try {
    console.log('🧹 Clearing all existing wipers products...');
    
    const existingProducts = await strapi.entityService.findMany('api::wipers-product.wipers-product', {
      sort: 'id:asc'
    });
    
    console.log(`📊 Found ${existingProducts.length} existing wipers products to delete`);
    
    for (const product of existingProducts) {
      await strapi.entityService.delete('api::wipers-product.wipers-product', product.id);
    }
    
    console.log(`✅ Deleted ${existingProducts.length} wipers products`);
    
  } catch (error) {
    console.error('❌ Error clearing wipers products:', error);
    throw error;
  }
}

async function importWipersProductsFinalFix() {
  try {
    console.log('🚀 Starting FINAL FIX wipers products import...');
    
    // First, clear all existing wipers products
    await clearAllWipersProducts();
    
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
    
    // Process ALL brands and their models
    const brands = Object.keys(wipersData.brands);
    
    console.log(`🚀 Processing ALL ${brands.length} brands for FINAL FIX import...`);
    
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
            
            // Transform wipers data to positions array with FINAL FIX parsing
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
            
            console.log(`📋 Found ${wipersPositions.length} wiper positions with FINAL FIX parsing`);
            
            // Log the positions for verification
            wipersPositions.forEach(pos => {
              console.log(`   - ${pos.position}: ${pos.ref} (${pos.description ? 'with description' : 'no description'})`);
            });
            
            // Create wipers product with corrected data
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
    
    console.log('\n🎉 FINAL FIX wipers products import completed!');
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
    console.error('💥 FINAL FIX import failed:', error);
    throw error;
  }
}

// Run the final fix import
importWipersProductsFinalFix();
