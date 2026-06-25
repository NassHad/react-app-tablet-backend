const fs = require('fs');
const path = require('path');

/**
 * Log missing models in organized files
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

function categorizeModels(models) {
  const categories = {
    'Short Names (1-3 chars)': [],
    'Numeric Only': [],
    'Special Characters': [],
    'Long Names (20+ chars)': [],
    'Standard Names': [],
    'Problematic Names': []
  };
  
  models.forEach(model => {
    if (model.length <= 3) {
      categories['Short Names (1-3 chars)'].push(model);
    } else if (/^\d+$/.test(model)) {
      categories['Numeric Only'].push(model);
    } else if (/[^\w\s\-]/.test(model)) {
      categories['Special Characters'].push(model);
    } else if (model.length > 20) {
      categories['Long Names (20+ chars)'].push(model);
    } else if (model.includes('(') || model.includes(')') || model.includes('/') || model.includes('\\')) {
      categories['Problematic Names'].push(model);
    } else {
      categories['Standard Names'].push(model);
    }
  });
  
  return categories;
}

function generateModelLogs(report) {
  const missingModels = report.missingModels;
  const categories = categorizeModels(missingModels);
  
  console.log('📝 Generating model logs...');
  
  // 1. Complete list of missing models
  const completeListPath = path.join(__dirname, 'missing-models-complete.txt');
  let completeContent = 'MISSING MODELS - COMPLETE LIST\n';
  completeContent += '=' .repeat(50) + '\n\n';
  completeContent += `Total missing models: ${missingModels.length}\n\n`;
  
  missingModels.forEach((model, index) => {
    completeContent += `${(index + 1).toString().padStart(4, ' ')}. ${model}\n`;
  });
  
  fs.writeFileSync(completeListPath, completeContent);
  console.log(`✅ Complete list saved to: ${completeListPath}`);
  
  // 2. Categorized models
  const categorizedPath = path.join(__dirname, 'missing-models-categorized.txt');
  let categorizedContent = 'MISSING MODELS - CATEGORIZED\n';
  categorizedContent += '=' .repeat(50) + '\n\n';
  
  Object.keys(categories).forEach(category => {
    const models = categories[category];
    if (models.length > 0) {
      categorizedContent += `${category.toUpperCase()} (${models.length} models)\n`;
      categorizedContent += '-' .repeat(40) + '\n';
      models.forEach(model => {
        categorizedContent += `- ${model}\n`;
      });
      categorizedContent += '\n';
    }
  });
  
  fs.writeFileSync(categorizedPath, categorizedContent);
  console.log(`✅ Categorized models saved to: ${categorizedPath}`);
  
  // 3. Short names (problematic for Strapi)
  const shortNamesPath = path.join(__dirname, 'missing-models-short-names.txt');
  let shortContent = 'SHORT MODEL NAMES (PROBLEMATIC FOR STRAPI)\n';
  shortContent += '=' .repeat(50) + '\n\n';
  shortContent += `These model names are too short and may cause validation issues:\n\n`;
  
  categories['Short Names (1-3 chars)'].forEach(model => {
    shortContent += `- "${model}" (${model.length} chars)\n`;
  });
  
  fs.writeFileSync(shortNamesPath, shortContent);
  console.log(`✅ Short names saved to: ${shortNamesPath}`);
  
  // 4. Special characters (problematic for Strapi)
  const specialCharsPath = path.join(__dirname, 'missing-models-special-chars.txt');
  let specialContent = 'MODEL NAMES WITH SPECIAL CHARACTERS\n';
  specialContent += '=' .repeat(50) + '\n\n';
  specialContent += `These model names contain special characters that may cause issues:\n\n`;
  
  categories['Special Characters'].forEach(model => {
    const specialChars = model.match(/[^\w\s\-]/g) || [];
    specialContent += `- "${model}" (contains: ${specialChars.join(', ')})\n`;
  });
  
  fs.writeFileSync(specialCharsPath, specialContent);
  console.log(`✅ Special characters saved to: ${specialCharsPath}`);
  
  // 5. Numeric models
  const numericPath = path.join(__dirname, 'missing-models-numeric.txt');
  let numericContent = 'NUMERIC MODEL NAMES\n';
  numericContent += '=' .repeat(50) + '\n\n';
  numericContent += `These are purely numeric model names:\n\n`;
  
  categories['Numeric Only'].forEach(model => {
    numericContent += `- ${model}\n`;
  });
  
  fs.writeFileSync(numericPath, numericContent);
  console.log(`✅ Numeric models saved to: ${numericPath}`);
  
  // 6. Standard names (should be easy to import)
  const standardPath = path.join(__dirname, 'missing-models-standard.txt');
  let standardContent = 'STANDARD MODEL NAMES (EASY TO IMPORT)\n';
  standardContent += '=' .repeat(50) + '\n\n';
  standardContent += `These model names should import without issues:\n\n`;
  
  categories['Standard Names'].forEach(model => {
    standardContent += `- ${model}\n`;
  });
  
  fs.writeFileSync(standardPath, standardContent);
  console.log(`✅ Standard names saved to: ${standardPath}`);
  
  // 7. Summary statistics
  const summaryPath = path.join(__dirname, 'missing-models-summary.txt');
  let summaryContent = 'MISSING MODELS - SUMMARY STATISTICS\n';
  summaryContent += '=' .repeat(50) + '\n\n';
  
  summaryContent += `Total missing models: ${missingModels.length}\n\n`;
  
  Object.keys(categories).forEach(category => {
    const count = categories[category].length;
    const percentage = ((count / missingModels.length) * 100).toFixed(1);
    summaryContent += `${category}: ${count} models (${percentage}%)\n`;
  });
  
  summaryContent += '\nIMPORT RECOMMENDATIONS:\n';
  summaryContent += '-' .repeat(30) + '\n';
  summaryContent += `1. Start with Standard Names (${categories['Standard Names'].length} models)\n`;
  summaryContent += `2. Handle Short Names carefully (${categories['Short Names (1-3 chars)'].length} models)\n`;
  summaryContent += `3. Clean Special Characters (${categories['Special Characters'].length} models)\n`;
  summaryContent += `4. Process Numeric Names (${categories['Numeric Only'].length} models)\n`;
  summaryContent += `5. Review Problematic Names (${categories['Problematic Names'].length} models)\n`;
  
  fs.writeFileSync(summaryPath, summaryContent);
  console.log(`✅ Summary saved to: ${summaryPath}`);
  
  return categories;
}

function generateImportScript(categories) {
  const scriptPath = path.join(__dirname, 'import-missing-models.js');
  let scriptContent = `const fs = require('fs');
const path = require('path');

/**
 * Import missing models with proper validation
 * Generated from missing models analysis
 */

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Helper function to make API calls to Strapi
async function strapiRequest(endpoint, method = 'GET', data = null) {
  const url = \`\${STRAPI_URL}/api\${endpoint}\`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(API_TOKEN && { 'Authorization': \`Bearer \${API_TOKEN}\` })
    }
  };

  if (data) {
    options.body = JSON.stringify({ data });
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }
    return await response.json();
  } catch (error) {
    console.error(\`❌ API Error for \${endpoint}:\`, error.message);
    throw error;
  }
}

// Clean model name for Strapi validation
function cleanModelName(modelName) {
  return modelName
    .replace(/[^\w\s\-]/g, '') // Remove special characters except spaces, hyphens, and underscores
    .replace(/\\s+/g, ' ') // Replace multiple spaces with single space
    .trim()
    .substring(0, 100); // Limit to 100 characters
}

// Generate slug from model name
function generateSlug(modelName) {
  return modelName
    .toLowerCase()
    .replace(/\\s+/g, '-')
    .replace(/[^\\w\\-]/g, '')
    .substring(0, 50);
}

// Import models by category
async function importModelsByCategory() {
  console.log('🚀 Starting missing models import...');
  
  // Load categories from analysis
  const categories = ${JSON.stringify(categories, null, 2)};
  
  let totalImported = 0;
  let totalErrors = 0;
  
  // Process each category
  for (const [category, models] of Object.entries(categories)) {
    if (models.length === 0) continue;
    
    console.log(\`\\n📂 Processing \${category} (\${models.length} models)...\`);
    
    let categoryImported = 0;
    let categoryErrors = 0;
    
    for (const modelName of models) {
      try {
        const cleanName = cleanModelName(modelName);
        const slug = generateSlug(cleanName);
        
        if (!cleanName || cleanName.length < 2) {
          console.log(\`⚠️  Skipping invalid model: "\${modelName}"\`);
          categoryErrors++;
          continue;
        }
        
        // For now, we'll need to determine the brand ID
        // This would need to be implemented based on your brand mapping logic
        console.log(\`📝 Would import: "\${modelName}" -> "\${cleanName}" (slug: \${slug})\`);
        
        categoryImported++;
        
      } catch (error) {
        console.error(\`❌ Error processing model "\${modelName}":\`, error.message);
        categoryErrors++;
      }
    }
    
    console.log(\`✅ \${category}: \${categoryImported} processed, \${categoryErrors} errors\`);
    totalImported += categoryImported;
    totalErrors += categoryErrors;
  }
  
  console.log(\`\\n📊 Import Summary:\`);
  console.log(\`   ✅ Total processed: \${totalImported}\`);
  console.log(\`   ❌ Total errors: \${totalErrors}\`);
}

// Run import if this script is executed directly
if (require.main === module) {
  importModelsByCategory()
    .then(() => {
      console.log('\\n🎉 Model import script finished!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Model import failed:', error);
      process.exit(1);
    });
}

module.exports = { importModelsByCategory, cleanModelName, generateSlug };
`;

  fs.writeFileSync(scriptPath, scriptContent);
  console.log(`✅ Import script generated: ${scriptPath}`);
}

// Main logging function
function runModelLogging() {
  console.log('📝 MISSING MODELS LOGGING');
  console.log('=' .repeat(60));
  
  const report = loadAnalysisReport();
  if (!report) {
    console.error('❌ Could not load analysis report');
    return;
  }
  
  console.log(`📊 Found ${report.missingModels.length} missing models`);
  
  const categories = generateModelLogs(report);
  generateImportScript(categories);
  
  console.log('\n📁 Generated Files:');
  console.log('   📄 missing-models-complete.txt - Complete list');
  console.log('   📄 missing-models-categorized.txt - Categorized by type');
  console.log('   📄 missing-models-short-names.txt - Short names (problematic)');
  console.log('   📄 missing-models-special-chars.txt - Special characters');
  console.log('   📄 missing-models-numeric.txt - Numeric models');
  console.log('   📄 missing-models-standard.txt - Standard names (easy)');
  console.log('   📄 missing-models-summary.txt - Summary statistics');
  console.log('   📄 import-missing-models.js - Import script template');
  
  console.log('\n🎉 Model logging complete!');
}

// Run logging if this script is executed directly
if (require.main === module) {
  runModelLogging();
}

module.exports = { runModelLogging, categorizeModels, generateModelLogs };
