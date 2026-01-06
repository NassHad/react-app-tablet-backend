const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Match Models Without Brands to Their Correct Brands
 *
 * This script matches 5,078 models currently without brand relationships
 * to their correct brands using reference data from cleaned_models.json
 * and moto_models.json.
 *
 * Usage:
 *   Step 1 (DRY RUN): node scripts/match-models-to-brands.js
 *   Step 2: Review scripts/match-report.json
 *   Step 3 (LIVE): Set DRY_RUN=false and run again
 */

// ============ CONFIGURATION ============
const DRY_RUN = true;  // Set to false to actually update database
const BATCH_SIZE = 100; // Inserts per batch
const PROGRESS_INTERVAL = 500; // Log progress every N models

// ============ PATHS ============
const DB_PATH = path.join(process.cwd(), '.tmp', 'data.db');
const CAR_REFERENCE_PATH = path.join(process.cwd(), 'scripts', 'json_data', 'cleaned_models.json');
const MOTO_REFERENCE_PATH = path.join(process.cwd(), 'scripts', 'json_data', 'moto_models.json');
const BRANDS_PATH = path.join(process.cwd(), 'scripts', 'exported_data', 'all-brands.json');
const REPORT_FILE = path.join(process.cwd(), 'scripts', 'match-report.json');
const ERRORS_FILE = path.join(process.cwd(), 'scripts', 'match-errors.json');

// ============ DATA STRUCTURES ============
const carReferenceMap = new Map(); // modelSlug -> brandSlug
const motoReferenceMap = new Map(); // modelSlug -> brandSlug
const brandIdMap = new Map(); // brandSlug + vehicleType -> brandId
const brandNameMap = new Map(); // brandId -> brandName
const matches = []; // Array of {modelId, modelName, modelSlug, brandId, brandName, vehicleType}
const errors = [];
const stats = {
  totalModelsToMatch: 0,
  carModelsToMatch: 0,
  motoModelsToMatch: 0,
  successfulMatches: 0,
  carMatches: 0,
  motoMatches: 0,
  unmatchedModels: 0,
  carUnmatched: 0,
  motoUnmatched: 0,
  startTime: Date.now()
};

// ============ HELPER FUNCTIONS ============
function logError(error, context) {
  const errorEntry = {
    timestamp: new Date().toISOString(),
    context,
    error: error.message,
    stack: error.stack
  };
  errors.push(errorEntry);
  console.error(`❌ Error in ${context}:`, error.message);
}

function validateFiles() {
  const requiredFiles = [
    { path: DB_PATH, name: 'Database' },
    { path: CAR_REFERENCE_PATH, name: 'Car reference data' },
    { path: MOTO_REFERENCE_PATH, name: 'Moto reference data' },
    { path: BRANDS_PATH, name: 'Brands data' }
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file.path)) {
      throw new Error(`${file.name} not found: ${file.path}`);
    }
  }
}

// ============ MAIN SCRIPT ============
console.log('🎯 Match Models to Brands');
console.log('═'.repeat(80));
console.log();
console.log('Configuration:');
console.log(`  DRY RUN: ${DRY_RUN ? 'YES (no database changes)' : 'NO (will update database)'}`);
console.log(`  Batch size: ${BATCH_SIZE}`);
console.log(`  Report file: ${REPORT_FILE}`);
console.log();

