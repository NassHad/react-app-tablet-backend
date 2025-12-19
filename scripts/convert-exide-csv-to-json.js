const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

/**
 * Convert Exide Battery Selection Guide CSV to JSON
 * Converts ~42,790 vehicle entries from CSV to structured JSON format
 */

const CSV_FILE = path.join(__dirname, 'liste_affectation', 'Exide Battery Selection Guide – PC & LCV_2026 Edition.csv');
const OUTPUT_FILE = path.join(__dirname, 'liste_affectation', 'exide-vehicles.json');

// Check for limit flag
const LIMIT_ARG = process.argv.find(arg => arg.startsWith('--limit='));
const ROW_LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : null;

/**
 * Convert field name to camelCase
 * @param {string} fieldName - Original field name
 * @returns {string} - camelCase version
 */
function toCamelCase(fieldName) {
  return fieldName
    .replace(/[#]/g, '') // Remove special characters like #
    .split(/[\s]+/) // Split on whitespace
    .map((word, index) => {
      // Keep first word lowercase, capitalize first letter of subsequent words
      if (index === 0) {
        return word.charAt(0).toLowerCase() + word.slice(1);
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}

/**
 * Main conversion function
 */
async function convertCSVToJSON() {
  console.log('🚀 Starting Exide CSV to JSON conversion...');
  console.log(`📁 Reading CSV: ${CSV_FILE}`);
  console.log(`📄 Output file: ${OUTPUT_FILE}`);

  if (ROW_LIMIT) {
    console.log(`🧪 LIMIT MODE: Processing first ${ROW_LIMIT} rows only`);
  }

  const vehicles = [];
  let rowCount = 0;
  let skippedRows = 0;
  let errorCount = 0;

  // Define all 38 columns based on CSV structure
  // Fields 1-17: Vehicle data
  // Fields 18-29: Battery options (AGM, EFB, Premium, Excell, Classic, Complementary Range with sub-options)
  // Fields 30-38: Extra empty fields
  const columnNames = [
    'Sequence#',           // 1
    'Make',                // 2
    'Model',               // 3
    'Type',                // 4
    'Body Type',           // 5
    'Vehicle types',       // 6
    'Date from',           // 7
    'Date to',             // 8
    'Engine Type',         // 9
    'Engine Power in HP',  // 10
    'Engine Power in kW',  // 11
    'Capacity in Litre',   // 12
    'Capacity in ccm',     // 13
    'Cylinders',           // 14
    'Fuel Type',           // 15
    'Mixture Preparation', // 16
    'Drive Type',          // 17
    'AGM_Option1',         // 18
    'AGM_Option2',         // 19
    'AGM_Option3',         // 20
    'EFB_Option1',         // 21
    'EFB_Option2',         // 22
    'Premium_Option1',     // 23
    'Premium_Option2',     // 24
    'Excell_Option1',      // 25
    'Excell_Option2',      // 26
    'Classic_Option1',     // 27
    'Classic_Option2',     // 28
    'Complementary_Option1', // 29
    'Complementary_Option2', // 30
    'Complementary_Option3', // 31
    'Extra1',              // 32
    'Extra2',              // 33
    'Extra3',              // 34
    'Extra4',              // 35
    'Extra5',              // 36
    'Extra6',              // 37
    'Extra7'               // 38
  ];

  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(parse({
        delimiter: ';',
        columns: columnNames,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true, // Handle rows with fewer columns
        from_line: 3 // Skip first 2 rows (header + sub-header)
      }))
      .on('data', (row) => {
        try {
          rowCount++;

          // Skip if limit reached
          if (ROW_LIMIT && vehicles.length >= ROW_LIMIT) {
            skippedRows++;
            return;
          }

          // Build vehicle object with camelCase fields
          const vehicle = {
            sequenceNumber: row['Sequence#'] || '',
            make: row['Make'] || '',
            model: row['Model'] || '',
            type: row['Type'] || '',
            bodyType: row['Body Type'] || '',
            vehicleTypes: row['Vehicle types'] || '',
            dateFrom: row['Date from'] || '',
            dateTo: row['Date to'] || '',
            engineType: row['Engine Type'] || '',
            enginePowerInHP: row['Engine Power in HP'] || '',
            enginePowerInKW: row['Engine Power in kW'] || '',
            capacityInLitre: row['Capacity in Litre'] || '',
            capacityInCcm: row['Capacity in ccm'] || '',
            cylinders: row['Cylinders'] || '',
            fuelType: row['Fuel Type'] || '',
            mixturePreparation: row['Mixture Preparation'] || '',
            driveType: row['Drive Type'] || '',
            batteries: {
              agm: {
                option1: row['AGM_Option1'] || '',
                option2: row['AGM_Option2'] || '',
                option3: row['AGM_Option3'] || ''
              },
              efb: {
                option1: row['EFB_Option1'] || '',
                option2: row['EFB_Option2'] || '',
                option3: ''  // EFB appears to have only 2 options in the CSV
              },
              premium: {
                option1: row['Premium_Option1'] || '',
                option2: row['Premium_Option2'] || '',
                option3: ''
              },
              excell: {
                option1: row['Excell_Option1'] || '',
                option2: row['Excell_Option2'] || '',
                option3: ''
              },
              classic: {
                option1: row['Classic_Option1'] || '',
                option2: row['Classic_Option2'] || '',
                option3: ''
              },
              complementaryRange: {
                option1: row['Complementary_Option1'] || '',
                option2: row['Complementary_Option2'] || '',
                option3: row['Complementary_Option3'] || ''
              }
            }
          };

          vehicles.push(vehicle);

          // Progress logging
          if (rowCount % 1000 === 0) {
            console.log(`📊 Processed ${rowCount} rows, collected ${vehicles.length} vehicles...`);
          }

        } catch (error) {
          console.error(`❌ Error processing row ${rowCount}:`, error.message);
          errorCount++;
        }
      })
      .on('end', async () => {
        console.log(`\n📈 Conversion Summary:`);
        console.log(`   📥 Total rows processed: ${rowCount}`);
        if (ROW_LIMIT) {
          console.log(`   ⏭️  Skipped rows (limit reached): ${skippedRows}`);
        }
        console.log(`   ✅ Vehicles converted: ${vehicles.length}`);
        console.log(`   ❌ Errors: ${errorCount}`);

        if (vehicles.length === 0) {
          console.log('⚠️  No vehicles to export. Check CSV format.');
          resolve();
          return;
        }

        try {
          // Create output with metadata
          const output = {
            metadata: {
              sourceFile: 'Exide Battery Selection Guide – PC & LCV_2026 Edition.csv',
              totalVehicles: vehicles.length,
              generatedAt: new Date().toISOString(),
              description: 'Exide battery selection guide data with vehicle specifications and compatible battery options'
            },
            vehicles: vehicles
          };

          // Write JSON file
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
          console.log(`\n✅ JSON file created successfully!`);
          console.log(`📄 Output: ${OUTPUT_FILE}`);

          // Show sample vehicles
          console.log('\n🔍 Sample vehicles (first 3):');
          vehicles.slice(0, 3).forEach((vehicle, idx) => {
            console.log(`\n--- Vehicle ${idx + 1} ---`);
            console.log(`Make: ${vehicle.make}`);
            console.log(`Model: ${vehicle.model}`);
            console.log(`Type: ${vehicle.type}`);
            console.log(`Engine: ${vehicle.engineType} (${vehicle.enginePowerInHP} HP / ${vehicle.enginePowerInKW} kW)`);
            console.log(`Production: ${vehicle.dateFrom} - ${vehicle.dateTo || 'current'}`);

            // Show non-empty batteries
            const batteriesWithData = [];
            Object.entries(vehicle.batteries).forEach(([category, options]) => {
              const nonEmpty = Object.entries(options)
                .filter(([, val]) => val !== '')
                .map(([opt, val]) => `${opt}:${val}`);
              if (nonEmpty.length > 0) {
                batteriesWithData.push(`${category}=[${nonEmpty.join(', ')}]`);
              }
            });
            console.log(`Batteries: ${batteriesWithData.join(' | ') || 'none'}`);
          });

          // Show brand distribution
          console.log('\n📊 Brand distribution (top 10):');
          const brandCount = {};
          vehicles.forEach(v => {
            brandCount[v.make] = (brandCount[v.make] || 0) + 1;
          });

          const topBrands = Object.entries(brandCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

          topBrands.forEach(([brand, count]) => {
            console.log(`   ${brand}: ${count} vehicles`);
          });

          console.log('\n🎉 Conversion completed successfully!');
          resolve();

        } catch (error) {
          console.error('❌ Error writing JSON file:', error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('❌ CSV parsing error:', error);
        reject(error);
      });
  });
}

// Run the conversion if this script is executed directly
if (require.main === module) {
  console.log('\n💡 Usage:');
  console.log('   node scripts/convert-exide-csv-to-json.js              # Full conversion (~42K vehicles)');
  console.log('   node scripts/convert-exide-csv-to-json.js --limit=100  # Test with first 100 rows\n');

  convertCSVToJSON()
    .then(() => {
      console.log('✨ Script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Conversion failed:', error);
      process.exit(1);
    });
}

module.exports = { convertCSVToJSON };
