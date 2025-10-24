const fs = require('fs');
const path = require('path');

/**
 * Compare cleaned models from CSV with models in Strapi database
 * Log missing models to a JSON file
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

// Enhanced model name cleaning function (same as in other scripts)
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

// Get all models from Strapi database
async function getAllDatabaseModels() {
  console.log('📥 Fetching all models from Strapi database...');
  
  try {
    let allModels = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      console.log(`📄 Fetching models page ${page}...`);
      const response = await strapiRequest(`/models?pagination[page]=${page}&pagination[pageSize]=100&populate=brand`);
      const models = response.data;
      const pagination = response.meta?.pagination;
      
      if (models && models.length > 0) {
        allModels = allModels.concat(models);
        console.log(`   ✅ Found ${models.length} models on page ${page}`);
        
        // Check if there are more pages
        if (pagination && page < pagination.pageCount) {
          page++;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    console.log(`✅ Total database models: ${allModels.length}`);
    return allModels;
  } catch (error) {
    console.error('❌ Failed to fetch database models:', error.message);
    throw error;
  }
}

// Extract and clean models from CSV
async function extractCsvModels() {
  console.log('📥 Extracting models from CSV file...');
  
  const csvPath = path.join(__dirname, 'liste_affectation', 'Applications_borne_20240118_Purflux.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }
  
  const csv = require('csv-parse');
  const parser = csv.parse({ 
    columns: ['Marque', 'typemodele', 'Modele', 'Puissance', 'Moteur', 'Début', 'Fin', 'comfixe', 'Commentaire', 'Date', 'Air', 'Habitacle', 'Gazole', 'Huile'],
    delimiter: ';',
    skip_empty_lines: true,
    skip_records_with_error: true
  });
  
  const csvModels = new Map(); // brand -> Set of model names
  let totalRows = 0;
  
  return new Promise((resolve, reject) => {
    parser.on('data', (row) => {
      totalRows++;
      
      // Debug: Log first few rows to see the structure
      if (totalRows <= 3) {
        console.log(`   Row ${totalRows} keys:`, Object.keys(row));
        console.log(`   Row ${totalRows} Marque:`, row.Marque);
        console.log(`   Row ${totalRows} typemodele:`, row.typemodele);
      }
      
      const brandName = row.Marque?.trim();
      const modelName = row.typemodele?.trim();
      
      if (brandName && modelName) {
        const cleanedModelName = cleanModelName(modelName);
        
        if (cleanedModelName && cleanedModelName.length >= 2) {
          if (!csvModels.has(brandName)) {
            csvModels.set(brandName, new Set());
          }
          csvModels.get(brandName).add(cleanedModelName);
        }
      }
    });
    
    parser.on('end', () => {
      console.log(`✅ Processed ${totalRows} CSV rows`);
      
      let totalCsvModels = 0;
      for (const [brand, models] of csvModels) {
        totalCsvModels += models.size;
      }
      
      console.log(`✅ Found ${totalCsvModels} unique models across ${csvModels.size} brands`);
      
      resolve(csvModels);
    });
    
    parser.on('error', reject);
    
    // Read the CSV file
    fs.createReadStream(csvPath).pipe(parser);
  });
}

// Compare CSV models with database models
async function compareModels() {
  console.log('🔍 Comparing CSV models with database models...');
  
  try {
    // Get database models
    const databaseModels = await getAllDatabaseModels();
    
    // Create lookup maps for database models
    const dbModelMap = new Map(); // brand -> Set of model names
    const dbModelDetails = new Map(); // "brand|model" -> model details
    
    databaseModels.forEach(model => {
      const modelName = model.attributes?.name || model.name;
      const brandName = model.attributes?.brand?.data?.attributes?.name || 
                      model.attributes?.brand?.data?.name || 
                      model.brand?.attributes?.name || 
                      model.brand?.name;
      
      if (modelName && brandName) {
        if (!dbModelMap.has(brandName)) {
          dbModelMap.set(brandName, new Set());
        }
        dbModelMap.get(brandName).add(modelName);
        
        const key = `${brandName}|${modelName}`;
        dbModelDetails.set(key, {
          id: model.id,
          name: modelName,
          brand: brandName,
          slug: model.attributes?.slug || model.slug
        });
      }
    });
    
    console.log(`📊 Database models: ${dbModelMap.size} brands`);
    
    // Get CSV models
    const csvModels = await extractCsvModels();
    
    // Compare and find missing models
    const missingModels = [];
    const foundModels = [];
    const brandStats = new Map();
    
    for (const [brandName, csvModelSet] of csvModels) {
      const dbModelSet = dbModelMap.get(brandName) || new Set();
      const brandMissing = [];
      const brandFound = [];
      
      for (const csvModelName of csvModelSet) {
        const key = `${brandName}|${csvModelName}`;
        const dbModel = dbModelDetails.get(key);
        
        if (dbModel) {
          brandFound.push({
            name: csvModelName,
            id: dbModel.id,
            slug: dbModel.slug
          });
          foundModels.push({
            brand: brandName,
            model: csvModelName,
            id: dbModel.id,
            slug: dbModel.slug
          });
        } else {
          brandMissing.push({
            name: csvModelName,
            original: csvModelName // In case we need to track original name
          });
          missingModels.push({
            brand: brandName,
            model: csvModelName
          });
        }
      }
      
      brandStats.set(brandName, {
        total: csvModelSet.size,
        found: brandFound.length,
        missing: brandMissing.length,
        foundModels: brandFound,
        missingModels: brandMissing
      });
    }
    
    // Create comparison report
    const report = {
      summary: {
        totalCsvModels: Array.from(csvModels.values()).reduce((sum, set) => sum + set.size, 0),
        totalDatabaseModels: databaseModels.length,
        totalBrands: csvModels.size,
        foundModels: foundModels.length,
        missingModels: missingModels.length,
        foundPercentage: ((foundModels.length / (foundModels.length + missingModels.length)) * 100).toFixed(2)
      },
      brandStats: Object.fromEntries(brandStats),
      missingModels: missingModels,
      foundModels: foundModels,
      timestamp: new Date().toISOString()
    };
    
    // Save report to JSON file
    const outputPath = path.join(__dirname, 'model-comparison-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`💾 Report saved to: ${outputPath}`);
    
    // Display summary
    console.log('\n📊 Comparison Summary:');
    console.log(`   📥 CSV Models: ${report.summary.totalCsvModels}`);
    console.log(`   🗄️  Database Models: ${report.summary.totalDatabaseModels}`);
    console.log(`   ✅ Found: ${report.summary.foundModels} (${report.summary.foundPercentage}%)`);
    console.log(`   ❌ Missing: ${report.summary.missingModels}`);
    
    // Show top brands with missing models
    console.log('\n🔍 Top brands with missing models:');
    const sortedBrands = Array.from(brandStats.entries())
      .filter(([brand, stats]) => stats.missing > 0)
      .sort((a, b) => b[1].missing - a[1].missing)
      .slice(0, 10);
    
    sortedBrands.forEach(([brand, stats]) => {
      console.log(`   ${brand}: ${stats.missing}/${stats.total} missing (${((stats.missing/stats.total)*100).toFixed(1)}%)`);
    });
    
    return report;
    
  } catch (error) {
    console.error('❌ Failed to compare models:', error.message);
    throw error;
  }
}

// Main function
async function runModelComparison() {
  console.log('🔍 Model Comparison: CSV vs Database');
  console.log('=' .repeat(60));
  
  try {
    const report = await compareModels();
    
    console.log('\n🎉 Model comparison complete!');
    console.log(`📄 Detailed report saved to: model-comparison-report.json`);
    
    return report;
    
  } catch (error) {
    console.error('\n💥 Model comparison failed:', error.message);
    process.exit(1);
  }
}

// Run the comparison if this script is executed directly
if (require.main === module) {
  runModelComparison()
    .then(() => {
      console.log('\n🎉 Model comparison script finished!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Model comparison script failed:', error);
      process.exit(1);
    });
}

module.exports = { 
  runModelComparison, 
  compareModels, 
  extractCsvModels,
  getAllDatabaseModels,
  cleanModelName 
};
