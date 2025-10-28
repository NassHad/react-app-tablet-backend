const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const fetch = require('node-fetch');

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';

/**
 * Script to analyze what was actually missing during the import process
 * by simulating the same logic used in the import script
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

// Find brand by name (same logic as import script)
async function findBrandByName(brandName) {
  try {
    const response = await strapiRequest(`/brands?filters[name][$eq]=${encodeURIComponent(brandName)}`);
    return response.data?.[0] || null;
  } catch (error) {
    console.error(`❌ Error finding brand "${brandName}":`, error.message);
    return null;
  }
}

// Find model by name with fuzzy matching (same logic as import script)
async function findModelByName(brandId, modelName) {
  try {
    // First try exact match
    const response = await strapiRequest(`/models?filters[name][$eq]=${encodeURIComponent(modelName)}&filters[brand][id][$eq]=${brandId}`);
    
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    
    // Try fuzzy matching - remove content in parentheses
    const cleanedName = modelName.replace(/\([^)]*\)/g, '').trim();
    if (cleanedName !== modelName) {
      const fuzzyResponse = await strapiRequest(`/models?filters[name][$eq]=${encodeURIComponent(cleanedName)}&filters[brand][id][$eq]=${brandId}`);
      
      if (fuzzyResponse.data && fuzzyResponse.data.length > 0) {
        return fuzzyResponse.data[0];
      }
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error finding model "${modelName}" for brand ID ${brandId}:`, error.message);
    return null;
  }
}

// Analyze import process
async function analyzeImportProcess() {
  console.log('🔍 Analyzing import process to identify missing data...\n');
  
  // Track missing data
  const missingBrands = new Set();
  const missingModels = new Set();
  const brandModelPairs = new Map();
  const consolidatedRecords = new Map();
  
  // Process CSV with same logic as import script
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
        
        // Consolidate records (same logic as import script)
        for (const row of csvData) {
          const brandName = row['﻿Marque']?.trim();
          const modelName = row.typemodele?.trim();
          
          if (!brandName || !modelName) continue;
          
          const uniqueKey = `${brandName}:${modelName}`;
          
          if (!consolidatedRecords.has(uniqueKey)) {
            consolidatedRecords.set(uniqueKey, {
              brand: brandName,
              typeModele: modelName
            });
          }
        }
        
        console.log(`📦 Found ${consolidatedRecords.size} unique brand-model combinations`);
        
        // Test each consolidated record
        const records = Array.from(consolidatedRecords.values());
        let processedCount = 0;
        
        for (const record of records) {
          processedCount++;
          
          if (processedCount % 100 === 0) {
            console.log(`   Processed ${processedCount}/${records.length} records...`);
          }
          
          // Find brand
          const brand = await findBrandByName(record.brand);
          
          if (!brand) {
            missingBrands.add(record.brand);
            continue;
          }
          
          // Find model
          const model = await findModelByName(brand.id, record.typeModele);
          
          if (!model) {
            missingModels.add(`${record.brand}:${record.typeModele}`);
            
            if (!brandModelPairs.has(record.brand)) {
              brandModelPairs.set(record.brand, new Set());
            }
            brandModelPairs.get(record.brand).add(record.typeModele);
          }
        }
        
        // Generate reports
        await generateImportAnalysisReports(missingBrands, missingModels, brandModelPairs);
        resolve();
      })
      .on('error', reject);
  });
}

// Generate detailed reports
async function generateImportAnalysisReports(missingBrands, missingModels, brandModelPairs) {
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
      reason: "Brand not found in Strapi database during import process"
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
      importSuccessRate: {
        brands: `${((121 - missingBrands.size) / 121 * 100).toFixed(1)}%`,
        models: `${((missingModels.size === 0) ? 100 : 'Unknown')}%`
      }
    },
    recommendations: [
      "Missing brands need to be added to the Brand table",
      "Missing models need to be added to the Model table with proper brand relations",
      "Consider cleaning model names to match existing patterns",
      "Verify brand names match exactly (case-sensitive)",
      "Check for typos or variations in model names"
    ]
  };
  
  // Write reports to files
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Write individual reports
  fs.writeFileSync(
    path.join(reportsDir, `import-missing-brands-${timestamp}.json`),
    JSON.stringify(missingBrandsReport, null, 2)
  );
  
  fs.writeFileSync(
    path.join(reportsDir, `import-missing-models-${timestamp}.json`),
    JSON.stringify(missingModelsReport, null, 2)
  );
  
  fs.writeFileSync(
    path.join(reportsDir, `import-analysis-summary-${timestamp}.json`),
    JSON.stringify(summaryReport, null, 2)
  );
  
  // Console output
  console.log('\n📊 IMPORT PROCESS ANALYSIS');
  console.log('=' .repeat(60));
  
  console.log(`\n🏷️  Missing Brands: ${missingBrands.size}`);
  if (missingBrands.size > 0) {
    console.log('   Missing brands:');
    Array.from(missingBrands).sort().forEach((brand, index) => {
      console.log(`   ${index + 1}. ${brand}`);
    });
  }
  
  console.log(`\n🚗 Missing Models: ${missingModels.size}`);
  console.log(`   Brands affected: ${brandModelPairs.size}`);
  
  if (brandModelPairs.size > 0) {
    console.log('\n   Brands with missing models:');
    Array.from(brandModelPairs.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .forEach(([brand, models], index) => {
        console.log(`   ${index + 1}. ${brand}: ${models.size} missing models`);
        if (models.size <= 5) {
          Array.from(models).sort().forEach(model => {
            console.log(`      - ${model}`);
          });
        } else {
          console.log(`      - ${Array.from(models).sort().slice(0, 3).join(', ')}... and ${models.size - 3} more`);
        }
      });
  }
  
  console.log('\n📁 Reports saved to:');
  console.log(`   📄 Missing Brands: reports/import-missing-brands-${timestamp}.json`);
  console.log(`   📄 Missing Models: reports/import-missing-models-${timestamp}.json`);
  console.log(`   📄 Summary: reports/import-analysis-summary-${timestamp}.json`);
  
  console.log('\n💡 Recommendations:');
  summaryReport.recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. ${rec}`);
  });
  
  console.log('\n🎉 Import analysis complete!');
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Import Process Analysis...');
    console.log(`📁 CSV File: ${CSV_FILE}`);
    
    await analyzeImportProcess();
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

main();
