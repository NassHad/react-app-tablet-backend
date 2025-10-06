// Debug script to check database state
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

async function debugDatabase() {
  try {
    console.log('🔍 Debugging database state...');
    
    // Try different endpoints
    const endpoints = [
      '/brands?pagination[limit]=-1',
      '/brands?pagination[limit]=-1&publicationState=preview',
      '/brands?pagination[limit]=-1&publicationState=live',
      '/brands?pagination[limit]=-1&filters[isActive][$eq]=true',
      '/brands?pagination[limit]=-1&filters[isActive][$eq]=false',
      '/brands?pagination[limit]=-1&populate=*'
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`\n🔍 Trying endpoint: ${endpoint}`);
        const response = await makeRequest(endpoint);
        
        if (response.data && response.data.length > 0) {
          console.log(`✅ Found ${response.data.length} brands`);
          console.log('Sample brands:');
          response.data.slice(0, 5).forEach((brand, index) => {
            console.log(`  ${index + 1}. ${brand.name} (${brand.slug}) - Published: ${brand.publishedAt ? 'Yes' : 'No'}`);
          });
        } else {
          console.log('❌ No brands found');
        }
      } catch (endpointErr) {
        console.log(`❌ Endpoint failed: ${endpointErr.message}`);
      }
    }
    
    // Try to get total count
    try {
      console.log('\n🔍 Getting total count...');
      const countResponse = await makeRequest('/brands?pagination[limit]=1');
      if (countResponse.meta && countResponse.meta.pagination) {
        console.log(`📊 Total brands in database: ${countResponse.meta.pagination.total}`);
      }
    } catch (countErr) {
      console.log(`❌ Count query failed: ${countErr.message}`);
    }
    
  } catch (err) {
    console.error('❌ General Error:', err.message);
  }
}

debugDatabase();
