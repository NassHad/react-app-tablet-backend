// Test different relationship formats
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

async function testRelationshipFormats() {
  try {
    console.log('🧪 Testing different relationship formats...');
    
    // Get a brand ID
    const brandsResponse = await makeRequest('/brands?pagination[limit]=1');
    if (!brandsResponse.data || brandsResponse.data.length === 0) {
      console.log('❌ No brands found');
      return;
    }
    
    const brandId = brandsResponse.data[0].id;
    console.log(`📊 Using brand ID: ${brandId} (${brandsResponse.data[0].name})`);
    
    // Test different formats
    const testFormats = [
      { name: 'Direct ID', data: { brand: brandId } },
      { name: 'Connect array', data: { brand: { connect: [brandId] } } },
      { name: 'Connect single', data: { brand: { connect: brandId } } },
      { name: 'Set array', data: { brand: { set: [brandId] } } },
      { name: 'Set single', data: { brand: { set: brandId } } }
    ];
    
    for (const format of testFormats) {
      try {
        console.log(`\n🧪 Testing format: ${format.name}`);
        
        const testData = {
          data: {
            slug: `test-model-${Date.now()}`,
            name: `Test Model ${format.name}`,
            isActive: true,
            ...format.data
          }
        };
        
        const result = await makeRequest('/models', 'POST', testData);
        
        if (result.data) {
          console.log(`✅ ${format.name} - Model created with ID: ${result.data.id}`);
          
          // Check if relationship was set
          const checkResponse = await makeRequest(`/models/${result.data.id}?populate=*`);
          if (checkResponse.data) {
            console.log(`   Brand relationship: ${checkResponse.data.brand ? 'Set' : 'Not set'}`);
            if (checkResponse.data.brand) {
              console.log(`   Brand details: ${checkResponse.data.brand.name} (ID: ${checkResponse.data.brand.id})`);
            }
          }
          
          // Clean up - delete the test model
          await makeRequest(`/models/${result.data.id}`, 'DELETE');
          console.log(`   🗑️  Test model deleted`);
        }
        
      } catch (err) {
        console.log(`❌ ${format.name} - Error: ${err.message}`);
      }
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testRelationshipFormats();