try {
  // Validate all required files exist
  console.log('📋 Validating required files...');
  validateFiles();
  console.log('✅ All required files found\n');

  // ============ PHASE 1: LOAD REFERENCE DATA ============
  console.log('📦 PHASE 1: Loading Reference Data');
  console.log('─'.repeat(80));
  console.log();

  console.log('Loading car reference data...');
  const carReference = JSON.parse(fs.readFileSync(CAR_REFERENCE_PATH, 'utf8'));
  console.log(`✅ Loaded ${carReference.length} car models from reference`);

  console.log('Loading moto reference data...');
  const motoReference = JSON.parse(fs.readFileSync(MOTO_REFERENCE_PATH, 'utf8'));
  console.log(`✅ Loaded ${motoReference.length} moto models from reference`);

  console.log('Loading brands data...');
  const brandsData = JSON.parse(fs.readFileSync(BRANDS_PATH, 'utf8'));
  console.log(`✅ Loaded ${brandsData.totalBrands} brands\n`);

  console.log('Building lookup maps...');

  // Build car reference map: modelSlug -> brandSlug
  for (const model of carReference) {
    if (model.modelSlug && model.brandSlug) {
      carReferenceMap.set(model.modelSlug, model.brandSlug);
    }
  }
  console.log(`✅ Built car reference map: ${carReferenceMap.size} entries`);

  // Build moto reference map: modelSlug -> brandSlug
  for (const model of motoReference) {
    if (model.modelSlug && model.brandSlug) {
      motoReferenceMap.set(model.modelSlug, model.brandSlug);
    }
  }
  console.log(`✅ Built moto reference map: ${motoReferenceMap.size} entries`);

  // Build brand ID map: brandSlug + vehicleType -> brandId
  for (const brand of brandsData.brands) {
    const key = `${brand.slug}|${brand.vehicle_type}`;
    brandIdMap.set(key, brand.id);
    brandNameMap.set(brand.id, brand.name);
  }
  console.log(`✅ Built brand ID map: ${brandIdMap.size} entries\n`);

  // ============ PHASE 2: LOAD MODELS WITHOUT BRAND ============
  console.log('📦 PHASE 2: Loading Models Without Brand');
  console.log('─'.repeat(80));
  console.log();

  const db = new Database(DB_PATH, { readonly: DRY_RUN });
  console.log('✅ Database opened\n');

  console.log('Querying models without brand...');
  const modelsWithoutBrand = db.prepare(`
    SELECT m.id, m.name, m.slug, m.vehicle_type
    FROM models m
    LEFT JOIN models_brand_lnk lnk ON m.id = lnk.model_id
    WHERE lnk.brand_id IS NULL
      AND m.published_at IS NOT NULL
    ORDER BY m.vehicle_type, m.slug
  `).all();

  console.log(`✅ Found ${modelsWithoutBrand.length} models without brand\n`);

  // Count by vehicle type
  const carModels = modelsWithoutBrand.filter(m => m.vehicle_type === 'car');
  const motoModels = modelsWithoutBrand.filter(m => m.vehicle_type === 'moto');

  stats.totalModelsToMatch = modelsWithoutBrand.length;
  stats.carModelsToMatch = carModels.length;
  stats.motoModelsToMatch = motoModels.length;

  console.log('Breakdown by vehicle type:');
  console.log(`  Cars: ${stats.carModelsToMatch}`);
  console.log(`  Motos: ${stats.motoModelsToMatch}`);
  console.log();

  // ============ PHASE 3: MATCH MODELS TO BRANDS ============
  console.log('📦 PHASE 3: Matching Models to Brands');
  console.log('─'.repeat(80));
  console.log();

  console.log('Performing exact slug matches...');
  let processedCount = 0;

  for (const model of modelsWithoutBrand) {
    processedCount++;

    // Select the appropriate reference map based on vehicle type
    const referenceMap = model.vehicle_type === 'car' ? carReferenceMap : motoReferenceMap;

    // Try exact slug match
    const brandSlug = referenceMap.get(model.slug);

    if (brandSlug) {
      // Look up brand ID
      const brandKey = `${brandSlug}|${model.vehicle_type}`;
      const brandId = brandIdMap.get(brandKey);

      if (brandId) {
        // Successful match!
        matches.push({
          modelId: model.id,
          modelName: model.name,
          modelSlug: model.slug,
          brandId: brandId,
          brandSlug: brandSlug,
          brandName: brandNameMap.get(brandId),
          vehicleType: model.vehicle_type,
          matchMethod: 'exact_slug'
        });

        stats.successfulMatches++;
        if (model.vehicle_type === 'car') {
          stats.carMatches++;
        } else {
          stats.motoMatches++;
        }
      } else {
        // Brand slug found in reference but brand doesn't exist in database
        logError(
          new Error(`Brand slug "${brandSlug}" not found in database for vehicle type "${model.vehicle_type}"`),
          `Matching model ${model.id} "${model.name}"`
        );
      }
    }

    // Progress logging
    if (processedCount % PROGRESS_INTERVAL === 0 || processedCount === modelsWithoutBrand.length) {
      console.log(`  Progress: ${processedCount}/${modelsWithoutBrand.length} models processed (${stats.successfulMatches} matched)...`);
    }
  }

  stats.unmatchedModels = stats.totalModelsToMatch - stats.successfulMatches;
  stats.carUnmatched = stats.carModelsToMatch - stats.carMatches;
  stats.motoUnmatched = stats.motoModelsToMatch - stats.motoMatches;

  console.log();
  console.log('✅ Matching complete!\n');

  // ============ PHASE 4: GENERATE MATCH REPORT ============
  console.log('📦 PHASE 4: Generating Match Report');
  console.log('─'.repeat(80));
  console.log();

  // Calculate match rate
  const matchRate = ((stats.successfulMatches / stats.totalModelsToMatch) * 100).toFixed(1);
  const carMatchRate = stats.carModelsToMatch > 0
    ? ((stats.carMatches / stats.carModelsToMatch) * 100).toFixed(1)
    : '0.0';
  const motoMatchRate = stats.motoModelsToMatch > 0
    ? ((stats.motoMatches / stats.motoModelsToMatch) * 100).toFixed(1)
    : '0.0';

  // Get unmatched models
  const matchedModelIds = new Set(matches.map(m => m.modelId));
  const unmatchedModels = modelsWithoutBrand
    .filter(m => !matchedModelIds.has(m.id))
    .map(m => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      vehicleType: m.vehicle_type
    }));

  // Count matches by brand
  const matchesByBrand = new Map();
  for (const match of matches) {
    const key = `${match.brandName} (${match.vehicleType})`;
    matchesByBrand.set(key, (matchesByBrand.get(key) || 0) + 1);
  }

  // Get top 10 brands by match count
  const topBrands = Array.from(matchesByBrand.entries())
    .map(([brand, count]) => ({ brand, modelCount: count }))
    .sort((a, b) => b.modelCount - a.modelCount)
    .slice(0, 10);

  // Build report
  const report = {
    timestamp: new Date().toISOString(),
    executionMode: DRY_RUN ? 'DRY_RUN (no database changes)' : 'LIVE (database updated)',
    statistics: {
      totalModelsToMatch: stats.totalModelsToMatch,
      successfulMatches: stats.successfulMatches,
      unmatchedModels: stats.unmatchedModels,
      matchRate: `${matchRate}%`,
      byVehicleType: {
        car: {
          total: stats.carModelsToMatch,
          matched: stats.carMatches,
          unmatched: stats.carUnmatched,
          matchRate: `${carMatchRate}%`
        },
        moto: {
          total: stats.motoModelsToMatch,
          matched: stats.motoMatches,
          unmatched: stats.motoUnmatched,
          matchRate: `${motoMatchRate}%`
        }
      }
    },
    sampleMatches: matches.slice(0, 20).map(m => ({
      modelId: m.modelId,
      modelName: m.modelName,
      modelSlug: m.modelSlug,
      matchedToBrand: `${m.brandName} (${m.brandSlug})`,
      brandId: m.brandId,
      vehicleType: m.vehicleType
    })),
    unmatchedModelsSample: unmatchedModels.slice(0, 50),
    topBrandsByMatchCount: topBrands,
    allMatches: matches,
    allUnmatchedModels: unmatchedModels
  };

  // Write report to file
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
  console.log(`✅ Match report written to: ${REPORT_FILE}\n`);

  // Display summary
  console.log('═'.repeat(80));
  console.log('📊 MATCH SUMMARY');
  console.log('═'.repeat(80));
  console.log();
  console.log(`Total models to match: ${stats.totalModelsToMatch}`);
  console.log(`Successfully matched: ${stats.successfulMatches} (${matchRate}%)`);
  console.log(`Unmatched: ${stats.unmatchedModels} (${(100 - matchRate).toFixed(1)}%)`);
  console.log();
  console.log('Breakdown by vehicle type:');
  console.log(`  Cars: ${stats.carMatches}/${stats.carModelsToMatch} matched (${carMatchRate}%)`);
  console.log(`  Motos: ${stats.motoMatches}/${stats.motoModelsToMatch} matched (${motoMatchRate}%)`);
  console.log();

  if (topBrands.length > 0) {
    console.log('Top 10 brands by match count:');
    topBrands.forEach((brand, i) => {
      console.log(`  ${i + 1}. ${brand.brand}: ${brand.modelCount} models`);
    });
    console.log();
  }

  // ============ PHASE 5: UPDATE DATABASE ============
  if (!DRY_RUN && matches.length > 0) {
    console.log('📦 PHASE 5: Updating Database');
    console.log('─'.repeat(80));
    console.log();

    console.log(`⚠️  LIVE MODE: Will insert ${matches.length} brand-model relationships`);
    console.log('Starting database transaction...\n');

    try {
      // Start transaction
      db.prepare('BEGIN').run();

      // Prepare insert statement
      const insertStmt = db.prepare(`
        INSERT INTO models_brand_lnk (model_id, brand_id, model_ord)
        VALUES (?, ?, 1)
      `);

      let insertedCount = 0;

      for (const match of matches) {
        try {
          insertStmt.run(match.modelId, match.brandId);
          insertedCount++;

          if (insertedCount % PROGRESS_INTERVAL === 0 || insertedCount === matches.length) {
            console.log(`  Progress: ${insertedCount}/${matches.length} relationships inserted...`);
          }
        } catch (error) {
          logError(error, `Inserting relationship for model ${match.modelId} -> brand ${match.brandId}`);
        }
      }

      // Commit transaction
      db.prepare('COMMIT').run();
      console.log();
      console.log(`✅ Transaction committed: ${insertedCount} relationships inserted\n`);

      // ============ PHASE 6: VALIDATION ============
      console.log('📦 PHASE 6: Validating Results');
      console.log('─'.repeat(80));
      console.log();

      // Re-count models without brand
      const remainingWithoutBrand = db.prepare(`
        SELECT COUNT(*) as count
        FROM models m
        LEFT JOIN models_brand_lnk lnk ON m.id = lnk.model_id
        WHERE lnk.brand_id IS NULL
          AND m.published_at IS NOT NULL
      `).get();

      console.log('Validation results:');
      console.log(`  Models without brand before: ${stats.totalModelsToMatch}`);
      console.log(`  Relationships inserted: ${insertedCount}`);
      console.log(`  Models without brand after: ${remainingWithoutBrand.count}`);
      console.log(`  Expected remaining: ${stats.unmatchedModels}`);
      console.log(`  Actual remaining: ${remainingWithoutBrand.count}`);

      if (remainingWithoutBrand.count === stats.unmatchedModels) {
        console.log('  ✅ Validation passed!\n');
      } else {
        console.log('  ⚠️  Count mismatch detected\n');
      }

      // Spot-check random samples
      console.log('Spot-checking random samples...');
      const sampleMatches = matches.slice(0, Math.min(10, matches.length));

      for (const match of sampleMatches) {
        const result = db.prepare(`
          SELECT b.name as brand_name
          FROM models_brand_lnk lnk
          INNER JOIN brands b ON lnk.brand_id = b.id
          WHERE lnk.model_id = ?
        `).get(match.modelId);

        if (result && result.brand_name === match.brandName) {
          console.log(`  ✅ Model ${match.modelId} "${match.modelName}" → ${result.brand_name}`);
        } else {
          console.log(`  ❌ Model ${match.modelId} verification failed`);
        }
      }
      console.log();

    } catch (error) {
      // Rollback on error
      console.log();
      console.log('❌ Error during database update, rolling back transaction...');
      try {
        db.prepare('ROLLBACK').run();
        console.log('✅ Transaction rolled back\n');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError.message);
      }
      throw error;
    }
  } else if (DRY_RUN) {
    console.log('📦 PHASE 5: Skipped (DRY_RUN mode)');
    console.log('─'.repeat(80));
    console.log();
    console.log('⚠️  DRY_RUN mode: No database changes were made');
    console.log(`   To apply these ${matches.length} matches, set DRY_RUN = false and run again\n`);
  }

  // Close database
  db.close();

  // Write errors if any
  if (errors.length > 0) {
    fs.writeFileSync(ERRORS_FILE, JSON.stringify(errors, null, 2), 'utf8');
    console.log(`⚠️  ${errors.length} errors logged to: ${ERRORS_FILE}\n`);
  }

  // Final execution time
  const executionTime = ((Date.now() - stats.startTime) / 1000).toFixed(1);

  console.log('═'.repeat(80));
  console.log('✅ SCRIPT COMPLETE');
  console.log('═'.repeat(80));
  console.log();
  console.log(`Execution time: ${executionTime} seconds`);
  console.log(`Mode: ${DRY_RUN ? 'DRY_RUN' : 'LIVE'}`);
  console.log(`Match report: ${REPORT_FILE}`);
  console.log();
  console.log('Next steps:');
  if (DRY_RUN) {
    console.log('  1. Review the match report: cat scripts/match-report.json | jq \'.statistics\'');
    console.log('  2. Check sample matches look correct');
    console.log('  3. Set DRY_RUN = false in the script');
    console.log('  4. Run the script again to apply matches');
  } else {
    console.log('  1. Re-export brands to see updated model counts');
    console.log('  2. Run: node scripts/export-all-brands-models-direct.js');
    console.log('  3. Check no-brand/ folder for remaining unmatched models');
  }
  console.log();

} catch (error) {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
