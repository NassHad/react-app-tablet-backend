// Fix relationships using original data structure
const fs = require("fs");
const path = require("path");
const http = require("http");

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';

function makeRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${STRAPI_URL}/api${endpoint}`);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${parsedData.message || responseData}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function fixRelationshipsWithOriginalData() {
  try {
    console.log('🔧 Fixing relationships using original data...');
    
    // Read original models data
    const modelsPath = path.join(process.cwd(), "scripts", "json_data", "cleaned_models.json");
    if (!fs.existsSync(modelsPath)) {
      console.error(`❌ Models file not found: ${modelsPath}`);
      return;
    }
    
    const originalModelsData = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
    console.log(`📊 Found ${originalModelsData.length} models in original data`);
    
    // Get all brands
    let allBrands = [];
    let page = 1;
    const pageSize = 25;
    let hasMore = true;
    
    while (hasMore) {
      const response = await makeRequest(`/brands?pagination[page]=${page}&pagination[pageSize]=${pageSize}`);
      
      if (response.data && response.data.length > 0) {
        allBrands = allBrands.concat(response.data);
        
        if (response.meta && response.meta.pagination) {
          const { page: currentPage, pageCount } = response.meta.pagination;
          if (currentPage >= pageCount) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
        
        page++;
      } else {
        hasMore = false;
      }
    }
    
    // Create brand map
    const brandMap = new Map();
    for (const brand of allBrands) {
      brandMap.set(brand.slug, brand.id);
    }
    
    console.log(`📊 Found ${brandMap.size} brands for mapping`);
    
    // Get all existing models
    let allModels = [];
    page = 1;
    hasMore = true;
    
    while (hasMore) {
      const response = await makeRequest(`/models?pagination[page]=${page}&pagination[pageSize]=${pageSize}`);
      
      if (response.data && response.data.length > 0) {
        allModels = allModels.concat(response.data);
        
        if (response.meta && response.meta.pagination) {
          const { page: currentPage, pageCount } = response.meta.pagination;
          if (currentPage >= pageCount) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
        
        page++;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📊 Found ${allModels.length} existing models`);
    
    // Create a map of existing models by slug
    const modelMap = new Map();
    for (const model of allModels) {
      modelMap.set(model.slug, model);
    }
    
    let updated = 0;
    let errors = 0;
    let skipped = 0;
    
    // Process original data to update relationships
    for (let i = 0; i < originalModelsData.length; i++) {
      const originalModel = originalModelsData[i];
      
      try {
        // Find the existing model by slug
        const existingModel = modelMap.get(originalModel.modelSlug);
        if (!existingModel) {
          console.log(`⚠️  Model not found: ${originalModel.modelSlug}`);
          skipped++;
          continue;
        }
        
        // Skip if already has a brand relationship
        if (existingModel.brand) {
          skipped++;
          continue;
        }
        
        // Find the brand by slug
        const brandId = brandMap.get(originalModel.brandSlug);
        if (!brandId) {
          console.log(`⚠️  Brand not found for slug "${originalModel.brandSlug}", model: ${originalModel.name}`);
          errors++;
          continue;
        }
        
        // Update the model with the brand relationship
        const updateData = {
          data: {
            brand: brandId
          }
        };
        
        await makeRequest(`/models/${existingModel.id}`, 'PUT', updateData);
        console.log(`✅ Updated: ${originalModel.name} -> ${originalModel.brandSlug} (Brand ID: ${brandId})`);
        updated++;
        
        // Progress indicator
        if ((i + 1) % 100 === 0) {
          console.log(`📊 Progress: ${i + 1}/${originalModelsData.length} models processed`);
        }
        
      } catch (err) {
        console.log(`❌ Error updating model "${originalModel.name}": ${err.message}`);
        errors++;
      }
    }
    
    console.log(`\n🎉 Relationship fixing completed!`);
    console.log(`📊 Summary: ${updated} updated, ${skipped} skipped, ${errors} errors`);
    
    // Verify relationships
    console.log('\n🔍 Verifying relationships...');
    const verifyResponse = await makeRequest('/models?pagination[pageSize]=10&populate=*');
    if (verifyResponse.data && verifyResponse.data.length > 0) {
      console.log('Sample models with relationships:');
      verifyResponse.data.forEach((model, index) => {
        console.log(`${index + 1}. ${model.name} -> Brand: ${model.brand ? model.brand.name : 'None'}`);
      });
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

fixRelationshipsWithOriginalData();
