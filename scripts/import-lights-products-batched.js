// Import Lights Products from osram_bulbs_with_slugs.json (Batched Version)
// This script creates LightsProduct entries with proper relationships to LightsModel and LightsPosition
// Uses batching to handle large datasets efficiently

const fs = require('fs');
const path = require('path');

// Configuration
const BATCH_SIZE = 50; // Process 50 records at a time
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

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

async function importLightsProductsBatched() {
  try {
    console.log('🚀 Starting Lights Products import (Batched)...');
    
    // Read the data file
    const dataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_with_slugs.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`📊 Found ${data.length} records in osram_bulbs_with_slugs.json`);
    
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Cache for models and positions to avoid repeated queries
    const modelCache = new Map();
    const positionCache = new Map();
    
    // Process data in batches
    const totalBatches = Math.ceil(data.length / BATCH_SIZE);
    console.log(`Processing ${data.length} records in ${totalBatches} batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);
      
      for (const item of batch) {
        try {
          const brandSlug = item.brandSlug;
          const modelSlug = item.modelSlug;
          
          // Find the corresponding model
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
            
            if (models.length === 0) {
              console.log(`⚠️ Model not found for ${brandSlug}/${modelSlug}, skipping`);
              errorCount++;
              continue;
            }
            
            model = models[0];
            modelCache.set(modelKey, model);
          }
          
          // Process each light position in the lightType object
          const lightType = item.lightType;
          const positions = Object.values(lightType).filter(pos => pos && pos.ref && pos.position);
          
          for (const position of positions) {
            try {
              // Find or create the light position
              let lightPosition;
              const positionSlug = slugify(position.position);
              const positionKey = `${positionSlug}-${position.category}`;
              
              if (positionCache.has(positionKey)) {
                lightPosition = positionCache.get(positionKey);
              } else {
                // Try to find existing position
                let existingPositions = await strapi.entityService.findMany('api::lights-position.lights-position', {
                  filters: { 
                    slug: positionSlug,
                    name: position.position
                  }
                });
                
                if (existingPositions.length === 0) {
                  // Create new position
                  lightPosition = await strapi.entityService.create('api::lights-position.lights-position', {
                    data: {
                      name: position.position,
                      slug: positionSlug,
                      isActive: true,
                      publishedAt: new Date()
                    }
                  });
                  
                  console.log(`✅ Created new position: ${position.position}`);
                } else {
                  lightPosition = existingPositions[0];
                }
                
                positionCache.set(positionKey, lightPosition);
              }
              
              // Check if this product already exists
              const existingProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
                filters: {
                  ref: position.ref,
                  model: { id: model.id },
                  lights_position: { id: lightPosition.id }
                }
              });
              
              if (existingProducts.length > 0) {
                skippedCount++;
                continue;
              }
              
              // Create the lights product
              await strapi.entityService.create('api::lights-product.lights-product', {
                data: {
                  name: position.position,
                  ref: position.ref,
                  description: `${position.ref} for ${position.position}`,
                  brand: { id: model.brand.id },
                  model: { id: model.id },
                  lights_position: { id: lightPosition.id },
                  constructionYearStart: item.constructionYear.start,
                  constructionYearEnd: item.constructionYear.end,
                  typeConception: item.typeConception,
                  partNumber: item.partNumber || '',
                  notes: item.notes || '',
                  source: item.source || 'OSRAM CSV Guide',
                  category: position.category,
                  isActive: true,
                  publishedAt: new Date()
                }
              });
              
              importedCount++;
              
            } catch (positionError) {
              console.error(`❌ Error processing position ${position.position}:`, positionError.message);
              errorCount++;
            }
          }
          
        } catch (itemError) {
          console.error(`❌ Error processing item ${item.originalBrand} ${item.originalModel}:`, itemError.message);
          errorCount++;
        }
      }
      
      // Delay between batches to avoid overwhelming the server
      if (i + BATCH_SIZE < data.length) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
      
      // Log progress every 10 batches
      if (batchNumber % 10 === 0) {
        console.log(`📊 Progress: ${importedCount} products imported, ${skippedCount} skipped, ${errorCount} errors`);
      }
    }
    
    // Final summary
    console.log('');
    console.log('🎉 Import Complete!');
    console.log('📊 Final Summary:');
    console.log(`- Products imported: ${importedCount}`);
    console.log(`- Products skipped: ${skippedCount}`);
    console.log(`- Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  }
}

// Run the import
importLightsProductsBatched();
