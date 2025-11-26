const fs = require('fs');
const path = require('path');

/**
 * Fix remaining model creation errors
 * This script identifies and fixes specific model names that are failing
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
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error.message);
    throw error;
  }
}

// Enhanced model name cleaning function
function cleanModelName(modelName) {
  if (!modelName || typeof modelName !== 'string') {
    return '';
  }

  let cleaned = modelName
    .trim()
    // Remove content in parentheses
    .replace(/\([^)]*\)/g, '')
    // Replace slashes with hyphens
    .replace(/\//g, '-')
    // Remove special characters except spaces, hyphens, and underscores
    .replace(/[^\w\s\-]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    .trim();

  // Ensure minimum length
  if (cleaned.length < 2) {
    cleaned = modelName.substring(0, 50); // Fallback to original if too short
  }

  // Limit to 100 characters
  return cleaned.substring(0, 100);
}

// Test specific problematic model names
async function testProblematicModels() {
  const problematicModels = [
    'C4 II',
    'C4 III', 
    'C5 AIRCROSS',
    'C5 I',
    'C5 II',
    'C5 III',
    'C6',
    'C8',
    'DS3',
    'DS4',
    'DS5'
  ];

  console.log('🧪 Testing problematic model names...');
  
  for (const modelName of problematicModels) {
    const cleaned = cleanModelName(modelName);
    console.log(`   "${modelName}" -> "${cleaned}"`);
    
    // Test if the cleaned name is valid
    if (cleaned.length < 2) {
      console.log(`   ❌ Too short: ${cleaned}`);
    } else if (cleaned.length > 100) {
      console.log(`   ❌ Too long: ${cleaned}`);
    } else {
      console.log(`   ✅ Valid: ${cleaned}`);
    }
  }
}

// Find and fix missing models
async function findAndFixMissingModels() {
  console.log('🔍 Finding missing models...');
  
  try {
    // Get all brands first
    const brandsResponse = await strapiRequest('/brands?pagination[limit]=1000');
    const brands = brandsResponse.data;
    console.log(`📊 Found ${brands.length} brands`);
    
    // Create a map of brand names to IDs
    const brandMap = {};
    brands.forEach(brand => {
      const name = brand.attributes?.name || brand.name;
      if (name) {
        brandMap[name.toUpperCase()] = brand.id;
      }
    });
    
    // Get all existing models
    const modelsResponse = await strapiRequest('/models?pagination[limit]=10000&populate=brand');
    const existingModels = modelsResponse.data;
    console.log(`📊 Found ${existingModels.length} existing models`);
    
    // Create a set of existing model names for quick lookup
    const existingModelNames = new Set();
    existingModels.forEach(model => {
      const name = model.attributes?.name || model.name;
      if (name) {
        existingModelNames.add(name.toUpperCase());
      }
    });
    
    // Read the CSV to find missing models
    const csvPath = path.join(__dirname, 'liste_affectation', 'Applications_borne_20240118_Purflux.csv');
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found:', csvPath);
      return;
    }
    
    const csv = require('csv-parse');
    const parser = csv.parse({ 
      columns: true, 
      delimiter: ';',
      skip_empty_lines: true 
    });
    
    const missingModels = new Map(); // brand -> Set of missing models
    
    return new Promise((resolve, reject) => {
      parser.on('data', (row) => {
        const brandName = row.marque?.trim();
        const modelName = row.typemodele?.trim();
        
        if (brandName && modelName) {
          const cleanedModelName = cleanModelName(modelName);
          
          if (cleanedModelName && !existingModelNames.has(cleanedModelName.toUpperCase())) {
            if (!missingModels.has(brandName)) {
              missingModels.set(brandName, new Set());
            }
            missingModels.get(brandName).add(cleanedModelName);
          }
        }
      });
      
      parser.on('end', async () => {
        console.log(`📊 Found missing models for ${missingModels.size} brands`);
        
        let totalMissing = 0;
        for (const [brandName, models] of missingModels) {
          totalMissing += models.size;
          console.log(`   ${brandName}: ${models.size} missing models`);
        }
        
        console.log(`📊 Total missing models: ${totalMissing}`);
        
        // Try to create the missing models
        let created = 0;
        let errors = 0;
        
        for (const [brandName, models] of missingModels) {
          const brandId = brandMap[brandName.toUpperCase()];
          if (!brandId) {
            console.log(`❌ Brand not found: ${brandName}`);
            continue;
          }
          
          for (const modelName of models) {
            try {
              const newModel = await strapiRequest('/models', 'POST', {
                name: modelName,
                slug: modelName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, ''),
                brand: brandId,
                isActive: true
              });
              
              created++;
              console.log(`✅ Created model: ${modelName} for ${brandName}`);
              
            } catch (error) {
              errors++;
              console.error(`❌ Failed to create model ${modelName} for ${brandName}:`, error.message);
            }
          }
        }
        
        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Created: ${created}`);
        console.log(`   ❌ Errors: ${errors}`);
        
        resolve({ created, errors });
      });
      
      parser.on('error', reject);
      
      // Read the CSV file
      fs.createReadStream(csvPath).pipe(parser);
    });
    
  } catch (error) {
    console.error('❌ Failed to find and fix missing models:', error.message);
    throw error;
  }
}

// Main function
async function runFixRemainingModels() {
  console.log('🔧 Fixing Remaining Model Errors');
  console.log('=' .repeat(50));
  
  try {
    await testProblematicModels();
    console.log('');
    await findAndFixMissingModels();
    
    console.log('\n🎉 Model fix complete!');
    
  } catch (error) {
    console.error('\n💥 Model fix failed:', error.message);
    process.exit(1);
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  runFixRemainingModels()
    .then(() => {
      console.log('\n🎉 Model fix script finished!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Model fix script failed:', error);
      process.exit(1);
    });
}

module.exports = { 
  runFixRemainingModels, 
  findAndFixMissingModels, 
  testProblematicModels,
  cleanModelName 
};
