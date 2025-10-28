const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

const CSV_FILE = path.join(__dirname, 'liste_affectation', 'Applications_borne_20240118_Purflux.csv');

// Debug CSV parsing
function debugCSVParsing() {
  console.log('🔍 Debugging CSV parsing...\n');
  
  return new Promise((resolve, reject) => {
    let rowCount = 0;
    const sampleRows = [];
    
    fs.createReadStream(CSV_FILE)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        delimiter: ';'
      }))
      .on('data', (row) => {
        rowCount++;
        
        if (rowCount <= 5) {
          sampleRows.push({
            rowNumber: rowCount,
            data: row,
            keys: Object.keys(row)
          });
        }
        
        // Check for brand and model data
        if (rowCount <= 10) {
          console.log(`Row ${rowCount}:`);
          console.log(`  Marque: "${row.Marque}"`);
          console.log(`  typemodele: "${row.typemodele}"`);
          console.log(`  Keys: ${Object.keys(row).join(', ')}`);
          console.log('');
        }
      })
      .on('end', () => {
        console.log(`📊 Total rows processed: ${rowCount}`);
        console.log('\n📋 Sample rows:');
        sampleRows.forEach(sample => {
          console.log(`\nRow ${sample.rowNumber}:`);
          console.log(JSON.stringify(sample.data, null, 2));
        });
        resolve();
      })
      .on('error', reject);
  });
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting CSV Debug...');
    console.log(`📁 CSV File: ${CSV_FILE}`);
    
    await debugCSVParsing();
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    process.exit(1);
  }
}

main();
