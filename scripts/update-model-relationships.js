// Update existing models with brand relationships
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

async function updateModelRelationships() {
  try {
    console.log('🔧 Updating model-brand relationships...');
    
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
    
    // Get models without brand relationships
    const modelsResponse = await makeRequest('/models?pagination[pageSize]=50&filters[brand][$null]=true');
    
    if (!modelsResponse.data || modelsResponse.data.length === 0) {
      console.log('✅ No models need relationship updates');
      return;
    }
    
    console.log(`🔍 Found ${modelsResponse.data.length} models without brand relationships`);
    
    let updated = 0;
    let errors = 0;
    
    // Process models in batches
    for (let i = 0; i < modelsResponse.data.length; i += 10) {
      const batch = modelsResponse.data.slice(i, i + 10);
      
      for (const model of batch) {
        try {
          // Try to find the brand by looking at the model name or slug
          let brandId = null;
          let brandName = '';
          
          // Try to find brand by checking if any brand name appears in the model name
          for (const [brandSlug, brandIdValue] of brandMap) {
            const brand = allBrands.find(b => b.slug === brandSlug);
            if (brand) {
              // Check if brand name appears in model name (case insensitive)
              if (model.name.toLowerCase().includes(brand.name.toLowerCase())) {
                brandId = brandIdValue;
                brandName = brand.name;
                break;
              }
            }
          }
          
          if (!brandId) {
            console.log(`⚠️  Could not determine brand for model: ${model.name}`);
            errors++;
            continue;
          }
          
          // Try different update formats
          const updateFormats = [
            { brand: brandId },
            { brand: { connect: [brandId] } },
            { brand: { set: [brandId] } }
          ];
          
          let updateSuccess = false;
          for (const format of updateFormats) {
            try {
              const updateData = {
                data: format
              };
              
              await makeRequest(`/models/${model.id}`, 'PUT', updateData);
              console.log(`✅ Updated model: ${model.name} -> ${brandName} (ID: ${brandId})`);
              updateSuccess = true;
              break;
            } catch (err) {
              // Try next format
              continue;
            }
          }
          
          if (updateSuccess) {
            updated++;
          } else {
            console.log(`❌ Failed to update model: ${model.name}`);
            errors++;
          }
          
        } catch (err) {
          console.log(`❌ Error updating model ${model.name}: ${err.message}`);
          errors++;
        }
      }
      
      // Progress indicator
      if ((i + 10) % 100 === 0) {
        console.log(`📊 Progress: ${Math.min(i + 10, modelsResponse.data.length)}/${modelsResponse.data.length} models processed`);
      }
    }
    
    console.log(`\n🎉 Relationship update completed!`);
    console.log(`📊 Summary: ${updated} updated, ${errors} errors`);
    
    // Verify some relationships
    console.log('\n🔍 Verifying relationships...');
    const verifyResponse = await makeRequest('/models?pagination[pageSize]=5&populate=*');
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

updateModelRelationships();
