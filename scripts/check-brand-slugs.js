// Check what brand slugs are in the database vs what models expect
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

async function checkBrandSlugs() {
  try {
    console.log('🔍 Checking brand slugs in database...');
    
    // Get all brands
    const allBrands = await makeRequest('/brands?pagination[limit]=-1');
    
    if (allBrands.data) {
      console.log(`\n📊 Found ${allBrands.data.length} brands in database:`);
      
      const brandSlugs = allBrands.data.map(brand => brand.slug).sort();
      console.log('\n📋 Brand slugs in database:');
      brandSlugs.forEach((slug, index) => {
        console.log(`${index + 1}. ${slug}`);
      });
      
      // Check for some common brands that models might be looking for
      const commonBrands = ['mitsubishi', 'nissan', 'opel', 'peugeot', 'porsche', 'proton', 'renault', 'subaru', 'suzuki', 'toyota', 'volkswagen', 'volvo'];
      
      console.log('\n🔍 Checking for common brand slugs:');
      commonBrands.forEach(brand => {
        const found = brandSlugs.includes(brand);
        console.log(`${found ? '✅' : '❌'} ${brand}: ${found ? 'Found' : 'Missing'}`);
      });
      
      // Show some examples of what's actually in the database
      console.log('\n📋 Sample brands from database:');
      allBrands.data.slice(0, 10).forEach((brand, index) => {
        console.log(`${index + 1}. Name: ${brand.name}, Slug: ${brand.slug}`);
      });
      
    } else {
      console.log('❌ No brands found in response');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkBrandSlugs();
