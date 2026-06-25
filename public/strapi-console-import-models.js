// Battery Models Import Script for Strapi Console
// Copy and paste this entire script into the Strapi console

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

// Utility function to parse DD/MM/YYYY date format
function parseDate(dateString) {
  if (!dateString) return null;
  
  try {
    const [day, month, year] = dateString.split('/');
    return new Date(year, month - 1, day);
  } catch (error) {
    console.warn(`⚠️  Invalid date format: ${dateString}`);
    return null;
  }
}

async function importBatteryModels() {
  try {
    console.log('🚀 Starting battery models import...');
    
    // Read the models.json file - adjust path as needed
    const modelsPath = path.join(process.cwd(), 'scripts', 'models.json');
    console.log('📁 Reading from:', modelsPath);
    
    const modelsData = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
    
    console.log(`📊 Found ${modelsData.length} models to import`);
    
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Get all battery brands to create a lookup map
    const batteryBrands = await strapi.entityService.findMany('api::battery-brand.battery-brand', {
      filters: {
        isActive: true
      }
    });
    
    const brandSlugMap = {};
    batteryBrands.forEach(brand => {
      brandSlugMap[brand.slug] = brand.id;
    });
    
    console.log(`📋 Found ${batteryBrands.length} battery brands for lookup`);
    
    for (const modelData of modelsData) {
      try {
        // Find the corresponding battery brand by slug
        const brandId = brandSlugMap[modelData.brandSlug];
        
        if (!brandId) {
          console.log(`⚠️  Brand not found for slug: ${modelData.brandSlug}, skipping model: ${modelData.name}`);
          skippedCount++;
          continue;
        }
        
        // Create a unique identifier for the model (name + brand + motorisation)
        const modelIdentifier = `${modelData.name}-${modelData.brandSlug}-${modelData.motorisation || 'default'}`;
        const modelSlug = slugify(modelIdentifier);
        
        // Check if model already exists
        const existingModels = await strapi.entityService.findMany('api::battery-model.battery-model', {
          filters: {
            slug: modelSlug
          }
        });
        
        if (existingModels && existingModels.length > 0) {
          console.log(`⏭️  Skipping existing model: ${modelData.name} (${modelData.motorisation})`);
          skippedCount++;
          continue;
        }
        
        // Parse dates
        const startDate = parseDate(modelData.startDate);
        const endDate = parseDate(modelData.endDate);
        
        // Create the battery model
        const batteryModel = await strapi.entityService.create('api::battery-model.battery-model', {
          data: {
            name: modelData.name,
            slug: modelSlug,
            startDate: startDate,
            endDate: endDate,
            isActive: true,
            batteryBrand: brandId,
            motorisation: modelData.motorisation || null,
            fuel: modelData.fuel || null
          }
        });
        
        console.log(`✅ Created battery model: ${modelData.name} (${modelData.motorisation}) for brand: ${modelData.brandSlug} (ID: ${batteryModel.id})`);
        importedCount++;
        
      } catch (error) {
        console.error(`❌ Error creating battery model "${modelData.name}":`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Import Summary:');
    console.log(`✅ Imported: ${importedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${modelsData.length}`);
    
    console.log('\n🎉 Battery models import completed!');
    
  } catch (error) {
    console.error('💥 Fatal error during import:', error);
  }
}

// Run the import
importBatteryModels();
