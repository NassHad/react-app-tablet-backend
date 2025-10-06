// Simple script to check what brands are in the database
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
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        } catch (err) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.end();
  });
}

async function checkBrands() {
  try {
    console.log('🔍 Checking brands in database...');
    console.log(`Using URL: ${STRAPI_URL}`);
    
    // Try different endpoints
    const endpoints = [
      '/brands?pagination[limit]=10',
      '/brands',
      '/api/brands',
      '/brands?populate=*'
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`\n🔍 Trying endpoint: ${endpoint}`);
        const response = await makeRequest(endpoint);
        
        console.log('\n📊 Raw API Response:');
        console.log(JSON.stringify(response, null, 2));
        
        if (response.data && response.data.length > 0) {
          console.log(`\n📋 Found ${response.data.length} brands (showing first 10):`);
          response.data.forEach((brand, index) => {
            console.log(`${index + 1}. ID: ${brand.id}`);
            console.log(`   Name: ${brand.attributes?.name || brand.name || 'N/A'}`);
            console.log(`   Slug: ${brand.attributes?.slug || brand.slug || 'N/A'}`);
            console.log(`   Active: ${brand.attributes?.isActive || brand.isActive || 'N/A'}`);
            console.log('   ---');
          });
          return; // Success, exit the function
        } else {
          console.log('❌ No brands found in response');
        }
      } catch (endpointErr) {
        console.log(`❌ Endpoint ${endpoint} failed:`, endpointErr.message);
      }
    }
    
    console.log('\n❌ All endpoints failed');
    
  } catch (err) {
    console.error('❌ General Error:', err.message);
    console.error('❌ Error details:', err);
  }
}

checkBrands();
