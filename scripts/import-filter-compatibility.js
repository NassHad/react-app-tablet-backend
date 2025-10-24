const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

/**
 * Import script for Purflux filter compatibility from Applications_borne_20240118_Purflux.csv
 * Consolidates 12,153 rows into ~2,000 unique vehicle records with JSON filter arrays
 */

const CSV_FILE = path.join(__dirname, 'liste_affectation', 'Applications_borne_20240118_Purflux.csv');

async function importFilterCompatibility() {
  console.log('🚀 Starting FilterCompatibility import...');
  console.log(`📁 Reading CSV: ${CSV_FILE}`);
  
  const consolidatedRecords = new Map(); // Use Map to group by unique key
  let processedCount = 0;
  let errorCount = 0;
  let originalRowCount = 0;

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
          originalRowCount++;
          
          // Skip header row
          if (row.marque === 'Marque') {
            return;
          }

          // Create unique key for consolidation
          const uniqueKey = `${row.marque}|${row.modele}|${row.moteur}|${row.puissance}`;
          
          // Extract vehicle variant from full model name
          // Example: "500 II / 595 / 695 1.4 Turbo 135" with typeModele "500 II" → variant "1.4 Turbo 135"
          let vehicleVariant = '';
          if (row.modele && row.typemodele) {
            // Try to extract the part after the base model name
            const baseModel = row.typemodele.trim();
            const fullModel = row.modele.trim();
            
            // Find where the variant starts (after model name)
            if (fullModel.includes(baseModel)) {
              vehicleVariant = fullModel
                .substring(fullModel.indexOf(baseModel) + baseModel.length)
                .replace(/^[\s\/]+/, '') // Remove leading spaces and slashes
                .trim();
            } else {
              // Fallback: use full model if we can't extract variant
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
          }

          const record = consolidatedRecords.get(uniqueKey);

          // Helper function to add or merge filter with deduplication
          const addFilterWithDedup = (filterArray, ref, notes) => {
            // Check if filter ref already exists
            const existing = filterArray.find(f => f.ref === ref);
            
            if (existing) {
              // Merge notes, avoiding duplicates
              notes.forEach(note => {
                if (note && !existing.notes.includes(note)) {
                  existing.notes.push(note);
                }
              });
            } else {
              // Add new filter
              filterArray.push({
                ref: ref,
                notes: notes.filter(n => n) // Remove empty notes
              });
            }
          };

          // Add filter references if they exist
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

          processedCount++;

          if (processedCount % 1000 === 0) {
            console.log(`📊 Processed ${processedCount} rows...`);
          }

        } catch (error) {
          console.error(`❌ Error processing row:`, error);
          errorCount++;
        }
      })
      .on('end', async () => {
        console.log(`\n📈 Consolidation Summary:`);
        console.log(`   📥 Original rows: ${originalRowCount}`);
        console.log(`   📦 Consolidated records: ${consolidatedRecords.size}`);
        console.log(`   📉 Reduction: ${((1 - consolidatedRecords.size / originalRowCount) * 100).toFixed(1)}%`);
        console.log(`   ✅ Successfully processed: ${processedCount} rows`);
        console.log(`   ❌ Errors: ${errorCount}`);

        if (consolidatedRecords.size === 0) {
          console.log('⚠️  No records to import. Check CSV format.');
          resolve();
          return;
        }

        try {
          // Convert Map to Array for processing
          const records = Array.from(consolidatedRecords.values());
          
          console.log('\n🔍 Sample consolidated records:');
          // Show first real record (skip header if present)
          const realRecords = records.filter(r => r.brand !== 'Marque').slice(0, 3);
          realRecords.forEach((record, idx) => {
            console.log(`\n--- Record ${idx + 1} ---`);
            console.log(`Brand: ${record.brand}`);
            console.log(`Model: ${record.typeModele}`);
            console.log(`Full Vehicle: ${record.vehicleModel}`);
            console.log(`Variant: ${record.vehicleVariant}`);
            console.log(`Engine: ${record.engineCode}`);
            console.log(`Filters: Oil=${record.filters.oil.length}, Air=${record.filters.air.length}, Diesel=${record.filters.diesel.length}, Cabin=${record.filters.cabin.length}`);
          });
          
          console.log('\n📋 Filter type distribution:');
          const filterStats = {
            oil: 0,
            air: 0,
            diesel: 0,
            cabin: 0
          };
          
          records.forEach(record => {
            if (record.filters.oil.length > 0) filterStats.oil++;
            if (record.filters.air.length > 0) filterStats.air++;
            if (record.filters.diesel.length > 0) filterStats.diesel++;
            if (record.filters.cabin.length > 0) filterStats.cabin++;
          });
          
          console.log(filterStats);

          console.log('\n📊 Brand distribution (top 10):');
          const brandCount = {};
          records.forEach(record => {
            brandCount[record.brand] = (brandCount[record.brand] || 0) + 1;
          });
          
          const topBrands = Object.entries(brandCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
          
          topBrands.forEach(([brand, count]) => {
            console.log(`   ${brand}: ${count} records`);
          });

          console.log('\n✅ Consolidation completed successfully!');
          console.log('💡 Next step: Implement Strapi API calls to create records');
          console.log('💡 Next step: Create Brand/Model relations');
          
          resolve();
        } catch (error) {
          console.error('❌ Error during consolidation:', error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('❌ CSV parsing error:', error);
        reject(error);
      });
  });
}

// Run the import if this script is executed directly
if (require.main === module) {
  importFilterCompatibility()
    .then(() => {
      console.log('🎉 Consolidation script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Consolidation failed:', error);
      process.exit(1);
    });
}

module.exports = { importFilterCompatibility };
