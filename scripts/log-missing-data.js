const fs = require('fs');
const path = require('path');

/**
 * Log missing brands and models in a readable format
 */

function loadAnalysisReport() {
  try {
    const reportPath = path.join(__dirname, 'csv-analysis-report.json');
    const reportData = fs.readFileSync(reportPath, 'utf8');
    return JSON.parse(reportData);
  } catch (error) {
    console.error('❌ Failed to load analysis report:', error.message);
    return null;
  }
}

function logMissingBrands(report) {
  console.log('\n🏷️  MISSING BRANDS (46 total):');
  console.log('=' .repeat(50));
  
  const missingBrands = report.missingBrands;
  
  // Group by first letter for better organization
  const groupedBrands = {};
  missingBrands.forEach(brand => {
    const firstLetter = brand.charAt(0).toUpperCase();
    if (!groupedBrands[firstLetter]) {
      groupedBrands[firstLetter] = [];
    }
    groupedBrands[firstLetter].push(brand);
  });
  
  // Log grouped brands
  Object.keys(groupedBrands).sort().forEach(letter => {
    console.log(`\n📌 ${letter}:`);
    groupedBrands[letter].forEach(brand => {
      console.log(`   - ${brand}`);
    });
  });
  
  console.log(`\n📊 Total missing brands: ${missingBrands.length}`);
}

function logMissingModels(report) {
  console.log('\n🚗 MISSING MODELS (1464 total):');
  console.log('=' .repeat(50));
  
  const missingModels = report.missingModels;
  
  // Categorize models by type
  const categories = {
    'Short Names (1-3 chars)': [],
    'Numeric Models': [],
    'Special Characters': [],
    'Long Names': [],
    'Other': []
  };
  
  missingModels.forEach(model => {
    if (model.length <= 3) {
      categories['Short Names (1-3 chars)'].push(model);
    } else if (/^\d+$/.test(model)) {
      categories['Numeric Models'].push(model);
    } else if (/[^\w\s\-]/.test(model)) {
      categories['Special Characters'].push(model);
    } else if (model.length > 20) {
      categories['Long Names'].push(model);
    } else {
      categories['Other'].push(model);
    }
  });
  
  // Log each category
  Object.keys(categories).forEach(category => {
    const models = categories[category];
    if (models.length > 0) {
      console.log(`\n📌 ${category} (${models.length} models):`);
      const displayModels = models.slice(0, 20); // Show first 20
      displayModels.forEach(model => {
        console.log(`   - ${model}`);
      });
      if (models.length > 20) {
        console.log(`   ... and ${models.length - 20} more`);
      }
    }
  });
  
  console.log(`\n📊 Total missing models: ${missingModels.length}`);
}

function logPotentialMatches(report) {
  console.log('\n🔍 POTENTIAL MATCHES:');
  console.log('=' .repeat(50));
  
  if (report.potentialBrandMatches && report.potentialBrandMatches.length > 0) {
    console.log(`\n🏷️  Potential Brand Matches (${report.potentialBrandMatches.length}):`);
    report.potentialBrandMatches.forEach(brand => {
      console.log(`   - ${brand}`);
    });
  }
  
  if (report.potentialModelMatches && report.potentialModelMatches.length > 0) {
    console.log(`\n🚗 Potential Model Matches (${report.potentialModelMatches.length}):`);
    report.potentialModelMatches.slice(0, 20).forEach(model => {
      console.log(`   - ${model}`);
    });
    if (report.potentialModelMatches.length > 20) {
      console.log(`   ... and ${report.potentialModelMatches.length - 20} more`);
    }
  }
}

