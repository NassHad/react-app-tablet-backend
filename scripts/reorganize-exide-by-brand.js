const fs = require('fs');
const path = require('path');

/**
 * Reorganize Exide vehicles JSON by brand (make)
 * Input: exide-vehicles.json (flat array of 42,787 vehicles)
 * Output: exide-vehicles-by-brand.json (organized by brand)
 */

const INPUT_FILE = path.join(__dirname, 'liste_affectation', 'exide-vehicles.json');
const OUTPUT_FILE = path.join(__dirname, 'liste_affectation', 'exide-vehicles-by-brand.json');

async function reorganizeByBrand() {
  console.log('🚀 Starting brand reorganization...');
  console.log(`📁 Reading: ${INPUT_FILE}\n`);

  try {
    // Step 1: Load JSON file
    const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
    const data = JSON.parse(rawData);

    // Extract vehicles array
    const vehicles = data.vehicles || data;
    console.log(`📊 Processing ${vehicles.length.toLocaleString()} vehicles...\n`);

    // Step 2: Group by brand and extract unique models
    const brandMap = {};
    let processedCount = 0;

    vehicles.forEach((vehicle) => {
      const brand = vehicle.make;
      let model = vehicle.model;

      // Skip vehicles without a brand
      if (!brand) {
        console.warn(`⚠️  Skipping vehicle without brand: Sequence ${vehicle.sequenceNumber}`);
        return;
      }

      // Initialize brand Set if not exists (using Set to ensure uniqueness)
      if (!brandMap[brand]) {
        brandMap[brand] = new Set();
      }

      // Clean model name: remove parenthetical parts (chassis codes, variants, etc.)
      if (model) {
        // Remove everything in parentheses and trim whitespace
        model = model.replace(/\s*\([^)]*\)\s*/g, '').trim();

        // Only add if not empty after cleaning
        if (model) {
          brandMap[brand].add(model);
        }
      }

      processedCount++;

      // Progress logging every 5000 vehicles
      if (processedCount % 5000 === 0) {
        console.log(`   ⏳ Processed ${processedCount.toLocaleString()} vehicles...`);
      }
    });

    // Convert Sets to sorted arrays
    Object.keys(brandMap).forEach(brand => {
      brandMap[brand] = Array.from(brandMap[brand]).sort();
    });

    // Step 3: Sort brands alphabetically
    const sortedBrandMap = {};
    const brandNames = Object.keys(brandMap).sort();

    brandNames.forEach(brand => {
      sortedBrandMap[brand] = brandMap[brand];
    });

    // Step 4: Calculate statistics
    console.log(`\n✅ Organized into ${brandNames.length} brands\n`);

    const brandStats = brandNames.map(brand => ({
      name: brand,
      modelCount: brandMap[brand].length
    })).sort((a, b) => b.modelCount - a.modelCount);

    const totalModels = brandStats.reduce((sum, stat) => sum + stat.modelCount, 0);
    const avgModelsPerBrand = Math.round(totalModels / brandStats.length);

    console.log('📈 Statistics:');
    console.log(`   Total unique models: ${totalModels.toLocaleString()}`);
    console.log(`   Total brands: ${brandStats.length}`);
    console.log(`   Average models per brand: ${avgModelsPerBrand}`);
    console.log(`   Brand with most models: ${brandStats[0].name} (${brandStats[0].modelCount.toLocaleString()} models)`);
    console.log(`   Brand with fewest models: ${brandStats[brandStats.length - 1].name} (${brandStats[brandStats.length - 1].modelCount} models)`);

    console.log('\n📊 Top 10 Brands by Model Count:');
    brandStats.slice(0, 10).forEach((stat, index) => {
      console.log(`   ${index + 1}. ${stat.name}: ${stat.modelCount.toLocaleString()} models`);
    });

    // Step 5: Write output file
    console.log(`\n💾 Writing to: ${OUTPUT_FILE}`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(sortedBrandMap, null, 2), 'utf-8');

    // Get file size
    const stats = fs.statSync(OUTPUT_FILE);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`✅ File created successfully! (${fileSizeMB} MB)`);
    console.log('\n🎉 Brand reorganization completed!\n');

    // Display sample brands for verification
    console.log('📋 Sample brands (first 5):');
    brandNames.slice(0, 5).forEach(brand => {
      console.log(`   ${brand}: ${brandMap[brand].length} models`);
      if (brandMap[brand].length <= 3) {
        console.log(`      Models: ${brandMap[brand].join(', ')}`);
      } else {
        console.log(`      First 3: ${brandMap[brand].slice(0, 3).join(', ')}`);
      }
    });

  } catch (error) {
    console.error('\n❌ Error during reorganization:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  reorganizeByBrand()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Reorganization failed:', error);
      process.exit(1);
    });
}

module.exports = { reorganizeByBrand };
