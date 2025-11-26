const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

/**
 * Test script for small compatibility import
 * Processes first N rows from CSV and tests brand/model lookups
 */

const CSV_FILE = path.join(__dirname, 'liste_affectation', 'Applications_borne_20240118_Purflux.csv');
const LIMIT = process.argv[2] ? parseInt(process.argv[2]) : 50;
const DRY_RUN = process.argv.includes('--dry-run');

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

// Find brand by name
async function findBrandByName(brandName) {
  try {
    const response = await strapiRequest(`/brands?filters[name][$eq]=${encodeURIComponent(brandName)}`);
    return response.data?.[0] || null;
  } catch (error) {
    console.error(`❌ Error finding brand "${brandName}":`, error.message);
    return null;
  }
}

// Find model by name and brand ID with fuzzy matching
async function findModelByName(brandId, modelName) {
  try {
    // First try exact match
    let response = await strapiRequest(
      `/models?filters[name][$eq]=${encodeURIComponent(modelName)}&filters[brand][id][$eq]=${brandId}`
    );
    
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    
    // If no exact match, try fuzzy matching by removing parentheses
    const cleanedName = modelName.replace(/\([^)]*\)/g, '').trim();
    if (cleanedName !== modelName) {
      response = await strapiRequest(
        `/models?filters[name][$eq]=${encodeURIComponent(cleanedName)}&filters[brand][id][$eq]=${brandId}`
      );
      
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error finding model "${modelName}":`, error.message);
    return null;
  }
}

// Helper to add filter with deduplication
function addFilterWithDedup(filterArray, ref, notes) {
  const existing = filterArray.find(f => f.ref === ref);
  
  if (existing) {
    notes.forEach(note => {
      if (note && !existing.notes.includes(note)) {
        existing.notes.push(note);
      }
    });
  } else {
    filterArray.push({
      ref: ref,
      notes: notes.filter(n => n)
    });
  }
}

// Main test function
async function testCompatibilityImport() {
  console.log('🎯 Testing Filter Compatibility Import');
  console.log('=' .repeat(70));
  console.log(`📁 Reading CSV: ${CSV_FILE}`);
  console.log(`📊 Processing first ${LIMIT} rows`);
  console.log(`🔧 Mode: ${DRY_RUN ? 'DRY RUN (no records will be created)' : 'TEST CREATE (will create records)'}\n`);
  
  const consolidatedRecords = new Map();
  const stats = {
    rowsProcessed: 0,
    consolidatedRecords: 0,
    brandsFound: 0,
    brandsNotFound: 0,
    modelsFound: 0,
    modelsNotFound: 0,
    brandModelMatches: new Map(),
    errors: []
  };
  
  let rowCount = 0;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
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
      .on('data', async (row) => {
        if (rowCount >= LIMIT) {
          return;
        }
        
        try {
          rowCount++;
          
          // Skip header row
          if (row.marque === 'Marque') {
            return;
          }
          
          // Create unique key for consolidation
          const uniqueKey = `${row.marque}|${row.modele}|${row.moteur}|${row.puissance}`;
          
          // Extract vehicle variant
          let vehicleVariant = '';
          if (row.modele && row.typemodele) {
            const baseModel = row.typemodele.trim();
            const fullModel = row.modele.trim();
            
            if (fullModel.includes(baseModel)) {
              vehicleVariant = fullModel
                .substring(fullModel.indexOf(baseModel) + baseModel.length)
                .replace(/^[\s\/]+/, '')
                .trim();
            } else {
              vehicleVariant = fullModel;
            }
          }
          
          // Initialize or get existing record
          if (!consolidatedRecords.has(uniqueKey)) {
            consolidatedRecords.set(uniqueKey, {
              brand: row.marque,
              typeModele: row.typemodele,
              vehicleModel: row.modele,
              vehicleVariant: vehicleVariant,
              engineCode: row.moteur,
              power: row.puissance,
              productionStart: row.debut,
              productionEnd: row.fin,
              filters: {
                oil: [],
                air: [],
                diesel: [],
                cabin: []
              },
              metadata: {
                chassisNote: null,
                generalComment: null
              }
            });
            stats.consolidatedRecords++;
          }
          
          const record = consolidatedRecords.get(uniqueKey);
          
          // Add filters
          if (row.huile) {
            const notes = [];
            if (row.date) notes.push(`Date: ${row.date}`);
            if (row.commentaire) notes.push(row.commentaire);
            addFilterWithDedup(record.filters.oil, row.huile, notes);
          }
          
          if (row.air) {
            const notes = [];
            if (row.date) notes.push(`Date: ${row.date}`);
            if (row.commentaire) notes.push(row.commentaire);
            addFilterWithDedup(record.filters.air, row.air, notes);
          }
          
          if (row.gazole) {
            const notes = [];
            if (row.date) notes.push(`Date: ${row.date}`);
            if (row.commentaire) notes.push(row.commentaire);
            addFilterWithDedup(record.filters.diesel, row.gazole, notes);
          }
          
          if (row.habitacle) {
            const notes = [];
            if (row.date) notes.push(`Date: ${row.date}`);
            if (row.commentaire) notes.push(row.commentaire);
            addFilterWithDedup(record.filters.cabin, row.habitacle, notes);
          }
          
          // Update metadata
          if (row.comfixe) {
            record.metadata.chassisNote = row.comfixe;
          }
          if (row.commentaire && !row.huile && !row.air && !row.gazole && !row.habitacle) {
            record.metadata.generalComment = row.commentaire;
          }
          
          stats.rowsProcessed++;
          
        } catch (error) {
          console.error(`❌ Error processing row ${rowCount}:`, error.message);
          stats.errors.push({ row: rowCount, error: error.message });
        }
      })
      .on('end', async () => {
        console.log('\n✅ CSV Processing Complete!');
        console.log('=' .repeat(70));
        console.log(`📊 Consolidation Stats:`);
        console.log(`   📥 Rows processed: ${stats.rowsProcessed}`);
        console.log(`   📦 Unique records: ${stats.consolidatedRecords}`);
        
        // Test brand/model lookups
        console.log('\n🔍 Testing Brand/Model Lookups...\n');
        
        const records = Array.from(consolidatedRecords.values());
        const uniqueBrands = [...new Set(records.map(r => r.brand))];
        
        for (const brandName of uniqueBrands.slice(0, 10)) {
          console.log(`Testing brand: ${brandName}`);
          
          const brand = await findBrandByName(brandName);
          
          if (!brand) {
            console.log(`   ❌ Brand "${brandName}" NOT FOUND`);
            stats.brandsNotFound++;
            continue;
          }
          
          console.log(`   ✅ Brand found: ID=${brand.id}, slug="${brand.slug}"`);
          stats.brandsFound++;
          
          // Find unique models for this brand
          const brandModels = records.filter(r => r.brand === brandName);
          const uniqueModels = [...new Set(brandModels.map(r => r.typeModele))];
          
          console.log(`   📦 Testing ${uniqueModels.length} model(s) for this brand...`);
          
          for (const modelName of uniqueModels) {
            const model = await findModelByName(brand.id, modelName);
            
            if (!model) {
              console.log(`      ❌ Model "${modelName}" NOT FOUND`);
              stats.modelsNotFound++;
              
              // Track missing model
              if (!stats.brandModelMatches.has(brandName)) {
                stats.brandModelMatches.set(brandName, { found: [], notFound: [] });
              }
              stats.brandModelMatches.get(brandName).notFound.push(modelName);
            } else {
              console.log(`      ✅ Model "${modelName}" found: ID=${model.id}, slug="${model.slug}"`);
              stats.modelsFound++;
              
              if (!stats.brandModelMatches.has(brandName)) {
                stats.brandModelMatches.set(brandName, { found: [], notFound: [] });
              }
              stats.brandModelMatches.get(brandName).found.push(modelName);
            }
          }
        }
        
        // Summary
        console.log('\n📊 LOOKUP SUMMARY');
        console.log('=' .repeat(70));
        console.log(`   ✅ Brands found: ${stats.brandsFound}/${uniqueBrands.length}`);
        console.log(`   ❌ Brands not found: ${stats.brandsNotFound}`);
        console.log(`   ✅ Models found: ${stats.modelsFound}`);
        console.log(`   ❌ Models not found: ${stats.modelsNotFound}`);
        
        if (stats.modelsNotFound > 0) {
          console.log('\n⚠️  Missing models summary:');
          for (const [brand, { notFound }] of stats.brandModelMatches.entries()) {
            if (notFound.length > 0) {
              console.log(`   ${brand}: ${notFound.length} missing (${notFound.slice(0, 3).join(', ')})`);
            }
          }
        }
        
        // Show sample consolidated record
        console.log('\n📋 Sample Consolidated Record:');
        if (records.length > 0) {
          const sample = records[0];
          console.log(JSON.stringify({
            brand: sample.brand,
            typeModele: sample.typeModele,
            vehicleModel: sample.vehicleModel,
            vehicleVariant: sample.vehicleVariant,
            filters: Object.fromEntries(
              Object.entries(sample.filters).map(([key, value]) => [
                key, 
                value.length > 0 ? `${value.length} filters` : 'no filters'
              ])
            )
          }, null, 2));
        }
        
        console.log('\n✅ TEST COMPLETE!');
        console.log('=' .repeat(70));
        
        if (stats.modelsNotFound === 0 && stats.brandsNotFound === 0) {
          console.log('\n🎉 All brand/model lookups successful! Ready to proceed with full import.');
        } else {
          console.log('\n⚠️  Some brands/models not found. Review the list above before proceeding.');
        }
        
        resolve();
      })
      .on('error', (error) => {
        console.error('❌ CSV parsing error:', error);
        reject(error);
      });
  });
}

// Run tests if this script is executed directly
if (require.main === module) {
  const limit = process.argv[2] || 50;
  console.log(`\n💡 Usage: node scripts/test-import-filter-compatibility.js [limit] [--dry-run]`);
  console.log(`💡 Processing first ${limit} rows from CSV\n`);
  
  testCompatibilityImport()
    .then(() => {
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testCompatibilityImport };

