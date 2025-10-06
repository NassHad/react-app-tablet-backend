// Get all brands with proper pagination
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

async function getAllBrands() {
  try {
    console.log('🔍 Getting all brands with pagination...');
    
    let allBrands = [];
    let page = 1;
    const pageSize = 25;
    let hasMore = true;
    
    while (hasMore) {
      try {
        console.log(`📄 Fetching page ${page}...`);
        const response = await makeRequest(`/brands?pagination[page]=${page}&pagination[pageSize]=${pageSize}`);
        
        if (response.data && response.data.length > 0) {
          allBrands = allBrands.concat(response.data);
          console.log(`✅ Page ${page}: Found ${response.data.length} brands`);
          
          // Check if there are more pages
          if (response.meta && response.meta.pagination) {
            const { page: currentPage, pageCount, total } = response.meta.pagination;
            console.log(`📊 Page ${currentPage} of ${pageCount} (Total: ${total})`);
            
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
      } catch (pageErr) {
        console.log(`❌ Error fetching page ${page}: ${pageErr.message}`);
        hasMore = false;
      }
    }
    
    console.log(`\n🎉 Total brands retrieved: ${allBrands.length}`);
    
    if (allBrands.length > 0) {
      console.log('\n📋 Sample brands:');
      allBrands.slice(0, 10).forEach((brand, index) => {
        console.log(`  ${index + 1}. ${brand.name} (${brand.slug}) - Published: ${brand.publishedAt ? 'Yes' : 'No'}`);
      });
      
      // Check for common brands
      const brandSlugs = allBrands.map(brand => brand.slug);
      const commonBrands = ['mitsubishi', 'nissan', 'opel', 'peugeot', 'porsche', 'proton', 'renault', 'subaru', 'suzuki', 'toyota', 'volkswagen', 'volvo'];
      
      console.log('\n🔍 Checking for common brand slugs:');
      commonBrands.forEach(brand => {
        const found = brandSlugs.includes(brand);
        console.log(`${found ? '✅' : '❌'} ${brand}: ${found ? 'Found' : 'Missing'}`);
      });
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

getAllBrands();
