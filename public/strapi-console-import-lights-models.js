// Import script for LightsModels
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

async function importLightsModels() {
  try {
    console.log('🚀 Starting LightsModels import...');
    
    // Read the data file
    const dataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_parsed.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`📊 Found ${data.length} records in osram_bulbs_parsed.json`);
    
    // Get unique model + year combinations
    const uniqueModels = new Map();
    
    data.forEach(item => {
      const key = `${item.brand}|${item.model}|${item.constructionYear.start}|${item.constructionYear.end}`;
      if (!uniqueModels.has(key)) {
        uniqueModels.set(key, {
          brand: item.brand,
          model: item.model,
          constructionYearStart: item.constructionYear.start,
          constructionYearEnd: item.constructionYear.end
        });
      }
    });
    
    console.log(`🚗 Found ${uniqueModels.size} unique model + year combinations`);
    
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const [key, modelData] of uniqueModels) {
      try {
        const brandSlug = slugify(modelData.brand);
        const modelSlug = slugify(`${modelData.model}-${modelData.constructionYearStart}-${modelData.constructionYearEnd}`);
        
        // Find the corresponding brand
        const brands = await strapi.entityService.findMany('api::lights-brand.lights-brand', {
          filters: { slug: brandSlug }
        });
        
        if (brands.length === 0) {
          console.log(`⚠️ Brand not found for ${modelData.brand}, skipping model ${modelData.model}`);
          errorCount++;
          continue;
        }
        
        // Check if model already exists
        const existingModels = await strapi.entityService.findMany('api::lights-model.lights-model', {
          filters: { slug: modelSlug }
        });
        
        if (existingModels.length > 0) {
          console.log(`⏭️ Skipping ${modelData.model} (${modelData.constructionYearStart}-${modelData.constructionYearEnd}) - already exists`);
          skippedCount++;
          continue;
        }
        
        // Create the model
        await strapi.entityService.create('api::lights-model.lights-model', {
          data: {
            name: modelData.model,
            slug: modelSlug,
            constructionYearStart: modelData.constructionYearStart,
            constructionYearEnd: modelData.constructionYearEnd,
            lightsBrand: brands[0].id,
            isActive: true,
            publishedAt: new Date()
          }
        });
        
        console.log(`✅ Imported: ${modelData.model} (${modelData.constructionYearStart}-${modelData.constructionYearEnd})`);
        importedCount++;
        
      } catch (error) {
        console.error(`❌ Error importing model ${modelData.model}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 Import completed!`);
    console.log(`✅ Imported: ${importedCount} models`);
    console.log(`⏭️ Skipped: ${skippedCount} models`);
    console.log(`❌ Errors: ${errorCount} models`);
    
  } catch (error) {
    console.error('❌ Error importing lights models:', error);
  }
}

// Run the import
importLightsModels();
