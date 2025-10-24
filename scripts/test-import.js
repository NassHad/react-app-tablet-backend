const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

/**
 * Test import script for Purflux filter system
 * Tests with a small subset of data first
 */

const CSV_PRODUCTS = path.join(__dirname, 'liste_affectation', 'recap_data_purflux.csv');
const CSV_COMPATIBILITY = path.join(__dirname, 'liste_affectation', 'Applications_borne_20240118_Purflux.csv');

// Strapi API configuration
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
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error.message);
    throw error;
  }
}

// Test connection and content types
async function testConnection() {
  console.log('🔍 Testing Strapi connection...');
  
  try {
    // Test basic connection
    await strapiRequest('/brands');
    console.log('✅ Strapi connection successful');
    
    // Test content types exist
    try {
      await strapiRequest('/filter-products');
      console.log('✅ FilterProduct content type exists');
    } catch (error) {
      console.log('❌ FilterProduct content type not found');
    }
    
    try {
      await strapiRequest('/filter-compatibilities');
      console.log('✅ FilterCompatibility content type exists');
    } catch (error) {
      console.log('❌ FilterCompatibility content type not found');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Strapi connection failed:', error.message);
    return false;
  }
}

// Test brand creation
async function testBrandCreation() {
  console.log('\n🧪 Testing brand creation...');
  
  try {
    const timestamp = Date.now();
    const testBrand = await strapiRequest('/brands', 'POST', {
      name: `TEST_BRAND_${timestamp}`,
      slug: `test-brand-${timestamp}`,
      isActive: true
    });
    
    console.log('✅ Brand creation successful:', testBrand.data.id);
    console.log('ℹ️  Test brand not cleaned up (manual cleanup required)');
    
    return true;
  } catch (error) {
    console.error('❌ Brand creation failed:', error.message);
    return false;
  }
}

// Test model creation
async function testModelCreation() {
  console.log('\n🧪 Testing model creation...');
  
  try {
    const timestamp = Date.now();
    // First create a test brand
    const testBrand = await strapiRequest('/brands', 'POST', {
      name: `TEST_BRAND_MODEL_${timestamp}`,
      slug: `test-brand-model-${timestamp}`,
      isActive: true
    });
    
    // Test model creation
    const testModel = await strapiRequest('/models', 'POST', {
      name: `TEST MODEL ${timestamp}`,
      slug: `test-model-${timestamp}`,
      brand: testBrand.data.id,
      isActive: true
    });
    
    console.log('✅ Model creation successful:', testModel.data.id);
    console.log('ℹ️  Test model and brand not cleaned up (manual cleanup required)');
    
    return true;
  } catch (error) {
    console.error('❌ Model creation failed:', error.message);
    return false;
  }
}

// Test filter product creation
async function testFilterProductCreation() {
  console.log('\n🧪 Testing filter product creation...');
  
  try {
    const timestamp = Date.now();
    const testProduct = await strapiRequest('/filter-products', 'POST', {
      brand: 'PURFLUX',
      filterType: 'oil',
      reference: `TEST123_${timestamp}`,
      fullReference: `TEST123-1_${timestamp}`,
      fullName: `PURFLUX FILTRE HUILE TEST123_${timestamp} -1`,
      ean: `1234567890${timestamp.toString().slice(-3)}`,
      internalSKU: `TEST123_${timestamp}`,
      category: 'FILTRE A HUILE',
      slug: `purflux-filtre-huile-test123-${timestamp}`,
      isActive: true
    });
    
    console.log('✅ Filter product creation successful:', testProduct.data.id);
    console.log('ℹ️  Test filter product not cleaned up (manual cleanup required)');
    
    return true;
  } catch (error) {
    console.error('❌ Filter product creation failed:', error.message);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Starting Purflux Filter System Tests');
  console.log('=' .repeat(50));
  
  const tests = [
    { name: 'Connection Test', fn: testConnection },
    { name: 'Brand Creation Test', fn: testBrandCreation },
    { name: 'Model Creation Test', fn: testModelCreation },
    { name: 'Filter Product Creation Test', fn: testFilterProductCreation }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ Test ${test.name} failed:`, error.message);
      failed++;
    }
  }
  
  console.log('\n📊 Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Ready for full import.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the issues above.');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests()
    .then(() => {
      console.log('\n🧪 Test script finished!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { runTests, testConnection, testBrandCreation, testModelCreation, testFilterProductCreation };
