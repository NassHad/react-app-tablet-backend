const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

/**
 * Import script for FilterCompatibility records
 * Consolidates CSV data and creates records in Strapi
 */

const CSV_FILE = path.join(__dirname, 'liste_affectation', 'Applications_borne_20240118_Purflux.csv');

// Check for test mode or limit
const TEST_MODE = process.argv.includes('--test');
const LIMIT_ARG = process.argv.find(arg => arg.startsWith('--limit='));
const ROW_LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : null;

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

// Create FilterCompatibility record
async function createFilterCompatibility(record, brand, model) {
  try {
    const data = {
      brand: brand.documentId,
      model: model.documentId,
      vehicleModel: record.vehicleModel,
      vehicleVariant: record.vehicleVariant,
      engineCode: record.engineCode,
      power: record.power,
      productionStart: record.productionStart,
      productionEnd: record.productionEnd,
      filters: record.filters,
      metadata: record.metadata
    };
    
    const response = await strapiRequest('/filter-compatibilities', 'POST', data);
    return response.data;
  } catch (error) {
    console.error(`❌ Error creating FilterCompatibility:`, error.message);
    throw error;
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

// Main import function
async function importFilterCompatibility() {
  console.log('🚀 Starting FilterCompatibility Import...');
  console.log(`📁 Reading CSV: ${CSV_FILE}`);
  
  if (TEST_MODE || ROW_LIMIT) {
    console.log(`🧪 TEST MODE: ${ROW_LIMIT ? `Processing first ${ROW_LIMIT} rows` : 'Full test mode'}`);
  }
  
  const consolidatedRecords = new Map();
  const stats = {
    rowsProcessed: 0,
    consolidatedRecords: 0,
    recordsCreated: 0,
    recordsSkipped: 0,
    errors: 0,
    brandNotFound: 0,
    modelNotFound: 0
  };
  
  let rowCount = 0;
  let skippedCount = 0;
  
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
      .on('data', (row) => {
        try {
          rowCount++;
          
          // Skip header row
          if (row.marque === 'Marque') {
            return;
          }
          
          // Skip if limit reached
          if (ROW_LIMIT && stats.rowsProcessed >= ROW_LIMIT) {
            skippedCount++;
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
          stats.errors++;
        }
      })
      .on('end', async () => {
        console.log(`\n📈 Consolidation Summary:`);
        console.log(`   📥 Original rows: ${rowCount}`);
        if (ROW_LIMIT) {
          console.log(`   ⏭️  Skipped rows (limit reached): ${skippedCount}`);
        }
        console.log(`   📦 Consolidated records: ${stats.consolidatedRecords}`);
        console.log(`   📉 Reduction: ${((1 - stats.consolidatedRecords / rowCount) * 100).toFixed(1)}%`);
        console.log(`   ✅ Successfully processed: ${stats.rowsProcessed} rows`);
        console.log(`   ❌ Errors: ${stats.errors}`);
        
        if (consolidatedRecords.size === 0) {
          console.log('⚠️  No records to import. Check CSV format.');
          resolve();
          return;
        }
        
        // Process consolidated records
        console.log('\n🔄 Creating FilterCompatibility records...');
        
        const records = Array.from(consolidatedRecords.values());
        const brandCache = new Map();
        
        for (let i = 0; i < records.length; i++) {
          const record = records[i];
          const progress = `[${i + 1}/${records.length}]`;
          
          try {
            // Find brand
            let brand = brandCache.get(record.brand);
            if (!brand) {
              brand = await findBrandByName(record.brand);
              if (brand) {
                brandCache.set(record.brand, brand);
              }
            }
            
            if (!brand) {
              console.log(`${progress} ❌ Brand "${record.brand}" not found`);
              stats.brandNotFound++;
              stats.recordsSkipped++;
              continue;
            }
            
            // Find model
            const model = await findModelByName(brand.id, record.typeModele);
            
            if (!model) {
              console.log(`${progress} ❌ Model "${record.typeModele}" not found for brand "${record.brand}"`);
              stats.modelNotFound++;
              stats.recordsSkipped++;
              continue;
            }
            
            // Create FilterCompatibility record
            const created = await createFilterCompatibility(record, brand, model);
            stats.recordsCreated++;
            
            console.log(`${progress} ✅ Created: ${record.brand} ${record.typeModele} (${record.filters.oil.length + record.filters.air.length + record.filters.diesel.length + record.filters.cabin.length} filters)`);
            
            // Add small delay to avoid overwhelming the API
            if (i % 10 === 0 && i > 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
          } catch (error) {
            console.error(`${progress} ❌ Failed to create record:`, error.message);
            stats.errors++;
            stats.recordsSkipped++;
          }
        }
        
        // Final summary
        console.log('\n🎉 IMPORT COMPLETE!');
        console.log('=' .repeat(60));
        console.log(`📊 Final Statistics:`);
        console.log(`   📦 Consolidated records: ${stats.consolidatedRecords}`);
        console.log(`   ✅ Records created: ${stats.recordsCreated}`);
        console.log(`   ⏭️  Records skipped: ${stats.recordsSkipped}`);
        console.log(`   ❌ Brand not found: ${stats.brandNotFound}`);
        console.log(`   ❌ Model not found: ${stats.modelNotFound}`);
        console.log(`   ❌ Errors: ${stats.errors}`);
        
        const successRate = ((stats.recordsCreated / stats.consolidatedRecords) * 100).toFixed(1);
        console.log(`📈 Success rate: ${successRate}%`);
        
        resolve();
      })
      .on('error', (error) => {
        console.error('❌ CSV parsing error:', error);
        reject(error);
      });
  });
}

// Run the import if this script is executed directly
if (require.main === module) {
  console.log('\n💡 Usage:');
  console.log('   node scripts/import-filter-compatibility-to-strapi.js              # Full import');
  console.log('   node scripts/import-filter-compatibility-to-strapi.js --limit=100  # Test with first 100 rows');
  console.log('   node scripts/import-filter-compatibility-to-strapi.js --test       # Test mode\n');
  
  importFilterCompatibility()
    .then(() => {
      console.log('🎉 Import completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Import failed:', error);
      process.exit(1);
    });
}

module.exports = { importFilterCompatibility };
