// Clear all models and re-import with correct relationships
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

async function clearAndReimportModels() {
  try {
    console.log('🧹 Clearing all models and re-importing with correct relationships...');
    
    // Step 1: Get all existing models
    console.log('📊 Fetching all existing models...');
    let allModels = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;
    
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
    
    console.log(`📊 Found ${allModels.length} existing models to delete`);
    
    // Step 2: Delete all models
    console.log('🗑️  Deleting all existing models...');
    let deleted = 0;
    let deleteErrors = 0;
    
    for (const model of allModels) {
      try {
        await makeRequest(`/models/${model.id}`, 'DELETE');
        deleted++;
        
        if (deleted % 100 === 0) {
          console.log(`📊 Deleted ${deleted}/${allModels.length} models`);
        }
      } catch (err) {
        console.log(`⚠️  Could not delete model ${model.name}: ${err.message}`);
        deleteErrors++;
      }
    }
    
    console.log(`✅ Deleted ${deleted} models, ${deleteErrors} errors`);
    
    // Step 3: Wait a moment for database to process deletions
    console.log('⏳ Waiting for database to process deletions...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Read models data
    const modelsPath = path.join(process.cwd(), "scripts", "json_data", "cleaned_models.json");
    if (!fs.existsSync(modelsPath)) {
      console.error(`❌ Models file not found: ${modelsPath}`);
      return;
    }
    
    const modelsData = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
    console.log(`📊 Found ${modelsData.length} models to import`);
    
    // Step 5: Get all brands
    console.log('📊 Fetching all brands...');
    let allBrands = [];
    page = 1;
    hasMore = true;
    
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
    
    // Step 6: Re-import models with correct relationships
    console.log('🔄 Re-importing models with correct relationships...');
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    for (let i = 0; i < modelsData.length; i++) {
      const item = modelsData[i];
      
      try {
        // Find the brand by slug
        const brandId = brandMap.get(item.brandSlug);
        if (!brandId) {
          console.log(`⚠️  Brand not found for slug "${item.brandSlug}", skipping model: ${item.name}`);
          errors++;
          continue;
        }
        
        // Create model with correct manyToOne relationship
        const data = {
          data: {
            slug: item.modelSlug,
            name: item.name,
            brand: brandId,
            isActive: true
          }
        };
        
        await makeRequest('/models', 'POST', data);
        created++;
        
        if (created % 100 === 0) {
          console.log(`📊 Progress: ${created}/${modelsData.length} models created`);
        }
        
      } catch (err) {
        console.log(`❌ Error creating model "${item.name}": ${err.message}`);
        errors++;
      }
    }
    
    console.log(`\n🎉 Re-import completed!`);
    console.log(`📊 Summary: ${created} created, ${skipped} skipped, ${errors} errors`);
    
    // Step 7: Verify relationships
    console.log('\n🔍 Verifying relationships...');
    const verifyResponse = await makeRequest('/models?pagination[pageSize]=10&populate=*');
    if (verifyResponse.data && verifyResponse.data.length > 0) {
      console.log('Sample models with relationships:');
      verifyResponse.data.forEach((model, index) => {
        console.log(`${index + 1}. ${model.name} -> Brand: ${model.brand ? model.brand.name : 'None'}`);
      });
    }
    
    // Check total counts
    const totalModelsResponse = await makeRequest('/models?pagination[limit]=1');
    if (totalModelsResponse.meta && totalModelsResponse.meta.pagination) {
      console.log(`\n📊 Total models in database: ${totalModelsResponse.meta.pagination.total}`);
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

clearAndReimportModels();
