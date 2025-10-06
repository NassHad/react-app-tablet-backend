// Console-friendly version of battery products import script
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

async function importBatteryProducts() {
  try {
    console.log('🚀 Starting battery products import...');
    
    // Read the battery-products-fixed.json file
    const fs = require('fs');
    const path = require('path');
    const batteryProductsPath = path.join(process.cwd(), 'scripts', 'battery', 'battery-products-fixed.json');
    const batteryProductsData = JSON.parse(fs.readFileSync(batteryProductsPath, 'utf8'));
    
    console.log(`📊 Found ${batteryProductsData.length} battery product entries to process`);
    
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
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
            source: 'ILV-FULMEN-ENDURANCE',
            category: 'battery'
          }
        });
        
        // Count motorisations with battery types
        const motorisationsWithBatteryTypes = productData.motorisations.filter(motor => 
          motor.batteryAGM || motor.batteryEFB || motor.batteryConventional
        );
        
        console.log(`✅ Created battery product: ${productData.brand} ${productData.modelName} with ${productData.motorisations.length} motorisations (${motorisationsWithBatteryTypes.length} with battery types) (ID: ${batteryProduct.id})`);
        importedCount++;
        
      } catch (error) {
        console.error(`❌ Error creating battery product "${productData.brand} ${productData.modelName}":`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Import Summary:');
    console.log(`✅ Imported: ${importedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${batteryProductsData.length}`);
    
    console.log('\n🎉 Battery products import completed!');
    
  } catch (error) {
    console.error('💥 Fatal error during import:', error);
  }
}

// Export the function for console use
module.exports = { importBatteryProducts };
