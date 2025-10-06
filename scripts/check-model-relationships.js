// Check if model-brand relationships are working
const http = require("http");

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';

function makeRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${STRAPI_URL}/api${endpoint}`);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
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
    
    req.end();
  });
}

async function checkModelRelationships() {
  try {
    console.log('🔍 Checking model-brand relationships...');
    
    // Get some models with their brand relationships
    const response = await makeRequest('/models?pagination[pageSize]=10&populate=*');
    
    if (response.data && response.data.length > 0) {
      console.log(`📊 Found ${response.data.length} models (showing first 10):`);
      
      response.data.forEach((model, index) => {
        console.log(`\n${index + 1}. Model: ${model.name} (${model.slug})`);
        console.log(`   ID: ${model.id}`);
        console.log(`   Brand relationship:`, model.brand);
        
        if (model.brand) {
          if (typeof model.brand === 'object') {
            console.log(`   ✅ Brand linked: ${model.brand.name} (ID: ${model.brand.id})`);
          } else {
            console.log(`   ⚠️  Brand ID only: ${model.brand}`);
          }
        } else {
          console.log(`   ❌ No brand relationship found`);
        }
      });
      
      // Check total count
      const countResponse = await makeRequest('/models?pagination[limit]=1');
      if (countResponse.meta && countResponse.meta.pagination) {
        console.log(`\n📊 Total models in database: ${countResponse.meta.pagination.total}`);
      }
      
      // Check a specific model that should have a brand
      console.log('\n🔍 Checking specific model relationships...');
      const specificModels = ['golf-vi', 'audi-a4', 'bmw-3-series', 'mercedes-c-class'];
      
      for (const modelSlug of specificModels) {
        try {
          const modelResponse = await makeRequest(`/models?filters[slug][$eq]=${modelSlug}&populate=*`);
          if (modelResponse.data && modelResponse.data.length > 0) {
            const model = modelResponse.data[0];
            console.log(`\n🔍 Model: ${model.name} (${model.slug})`);
            console.log(`   Brand:`, model.brand);
          } else {
            console.log(`❌ Model not found: ${modelSlug}`);
          }
        } catch (err) {
          console.log(`❌ Error checking model ${modelSlug}: ${err.message}`);
        }
      }
      
    } else {
      console.log('❌ No models found in response');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkModelRelationships();