function logSummary(report) {
  console.log('\n📊 SUMMARY:');
  console.log('=' .repeat(50));
  console.log(`✅ CSV Brands: ${report.summary.csvBrands}`);
  console.log(`✅ CSV Models: ${report.summary.csvModels}`);
  console.log(`✅ CSV Brand-Model Pairs: ${report.summary.csvBrandModelPairs}`);
  console.log(`❌ Missing Brands: ${report.summary.missingBrands}`);
  console.log(`❌ Missing Models: ${report.summary.missingModels}`);
  console.log(`❌ Missing Brand-Model Pairs: ${report.summary.missingBrandModelPairs}`);
  
  const brandCoverage = ((report.summary.csvBrands - report.summary.missingBrands) / report.summary.csvBrands * 100).toFixed(1);
  const modelCoverage = ((report.summary.csvModels - report.summary.missingModels) / report.summary.csvModels * 100).toFixed(1);
  
  console.log(`\n📈 Coverage:`);
  console.log(`   🏷️  Brand Coverage: ${brandCoverage}%`);
  console.log(`   🚗 Model Coverage: ${modelCoverage}%`);
}

function generateImportPlan(report) {
  console.log('\n🎯 RECOMMENDED IMPORT PLAN:');
  console.log('=' .repeat(50));
  
  console.log('\n1️⃣  PHASE 1: Import Missing Brands');
  console.log(`   - Create ${report.summary.missingBrands} missing brands`);
  console.log(`   - Handle special characters and validation`);
  console.log(`   - Estimated time: 5-10 minutes`);
  
  console.log('\n2️⃣  PHASE 2: Import Missing Models');
  console.log(`   - Create ${report.summary.missingModels} missing models`);
  console.log(`   - Handle short names, special characters, and validation`);
  console.log(`   - Link to correct brands`);
  console.log(`   - Estimated time: 15-30 minutes`);
  
  console.log('\n3️⃣  PHASE 3: Import Filter Compatibility');
  console.log(`   - Import ${report.summary.csvBrandModelPairs} brand-model pairs`);
  console.log(`   - Use existing brands/models where possible`);
  console.log(`   - Create compatibility records`);
  console.log(`   - Estimated time: 30-60 minutes`);
  
  console.log('\n⚠️  CHALLENGES TO ADDRESS:');
  console.log('   - Model names like "240", "V8" are too short');
  console.log('   - Special characters in model names');
  console.log('   - Brand name variations (CITROEN vs CITROËN)');
  console.log('   - Large volume of data (1464 models)');
}

function saveDetailedLog(report) {
  const logPath = path.join(__dirname, 'missing-data-log.txt');
  let logContent = '';
  
  logContent += 'MISSING BRANDS AND MODELS ANALYSIS\n';
  logContent += '=' .repeat(50) + '\n\n';
  
  logContent += `SUMMARY:\n`;
  logContent += `- CSV Brands: ${report.summary.csvBrands}\n`;
  logContent += `- CSV Models: ${report.summary.csvModels}\n`;
  logContent += `- Missing Brands: ${report.summary.missingBrands}\n`;
  logContent += `- Missing Models: ${report.summary.missingModels}\n\n`;
  
  logContent += 'MISSING BRANDS:\n';
  logContent += '-' .repeat(30) + '\n';
  report.missingBrands.forEach(brand => {
    logContent += `- ${brand}\n`;
  });
  
  logContent += '\nMISSING MODELS (first 100):\n';
  logContent += '-' .repeat(30) + '\n';
  report.missingModels.slice(0, 100).forEach(model => {
    logContent += `- ${model}\n`;
  });
  
  if (report.missingModels.length > 100) {
    logContent += `... and ${report.missingModels.length - 100} more models\n`;
  }
  
  fs.writeFileSync(logPath, logContent);
  console.log(`\n💾 Detailed log saved to: ${logPath}`);
}

// Main logging function
function runLogging() {
  console.log('📋 MISSING BRANDS AND MODELS LOG');
  console.log('=' .repeat(60));
  
  const report = loadAnalysisReport();
  if (!report) {
    console.error('❌ Could not load analysis report');
    return;
  }
  
  logSummary(report);
  logMissingBrands(report);
  logMissingModels(report);
  logPotentialMatches(report);
  generateImportPlan(report);
  saveDetailedLog(report);
  
  console.log('\n🎉 Logging complete!');
}

// Run logging if this script is executed directly
if (require.main === module) {
  runLogging();
}

module.exports = { runLogging, logMissingBrands, logMissingModels, logSummary };
