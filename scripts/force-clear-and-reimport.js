// Force clear all models and re-import with correct relationships
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

async function forceClearAndReimport() {
  try {
    console.log('🧹 Force clearing all models and re-importing...');
    
    // Step 1: Get all existing models with pagination
    console.log('📊 Fetching all existing models...');
    let allModels = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;
    
    while (hasMore) {
      try {
        const response = await makeRequest(`/models?pagination[page]=${page}&pagination[pageSize]=${pageSize}`);
        
        if (response.data && response.data.length > 0) {
          allModels = allModels.concat(response.data);
          console.log(`📊 Fetched page ${page}: ${response.data.length} models (total: ${allModels.length})`);
          
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
      } catch (err) {
        console.log(`⚠️  Error fetching page ${page}: ${err.message}`);
        hasMore = false;
      }
    }
    
    console.log(`📊 Found ${allModels.length} existing models to delete`);
    
    // Step 2: Delete all models in batches
    console.log('🗑️  Deleting all existing models...');
    let deleted = 0;
    let deleteErrors = 0;
    
    // Process in batches of 50
    for (let i = 0; i < allModels.length; i += 50) {
      const batch = allModels.slice(i, i + 50);
      
      // Delete batch in parallel
      const deletePromises = batch.map(async (model) => {
        try {
          await makeRequest(`/models/${model.id}`, 'DELETE');
          return { success: true, model };
        } catch (err) {
          return { success: false, model, error: err.message };
        }
      });
      
      const results = await Promise.all(deletePromises);
      
      for (const result of results) {
        if (result.success) {
          deleted++;
        } else {
          console.log(`⚠️  Could not delete model ${result.model.name}: ${result.error}`);
          deleteErrors++;
        }
      }
      
      console.log(`📊 Deleted batch ${Math.floor(i/50) + 1}: ${deleted} deleted, ${deleteErrors} errors`);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Deletion complete: ${deleted} deleted, ${deleteErrors} errors`);
    
    // Step 3: Wait for database to process deletions
    console.log('⏳ Waiting for database to process deletions...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Verify deletion
    console.log('🔍 Verifying deletion...');
    try {
      const verifyResponse = await makeRequest('/models?pagination[limit]=1');
      if (verifyResponse.data && verifyResponse.data.length > 0) {
        console.log(`⚠️  Still ${verifyResponse.data.length} models remaining, trying again...`);
        // Try one more time with a different approach
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log('✅ All models successfully deleted');
      }
    } catch (err) {
      console.log(`⚠️  Error verifying deletion: ${err.message}`);
    }
    
    // Step 5: Read models data
    const modelsPath = path.join(process.cwd(), "scripts", "json_data", "cleaned_models.json");
    if (!fs.existsSync(modelsPath)) {
      console.error(`❌ Models file not found: ${modelsPath}`);
      return;
    }
    
    const modelsData = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
    console.log(`📊 Found ${modelsData.length} models to import`);
    
    // Step 6: Get all brands
    console.log('📊 Fetching all brands...');
    let allBrands = [];
    page = 1;
    hasMore = true;
    
    while (hasMore) {
      try {
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
      } catch (err) {
        console.log(`⚠️  Error fetching brands page ${page}: ${err.message}`);
        hasMore = false;
      }
    }
    
    // Create brand map
    const brandMap = new Map();
    for (const brand of allBrands) {
      brandMap.set(brand.slug, brand.id);
    }
    
    console.log(`📊 Found ${brandMap.size} brands for mapping`);
    
    // Step 7: Re-import models with correct relationships
    console.log('🔄 Re-importing models with correct relationships...');
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process in batches of 100
    for (let i = 0; i < modelsData.length; i += 100) {
      const batch = modelsData.slice(i, i + 100);
      
      for (const item of batch) {
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
          
        } catch (err) {
          if (err.message.includes('This attribute must be unique')) {
            console.log(`⚠️  Model already exists, skipping: ${item.name}`);
            skipped++;
          } else {
            console.log(`❌ Error creating model "${item.name}": ${err.message}`);
            errors++;
          }
        }
      }
      
      console.log(`📊 Progress: ${Math.min(i + 100, modelsData.length)}/${modelsData.length} models processed (${created} created, ${skipped} skipped, ${errors} errors)`);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n🎉 Re-import completed!`);
    console.log(`📊 Summary: ${created} created, ${skipped} skipped, ${errors} errors`);
    
    // Step 8: Verify relationships
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

forceClearAndReimport();
