// Import Lights Products with slug mapping to handle differences
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

// Slug mapping function to handle differences between JSON and database
function mapSlugToDatabase(brandSlug, modelSlug) {
  // Common mappings for problematic slugs
  const slugMappings = {
    'dokker-express-box-body-mpv': 'dokker-express-box-bodympv',
    'doblo-box-body-mpv': 'doblo-box-bodympv',
    'doblo-platform-chassis': 'doblo-platformchassis',
    'ducato-platform-chassis': 'ducato-platformchassis',
    'fiorino-box-body-mpv': 'fiorino-box-bodympv'
  };
  
  return slugMappings[modelSlug] || modelSlug;
}

(async () => {
  try {
    console.log('🚀 Starting Lights Products import with slug mapping...');
    
    // Read the data file
    const dataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_with_slugs.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`📊 Found ${data.length} records in osram_bulbs_with_slugs.json`);
    
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let mappedCount = 0;
    
    // Cache for models to avoid repeated queries
    const modelCache = new Map();
    
    // Process each record
    for (const item of data) {
      try {
        const brandSlug = item.brandSlug;
        let modelSlug = item.modelSlug;
        const originalModelSlug = modelSlug;
        
        // Try to find the model with the original slug first
        let model;
        let modelKey = `${brandSlug}-${modelSlug}`;
        
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
          
          // If not found, try with mapped slug
          if (models.length === 0) {
            const mappedSlug = mapSlugToDatabase(brandSlug, modelSlug);
            if (mappedSlug !== modelSlug) {
              modelSlug = mappedSlug;
              modelKey = `${brandSlug}-${modelSlug}`;
              mappedCount++;
              
              const mappedModels = await strapi.entityService.findMany('api::model.model', {
                filters: { 
                  slug: modelSlug,
                  brand: {
                    slug: brandSlug
                  }
                },
                populate: { brand: true }
              });
              
              if (mappedModels.length > 0) {
                model = mappedModels[0];
                modelCache.set(modelKey, model);
                console.log(`🔄 Mapped: ${originalModelSlug} → ${modelSlug}`);
              }
            }
          } else {
            model = models[0];
            modelCache.set(modelKey, model);
          }
        }
        
        if (!model) {
          console.log(`⚠️ Model not found for ${brandSlug}/${originalModelSlug}, skipping`);
          errorCount++;
          continue;
        }
        
        // Check if this product already exists
        const existingProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
          filters: {
            model: { id: model.id },
            brand: { id: model.brand.id }
          }
        });
        
        if (existingProducts.length > 0) {
          console.log(`⏭️ Product already exists for ${model.brand.name} ${model.name}, skipping`);
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
          console.log(`⚠️ No valid positions found for ${model.brand.name} ${model.name}, skipping`);
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
          await delay(100);
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
