// Import script for LightsBrands
// Run this in: npx strapi console

const fs = require('fs');
const path = require('path');

// Helper function to create slug
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

async function importLightsBrands() {
  try {
    console.log('🚀 Starting LightsBrands import...');
    
    // Read the data file
    const dataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_parsed.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`📊 Found ${data.length} records in osram_bulbs_parsed.json`);
    
    // Get unique brands
    const uniqueBrands = [...new Set(data.map(item => item.brand))];
    console.log(`🏷️ Found ${uniqueBrands.length} unique brands`);
    
    let importedCount = 0;
    let skippedCount = 0;
    
    for (const brandName of uniqueBrands) {
      const slug = slugify(brandName);
      
      // Check if brand already exists
      const existingBrands = await strapi.entityService.findMany('api::lights-brand.lights-brand', {
        filters: { slug: slug }
      });
      
      if (existingBrands.length > 0) {
        console.log(`⏭️ Skipping ${brandName} - already exists`);
        skippedCount++;
        continue;
      }
      
      // Create the brand
      await strapi.entityService.create('api::lights-brand.lights-brand', {
        data: {
          name: brandName,
          slug: slug,
          isActive: true,
          publishedAt: new Date()
        }
      });
      
      console.log(`✅ Imported: ${brandName} (${slug})`);
      importedCount++;
    }
    
    console.log(`\n🎉 Import completed!`);
    console.log(`✅ Imported: ${importedCount} brands`);
    console.log(`⏭️ Skipped: ${skippedCount} brands`);
    
  } catch (error) {
    console.error('❌ Error importing lights brands:', error);
  }
}

// Run the import
importLightsBrands();
