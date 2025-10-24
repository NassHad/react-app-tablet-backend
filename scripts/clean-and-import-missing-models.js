const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

/**
 * Clean and import missing models with proper name cleaning
 * Implements the cleaning rules: remove parentheses content, replace slashes with hyphens
 */

const CSV_COMPATIBILITY = path.join(__dirname, 'liste_affectation', 'Applications_borne_20240118_Purflux.csv');
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

// Clean model name according to the specified rules
function cleanModelName(modelName) {
  if (!modelName || typeof modelName !== 'string') {
    return '';
  }

  let cleaned = modelName.trim();

  // 1. Remove content in parentheses: "124 I (124_)" → "124 I"
  cleaned = cleaned.replace(/\([^)]*\)/g, '');

  // 2. Replace slashes with hyphens: "300/350" → "300-350"
  cleaned = cleaned.replace(/\//g, '-');

  // 3. Remove other special characters except alphanumeric, spaces, and hyphens
  cleaned = cleaned.replace(/[^\w\s\-]/g, '');

  // 4. Replace multiple spaces with single space
  cleaned = cleaned.replace(/\s+/g, ' ');

  // 5. Trim extra spaces
  cleaned = cleaned.trim();

  return cleaned;
}

// Test the cleaning function with sample names
function testNameCleaning() {
  console.log('🧪 Testing name cleaning function...');
  
  const testCases = [
    '124 I (124_)',
    '2 (DL, DJ)',
    '300/350',
    '320 / SMILY',
    '206+',
    '240',
    '101',
    '4 RUNNER I (_N5_, _N6_, _N7_)',
    '308/328/330 GT',
    '343 / 345',
    '520 / BREEZ',
    '6 (GG, GY)',
    'AUDI A3',
    'BMW X5',
    'MERCEDES C-CLASS'
  ];

  testCases.forEach(original => {
    const cleaned = cleanModelName(original);
    console.log(`"${original}" → "${cleaned}"`);
  });
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

// Extract unique brand-model pairs from CSV
async function extractBrandModelPairs() {
  console.log('📥 Extracting brand-model pairs from CSV...');
  
  const brandModelPairs = new Map();
  let rowCount = 0;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_COMPATIBILITY)
      .pipe(parse({
        delimiter: ';',
        columns: [
          'marque', 'typemodele', 'modele', 'puissance', 'moteur', 
          'debut', 'fin', 'comfixe', 'commentaire', 'date', 
          'air', 'habitacle', 'gazole', 'huile'
        ],
        skip_empty_lines: true,
        trim: true
      }))
      .on('data', (row) => {
        rowCount++;
        
        // Skip header row
        if (row.marque === 'Marque') {
          return;
        }
        
        if (row.marque && row.typemodele) {
          const brand = row.marque.trim();
          const model = row.typemodele.trim();
          const key = `${brand}|${model}`;
          
          if (!brandModelPairs.has(key)) {
            brandModelPairs.set(key, {
              brand,
              model,
              cleanedModel: cleanModelName(model)
            });
          }
        }
      })
      .on('end', () => {
        console.log(`✅ Extracted ${brandModelPairs.size} unique brand-model pairs from ${rowCount} rows`);
        resolve(Array.from(brandModelPairs.values()));
      })
      .on('error', (error) => {
        console.error('❌ CSV parsing error:', error);
        reject(error);
      });
  });
}

// Import missing brands first
async function importMissingBrands() {
  console.log('🏷️  Importing missing brands...');
  
  try {
    // Load existing brands
    const existingBrands = await loadExistingBrands();
    
    // Load missing brands from analysis
    const reportPath = path.join(__dirname, 'csv-analysis-report.json');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const missingBrands = report.missingBrands;
    
    console.log(`📊 Found ${missingBrands.length} missing brands to import`);
    
    const importedBrands = [];
    const errors = [];
    
    for (const brandName of missingBrands) {
      try {
        // Skip if brand already exists
        if (existingBrands.has(brandName)) {
          console.log(`✅ Brand "${brandName}" already exists`);
          continue;
        }
        
        // Create new brand
        const newBrand = await strapiRequest('/brands', 'POST', {
          name: brandName,
          slug: brandName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, ''),
          isActive: true
        });
        
        importedBrands.push(newBrand.data);
        console.log(`✅ Created brand: ${brandName} (ID: ${newBrand.data.id})`);
        
      } catch (error) {
        console.error(`❌ Failed to create brand "${brandName}":`, error.message);
        errors.push({ brand: brandName, error: error.message });
      }
    }
    
    console.log(`\n📊 Brand Import Summary:`);
    console.log(`   ✅ Imported: ${importedBrands.length}`);
    console.log(`   ❌ Errors: ${errors.length}`);
    
    return { importedBrands, errors };
  } catch (error) {
    console.error('❌ Brand import failed:', error.message);
    throw error;
  }
}

