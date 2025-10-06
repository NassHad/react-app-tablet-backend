// Import Lights Products with comprehensive slug mapping and error handling
// Copy and paste this ENTIRE script into your Strapi console

const fs = require('fs');
const path = require('path');

// Utility function to create slugs
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

// Utility function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Comprehensive slug mapping function
function mapSlugToDatabase(brandSlug, modelSlug) {
  // Skip invalid or empty slugs
  if (!modelSlug || modelSlug.length < 2 || modelSlug.includes('_')) {
    return null;
  }
  
  // Brand corrections
  const brandMappings = {
    'daimler': 'ford',  // Many Daimler models are actually Ford
    'daewoo': 'chevrolet'
  };
  
  const correctedBrand = brandMappings[brandSlug] || brandSlug;
  
  // Model slug corrections
  const modelMappings = {
    // Remove hyphens in compound words
    'dokker-express-box-body-mpv': 'dokker-express-box-bodympv',
    'doblo-box-body-mpv': 'doblo-box-bodympv',
    'doblo-platform-chassis': 'doblo-platformchassis',
    'ducato-platform-chassis': 'ducato-platformchassis',
    'fiorino-box-body-mpv': 'fiorino-box-bodympv',
    'fiesta-box-body-mpv': 'fiesta-box-bodympv',
    'transit-connect': 'transit-connect',
    's-max': 's-max',
    'c-max': 'c-max',
    'ka+-iii': 'ka-iii',
    'ka+-iii-saloon': 'ka-iii-saloon',
    'mondeo-iii-turnier': 'mondeo-iii-turnier',
    'focus-c-max': 'focus-c-max',
    'focus-ii': 'focus-ii',
    'fiesta-iv': 'fiesta-iv',
    'fiesta-v': 'fiesta-v',
    'fiesta-vi': 'fiesta-vi',
    'fiesta-vii': 'fiesta-vii',
    'galaxy': 'galaxy',
    'fusion': 'fusion',
    'ranger': 'ranger',
    'transit-connect': 'transit-connect',
    'box-body-mpv': 'box-bodympv',
    'h-1-platform-chassis': 'h-1-platformchassis',
    'h350-platform-chassis': 'h350-platformchassis',
    'i20-ii-hatchback-van': 'i20-ii-hatchback-van',
    'i30-fastback': 'i30-fastback',
    'grand-santa-fe': 'grand-santa-fe',
    'santa-fe-i': 'santa-fe-i',
    'santa-fe-ii': 'santa-fe-ii',
    'santa-fe-iii': 'santa-fe-iii',
    'santamo': 'santamo'
  };
  
  const correctedModel = modelMappings[modelSlug] || modelSlug;
  
  return { brand: correctedBrand, model: correctedModel };
}

