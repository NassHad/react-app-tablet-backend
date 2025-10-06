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
    console.log('🚀 Starting battery models import (grouped by model)...');
    
    // Read the models.json file
    const modelsPath = path.join(__dirname, 'models.json');
    const modelsData = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
    
    console.log(`📊 Found ${modelsData.length} model entries to process`);
    
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
    
    // Get all general models to create a lookup map
    const generalModels = await strapi.entityService.findMany('api::model.model', {
      filters: {
        isActive: true
      },
      populate: {
        brand: true
      }
    });
    
    const modelLookupMap = {};
    generalModels.forEach(model => {
      if (model.brand && model.brand.slug) {
        const key = `${model.brand.slug}-${model.name.toLowerCase()}`;
        if (!modelLookupMap[key]) {
          modelLookupMap[key] = [];
        }
        modelLookupMap[key].push(model.id);
      }
    });
    
    console.log(`📋 Found ${generalModels.length} general models for lookup`);
    
    // Group models by brand + model name
    const groupedModels = new Map();
    
    for (const modelData of modelsData) {
      const groupKey = `${modelData.brandSlug}-${modelData.name}`;
      
      if (!groupedModels.has(groupKey)) {
        groupedModels.set(groupKey, {
          brandSlug: modelData.brandSlug,
          name: modelData.name,
          motorisations: []
        });
      }
      
      groupedModels.get(groupKey).motorisations.push({
        motorisation: modelData.motorisation || 'Unknown',
        fuel: modelData.fuel || 'Unknown',
        startDate: parseDate(modelData.startDate),
        endDate: parseDate(modelData.endDate)
      });
    }
    
    console.log(`📊 Grouped into ${groupedModels.size} unique models`);
    
    // Process each grouped model
    for (const [groupKey, groupData] of groupedModels) {
      try {
        // Find the corresponding battery brand by slug
        const brandId = brandSlugMap[groupData.brandSlug];
        
        if (!brandId) {
          console.log(`⚠️  Brand not found for slug: ${groupData.brandSlug}, skipping model: ${groupData.name}`);
          skippedCount++;
          continue;
        }
        
        // Find the corresponding general model
        const modelKey = `${groupData.brandSlug}-${groupData.name.toLowerCase()}`;
        const generalModelIds = modelLookupMap[modelKey];
        
        if (!generalModelIds || generalModelIds.length === 0) {
          console.log(`⚠️  General model not found for: ${groupData.brandSlug} ${groupData.name}, skipping`);
          skippedCount++;
          continue;
        }
        
        // Use the first matching general model
        const generalModelId = generalModelIds[0];
        
        // Create a simple slug for the model (just brand + model name)
        const modelSlug = slugify(`${groupData.brandSlug}-${groupData.name}`);
        
        // Check if model already exists
        const existingModels = await strapi.entityService.findMany('api::battery-model.battery-model', {
          filters: {
            modelSlug: modelSlug
          }
        });
        
        if (existingModels && existingModels.length > 0) {
          console.log(`⏭️  Skipping existing model: ${groupData.name} (${groupData.motorisations.length} motorisations)`);
          skippedCount++;
          continue;
        }
        
        // Create the battery model with grouped motorisations
        const batteryModel = await strapi.entityService.create('api::battery-model.battery-model', {
          data: {
            name: groupData.name,
            slug: modelSlug,
            modelSlug: modelSlug,
            isActive: true,
            batteryBrand: brandId,
            model: generalModelId,
            motorisations: groupData.motorisations,
            // Keep individual fields for backward compatibility (use first motorisation)
            motorisation: groupData.motorisations[0]?.motorisation || null,
            fuel: groupData.motorisations[0]?.fuel || null,
            startDate: groupData.motorisations[0]?.startDate || null,
            endDate: groupData.motorisations[0]?.endDate || null
          }
        });
        
        console.log(`✅ Created battery model: ${groupData.name} with ${groupData.motorisations.length} motorisations for brand: ${groupData.brandSlug} (ID: ${batteryModel.id})`);
        importedCount++;
        
      } catch (error) {
        console.error(`❌ Error creating battery model "${groupData.name}":`, error.message);
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