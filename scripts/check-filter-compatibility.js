const fs = require('fs');
const path = require('path');

/**
 * Check what's actually in the FilterCompatibility table
 */

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Helper function to make API calls to Strapi
async function strapiRequest(endpoint, method = 'GET', data = null) {
  const url = `${STRAPI_URL}/api${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(API_TOKEN && { 'Authorization': `Bearer ${API_TOKEN}` })
    }
  };

  if (data) {
    options.body = JSON.stringify({ data });
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error.message);
    throw error;
  }
}

// Check what's in the FilterCompatibility table
async function checkFilterCompatibility() {
  console.log('🔍 Checking FilterCompatibility table...');
  
  try {
    const response = await strapiRequest('/filter-compatibilities?pagination[limit]=10000&populate=*');
    const records = response.data;
    
    console.log(`📊 Found ${records.length} filter compatibility records`);
    
    if (records.length > 0) {
      console.log('\n📋 Sample records:');
      records.slice(0, 5).forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record.id}`);
        console.log(`      Vehicle Model: ${record.vehicleModel || 'N/A'}`);
        console.log(`      Brand: ${record.brand?.name || record.brand || 'N/A'}`);
        console.log(`      Model: ${record.model?.name || record.model || 'N/A'}`);
        console.log(`      Engine Code: ${record.engineCode || 'N/A'}`);
        console.log('');
      });
      
      if (records.length > 5) {
        console.log(`   ... and ${records.length - 5} more records`);
      }
      
      // Show ID range
      const ids = records.map(r => r.id).sort((a, b) => a - b);
      console.log(`📈 ID range: ${ids[0]} to ${ids[ids.length - 1]}`);
      console.log(`📊 Total records: ${records.length}`);
    } else {
      console.log('✅ No filter compatibility records found - table is already clean!');
    }
    
    return records;
  } catch (error) {
    console.error('❌ Failed to check filter compatibility records:', error.message);
    throw error;
  }
}

// Try to delete a single record to test the API
async function testDelete() {
  console.log('\n🧪 Testing delete functionality...');
  
  try {
    const records = await checkFilterCompatibility();
    
    if (records.length === 0) {
      console.log('✅ No records to test delete with');
      return;
    }
    
    const testRecord = records[0];
    console.log(`🎯 Testing delete on record ID: ${testRecord.id}`);
    
    try {
      await strapiRequest(`/filter-compatibilities/${testRecord.id}`, 'DELETE');
      console.log('✅ Delete test successful');
    } catch (error) {
      console.error('❌ Delete test failed:', error.message);
      console.log('   This might be a permissions issue or the record might not exist');
    }
  } catch (error) {
    console.error('❌ Test delete failed:', error.message);
  }
}

// Main check function
async function runCheck() {
  console.log('🔍 FilterCompatibility Table Check');
  console.log('=' .repeat(50));
  
  try {
    await checkFilterCompatibility();
    await testDelete();
    
    console.log('\n🎉 Check complete!');
    
  } catch (error) {
    console.error('\n💥 Check failed:', error.message);
    process.exit(1);
  }
}

// Run the check if this script is executed directly
if (require.main === module) {
  runCheck()
    .then(() => {
      console.log('\n🎉 FilterCompatibility check finished!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 FilterCompatibility check failed:', error);
      process.exit(1);
    });
}

module.exports = { 
  runCheck, 
  checkFilterCompatibility, 
  testDelete 
};
