const fs = require('fs');
const path = require('path');

/**
 * Import missing brands first before importing models
 * This script imports the 46 missing brands identified in the analysis
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

// Load existing brands from database
async function loadExistingBrands() {
  console.log('📥 Loading existing brands from database...');
  
  try {
    const response = await strapiRequest('/brands?pagination[limit]=1000');
    const brands = response.data;
    
    const brandMap = new Map();
    brands.forEach(brand => {
      const name = brand.attributes?.name || brand.name;
      const id = brand.id;
      brandMap.set(name, id);
    });
    
    console.log(`✅ Loaded ${brandMap.size} existing brands`);
    return brandMap;
  } catch (error) {
    console.error('❌ Failed to load existing brands:', error.message);
    throw error;
  }
}

// Import missing brands
async function importMissingBrands() {
  console.log('🏷️  Starting missing brands import...');
  
  try {
    // Load existing brands
    const existingBrands = await loadExistingBrands();
    
    // Load missing brands from analysis report
    const reportPath = path.join(__dirname, 'csv-analysis-report.json');
    if (!fs.existsSync(reportPath)) {
      throw new Error('Analysis report not found. Please run analyze-csv-brands-models.js first.');
    }
    
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const missingBrands = report.missingBrands;
    
    console.log(`📊 Found ${missingBrands.length} missing brands to import`);
    
    const importedBrands = [];
    const errors = [];
    const alreadyExists = [];
    
    for (const brandName of missingBrands) {
      try {
        // Check if brand already exists
        if (existingBrands.has(brandName)) {
          console.log(`✅ Brand "${brandName}" already exists`);
          alreadyExists.push(brandName);
          continue;
        }
        
        // Create slug from brand name
        const slug = brandName
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w\-]/g, '');
        
        // Create new brand
        const newBrand = await strapiRequest('/brands', 'POST', {
          name: brandName,
          slug: slug,
          isActive: true
        });
        
        importedBrands.push(newBrand.data);
        console.log(`✅ Created brand: ${brandName} (ID: ${newBrand.data.id}, slug: ${slug})`);
        
        // Add to existing brands map for subsequent checks
        existingBrands.set(brandName, newBrand.data.id);
        
      } catch (error) {
        console.error(`❌ Failed to create brand "${brandName}":`, error.message);
        errors.push({ brand: brandName, error: error.message });
      }
    }
    
    console.log(`\n📊 Brand Import Summary:`);
    console.log(`   ✅ Imported: ${importedBrands.length}`);
    console.log(`   ✅ Already existed: ${alreadyExists.length}`);
    console.log(`   ❌ Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(error => {
        console.log(`   - ${error.brand}: ${error.error}`);
      });
    }
    
    return { importedBrands, errors, alreadyExists };
  } catch (error) {
    console.error('❌ Brand import failed:', error.message);
    throw error;
  }
}

// Main import function
async function runBrandImport() {
  console.log('🎯 Starting Missing Brands Import');
  console.log('=' .repeat(50));
  
  try {
    const results = await importMissingBrands();
    
    console.log('\n🎉 Brand Import Complete!');
    console.log('=' .repeat(50));
    console.log(`✅ Total brands processed: ${results.importedBrands.length + results.alreadyExists.length}`);
    console.log(`✅ New brands created: ${results.importedBrands.length}`);
    console.log(`✅ Already existed: ${results.alreadyExists.length}`);
    console.log(`❌ Errors: ${results.errors.length}`);
    
    if (results.importedBrands.length > 0) {
      console.log('\n📝 New brands created:');
      results.importedBrands.forEach(brand => {
        console.log(`   - ${brand.attributes?.name || brand.name} (ID: ${brand.id})`);
      });
    }
    
    console.log('\n🚀 Ready to import missing models!');
    
  } catch (error) {
    console.error('\n💥 Brand import failed:', error.message);
    process.exit(1);
  }
}

// Run the import if this script is executed directly
if (require.main === module) {
  runBrandImport()
    .then(() => {
      console.log('\n🎉 Brand import script finished!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Brand import script failed:', error);
      process.exit(1);
    });
}

module.exports = { runBrandImport, importMissingBrands, loadExistingBrands };
