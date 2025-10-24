const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

/**
 * Analyze CSV file to extract unique brands and models
 * Compare with existing database brands and models
 */

const CSV_COMPATIBILITY = path.join(__dirname, 'liste_affectation', 'Applications_borne_20240118_Purflux.csv');

// Load existing brands and models from database
function loadExistingData() {
  try {
    const brandsData = fs.readFileSync(path.join(__dirname, 'export-brands.json'), 'utf8');
    const modelsData = fs.readFileSync(path.join(__dirname, 'export-models.json'), 'utf8');
    
    const existingBrands = JSON.parse(brandsData);
    const existingModels = JSON.parse(modelsData);
    
    return { existingBrands, existingModels };
  } catch (error) {
    console.error('❌ Failed to load existing data:', error.message);
    return { existingBrands: [], existingModels: [] };
  }
}

// Analyze CSV file
async function analyzeCSV() {
  console.log('🔍 Analyzing CSV file for brands and models...');
  
  const brands = new Set();
  const models = new Set();
  const brandModelPairs = new Set();
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
        
        if (row.marque && row.marque.trim()) {
          brands.add(row.marque.trim());
        }
        
        if (row.typemodele && row.typemodele.trim()) {
          models.add(row.typemodele.trim());
        }
        
        if (row.marque && row.typemodele) {
          brandModelPairs.add(`${row.marque.trim()}|${row.typemodele.trim()}`);
        }
      })
      .on('end', () => {
        console.log(`✅ CSV Analysis Complete:`);
        console.log(`   📊 Total rows processed: ${rowCount}`);
        console.log(`   🏷️  Unique brands found: ${brands.size}`);
        console.log(`   🚗 Unique models found: ${models.size}`);
        console.log(`   🔗 Unique brand-model pairs: ${brandModelPairs.size}`);
        
        resolve({
          brands: Array.from(brands).sort(),
          models: Array.from(models).sort(),
          brandModelPairs: Array.from(brandModelPairs).sort(),
          rowCount
        });
      })
      .on('error', (error) => {
        console.error('❌ CSV parsing error:', error);
        reject(error);
      });
  });
}

// Compare CSV data with existing database data
function compareData(csvData, existingData) {
  console.log('\n🔍 Comparing CSV data with existing database...');
  
  const { existingBrands, existingModels } = existingData;
  const { brands: csvBrands, models: csvModels, brandModelPairs } = csvData;
  
  // Create lookup maps for existing data
  const existingBrandNames = new Set(existingBrands.map(b => b.name));
  const existingModelNames = new Set(existingModels.map(m => m.name));
  const existingBrandModelPairs = new Set(
    existingModels.map(m => `${m.brandName}|${m.name}`)
  );
  
  // Find missing brands
  const missingBrands = csvBrands.filter(brand => !existingBrandNames.has(brand));
  
  // Find missing models
  const missingModels = csvModels.filter(model => !existingModelNames.has(model));
  
  // Find missing brand-model pairs
  const missingBrandModelPairs = brandModelPairs.filter(pair => !existingBrandModelPairs.has(pair));
  
  // Find brands that exist but might have different names
  const potentialBrandMatches = csvBrands.filter(brand => {
    return !existingBrandNames.has(brand) && 
           existingBrands.some(existing => 
             existing.name.toLowerCase() === brand.toLowerCase() ||
             existing.name.replace(/\s+/g, '') === brand.replace(/\s+/g, '')
           );
  });
  
  // Find models that exist but might have different names
  const potentialModelMatches = csvModels.filter(model => {
    return !existingModelNames.has(model) && 
           existingModels.some(existing => 
             existing.name.toLowerCase() === model.toLowerCase() ||
             existing.name.replace(/\s+/g, '') === model.replace(/\s+/g, '')
           );
  });
  
  console.log('\n📊 Comparison Results:');
  console.log(`   🏷️  Missing brands: ${missingBrands.length}`);
  console.log(`   🚗 Missing models: ${missingModels.length}`);
  console.log(`   🔗 Missing brand-model pairs: ${missingBrandModelPairs.length}`);
  console.log(`   🔍 Potential brand matches: ${potentialBrandMatches.length}`);
  console.log(`   🔍 Potential model matches: ${potentialModelMatches.length}`);
  
  return {
    missingBrands,
    missingModels,
    missingBrandModelPairs,
    potentialBrandMatches,
    potentialModelMatches
  };
}

