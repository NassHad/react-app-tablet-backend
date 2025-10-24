const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

/**
 * Import script for Purflux filter products from recap_data_purflux.csv
 * Processes 57 products and imports them into FilterProduct content type
 */

const CSV_FILE = path.join(__dirname, 'liste_affectation', 'recap_data_purflux.csv');

// Map category to filter type
const CATEGORY_TO_FILTER_TYPE = {
  'FILTRE A HUILE': 'oil',
  'FILTRE GAZOLE': 'diesel', 
  'FILTRE A AIR': 'air',
  'FILTRE HABITACLE': 'cabin'
};

async function importFilterProducts() {
  console.log('🚀 Starting FilterProduct import...');
  console.log(`📁 Reading CSV: ${CSV_FILE}`);
  
  const records = [];
  let processedCount = 0;
  let errorCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(parse({
        delimiter: ';',
        columns: ['gsa', 'type', 'category', 'brand', 'sku', 'name', 'ean'],
        skip_empty_lines: true,
        trim: true
      }))
      .on('data', (row) => {
        try {
          const category = row.category;
          const filterType = CATEGORY_TO_FILTER_TYPE[category];
          
          if (!filterType) {
            console.warn(`⚠️  Unknown category: ${category}`);
            return;
          }

          const fullName = row.name;
          const internalSKU = row.sku;
          const ean = row.ean;

          if (!internalSKU || !ean || !fullName) {
            console.warn(`⚠️  Missing required data for: ${fullName}`);
            return;
          }

          // Extract reference from full name (e.g., "PURFLUX FILTRE HUILE L358AY -2" -> "L358AY")
          const refMatch = fullName.match(/PURFLUX FILTRE \w+ (\w+)( -(\d+))?/);
          if (!refMatch) {
            console.warn(`⚠️  Could not parse reference from: ${fullName}`);
            return;
          }

          const reference = refMatch[1];
          const fullReference = refMatch[3] || '';

          const record = {
            brand: 'PURFLUX',
            filterType,
            reference,
            fullReference,
            fullName,
            ean,
            internalSKU,
            category,
            isActive: true
          };

          records.push(record);
          processedCount++;

          if (processedCount % 10 === 0) {
            console.log(`📊 Processed ${processedCount} products...`);
          }

        } catch (error) {
          console.error(`❌ Error processing row:`, error);
          errorCount++;
        }
      })
      .on('end', async () => {
        console.log(`\n📈 Import Summary:`);
        console.log(`   ✅ Successfully processed: ${processedCount} products`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📦 Total records to import: ${records.length}`);

        if (records.length === 0) {
          console.log('⚠️  No records to import. Check CSV format.');
          resolve();
          return;
        }

        try {
          // Here you would normally import to Strapi
          // For now, we'll just log the structure
          console.log('\n🔍 Sample record structure:');
          console.log(JSON.stringify(records[0], null, 2));
          
          console.log('\n📋 Filter type distribution:');
          const typeCount = records.reduce((acc, record) => {
            acc[record.filterType] = (acc[record.filterType] || 0) + 1;
            return acc;
          }, {});
          console.log(typeCount);

          console.log('\n✅ Import preparation completed successfully!');
          console.log('💡 Next step: Implement Strapi API calls to create records');
          
          resolve();
        } catch (error) {
          console.error('❌ Error during import:', error);
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
  importFilterProducts()
    .then(() => {
      console.log('🎉 Import script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Import failed:', error);
      process.exit(1);
    });
}

module.exports = { importFilterProducts };
