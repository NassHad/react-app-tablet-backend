const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';

/**
 * Test script for the new find-products endpoint
 */

async function testFindProductsEndpoint() {
  console.log('🧪 Testing find-products endpoint...\n');
  
  const testCases = [
    {
      name: 'ABARTH 500 II - Oil filters',
      params: 'brand=ABARTH&model=500%20II&filterType=oil'
    },
    {
      name: 'CITROEN C4 II - Air filters',
      params: 'brand=CITROEN&model=C4%20II&filterType=air'
    },
    {
      name: 'ABARTH 500 II with variant - Oil filters',
      params: 'brand=ABARTH&model=500%20II&variant=1.4%20Turbo%20135&filterType=oil'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`🔗 URL: ${STRAPI_URL}/api/filter-compatibility/find-products?${testCase.params}`);
    
    try {
      const response = await fetch(`${STRAPI_URL}/api/filter-compatibility/find-products?${testCase.params}`);
      
      if (!response.ok) {
        console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      
      console.log(`✅ Response received:`);
      console.log(`   📊 Total products: ${data.meta?.total || 0}`);
      console.log(`   🔍 Found: ${data.meta?.found ? 'Yes' : 'No'}`);
      
      if (data.data && data.data.length > 0) {
        console.log(`   📦 Sample product:`);
        const sample = data.data[0];
        console.log(`      - Reference: ${sample.reference}`);
        console.log(`      - Full Name: ${sample.fullName}`);
        console.log(`      - Filter Type: ${sample.filterType}`);
        console.log(`      - EAN: ${sample.ean}`);
        
        if (sample.compatibilityMetadata) {
          console.log(`      - Vehicle Variant: ${sample.compatibilityMetadata.vehicleVariant}`);
          console.log(`      - Engine Code: ${sample.compatibilityMetadata.engineCode}`);
        }
      } else {
        console.log(`   ⚠️  No products found`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Testing completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  testFindProductsEndpoint()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testFindProductsEndpoint };
