const fs = require('fs');
const path = require('path');

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

async function importBatteryBrands() {
  try {
    console.log('🚀 Starting battery brands import...');
    
    // Read the brands.json file
    const brandsPath = path.join(__dirname, '..', 'data', 'brands.json');
    const brandsData = JSON.parse(fs.readFileSync(brandsPath, 'utf8'));
    
    console.log(`📊 Found ${brandsData.length} brands to import`);
    
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const brandData of brandsData) {
      try {
        // Check if brand already exists
        const existingBrands = await strapi.entityService.findMany('api::battery-brand.battery-brand', {
          filters: {
            name: brandData.name
          }
        });
        
        if (existingBrands && existingBrands.length > 0) {
          console.log(`⏭️  Skipping existing brand: ${brandData.name}`);
          skippedCount++;
          continue;
        }
        
        // Create slug from name
        const slug = slugify(brandData.name);
        
        // Create the battery brand
        const batteryBrand = await strapi.entityService.create('api::battery-brand.battery-brand', {
          data: {
            name: brandData.name,
            slug: slug,
            isActive: brandData.active === 1
          }
        });
        
        console.log(`✅ Created battery brand: ${brandData.name} (ID: ${batteryBrand.id})`);
        importedCount++;
        
      } catch (error) {
        console.error(`❌ Error creating battery brand "${brandData.name}":`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Import Summary:');
    console.log(`✅ Imported: ${importedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${brandsData.length}`);
    
    console.log('\n🎉 Battery brands import completed!');
    
  } catch (error) {
    console.error('💥 Fatal error during import:', error);
  }
}

// Run the import
importBatteryBrands();