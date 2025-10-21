const http = require('http');

// Helper function to make HTTP requests
function makeRequest(path) {
  return new Promise((resolve, reject) => {
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
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => reject(error));
    req.end();
  });
}

// Test different API queries
async function testWiperDataAPI() {
  console.log('🧪 Testing WiperData API queries...\n');

  try {
    // Test 1: Get all WiperData
    console.log('1️⃣ Getting all WiperData:');
    const allData = await makeRequest('/api/wipers-data');
    console.log(`   Status: ${allData.status}`);
    console.log(`   Count: ${allData.data.data ? allData.data.data.length : 'No data'}`);
    console.log('');

    // Test 2: Get by specific ref
    console.log('2️⃣ Getting WiperData by ref "VS35":');
    const byRef = await makeRequest('/api/wipers-data?filters[ref][$eq]=VS35');
    console.log(`   Status: ${byRef.status}`);
    if (byRef.data && byRef.data.data && byRef.data.data.length > 0) {
      const item = byRef.data.data[0];
      console.log(`   Found: ${item.ref || 'N/A'} - ${item.description || 'N/A'}`);
    } else {
      console.log('   No data found');
    }
    console.log('');

    // Test 3: Get by ref containing "VS"
    console.log('3️⃣ Getting WiperData with ref containing "VS":');
    const byContains = await makeRequest('/api/wipers-data?filters[ref][$contains]=VS');
    console.log(`   Status: ${byContains.status}`);
    console.log(`   Count: ${byContains.data.data ? byContains.data.data.length : 'No data'}`);
    if (byContains.data.data && byContains.data.data.length > 0) {
      console.log('   Sample results:');
      byContains.data.data.slice(0, 3).forEach(item => {
        console.log(`     - ${item.ref}: ${item.description}`);
      });
    }
    console.log('');

    // Test 4: Get by brand
    console.log('4️⃣ Getting WiperData by brand "VALEO":');
    const byBrand = await makeRequest('/api/wipers-data?filters[brand][$eq]=VALEO');
    console.log(`   Status: ${byBrand.status}`);
    console.log(`   Count: ${byBrand.data.data ? byBrand.data.data.length : 'No data'}`);
    console.log('');

    // Test 5: Get by category
    console.log('5️⃣ Getting WiperData by category "PLATS":');
    const byCategory = await makeRequest('/api/wipers-data?filters[category][$eq]=PLATS');
    console.log(`   Status: ${byCategory.status}`);
    console.log(`   Count: ${byCategory.data.data ? byCategory.data.data.length : 'No data'}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testWiperDataAPI();
}

module.exports = { makeRequest, testWiperDataAPI };
