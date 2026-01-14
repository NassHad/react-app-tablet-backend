const fs = require('fs');
const path = require('path');

/**
 * Import Missing Models from Comparison Report
 * 
 * This script reads model-comparison-report.json and imports only the 342 missing models
 * identified in the comparison, using their already-cleaned names.
 */

const REPORT_PATH = path.join(__dirname, 'model-comparison-report.json');
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Helper function to make API calls to Strapi
async function strapiRequest(endpoint, method = 'GET', data = null) {
  const url = `${STRAPI_URL}/api${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(API_TOKEN && { 'Authorization': `Bearer ${API_TOKEN}` })
    }
  };

  if (data) {
    options.body = JSON.stringify({ data });
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error.message);
    throw error;
  }
}

// Load all brands from Strapi with pagination support
async function loadBrandMap() {
  console.log('📥 Loading all brands from Strapi...');
  
  const brandMap = new Map();
  let page = 1;
  const pageSize = 100;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const response = await strapiRequest(`/brands?pagination[page]=${page}&pagination[pageSize]=${pageSize}`);
      const brands = response.data;
      
      if (!brands || brands.length === 0) {
        hasMore = false;
        break;
      }
      
      brands.forEach(brand => {
        const name = brand.attributes?.name || brand.name;
        const id = brand.id;
        brandMap.set(name, id);
      });
      
      console.log(`   📄 Page ${page}: Loaded ${brands.length} brands`);
      
      // Check if we have more pages
      if (brands.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
      
    } catch (error) {
      console.error(`❌ Failed to load brands page ${page}:`, error.message);
      throw error;
    }
  }
  
  console.log(`✅ Loaded ${brandMap.size} total brands`);
  return brandMap;
}


// Check if model already exists and get its details
async function checkModelExists(brandId, modelName) {
  try {
    const response = await strapiRequest(
      `/models?filters[name][$eq]=${encodeURIComponent(modelName)}&populate=brand`
    );
    
    if (response.data && response.data.length > 0) {
      const model = response.data[0];
      const hasBrand = model.attributes?.brand?.data?.id || model.brand?.id;
      
      return {
        exists: true,
        modelId: model.id,
        hasBrand: !!hasBrand,
        currentBrandId: hasBrand
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.error(`❌ Error checking model existence for "${modelName}":`, error.message);
    return { exists: false };
  }
}

// Update an existing model's brand relation
async function updateModelBrand(modelId, brandId, modelName) {
  console.log(`🔄 Updating model "${modelName}" (ID: ${modelId}) with brand ID: ${brandId}`);
  
  const modelData = {
    brand: brandId
  };
  
  console.log(`📤 Sending update data:`, JSON.stringify(modelData, null, 2));
  
  return await strapiRequest(`/models/${modelId}`, 'PUT', modelData);
}

// Create a new model
async function createModel(brandId, modelName) {
  console.log(`🔍 Creating model "${modelName}" with brand ID: ${brandId}`);
  
  const modelData = {
    name: modelName,
    brand: brandId,
    isActive: true
  };
  
  console.log(`📤 Sending data:`, JSON.stringify(modelData, null, 2));
  
  return await strapiRequest('/models', 'POST', modelData);
}

// Import missing models from the comparison report
async function importMissingModelsFromReport() {
  console.log('📊 Reading comparison report...');
  
  // Read the comparison report
  if (!fs.existsSync(REPORT_PATH)) {
    throw new Error(`Comparison report not found: ${REPORT_PATH}`);
  }
  
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  console.log(`✅ Report loaded: ${report.summary.missingModels} missing models across ${Object.keys(report.brandStats).length} brands`);
  
  // Load all brands from Strapi
  const brandMap = await loadBrandMap();
  
  // Extract all missing models
  const missingModels = [];
  
  for (const [brandName, brandData] of Object.entries(report.brandStats)) {
    // Skip the header row brand
    if (brandName === 'Marque') {
      continue;
    }
    
    if (brandData.missingModels && brandData.missingModels.length > 0) {
      for (const missingModel of brandData.missingModels) {
        missingModels.push({
          brand: brandName,
          model: missingModel.name,
          original: missingModel.original
        });
      }
    }
  }
  
  console.log(`📋 Found ${missingModels.length} missing models to process`);
  
  // Import statistics
  const stats = {
    total: missingModels.length,
    imported: 0,
    updated: 0,
    alreadyExists: 0,
    brandNotFound: 0,
    errors: 0,
    errorDetails: []
  };
  
  console.log('\n🚀 Starting model import...');
  console.log('=' .repeat(60));
  
  // Process each missing model
  for (let i = 0; i < missingModels.length; i++) {
    const { brand, model, original } = missingModels[i];
    const progress = `[${i + 1}/${missingModels.length}]`;
    
    try {
      // Find brand ID
      const brandId = brandMap.get(brand);
      if (!brandId) {
        console.log(`${progress} ⚠️  Brand "${brand}" not found, skipping model "${model}"`);
        console.log(`🔍 Available brands:`, Array.from(brandMap.keys()).slice(0, 10).join(', '), '...');
        stats.brandNotFound++;
        continue;
      }
      
      console.log(`${progress} 🔍 Found brand "${brand}" with ID: ${brandId}`);
      
      // Check if model already exists and get its details
      const modelCheck = await checkModelExists(brandId, model);
      
      if (modelCheck.exists) {
        if (modelCheck.hasBrand) {
          console.log(`${progress} ✅ Model "${model}" already exists with brand relation`);
          stats.alreadyExists++;
          continue;
        } else {
          // Model exists but has no brand relation - update it
          console.log(`${progress} 🔄 Model "${model}" exists but missing brand relation - updating...`);
          const updatedModel = await updateModelBrand(modelCheck.modelId, brandId, model);
          stats.updated++;
          
          console.log(`📥 Update response:`, JSON.stringify(updatedModel, null, 2));
          console.log(`${progress} ✅ Updated: "${model}" (ID: ${modelCheck.modelId}) with brand relation`);
        }
      } else {
        // Model doesn't exist - create it
        const newModel = await createModel(brandId, model);
        stats.imported++;
        
        console.log(`📥 Response:`, JSON.stringify(newModel, null, 2));
        
        if (original !== model) {
          console.log(`${progress} ✅ Created: "${original}" → "${model}" (ID: ${newModel.data.id})`);
        } else {
          console.log(`${progress} ✅ Created: "${model}" (ID: ${newModel.data.id})`);
        }
      }
      
    } catch (error) {
      console.error(`${progress} ❌ Failed to create model "${model}" for brand "${brand}":`, error.message);
      stats.errors++;
      stats.errorDetails.push({
        brand,
        model,
        original,
        error: error.message
      });
    }
    
    // Add small delay to avoid overwhelming the API
    if (i % 10 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return stats;
}

// Generate final summary report
function generateSummaryReport(stats) {
  console.log('\n🎉 IMPORT COMPLETE!');
  console.log('=' .repeat(60));
  console.log(`📊 Summary Statistics:`);
  console.log(`   📋 Total processed: ${stats.total}`);
  console.log(`   ✅ Successfully imported: ${stats.imported}`);
  console.log(`   🔄 Updated existing: ${stats.updated}`);
  console.log(`   ✅ Already existed: ${stats.alreadyExists}`);
  console.log(`   ⚠️  Brand not found: ${stats.brandNotFound}`);
  console.log(`   ❌ Errors: ${stats.errors}`);
  
  if (stats.errors > 0) {
    console.log('\n❌ Error Details:');
    stats.errorDetails.slice(0, 10).forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.brand}: ${error.model} - ${error.error}`);
    });
    if (stats.errorDetails.length > 10) {
      console.log(`   ... and ${stats.errorDetails.length - 10} more errors`);
    }
  }
  
  // Calculate success rate
  const successRate = ((stats.imported + stats.updated + stats.alreadyExists) / stats.total * 100).toFixed(2);
  console.log(`\n📈 Success Rate: ${successRate}%`);
  
  if (stats.imported > 0 || stats.updated > 0) {
    console.log('\n🚀 Ready to resume filter compatibility import!');
  }
}

// Main execution function
async function runImport() {
  console.log('🎯 Import Missing Models from Comparison Report');
  console.log('=' .repeat(60));
  
  try {
    const stats = await importMissingModelsFromReport();
    generateSummaryReport(stats);
    
    return stats;
  } catch (error) {
    console.error('\n💥 Import failed:', error.message);
    throw error;
  }
}

// Run the import if this script is executed directly
if (require.main === module) {
  runImport()
    .then((stats) => {
      console.log('\n🎉 Missing models import script finished!');
      process.exit(stats.errors > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('💥 Missing models import failed:', error);
      process.exit(1);
    });
}

module.exports = { 
  runImport,
  loadBrandMap,
  checkModelExists,
  updateModelBrand,
  createModel
};
