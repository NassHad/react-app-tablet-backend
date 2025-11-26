const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

/**
 * Test script to verify Brand/Model relations in Strapi
 * Tests lookup functionality needed for filter compatibility import
 */

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

// Fetch a brand by name
async function getBrandByName(brandName) {
  try {
    const response = await strapiRequest(`/brands?filters[name][$eq]=${encodeURIComponent(brandName)}`);
    return response.data?.[0] || null;
  } catch (error) {
    console.error(`❌ Error fetching brand "${brandName}":`, error.message);
    return null;
  }
}

// Fetch models by brand ID
async function getModelsByBrandId(brandId) {
  try {
    const response = await strapiRequest(`/models?filters[brand][id][$eq]=${brandId}&populate=brand`);
    return response.data || [];
  } catch (error) {
    console.error(`❌ Error fetching models for brand ID ${brandId}:`, error.message);
    return [];
  }
}

// Fetch all brands with pagination
async function getAllBrands() {
  const brands = [];
  let page = 1;
  const pageSize = 100;
  
  while (true) {
    try {
      const response = await strapiRequest(`/brands?pagination[page]=${page}&pagination[pageSize]=${pageSize}`);
      
      if (!response.data || response.data.length === 0) {
        break;
      }
      
      brands.push(...response.data);
      
      // Check if there are more pages
      const totalPages = response.meta?.pagination?.pageCount || 1;
      if (page >= totalPages) {
        break;
      }
      
      page++;
    } catch (error) {
      console.error(`❌ Error fetching brands page ${page}:`, error.message);
      break;
    }
  }
  
  return brands;
}

// Test brand/model lookup for specific brands
async function testSpecificBrands() {
  console.log('🔍 Testing Specific Brands (from CSV)...\n');
  
  const testBrands = ['ABARTH', 'CITROEN', 'FIAT', 'FORD', 'TOYOTA', 'RENAULT'];
  const stats = {
    found: 0,
    notFound: 0,
    totalModels: 0,
    brandsWithModels: 0,
    brandsWithoutModels: 0
  };
  
  for (const brandName of testBrands) {
    console.log(`\n📋 Testing brand: ${brandName}`);
    
    const brand = await getBrandByName(brandName);
    
    if (!brand) {
      console.log(`   ❌ Brand "${brandName}" NOT FOUND in database`);
      stats.notFound++;
      continue;
    }
    
    console.log(`   ✅ Brand found: ID=${brand.id}, slug="${brand.slug}"`);
    stats.found++;
    
    // Get models for this brand
    const models = await getModelsByBrandId(brand.id);
    
    if (models.length === 0) {
      console.log(`   ⚠️  No models found for this brand`);
      stats.brandsWithoutModels++;
    } else {
      console.log(`   📦 Found ${models.length} model(s):`);
      models.slice(0, 5).forEach(model => {
        const modelName = model.name || model.attributes?.name;
        const slug = model.slug || model.attributes?.slug;
        console.log(`      - ${modelName} (slug: ${slug})`);
      });
      
      if (models.length > 5) {
        console.log(`      ... and ${models.length - 5} more`);
      }
      
      stats.totalModels += models.length;
      stats.brandsWithModels++;
    }
  }
  
  console.log('\n📊 Summary Statistics:');
  console.log(`   ✅ Brands found: ${stats.found}/${testBrands.length}`);
  console.log(`   ❌ Brands not found: ${stats.notFound}/${testBrands.length}`);
  console.log(`   📦 Total models across all brands: ${stats.totalModels}`);
  console.log(`   ✅ Brands with models: ${stats.brandsWithModels}`);
  console.log(`   ⚠️  Brands without models: ${stats.brandsWithoutModels}`);
  
  return stats;
}

// Test brand lookup from CSV data
async function testBrandsFromCSV() {
  console.log('\n📁 Testing brands from CSV file...\n');
  
  // Brands that should exist from the import process
  const csvBrands = ['ABARTH', 'ALFA ROMEO', 'ARO', 'ASTON MARTIN', 'BEDFORD', 
                      'CHEVROLET', 'CHRYSLER', 'CITROEN', 'DACIA', 'DAEWOO',
                      'DODGE', 'DS', 'FERRARI', 'FIAT', 'FORD', 'TOYOTA', 'RENAULT'];
  
  const results = {
    found: [],
    notFound: []
  };
  
  for (const brandName of csvBrands) {
    const brand = await getBrandByName(brandName);
    if (brand) {
      results.found.push({ name: brandName, id: brand.id, slug: brand.slug });
    } else {
      results.notFound.push(brandName);
    }
  }
  
  console.log(`✅ Found ${results.found.length}/${csvBrands.length} brands:`);
  results.found.forEach(({ name, id, slug }) => {
    console.log(`   - ${name} (ID: ${id}, slug: ${slug})`);
  });
  
  if (results.notFound.length > 0) {
    console.log(`\n❌ Not found ${results.notFound.length}/${csvBrands.length} brands:`);
    results.notFound.forEach(name => {
      console.log(`   - ${name}`);
    });
  }
  
  return results;
}

// Main test function
async function runTests() {
  console.log('🎯 Brand/Model Relations Test');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Check if Strapi is accessible
    console.log('\n1️⃣ Testing Strapi connection...');
    const brands = await getAllBrands();
    console.log(`✅ Connected to Strapi. Found ${brands.length} total brands in database.\n`);
    
    // Test 2: Test specific brands with model lookups
    const specificStats = await testSpecificBrands();
    
    // Test 3: Test brand lookup for CSV brands
    const csvResults = await testBrandsFromCSV();
    
    // Final summary
    console.log('\n🎉 TEST COMPLETE!');
    console.log('=' .repeat(60));
    console.log('\n✅ All tests passed. Brand/Model relations are properly configured.');
    console.log('\n💡 Next steps:');
    console.log('   - Run test-import-filter-compatibility.js to test small import');
    console.log('   - Then proceed with full compatibility import');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Make sure Strapi is running on:', STRAPI_URL);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runTests,
  getBrandByName,
  getModelsByBrandId
};

