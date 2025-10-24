const http = require('http');

// Check specific WiperData records for VS35 and VS35+
function checkSpecificRefs() {
  console.log('🔍 Checking specific WiperData records for VS35 and VS35+...\n');

  // Test 1: Get VS35 record
  console.log('1️⃣ Testing: VS35 record');
  testAPI('/api/wipers-data?filters[ref][$eq]=VS35&populate=*', 'VS35 exact match');

  // Test 2: Get VS35+ record
  console.log('\n2️⃣ Testing: VS35+ record');
  testAPI('/api/wipers-data?filters[ref][$eq]=VS35%2B&populate=*', 'VS35+ exact match (URL encoded)');

  // Test 3: Get both with contains
  console.log('\n3️⃣ Testing: Both with contains');
  testAPI('/api/wipers-data?filters[ref][$contains]=VS35&populate=*', 'Contains VS35');

  // Test 4: Check the specific record with ID 77
  console.log('\n4️⃣ Testing: Record with ID 77');
  testAPI('/api/wipers-data/77?populate=*', 'Record ID 77');
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
      console.log(`   ${description}:`);
      console.log(`     Status: ${res.statusCode}`);
      
      if (res.statusCode === 200) {
        try {
          const response = JSON.parse(data);
          
          if (response.data) {
            // Handle single record response
            if (response.data.ref) {
              console.log(`     Found: ID=${response.data.id}, Ref="${response.data.ref}", genCode=${response.data.genCode}`);
            } 
            // Handle array response
            else if (Array.isArray(response.data)) {
              console.log(`     Count: ${response.data.length}`);
              response.data.forEach(item => {
                console.log(`     - ID=${item.id}, Ref="${item.ref}", genCode=${item.genCode}`);
              });
            }
          }
        } catch (error) {
          console.log(`     Error parsing response: ${error.message}`);
        }
      } else {
        console.log(`     Error: ${res.statusCode}`);
        if (data.length > 0) {
          console.log(`     Response: ${data.substring(0, 200)}...`);
        }
      }
    });
  });

  req.on('error', (error) => {
    console.log(`     Request error: ${error.message}`);
  });

  req.end();
}

checkSpecificRefs();
