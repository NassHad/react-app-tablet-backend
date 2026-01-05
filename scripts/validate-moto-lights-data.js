const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

/**
 * Validate OSRAM motorcycle lights data before import
 *
 * This script checks data quality and identifies potential issues:
 * - Missing brands/models
 * - Invalid data structures
 * - Duplicate entries
 * - Category validation
 *
 * Usage: node scripts/validate-moto-lights-data.js
 */

const DATA_FILE = path.join(__dirname, 'liste_affectation', 'osram-moto-lamps.json');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

async function validateData() {
  try {
    console.log('🔍 Validating OSRAM Motorcycle Lights Data\n');
    console.log('═══════════════════════════════════════════════\n');

    // Load data
    console.log('📦 Loading data file...');
    if (!fs.existsSync(DATA_FILE)) {
      throw new Error(`Data file not found: ${DATA_FILE}`);
    }
    const osramData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log(`✅ Loaded ${osramData.length} entries\n`);

    // Open database
    console.log('💾 Opening database...');
    const db = new Database(DB_PATH);
    console.log('✅ Database opened\n');

    // Get existing brands and models
    const existingBrands = db.prepare('SELECT id, slug, vehicle_type FROM brands').all();
    const existingModels = db.prepare('SELECT id, slug, vehicle_type FROM models').all();

    const brandSlugs = new Set(existingBrands.map(b => b.slug));
    const modelSlugs = new Set(existingModels.map(m => m.slug));
    const motoBrands = new Set(existingBrands.filter(b => b.vehicle_type === 'moto' || b.vehicle_type === 'car-moto').map(b => b.slug));
    const motoModels = new Set(existingModels.filter(m => m.vehicle_type === 'moto').map(m => m.slug));

    console.log('Database Statistics:');
    console.log(`  Total brands: ${existingBrands.length}`);
    console.log(`  Moto/Car-Moto brands: ${motoBrands.size}`);
    console.log(`  Total models: ${existingModels.length}`);
    console.log(`  Moto models: ${motoModels.size}\n`);

    // Validation counters
    let validEntries = 0;
    let invalidEntries = 0;
    const issues = {
      missingBrands: new Set(),
      missingModels: new Set(),
      invalidBrands: new Set(),
      missingLightType: [],
      invalidLightStructure: [],
      duplicates: new Map()
    };

    // Validate each entry
    console.log('🔍 Validating entries...\n');

    for (const item of osramData) {
      let isValid = true;

      // Check for required fields
      if (!item.brandSlug || !item.modelSlug) {
        isValid = false;
        invalidEntries++;
        continue;
      }

      // Check for invalid brand names
      if (item.brandSlug === 'led' || item.brandSlug === 'led-led-led-led' || item.brandSlug.length < 2) {
        issues.invalidBrands.add(item.brandSlug);
        isValid = false;
      }

      // Check if brand exists
      if (!brandSlugs.has(item.brandSlug)) {
        issues.missingBrands.add(`${item.brandSlug} (${item.originalBrand})`);
      }

      // Check if model exists
      if (!modelSlugs.has(item.modelSlug)) {
        issues.missingModels.add(`${item.brandSlug}::${item.modelSlug} (${item.originalModel})`);
      }

      // Check lightType structure
      if (!item.lightType || typeof item.lightType !== 'object') {
        issues.missingLightType.push(item.id);
        isValid = false;
      } else {
        // Validate each position
        const positions = Object.values(item.lightType);
        const validPositions = positions.filter(pos =>
          pos && pos.ref && pos.position && pos.category
        );

        if (validPositions.length === 0) {
          issues.invalidLightStructure.push(item.id);
          isValid = false;
        }
      }

      // Check for duplicates
      const key = `${item.brandSlug}::${item.modelSlug}::${item.constructionYear?.start}::${item.typeConception}`;
      if (issues.duplicates.has(key)) {
        issues.duplicates.set(key, issues.duplicates.get(key) + 1);
      } else {
        issues.duplicates.set(key, 1);
      }

      if (isValid) {
        validEntries++;
      } else {
        invalidEntries++;
      }
    }

    db.close();

    // Report Results
    console.log('═══════════════════════════════════════════════');
    console.log('📊 Validation Report\n');

    console.log('Entry Statistics:');
    console.log(`  Total entries: ${osramData.length}`);
    console.log(`  Valid entries: ${validEntries}`);
    console.log(`  Invalid entries: ${invalidEntries}\n`);

    // Missing brands
    console.log(`Missing Brands (${issues.missingBrands.size}):`);
    if (issues.missingBrands.size > 0) {
      [...issues.missingBrands].slice(0, 10).forEach(brand => {
        console.log(`  ⚠️  ${brand}`);
      });
      if (issues.missingBrands.size > 10) {
        console.log(`  ... and ${issues.missingBrands.size - 10} more`);
      }
    } else {
      console.log(`  ✅ All brands exist in database`);
    }
    console.log();

    // Missing models
    console.log(`Missing Models (${issues.missingModels.size}):`);
    if (issues.missingModels.size > 0) {
      [...issues.missingModels].slice(0, 10).forEach(model => {
        console.log(`  ⚠️  ${model}`);
      });
      if (issues.missingModels.size > 10) {
        console.log(`  ... and ${issues.missingModels.size - 10} more`);
      }
    } else {
      console.log(`  ✅ All models exist in database`);
    }
    console.log();

    // Invalid brands
    if (issues.invalidBrands.size > 0) {
      console.log(`Invalid Brand Slugs (${issues.invalidBrands.size}):`);
      [...issues.invalidBrands].forEach(brand => {
        console.log(`  ❌ ${brand}`);
      });
      console.log();
    }

    // Invalid structures
    if (issues.missingLightType.length > 0) {
      console.log(`Entries Missing lightType (${issues.missingLightType.length}):`);
      console.log(`  IDs: ${issues.missingLightType.slice(0, 10).join(', ')}${issues.missingLightType.length > 10 ? '...' : ''}\n`);
    }

    if (issues.invalidLightStructure.length > 0) {
      console.log(`Entries with Invalid Light Structure (${issues.invalidLightStructure.length}):`);
      console.log(`  IDs: ${issues.invalidLightStructure.slice(0, 10).join(', ')}${issues.invalidLightStructure.length > 10 ? '...' : ''}\n`);
    }

    // Duplicates
    const duplicates = [...issues.duplicates.entries()].filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log(`Potential Duplicates (${duplicates.length} sets):`);
      duplicates.slice(0, 5).forEach(([key, count]) => {
        console.log(`  ⚠️  ${key} (${count} entries)`);
      });
      if (duplicates.length > 5) {
        console.log(`  ... and ${duplicates.length - 5} more duplicate sets`);
      }
      console.log();
    }

    // Category analysis
    const categories = new Set();
    osramData.forEach(item => {
      if (item.lightType) {
        Object.values(item.lightType).forEach(pos => {
          if (pos && pos.category) {
            categories.add(pos.category);
          }
        });
      }
    });

    console.log(`Light Categories Found (${categories.size}):`);
    [...categories].sort().forEach(cat => {
      console.log(`  - ${cat}`);
    });
    console.log();

    console.log('═══════════════════════════════════════════════');
    console.log('Summary:\n');

    if (invalidEntries === 0 && issues.missingBrands.size === 0 && issues.missingModels.size === 0) {
      console.log('✅ Data is ready for import!');
      console.log('   All brands and models exist in database');
      console.log('   All entries have valid structure\n');
    } else {
      console.log('⚠️  Issues found:');
      if (issues.missingBrands.size > 0) {
        console.log(`   - ${issues.missingBrands.size} missing brands (will be created)`);
      }
      if (issues.missingModels.size > 0) {
        console.log(`   - ${issues.missingModels.size} missing models (will be created)`);
      }
      if (invalidEntries > 0) {
        console.log(`   - ${invalidEntries} invalid entries (will be skipped)`);
      }
      console.log();
      console.log('💡 Recommendation:');
      console.log('   Run import-moto-lights-missing-data.js to create missing brands/models\n');
    }

    console.log('═══════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run validation
validateData();