(async () => {
  try {
    console.log('🚀 Starting Lights Products import with robust mapping...');
    
    // Read the data file
    const dataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_with_slugs.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`📊 Found ${data.length} records in osram_bulbs_with_slugs.json`);
    
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let mappedCount = 0;
    let invalidSlugCount = 0;
    
    // Cache for models to avoid repeated queries
    const modelCache = new Map();
    
    // Process each record
    for (const item of data) {
      try {
        const originalBrandSlug = item.brandSlug;
        const originalModelSlug = item.modelSlug;
        
        // Skip invalid entries
        if (!originalBrandSlug || !originalModelSlug) {
          invalidSlugCount++;
          continue;
        }
        
        // Apply comprehensive mapping
        const mapping = mapSlugToDatabase(originalBrandSlug, originalModelSlug);
        if (!mapping) {
          invalidSlugCount++;
          continue;
        }
        
        const { brand: brandSlug, model: modelSlug } = mapping;
        const wasMapped = brandSlug !== originalBrandSlug || modelSlug !== originalModelSlug;
        
        if (wasMapped) {
          mappedCount++;
          console.log(`🔄 Mapped: ${originalBrandSlug}/${originalModelSlug} → ${brandSlug}/${modelSlug}`);
        }
        
        // Try to find the model
        let model;
        const modelKey = `${brandSlug}-${modelSlug}`;
        
        if (modelCache.has(modelKey)) {
          model = modelCache.get(modelKey);
        } else {
          const models = await strapi.entityService.findMany('api::model.model', {
            filters: { 
              slug: modelSlug,
              brand: {
                slug: brandSlug
              }
            },
            populate: { brand: true }
          });
          
          if (models.length > 0) {
            model = models[0];
            modelCache.set(modelKey, model);
          }
        }
        
        if (!model) {
          // Try alternative search patterns
          const alternativeModels = await strapi.entityService.findMany('api::model.model', {
            filters: { 
              slug: { $contains: modelSlug.split('-')[0] },
              brand: {
                slug: brandSlug
              }
            },
            populate: { brand: true }
          });
          
          if (alternativeModels.length > 0) {
            model = alternativeModels[0];
            modelCache.set(modelKey, model);
            console.log(`🔍 Found alternative: ${modelSlug} → ${model.slug}`);
          } else {
            console.log(`⚠️ Model not found for ${brandSlug}/${modelSlug}, skipping`);
            errorCount++;
            continue;
          }
        }
        
        // Check if this product already exists
        const existingProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
          filters: {
            model: { id: model.id },
            brand: { id: model.brand.id }
          }
        });
        
        if (existingProducts.length > 0) {
          skippedCount++;
          continue;
        }
        
        // Process all light positions in the lightType object
        const lightType = item.lightType;
        const positions = Object.values(lightType)
          .filter(pos => pos && pos.ref && pos.position)
          .map(pos => ({
            ref: pos.ref,
            position: pos.position,
            category: pos.category
          }));
        
        if (positions.length === 0) {
          errorCount++;
          continue;
        }
        
        // Create the lights product with grouped positions
        await strapi.entityService.create('api::lights-product.lights-product', {
          data: {
            name: `${model.brand.name} ${model.name}`,
            ref: positions.length === 1 ? positions[0].ref : 'Multiple',
            description: `Light positions for ${model.brand.name} ${model.name}`,
            brand: { id: model.brand.id },
            model: { id: model.id },
            lightPositions: positions,
            constructionYearStart: item.constructionYear.start,
            constructionYearEnd: item.constructionYear.end,
            typeConception: item.typeConception,
            partNumber: item.partNumber || '',
            notes: item.notes || '',
            source: item.source || 'OSRAM CSV Guide',
            category: 'multiple',
            isActive: true,
            publishedAt: new Date()
          }
        });
        
        importedCount++;
        
        // Log progress every 100 entries
        if (importedCount % 100 === 0) {
          console.log(`📊 Processed ${importedCount} products...`);
        }
        
        // Small delay to avoid overwhelming the server
        if (importedCount % 10 === 0) {
          await delay(50);
        }
        
      } catch (itemError) {
        console.error(`❌ Error processing item ${item.originalBrand} ${item.originalModel}:`, itemError.message);
        errorCount++;
      }
    }
    
    // Final summary
    console.log('');
    console.log('🎉 Import Complete!');
    console.log('📊 Final Summary:');
    console.log(`- Products imported: ${importedCount}`);
    console.log(`- Products skipped: ${skippedCount}`);
    console.log(`- Errors: ${errorCount}`);
    console.log(`- Slug mappings applied: ${mappedCount}`);
    console.log(`- Invalid slugs skipped: ${invalidSlugCount}`);
    
    // Verify the import
    console.log('\n🔍 Verifying import...');
    const createdProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
      populate: {
        brand: true,
        model: {
          populate: {
            brand: true
          }
        }
      }
    });
    
    console.log(`📊 Total products in database: ${createdProducts.length}`);
    
    if (createdProducts.length > 0) {
      console.log('\n📋 Sample products:');
      createdProducts.slice(0, 3).forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.name}`);
        console.log(`     Brand: ${product.brand?.name}`);
        console.log(`     Model: ${product.model?.name}`);
        console.log(`     Positions: ${product.lightPositions?.length || 0} light positions`);
        if (product.lightPositions && product.lightPositions.length > 0) {
          console.log(`     Sample positions: ${product.lightPositions.slice(0, 2).map(p => p.position).join(', ')}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  }
})();
