const http = require('http');

// Debug script to check models API for BMW
function debugModelsAPI() {
  console.log('🔍 Debugging models API for BMW...\n');

  // Test 1: Get all models without filters
  console.log('1️⃣ Testing: Get all models');
  testAPI('/api/models?populate=*', 'All models');

  // Test 2: Get all brands first
  console.log('\n2️⃣ Testing: Get all brands');
  testAPI('/api/brands', 'All brands');

  // Test 3: Check if BMW brand exists
  console.log('\n3️⃣ Testing: Check BMW brand specifically');
  testAPI('/api/brands?filters[slug][$eq]=BMW', 'BMW brand');

  // Test 4: Try different BMW slug variations
  console.log('\n4️⃣ Testing: Different BMW slug variations');
  testAPI('/api/brands?filters[slug][$eq]=bmw', 'BMW (lowercase)');
  testAPI('/api/brands?filters[slug][$contains]=BMW', 'BMW (contains)');
  testAPI('/api/brands?filters[name][$contains]=BMW', 'BMW (name contains)');

  // Test 5: Try models with different filter structures
  console.log('\n5️⃣ Testing: Models with different filter structures');
  testAPI('/api/models?filters[brand][slug][$eq]=BMW', 'Models with brand slug filter');
  testAPI('/api/models?filters[brand][name][$eq]=BMW', 'Models with brand name filter');
  testAPI('/api/models?filters[brand][name][$contains]=BMW', 'Models with brand name contains');
}

function testAPI(path, description) {
  const options = {
    hostname: 'localhost',
    port: 1338,
    path: path,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        
        console.log(`   ${description}:`);
        console.log(`     Status: ${res.statusCode}`);
        console.log(`     Count: ${response.data?.length || 0}`);
        
        if (response.data && response.data.length > 0) {
          // Show first few items
          const itemsToShow = Math.min(3, response.data.length);
          for (let i = 0; i < itemsToShow; i++) {
            const item = response.data[i];
            if (item.slug) {
              console.log(`     - "${item.slug}" (${item.name || 'No name'})`);
            } else if (item.name) {
              console.log(`     - "${item.name}"`);
            }
          }
          if (response.data.length > 3) {
            console.log(`     ... and ${response.data.length - 3} more`);
          }
        } else {
          console.log(`     No data found`);
        }
        
      } catch (error) {
        console.log(`     Error parsing response: ${error.message}`);
      }
    });
  });

  req.on('error', (error) => {
    console.log(`     Request error: ${error.message}`);
  });

  req.end();
}

debugModelsAPI();
