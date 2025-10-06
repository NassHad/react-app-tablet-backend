// Debug script to check what brands are in the database
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

async function debugBrands() {
  try {
    console.log('🔍 Checking brands in database...');
    
    const response = await makeRequest('/brands?pagination[limit]=-1');
    
    console.log('📊 API Response structure:');
    console.log(JSON.stringify(response, null, 2));
    
    if (response.data) {
      console.log(`\n📋 Found ${response.data.length} brands:`);
      response.data.forEach((brand, index) => {
        console.log(`${index + 1}. ID: ${brand.id}, Slug: ${brand.attributes?.slug || brand.slug}, Name: ${brand.attributes?.name || brand.name}`);
      });
      
      // Check for specific brands that are failing
      const failingBrands = ['mazda', 'mercedes', 'nissan', 'opel', 'peugeot', 'renault', 'volkswagen', 'toyota'];
      console.log('\n🔍 Checking for failing brands:');
      failingBrands.forEach(brandSlug => {
        const found = response.data.find(brand => 
          (brand.attributes?.slug || brand.slug) === brandSlug
        );
        console.log(`${brandSlug}: ${found ? '✅ Found' : '❌ Not found'}`);
      });
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

debugBrands();
