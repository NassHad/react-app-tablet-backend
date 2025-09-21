// Import script for LightsPositions
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

async function importLightsPositions() {
  try {
    console.log('🚀 Starting LightsPositions import...');
    
    // Read the data file
    const dataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_parsed.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`📊 Found ${data.length} records in osram_bulbs_parsed.json`);
    
    // Get unique position + model combinations
    const uniquePositions = new Map();
    
    data.forEach(item => {
      const modelKey = `${item.brand}|${item.model}|${item.constructionYear.start}|${item.constructionYear.end}`;
      const positionKey = `${modelKey}|${item.position}`;
      
      if (!uniquePositions.has(positionKey)) {
        uniquePositions.set(positionKey, {
          brand: item.brand,
          model: item.model,
          constructionYearStart: item.constructionYear.start,
          constructionYearEnd: item.constructionYear.end,
          position: item.position
        });
      }
    });
    
    console.log(`💡 Found ${uniquePositions.size} unique position + model combinations`);
    
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const [key, positionData] of uniquePositions) {
      try {
        const brandSlug = slugify(positionData.brand);
        const modelSlug = slugify(`${positionData.model}-${positionData.constructionYearStart}-${positionData.constructionYearEnd}`);
        const positionSlug = slugify(`${positionData.model}-${positionData.constructionYearStart}-${positionData.constructionYearEnd}-${positionData.position}`);
        
        // Find the corresponding model
        const models = await strapi.entityService.findMany('api::lights-model.lights-model', {
          filters: { slug: modelSlug },
          populate: { lightsBrand: true }
        });
        
        if (models.length === 0) {
          console.log(`⚠️ Model not found for ${positionData.brand} ${positionData.model}, skipping position ${positionData.position}`);
          errorCount++;
          continue;
        }
        
        // Check if position already exists
        const existingPositions = await strapi.entityService.findMany('api::lights-position.lights-position', {
          filters: { slug: positionSlug }
        });
        
        if (existingPositions.length > 0) {
          console.log(`⏭️ Skipping ${positionData.position} for ${positionData.model} - already exists`);
          skippedCount++;
          continue;
        }
        
        // Create the position
        await strapi.entityService.create('api::lights-position.lights-position', {
          data: {
            name: positionData.position,
            slug: positionSlug,
            lightsModel: models[0].id,
            isActive: true,
            publishedAt: new Date()
          }
        });
        
        console.log(`✅ Imported: ${positionData.position} for ${positionData.model}`);
        importedCount++;
        
      } catch (error) {
        console.error(`❌ Error importing position ${positionData.position}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 Import completed!`);
    console.log(`✅ Imported: ${importedCount} positions`);
    console.log(`⏭️ Skipped: ${skippedCount} positions`);
    console.log(`❌ Errors: ${errorCount} positions`);
    
  } catch (error) {
    console.error('❌ Error importing lights positions:', error);
  }
}

// Run the import
importLightsPositions();
