// Import script for LightPositionData
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

async function importLightPositionData() {
  try {
    console.log('🚀 Starting LightPositionData import...');
    
    // Read the data file
    const dataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_parsed.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`📊 Found ${data.length} records in osram_bulbs_parsed.json`);
    
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const item of data) {
      try {
        const brandSlug = slugify(item.brand);
        const modelSlug = slugify(`${item.model}-${item.constructionYear.start}-${item.constructionYear.end}`);
        const positionSlug = slugify(`${item.model}-${item.constructionYear.start}-${item.constructionYear.end}-${item.position}`);
        
        // Find the corresponding position
        const positions = await strapi.entityService.findMany('api::lights-position.lights-position', {
          filters: { slug: positionSlug },
          populate: { lightsModel: true }
        });
        
        if (positions.length === 0) {
          console.log(`⚠️ Position not found for ${item.brand} ${item.model} ${item.position}, skipping data`);
          errorCount++;
          continue;
        }
        
        // Check if this exact data already exists
        const existingData = await strapi.entityService.findMany('api::light-position-data.light-position-data', {
          filters: {
            lightType: item.lightType,
            position: item.position,
            category: item.category,
            lightsPosition: positions[0].id
          }
        });
        
        if (existingData.length > 0) {
          console.log(`⏭️ Skipping ${item.lightType} for ${item.position} - already exists`);
          skippedCount++;
          continue;
        }
        
        // Create the position data
        await strapi.entityService.create('api::light-position-data.light-position-data', {
          data: {
            lightType: item.lightType,
            position: item.position,
            category: item.category,
            typeConception: item.typeConception || '',
            partNumber: item.partNumber || '',
            notes: item.notes || '',
            source: item.source || '',
            lightsPosition: positions[0].id,
            isActive: true,
            publishedAt: new Date()
          }
        });
        
        console.log(`✅ Imported: ${item.lightType} for ${item.position} (${item.brand} ${item.model})`);
        importedCount++;
        
        // Add a small delay to avoid overwhelming the database
        if (importedCount % 1000 === 0) {
          console.log(`📊 Progress: ${importedCount} records imported...`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ Error importing data for ${item.brand} ${item.model}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 Import completed!`);
    console.log(`✅ Imported: ${importedCount} position data records`);
    console.log(`⏭️ Skipped: ${skippedCount} position data records`);
    console.log(`❌ Errors: ${errorCount} position data records`);
    
  } catch (error) {
    console.error('❌ Error importing light position data:', error);
  }
}

// Run the import
importLightPositionData();
