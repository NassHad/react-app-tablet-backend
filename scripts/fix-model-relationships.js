// Fix model-brand relationships for existing models
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

async function fixModelRelationships() {
  try {
    console.log('🔧 Fixing model-brand relationships...');
    
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
    
    console.log(`📊 Found ${brandMap.size} brands`);
    
    // Get models that need fixing (without brand relationships)
    const modelsResponse = await makeRequest('/models?pagination[pageSize]=100&filters[brand][$null]=true');
    
    if (!modelsResponse.data || modelsResponse.data.length === 0) {
      console.log('✅ No models need relationship fixing');
      return;
    }
    
    console.log(`🔍 Found ${modelsResponse.data.length} models without brand relationships`);
    
    let fixed = 0;
    let errors = 0;
    
    // Process models in batches
    for (let i = 0; i < modelsResponse.data.length; i += 10) {
      const batch = modelsResponse.data.slice(i, i + 10);
      
      for (const model of batch) {
        try {
          // Try to find the brand by looking at the model name or slug
          // This is a heuristic approach since we don't have the original brand mapping
          let brandId = null;
          
          // Try to find brand by checking if any brand name appears in the model name
          for (const [brandSlug, brandIdValue] of brandMap) {
            const brand = allBrands.find(b => b.slug === brandSlug);
            if (brand && model.name.toLowerCase().includes(brand.name.toLowerCase())) {
              brandId = brandIdValue;
              break;
            }
          }
          
          if (!brandId) {
            console.log(`⚠️  Could not determine brand for model: ${model.name}`);
            errors++;
            continue;
          }
          
          // Update the model with the brand relationship
          const updateData = {
            data: {
              brand: brandId
            }
          };
          
          await makeRequest(`/models/${model.id}`, 'PUT', updateData);
          console.log(`✅ Fixed relationship for model: ${model.name} -> Brand ID: ${brandId}`);
          fixed++;
          
        } catch (err) {
          console.log(`❌ Error fixing model ${model.name}: ${err.message}`);
          errors++;
        }
      }
      
      // Progress indicator
      if ((i + 10) % 100 === 0) {
        console.log(`📊 Progress: ${Math.min(i + 10, modelsResponse.data.length)}/${modelsResponse.data.length} models processed`);
      }
    }
    
    console.log(`\n🎉 Relationship fixing completed!`);
    console.log(`📊 Summary: ${fixed} fixed, ${errors} errors`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

fixModelRelationships();
