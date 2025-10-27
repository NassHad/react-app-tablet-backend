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

// Generate unique slug from model name and brand
function generateSlug(modelName, brandName = '') {
  let baseSlug = modelName.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  // If we have a brand name, prepend it to make the slug unique
  if (brandName) {
    const brandSlug = brandName.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    baseSlug = `${brandSlug}-${baseSlug}`;
  }
  
  return baseSlug;
}

// Find all models with null slugs
async function findModelsWithNullSlugs() {
  console.log('🔍 Finding models with null slugs...');
  
  const modelsWithNullSlugs = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const response = await strapiRequest(`/models?pagination[page]=${page}&pagination[pageSize]=${pageSize}&populate=brand`);
      const models = response.data;
      
      if (!models || models.length === 0) {
        hasMore = false;
        break;
      }
      
      // Filter models with null slugs
      const nullSlugModels = models.filter(model => model.slug === null);
      modelsWithNullSlugs.push(...nullSlugModels);
      
      console.log(`   📄 Page ${page}: Found ${nullSlugModels.length} models with null slugs out of ${models.length} total`);
      
      // Check if we have more pages
      if (models.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
      
    } catch (error) {
      console.error(`❌ Failed to fetch models page ${page}:`, error.message);
      throw error;
    }
  }
  
  console.log(`✅ Found ${modelsWithNullSlugs.length} total models with null slugs`);
  return modelsWithNullSlugs;
}

// Update model slug
async function updateModelSlug(modelDocumentId, modelName, newSlug) {
  console.log(`🔄 Updating model "${modelName}" (DocumentID: ${modelDocumentId}) with slug: "${newSlug}"`);
  
  const modelData = {
    slug: newSlug
  };
  
  return await strapiRequest(`/models/${modelDocumentId}`, 'PUT', modelData);
}

// Main function to update all null slugs
async function updateNullSlugs() {
  console.log('🎯 Updating Models with Null Slugs');
  console.log('=' .repeat(50));
  
  try {
    // Find all models with null slugs
    const modelsWithNullSlugs = await findModelsWithNullSlugs();
    
    if (modelsWithNullSlugs.length === 0) {
      console.log('✅ No models found with null slugs!');
      return;
    }
    
    console.log(`\n🚀 Starting slug updates for ${modelsWithNullSlugs.length} models...`);
    console.log('=' .repeat(50));
    
    const stats = {
      total: modelsWithNullSlugs.length,
      updated: 0,
      errors: 0,
      errorDetails: []
    };
    
    // Update each model
    for (let i = 0; i < modelsWithNullSlugs.length; i++) {
      const model = modelsWithNullSlugs[i];
      const progress = `[${i + 1}/${modelsWithNullSlugs.length}]`;
      
      try {
        // Get brand name from the populated brand relation
        const brandName = model.brand?.name || model.brand?.attributes?.name || '';
        const newSlug = generateSlug(model.name, brandName);
        const updatedModel = await updateModelSlug(model.documentId, model.name, newSlug);
        
        stats.updated++;
        console.log(`${progress} ✅ Updated: "${model.name}" (${brandName}) → slug: "${newSlug}"`);
        
        // Add small delay to avoid overwhelming the API
        if (i % 10 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`${progress} ❌ Failed to update "${model.name}":`, error.message);
        stats.errors++;
        stats.errorDetails.push({
          modelId: model.documentId,
          modelName: model.name,
          error: error.message
        });
      }
    }
    
    // Generate summary report
    console.log('\n🎉 SLUG UPDATE COMPLETE!');
    console.log('=' .repeat(50));
    console.log(`📊 Summary Statistics:`);
    console.log(`   📋 Total processed: ${stats.total}`);
    console.log(`   ✅ Successfully updated: ${stats.updated}`);
    console.log(`   ❌ Errors: ${stats.errors}`);
    
    if (stats.errors > 0) {
      console.log('\n❌ Error Details:');
      stats.errorDetails.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.modelName} (ID: ${error.modelId}) - ${error.error}`);
      });
      if (stats.errorDetails.length > 10) {
        console.log(`   ... and ${stats.errorDetails.length - 10} more errors`);
      }
    }
    
    // Calculate success rate
    const successRate = (stats.updated / stats.total * 100).toFixed(2);
    console.log(`\n📈 Success Rate: ${successRate}%`);
    
    return stats;
    
  } catch (error) {
    console.error('\n💥 Slug update failed:', error.message);
    throw error;
  }
}

// Run the update if this script is executed directly
if (require.main === module) {
  updateNullSlugs()
    .then((stats) => {
      console.log('\n🎉 Slug update script finished!');
      process.exit(stats?.errors > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('💥 Slug update failed:', error);
      process.exit(1);
    });
}

module.exports = { 
  updateNullSlugs,
  generateSlug,
  findModelsWithNullSlugs,
  updateModelSlug
};