// Generate detailed report
function generateReport(csvData, comparisonResults) {
  const report = {
    summary: {
      csvBrands: csvData.brands.length,
      csvModels: csvData.models.length,
      csvBrandModelPairs: csvData.brandModelPairs.length,
      missingBrands: comparisonResults.missingBrands.length,
      missingModels: comparisonResults.missingModels.length,
      missingBrandModelPairs: comparisonResults.missingBrandModelPairs.length
    },
    missingBrands: comparisonResults.missingBrands,
    missingModels: comparisonResults.missingModels,
    missingBrandModelPairs: comparisonResults.missingBrandModelPairs,
    potentialBrandMatches: comparisonResults.potentialBrandMatches,
    potentialModelMatches: comparisonResults.potentialModelMatches
  };
  
  // Save detailed report
  const reportPath = path.join(__dirname, 'csv-analysis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  
  // Save missing brands to CSV
  const missingBrandsPath = path.join(__dirname, 'missing-brands.csv');
  const missingBrandsCSV = 'brand\n' + comparisonResults.missingBrands.join('\n');
  fs.writeFileSync(missingBrandsPath, missingBrandsCSV);
  console.log(`💾 Missing brands CSV: ${missingBrandsPath}`);
  
  // Save missing models to CSV
  const missingModelsPath = path.join(__dirname, 'missing-models.csv');
  const missingModelsCSV = 'model\n' + comparisonResults.missingModels.join('\n');
  fs.writeFileSync(missingModelsPath, missingModelsCSV);
  console.log(`💾 Missing models CSV: ${missingModelsPath}`);
  
  return report;
}

// Main analysis function
async function runAnalysis() {
  console.log('🎯 Starting CSV Brands/Models Analysis');
  console.log('='.repeat(60));
  
  try {
    // Load existing data from database
    const existingData = loadExistingData();
    console.log(`✅ Loaded ${existingData.existingBrands.length} existing brands`);
    console.log(`✅ Loaded ${existingData.existingModels.length} existing models`);
    
    // Analyze CSV file
    const csvData = await analyzeCSV();
    
    // Compare data
    const comparisonResults = compareData(csvData, existingData);
    
    // Generate report
    const report = generateReport(csvData, comparisonResults);
    
    console.log('\n🎉 Analysis Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   CSV Brands: ${report.summary.csvBrands}`);
    console.log(`   CSV Models: ${report.summary.csvModels}`);
    console.log(`   Missing Brands: ${report.summary.missingBrands}`);
    console.log(`   Missing Models: ${report.summary.missingModels}`);
    
    if (report.summary.missingBrands > 0) {
      console.log('\n🏷️  Missing Brands:');
      report.missingBrands.slice(0, 10).forEach(brand => console.log(`   - ${brand}`));
      if (report.missingBrands.length > 10) {
        console.log(`   ... and ${report.missingBrands.length - 10} more`);
      }
    }
    
    if (report.summary.missingModels > 0) {
      console.log('\n🚗 Missing Models:');
      report.missingModels.slice(0, 10).forEach(model => console.log(`   - ${model}`));
      if (report.missingModels.length > 10) {
        console.log(`   ... and ${report.missingModels.length - 10} more`);
      }
    }
    
  } catch (error) {
    console.error('\n💥 Analysis failed:', error.message);
    process.exit(1);
  }
}

// Run analysis if this script is executed directly
if (require.main === module) {
  runAnalysis()
    .then(() => {
      console.log('\n🎉 Analysis script finished!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Analysis script failed:', error);
      process.exit(1);
    });
}

module.exports = { runAnalysis, analyzeCSV, compareData, generateReport };
