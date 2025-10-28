const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const fetch = require('node-fetch');

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';

/**
 * Script to analyze missing brands and models from the import process
 */

const CSV_FILE = path.join(__dirname, 'liste_affectation', 'Applications_borne_20240118_Purflux.csv');

// Helper function to make API calls to Strapi
async function strapiRequest(endpoint, method = 'GET', data = null) {
  const url = `${STRAPI_URL}/api${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
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

// Load all brands from Strapi
async function loadAllBrands() {
  console.log('📥 Loading all brands from Strapi...');
  const brands = new Map();
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await strapiRequest(`/brands?pagination[page]=${page}&pagination[pageSize]=100`);
    
    if (response.data && response.data.length > 0) {
      response.data.forEach(brand => {
        brands.set(brand.name.toUpperCase(), brand);
      });
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`✅ Loaded ${brands.size} brands from Strapi`);
  return brands;
}

// Load all models from Strapi
async function loadAllModels() {
  console.log('📥 Loading all models from Strapi...');
  const models = new Map();
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await strapiRequest(`/models?pagination[page]=${page}&pagination[pageSize]=100`);
    
    if (response.data && response.data.length > 0) {
      response.data.forEach(model => {
        const key = `${model.brand?.name?.toUpperCase() || 'UNKNOWN'}:${model.name.toUpperCase()}`;
        models.set(key, model);
      });
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`✅ Loaded ${models.size} models from Strapi`);
  return models;
}

// Analyze CSV data
async function analyzeMissingData() {
  console.log('🔍 Analyzing missing brands and models...\n');
  
  // Load existing data
  const brands = await loadAllBrands();
  const models = await loadAllModels();
  
  // Track missing data
  const missingBrands = new Set();
  const missingModels = new Set();
  const brandModelPairs = new Map();
  
  // Process CSV
  const csvData = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        delimiter: ';'
      }))
      .on('data', (row) => {
        csvData.push(row);
      })
      .on('end', async () => {
        console.log(`📊 Processing ${csvData.length} CSV rows...`);
        
        // Analyze each row
        for (const row of csvData) {
          const brandName = row.Marque?.trim();
          const modelName = row.typemodele?.trim();
          
          if (!brandName || !modelName) continue;
          
          const brandKey = brandName.toUpperCase();
          const modelKey = `${brandKey}:${modelName.toUpperCase()}`;
          
          // Check if brand exists
          if (!brands.has(brandKey)) {
            missingBrands.add(brandName);
          }
          
          // Check if model exists
          if (!models.has(modelKey)) {
            missingModels.add(modelKey);
            
            // Track brand-model pairs for missing models
            if (!brandModelPairs.has(brandName)) {
              brandModelPairs.set(brandName, new Set());
            }
            brandModelPairs.get(brandName).add(modelName);
          }
        }
        
        // Generate reports
        await generateReports(missingBrands, missingModels, brandModelPairs);
        resolve();
      })
      .on('error', reject);
  });
}

// Generate detailed reports
async function generateReports(missingBrands, missingModels, brandModelPairs) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Missing Brands Report
  const missingBrandsReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalMissingBrands: missingBrands.size,
      brands: Array.from(missingBrands).sort()
    },
    details: Array.from(missingBrands).map(brand => ({
      brandName: brand,
      reason: "Brand not found in Strapi database"
    }))
  };
  
  // Missing Models Report
  const missingModelsReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalMissingModels: missingModels.size,
      brandsAffected: brandModelPairs.size
    },
    details: Array.from(brandModelPairs.entries()).map(([brand, models]) => ({
      brandName: brand,
      missingModels: Array.from(models).sort(),
      count: models.size
    })).sort((a, b) => b.count - a.count)
  };
  
  // Combined Summary Report
  const summaryReport = {
    timestamp: new Date().toISOString(),
    importAnalysis: {
      totalMissingBrands: missingBrands.size,
      totalMissingModels: missingModels.size,
      brandsAffected: brandModelPairs.size,
      successRate: {
        brands: `${((121 - missingBrands.size) / 121 * 100).toFixed(1)}%`,
        models: `${((missingModels.size === 0) ? 100 : 'Unknown')}%`
      }
    },
    recommendations: [
      "Missing brands need to be added to the Brand table",
      "Missing models need to be added to the Model table with proper brand relations",
      "Consider cleaning model names to match existing patterns",
      "Verify brand names match exactly (case-sensitive)"
    ]
  };
  
  // Write reports to files
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Write individual reports
  fs.writeFileSync(
    path.join(reportsDir, `missing-brands-${timestamp}.json`),
    JSON.stringify(missingBrandsReport, null, 2)
  );
  
  fs.writeFileSync(
    path.join(reportsDir, `missing-models-${timestamp}.json`),
    JSON.stringify(missingModelsReport, null, 2)
  );
  
  fs.writeFileSync(
    path.join(reportsDir, `import-analysis-summary-${timestamp}.json`),
    JSON.stringify(summaryReport, null, 2)
  );
  
  // Console output
  console.log('\n📊 MISSING DATA ANALYSIS');
  console.log('=' .repeat(60));
  
  console.log(`\n🏷️  Missing Brands: ${missingBrands.size}`);
  if (missingBrands.size > 0) {
    console.log('   Top 10 missing brands:');
    Array.from(missingBrands).sort().slice(0, 10).forEach((brand, index) => {
      console.log(`   ${index + 1}. ${brand}`);
    });
    if (missingBrands.size > 10) {
      console.log(`   ... and ${missingBrands.size - 10} more`);
    }
  }
  
  console.log(`\n🚗 Missing Models: ${missingModels.size}`);
  console.log(`   Brands affected: ${brandModelPairs.size}`);
  
  if (brandModelPairs.size > 0) {
    console.log('\n   Top 10 brands with most missing models:');
    Array.from(brandModelPairs.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 10)
      .forEach(([brand, models], index) => {
        console.log(`   ${index + 1}. ${brand}: ${models.size} missing models`);
      });
  }
  
  console.log('\n📁 Reports saved to:');
  console.log(`   📄 Missing Brands: reports/missing-brands-${timestamp}.json`);
  console.log(`   📄 Missing Models: reports/missing-models-${timestamp}.json`);
  console.log(`   📄 Summary: reports/import-analysis-summary-${timestamp}.json`);
  
  console.log('\n💡 Recommendations:');
  summaryReport.recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. ${rec}`);
  });
  
  console.log('\n🎉 Analysis complete!');
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Missing Data Analysis...');
    console.log(`📁 CSV File: ${CSV_FILE}`);
    
    await analyzeMissingData();
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

main();
