// Test script for Lights Products import (Strapi Console Version)
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

(async () => {
  try {
    console.log('🧪 Testing Lights Products import with sample data...');
    
    // Read the data file
    const dataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_with_slugs.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    // Take only the first 5 records for testing
    const testData = data.slice(0, 5);
    console.log(`📊 Testing with ${testData.length} records`);
    
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process each test record
    for (const item of testData) {
      try {
        console.log(`\n🔍 Processing: ${item.originalBrand} ${item.originalModel}`);
        console.log(`   Brand Slug: ${item.brandSlug}`);
        console.log(`   Model Slug: ${item.modelSlug}`);
        
        const brandSlug = item.brandSlug;
        const modelSlug = item.modelSlug;
        
        // Find the corresponding model
        const models = await strapi.entityService.findMany('api::model.model', {
          filters: { 
            slug: modelSlug,
            brand: {
              slug: brandSlug
            }
          },
          populate: { 
            brand: true 
          }
        });
        
        if (models.length === 0) {
          console.log(`⚠️ Model not found for ${brandSlug}/${modelSlug}, skipping`);
          errorCount++;
          continue;
        }
        
        const model = models[0];
        console.log(`   ✅ Found model: ${model.name} (ID: ${model.id})`);
        console.log(`   🏷️ Brand: ${model.brand ? model.brand.name : 'NULL'} (ID: ${model.brand ? model.brand.id : 'NULL'})`);
        
        if (!model.brand) {
          console.log(`   ❌ Model has no brand relationship, skipping`);
          errorCount++;
          continue;
        }
        
        // Process each light position in the lightType object
        const lightType = item.lightType;
        const positions = Object.values(lightType).filter(pos => pos && pos.ref && pos.position);
        
        console.log(`   📍 Found ${positions.length} light positions`);
        
        for (const position of positions) {
          try {
            console.log(`     🔦 Processing position: ${position.position} (${position.ref})`);
            
            // Find or create the light position
            const positionSlug = slugify(position.position);
            
            let existingPositions = await strapi.entityService.findMany('api::lights-position.lights-position', {
              filters: { 
                slug: positionSlug,
                name: position.position
              }
            });
            
            let lightPosition;
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
              
              console.log(`       ✅ Created new position: ${position.position} (ID: ${lightPosition.id})`);
            } else {
              lightPosition = existingPositions[0];
              console.log(`       ✅ Found existing position: ${position.position} (ID: ${lightPosition.id})`);
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
              console.log(`       ⏭️ Product already exists, skipping`);
              skippedCount++;
              continue;
            }
            
            // Create the lights product
            const product = await strapi.entityService.create('api::lights-product.lights-product', {
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
            
            console.log(`       ✅ Created product: ${position.ref} (ID: ${product.id})`);
            importedCount++;
            
          } catch (positionError) {
            console.error(`       ❌ Error processing position ${position.position}:`, positionError.message);
            errorCount++;
          }
        }
        
      } catch (itemError) {
        console.error(`❌ Error processing item ${item.originalBrand} ${item.originalModel}:`, itemError.message);
        errorCount++;
      }
    }
    
    // Final summary
    console.log('\n🎉 Test Complete!');
    console.log('📊 Test Summary:');
    console.log(`- Products imported: ${importedCount}`);
    console.log(`- Products skipped: ${skippedCount}`);
    console.log(`- Errors: ${errorCount}`);
    
    // Verify the import by querying the created products
    console.log('\n🔍 Verifying import...');
    const createdProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
      populate: {
        brand: true,
        model: {
          populate: {
            brand: true
          }
        },
        lights_position: true
      }
    });
    
    console.log(`📊 Total products in database: ${createdProducts.length}`);
    
    if (createdProducts.length > 0) {
      console.log('\n📋 Sample products:');
      createdProducts.slice(0, 3).forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.ref} - ${product.name}`);
        console.log(`     Brand: ${product.brand?.name}`);
        console.log(`     Model: ${product.model?.name}`);
        console.log(`     Position: ${product.lights_position?.name}`);
        console.log(`     Category: ${product.category}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
})();
