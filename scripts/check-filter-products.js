const fetch = require('node-fetch');

async function checkFilterProducts() {
  try {
    console.log('🔍 Checking FilterProduct data...\n');
    
    const response = await fetch('http://localhost:1338/api/filter-products');
    const data = await response.json();
    
    console.log(`📊 Total FilterProducts: ${data.meta?.pagination?.total || 0}`);
    
    if (data.data && data.data.length > 0) {
      console.log('\n📋 Sample products:');
      data.data.slice(0, 5).forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.reference} - ${product.fullName} (${product.filterType})`);
      });
    } else {
      console.log('⚠️  No FilterProduct data found');
    }
    
    console.log('\n🔍 Checking FilterCompatibility data...');
    const compatResponse = await fetch('http://localhost:1338/api/filter-compatibilities');
    const compatData = await compatResponse.json();
    
    console.log(`📊 Total FilterCompatibilities: ${compatData.meta?.pagination?.total || 0}`);
    
    if (compatData.data && compatData.data.length > 0) {
      console.log('\n📋 Sample compatibilities:');
      compatData.data.slice(0, 3).forEach((compat, index) => {
        console.log(`   ${index + 1}. ${compat.brand?.name} ${compat.model?.name} - ${compat.vehicleVariant}`);
      });
    } else {
      console.log('⚠️  No FilterCompatibility data found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkFilterProducts();
