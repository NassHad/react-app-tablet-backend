// Console-friendly version of battery products import script for split data
// Run this in Strapi console: npx strapi console

// Utility function to create URL-friendly slugs
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

async function importBatteryProductsSplit() {
  try {
    console.log('🚀 Starting battery products import (split data)...');
    
    // Read the battery-products-split.json file
    const fs = require('fs');
    const path = require('path');
    const batteryProductsPath = path.join(process.cwd(), 'scripts', 'battery', 'battery-products-split.json');
    const batteryProductsData = JSON.parse(fs.readFileSync(batteryProductsPath, 'utf8'));
    
    console.log(`📊 Found ${batteryProductsData.length} battery product entries to process`);
    
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let totalMotorisations = 0;
    let motorisationsWithBatteryTypes = 0;
    
    // Process each battery product
    for (const productData of batteryProductsData) {
      try {
        // Create a unique slug for the product
        const productSlug = slugify(`${productData.brandSlug}-${productData.modelSlug}`);
        
        // Check if product already exists
        const existingProducts = await strapi.entityService.findMany('api::battery-product.battery-product', {
          filters: {
            slug: productSlug
          }
        });
        
        if (existingProducts && existingProducts.length > 0) {
          console.log(`⏭️  Skipping existing product: ${productData.brand} ${productData.modelName}`);
          skippedCount++;
          continue;
        }
        
        // Count motorisations with battery types for this product
        const productMotorisationsWithBatteryTypes = productData.motorisations.filter(motor => 
          motor.batteryAGM || motor.batteryEFB || motor.batteryConventional
        );
        
        totalMotorisations += productData.motorisations.length;
        motorisationsWithBatteryTypes += productMotorisationsWithBatteryTypes.length;
        
        // Create the battery product
        const batteryProduct = await strapi.entityService.create('api::battery-product.battery-product', {
          data: {
            name: `${productData.brand} ${productData.modelName}`,
            slug: productSlug,
            brand: productData.brand,
            brandSlug: productData.brandSlug,
            modelName: productData.modelName,
            modelSlug: productData.modelSlug,
            motorisations: productData.motorisations,
            isActive: true,
            source: 'ILV-FULMEN-ENDURANCE-SPLIT',
            category: 'battery'
          }
        });
        
        console.log(`✅ Created battery product: ${productData.brand} ${productData.modelName} with ${productData.motorisations.length} motorisations (${productMotorisationsWithBatteryTypes.length} with battery types) (ID: ${batteryProduct.id})`);
        importedCount++;
        
      } catch (error) {
        console.error(`❌ Error creating battery product "${productData.brand} ${productData.modelName}":`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Import Summary:');
    console.log(`✅ Imported: ${importedCount} products`);
    console.log(`⏭️  Skipped: ${skippedCount} products`);
    console.log(`❌ Errors: ${errorCount} products`);
    console.log(`📊 Total processed: ${batteryProductsData.length} products`);
    console.log(`🔋 Total motorisations: ${totalMotorisations}`);
    console.log(`🔋 Motorisations with battery types: ${motorisationsWithBatteryTypes}`);
    console.log(`📈 Battery type coverage: ${((motorisationsWithBatteryTypes / totalMotorisations) * 100).toFixed(1)}%`);
    
    console.log('\n🎉 Battery products import (split data) completed!');
    
  } catch (error) {
    console.error('💥 Fatal error during import:', error);
  }
}

// Export the function for console use
module.exports = { importBatteryProductsSplit };