// Import missing models with cleaned names
async function importMissingModels() {
  console.log('🚗 Importing missing models with cleaned names...');
  
  try {
    // Load existing brands (including newly created ones)
    const existingBrands = await loadExistingBrands();
    
    // Extract brand-model pairs from CSV
    const brandModelPairs = await extractBrandModelPairs();
    
    console.log(`📊 Processing ${brandModelPairs.length} brand-model pairs...`);
    
    const importedModels = [];
    const errors = [];
    const skipped = [];
    
    for (const pair of brandModelPairs) {
      try {
        const { brand, model, cleanedModel } = pair;
        
        // Find brand ID
        const brandId = existingBrands.get(brand);
        if (!brandId) {
          console.log(`⚠️  Brand "${brand}" not found, skipping model "${model}"`);
          skipped.push({ brand, model, reason: 'Brand not found' });
          continue;
        }
        
        // Check if model already exists
        const existingModels = await strapiRequest(`/models?filters[name][$eq]=${encodeURIComponent(cleanedModel)}&filters[brand][id][$eq]=${brandId}`);
        
        if (existingModels.data && existingModels.data.length > 0) {
          console.log(`✅ Model "${cleanedModel}" already exists for brand "${brand}"`);
          continue;
        }
        
        // Create new model
        const newModel = await strapiRequest('/models', 'POST', {
          name: cleanedModel,
          slug: cleanedModel.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, ''),
          brand: brandId,
          isActive: true
        });
        
        importedModels.push(newModel.data);
        
        if (model !== cleanedModel) {
          console.log(`✅ Created model: "${model}" → "${cleanedModel}" (ID: ${newModel.data.id})`);
        } else {
          console.log(`✅ Created model: "${cleanedModel}" (ID: ${newModel.data.id})`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to create model "${pair.model}":`, error.message);
        errors.push({ brand: pair.brand, model: pair.model, error: error.message });
      }
    }
    
    console.log(`\n📊 Model Import Summary:`);
    console.log(`   ✅ Imported: ${importedModels.length}`);
    console.log(`   ⚠️  Skipped: ${skipped.length}`);
    console.log(`   ❌ Errors: ${errors.length}`);
    
    if (skipped.length > 0) {
      console.log('\n⚠️  Skipped models:');
      skipped.slice(0, 10).forEach(skip => {
        console.log(`   - ${skip.brand}: ${skip.model} (${skip.reason})`);
      });
      if (skipped.length > 10) {
        console.log(`   ... and ${skipped.length - 10} more`);
      }
    }
    
    return { importedModels, errors, skipped };
  } catch (error) {
    console.error('❌ Model import failed:', error.message);
    throw error;
  }
}

// Main import function
async function runCompleteImport() {
  console.log('🎯 Starting Complete Missing Models Import');
  console.log('=' .repeat(60));
  
  try {
    // Test name cleaning function
    testNameCleaning();
    
    // Step 1: Import missing brands
    console.log('\n🏷️  Step 1: Importing Missing Brands');
    console.log('-'.repeat(40));
    const brandResults = await importMissingBrands();
    
    // Step 2: Import missing models
    console.log('\n🚗 Step 2: Importing Missing Models');
    console.log('-'.repeat(40));
    const modelResults = await importMissingModels();
    
    // Final Summary
    console.log('\n🎉 IMPORT COMPLETE!');
    console.log('=' .repeat(60));
    console.log(`✅ Brands imported: ${brandResults.importedBrands.length}`);
    console.log(`✅ Models imported: ${modelResults.importedModels.length}`);
    console.log(`⚠️  Models skipped: ${modelResults.skipped.length}`);
    console.log(`❌ Total errors: ${brandResults.errors.length + modelResults.errors.length}`);
    
    console.log('\n🚀 Ready to resume filter compatibility import!');
    
  } catch (error) {
    console.error('\n💥 Import failed:', error.message);
    process.exit(1);
  }
}

// Run the import if this script is executed directly
if (require.main === module) {
  runCompleteImport()
    .then(() => {
      console.log('\n🎉 Missing models import script finished!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Missing models import failed:', error);
      process.exit(1);
    });
}

module.exports = { 
  runCompleteImport, 
  cleanModelName, 
  testNameCleaning,
  importMissingBrands,
  importMissingModels 
};
