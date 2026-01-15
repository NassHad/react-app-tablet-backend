const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Enhanced Brand Matching Script with Multiple Strategies
 *
 * This script uses multiple matching strategies to assign brands to car models:
 * 1. Exact slug match (from cleaned_models.json)
 * 2. Exact name match (from exide-vehicles-by-brand.json)
 * 3. Name-based brand detection (brand name within model name)
 * 4. Fuzzy/partial slug matching (partial similarity)
 *
 * Usage:
 *   Step 1 (DRY RUN): node scripts/match-models-to-brands-enhanced.js
 *   Step 2: Review scripts/match-report-enhanced.json
 *   Step 3 (LIVE): Set DRY_RUN=false and run again
 */

// ============ CONFIGURATION ============
const DRY_RUN = false;  // Set to false to actually update database
const BATCH_SIZE = 100; // Inserts per batch
const PROGRESS_INTERVAL = 500; // Log progress every N models

// ============ PATHS ============
const DB_PATH = path.join(process.cwd(), '.tmp', 'data.db');
const CAR_REFERENCE_PATH = path.join(process.cwd(), 'scripts', 'json_data', 'cleaned_models.json');
const EXIDE_BY_BRAND_PATH = path.join(process.cwd(), 'scripts', 'liste_affectation', 'exide-vehicles-by-brand.json');
const BRANDS_PATH = path.join(process.cwd(), 'scripts', 'exported_data', 'all-brands.json');
const REPORT_FILE = path.join(process.cwd(), 'scripts', 'match-report-enhanced.json');
const ERRORS_FILE = path.join(process.cwd(), 'scripts', 'match-errors-enhanced.json');

// ============ DATA STRUCTURES ============
const carReferenceBySlug = new Map(); // modelSlug -> brandSlug (from cleaned_models.json)
const carReferenceByName = new Map(); // modelName -> brandSlug (from cleaned_models.json)
const exideByName = new Map(); // modelName -> brandName (from exide-vehicles-by-brand.json)
const brandIdMap = new Map(); // brandSlug|vehicleType -> brandId
const brandNameMap = new Map(); // brandId -> brandName
const brandSlugByName = new Map(); // brandName (uppercase) -> brandSlug
const matches = [];
const errors = [];
const stats = {
  totalModelsToMatch: 0,
  strategy1_exactSlug: 0,
  strategy2_exactName: 0,
  strategy3_brandInName: 0,
  strategy4_fuzzySlug: 0,
  unmatched: 0,
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
    { path: EXIDE_BY_BRAND_PATH, name: 'Exide vehicles by brand' },
    { path: BRANDS_PATH, name: 'Brands data' }
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file.path)) {
      throw new Error(`${file.name} not found: ${file.path}`);
    }
  }
}

function normalizeString(str) {
  return str.trim().toLowerCase();
}

function calculateSlugSimilarity(slug1, slug2) {
  // Simple similarity: how much of slug2 is contained in slug1 or vice versa
  const s1 = normalizeString(slug1);
  const s2 = normalizeString(slug2);

  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) {
    const shorter = s1.length < s2.length ? s1 : s2;
    const longer = s1.length >= s2.length ? s1 : s2;
    return shorter.length / longer.length;
  }

  return 0;
}

// ============ MAIN SCRIPT ============
console.log('🎯 Enhanced Brand Matching (Multi-Strategy)');
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

  // Load cleaned_models.json
  console.log('Loading car reference data (cleaned_models.json)...');
  const carReference = JSON.parse(fs.readFileSync(CAR_REFERENCE_PATH, 'utf8'));
  console.log(`✅ Loaded ${carReference.length} car models from reference`);

  // Load exide-vehicles-by-brand.json
  console.log('Loading exide vehicles by brand...');
  const exideByBrand = JSON.parse(fs.readFileSync(EXIDE_BY_BRAND_PATH, 'utf8'));
  const exideBrandCount = Object.keys(exideByBrand).length;
  let exideModelCount = 0;
  for (const brand in exideByBrand) {
    exideModelCount += exideByBrand[brand].length;
  }
  console.log(`✅ Loaded ${exideBrandCount} brands with ${exideModelCount} models from exide data`);

  // Load brands data
  console.log('Loading brands data...');
  const brandsData = JSON.parse(fs.readFileSync(BRANDS_PATH, 'utf8'));
  console.log(`✅ Loaded ${brandsData.totalBrands} brands\n`);

  console.log('Building lookup maps...');

  // Build car reference maps from cleaned_models.json
  for (const model of carReference) {
    if (model.modelSlug && model.brandSlug) {
      carReferenceBySlug.set(model.modelSlug, model.brandSlug);
    }
    if (model.name && model.brandSlug) {
      carReferenceByName.set(normalizeString(model.name), model.brandSlug);
    }
  }
  console.log(`✅ Built car reference maps: ${carReferenceBySlug.size} by slug, ${carReferenceByName.size} by name`);

  // Build exide name -> brand map
  for (const brandName in exideByBrand) {
    for (const modelName of exideByBrand[brandName]) {
      exideByName.set(normalizeString(modelName), brandName);
    }
  }
  console.log(`✅ Built exide name map: ${exideByName.size} entries`);

  // Build brand ID and name maps
  for (const brand of brandsData.brands) {
    const key = `${brand.slug}|${brand.vehicle_type}`;
    brandIdMap.set(key, brand.id);
    brandNameMap.set(brand.id, brand.name);
    brandSlugByName.set(normalizeString(brand.name), brand.slug);
  }
  console.log(`✅ Built brand ID map: ${brandIdMap.size} entries`);
  console.log(`✅ Built brand name->slug map: ${brandSlugByName.size} entries\n`);

  // ============ PHASE 2: LOAD MODELS WITHOUT BRAND ============
  console.log('📦 PHASE 2: Loading Car Models Without Brand');
  console.log('─'.repeat(80));
  console.log();

  const db = new Database(DB_PATH, { readonly: DRY_RUN });
  console.log('✅ Database opened\n');

  console.log('Querying car models without brand...');
  const modelsWithoutBrand = db.prepare(`
    SELECT m.id, m.name, m.slug, m.vehicle_type
    FROM models m
    LEFT JOIN models_brand_lnk lnk ON m.id = lnk.model_id
    WHERE lnk.brand_id IS NULL
      AND m.published_at IS NOT NULL
      AND m.vehicle_type = 'car'
    ORDER BY m.slug
  `).all();

  console.log(`✅ Found ${modelsWithoutBrand.length} car models without brand\n`);
  stats.totalModelsToMatch = modelsWithoutBrand.length;

  // ============ PHASE 3: MATCH USING MULTIPLE STRATEGIES ============
  console.log('📦 PHASE 3: Matching Models Using Multiple Strategies');
  console.log('─'.repeat(80));
  console.log();

  let processedCount = 0;

  for (const model of modelsWithoutBrand) {
    processedCount++;
    let matched = false;
    let brandSlug = null;
    let brandName = null;
    let matchStrategy = null;

    // STRATEGY 1: Exact slug match from cleaned_models.json
    if (!matched && model.slug) {
      brandSlug = carReferenceBySlug.get(model.slug);
      if (brandSlug) {
        matchStrategy = 'exact_slug';
        matched = true;
        stats.strategy1_exactSlug++;
      }
    }

    // STRATEGY 2: Exact name match from exide-vehicles-by-brand.json
    if (!matched && model.name) {
      const normalizedName = normalizeString(model.name);
      brandName = exideByName.get(normalizedName);

      if (brandName) {
        // Convert brand name to slug
        brandSlug = brandSlugByName.get(normalizeString(brandName));
        if (brandSlug) {
          matchStrategy = 'exact_name_exide';
          matched = true;
          stats.strategy2_exactName++;
        }
      }
    }

    // STRATEGY 3: Brand name detection within model name
    if (!matched && model.name) {
      const modelNameLower = normalizeString(model.name);

      // Try to find a brand name within the model name
      for (const [brandNameKey, slug] of brandSlugByName.entries()) {
        // Only try brands with meaningful names (3+ chars)
        if (brandNameKey.length >= 3 && modelNameLower.includes(brandNameKey)) {
          brandSlug = slug;
          matchStrategy = 'brand_in_name';
          matched = true;
          stats.strategy3_brandInName++;
          break;
        }
      }
    }

    // STRATEGY 4: Fuzzy slug matching from cleaned_models.json
    if (!matched && model.slug) {
      let bestMatch = null;
      let bestSimilarity = 0;
      const MIN_SIMILARITY = 0.7; // At least 70% similar

      for (const [refSlug, refBrandSlug] of carReferenceBySlug.entries()) {
        const similarity = calculateSlugSimilarity(model.slug, refSlug);
        if (similarity >= MIN_SIMILARITY && similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = refBrandSlug;
        }
      }

      if (bestMatch) {
        brandSlug = bestMatch;
        matchStrategy = `fuzzy_slug_${(bestSimilarity * 100).toFixed(0)}%`;
        matched = true;
        stats.strategy4_fuzzySlug++;
      }
    }

    // If we found a match, record it
    if (matched && brandSlug) {
      // Try to find brand with vehicle_type = 'car' or 'car-moto'
      let brandKey = `${brandSlug}|car`;
      let brandId = brandIdMap.get(brandKey);

      if (!brandId) {
        // Try car-moto if exact car match not found
        brandKey = `${brandSlug}|car-moto`;
        brandId = brandIdMap.get(brandKey);
      }

      if (brandId) {
        matches.push({
          modelId: model.id,
          modelName: model.name,
          modelSlug: model.slug,
          brandId: brandId,
          brandSlug: brandSlug,
          brandName: brandNameMap.get(brandId),
          vehicleType: 'car',
          matchMethod: matchStrategy
        });
      } else {
        logError(
          new Error(`Brand slug "${brandSlug}" not found in database for car (tried 'car' and 'car-moto')`),
          `Matching model ${model.id} "${model.name}" (strategy: ${matchStrategy})`
        );
      }
    }

    // Progress logging
    if (processedCount % PROGRESS_INTERVAL === 0 || processedCount === modelsWithoutBrand.length) {
      console.log(`  Progress: ${processedCount}/${modelsWithoutBrand.length} models processed (${matches.length} matched)...`);
    }
  }

  stats.unmatched = stats.totalModelsToMatch - matches.length;

  console.log();
  console.log('✅ Matching complete!\n');

  // ============ PHASE 4: SEPARATE EXACT AND FUZZY MATCHES ============
  console.log('📦 PHASE 4: Separating Exact and Fuzzy Matches');
  console.log('─'.repeat(80));
  console.log();

  // Separate exact matches from fuzzy matches
  const exactMatches = matches.filter(m => !m.matchMethod.startsWith('fuzzy_slug'));
  const fuzzyMatches = matches.filter(m => m.matchMethod.startsWith('fuzzy_slug'));

  console.log(`Total matches: ${matches.length}`);
  console.log(`  Exact matches (will be applied): ${exactMatches.length}`);
  console.log(`  Fuzzy matches (for manual review): ${fuzzyMatches.length}\n`);

  // Save fuzzy matches to separate file for manual review
  const FUZZY_MATCHES_FILE = path.join(process.cwd(), 'scripts', 'fuzzy-matches-review.json');
  const fuzzyReport = {
    timestamp: new Date().toISOString(),
    totalFuzzyMatches: fuzzyMatches.length,
    note: 'These matches use fuzzy/partial slug matching and should be manually reviewed before applying',
    matches: fuzzyMatches.map(m => ({
      modelId: m.modelId,
      modelName: m.modelName,
      modelSlug: m.modelSlug,
      matchedToBrand: m.brandName,
      brandId: m.brandId,
      brandSlug: m.brandSlug,
      similarity: m.matchMethod,
      action: 'REVIEW_REQUIRED'
    }))
  };
  fs.writeFileSync(FUZZY_MATCHES_FILE, JSON.stringify(fuzzyReport, null, 2), 'utf8');
  console.log(`✅ Fuzzy matches saved to: ${FUZZY_MATCHES_FILE}\n`);

  // ============ PHASE 5: GENERATE MATCH REPORT (EXACT MATCHES ONLY) ============
  console.log('📦 PHASE 5: Generating Match Report');
  console.log('─'.repeat(80));
  console.log();

  // Calculate match rate (exact matches only)
  const matchRate = ((exactMatches.length / stats.totalModelsToMatch) * 100).toFixed(1);

  // Get unmatched models (including fuzzy matches since they won't be applied)
  const exactMatchedIds = new Set(exactMatches.map(m => m.modelId));
  const unmatchedModels = modelsWithoutBrand
    .filter(m => !exactMatchedIds.has(m.id))
    .map(m => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      vehicleType: m.vehicle_type
    }));

  // Count exact matches by brand
  const matchesByBrand = new Map();
  for (const match of exactMatches) {
    const key = match.brandName;
    matchesByBrand.set(key, (matchesByBrand.get(key) || 0) + 1);
  }

  // Get top brands by match count
  const topBrands = Array.from(matchesByBrand.entries())
    .map(([brand, count]) => ({ brand, modelCount: count }))
    .sort((a, b) => b.modelCount - a.modelCount)
    .slice(0, 20);

  // Count by strategy (exact matches only)
  const matchesByStrategy = new Map();
  for (const match of exactMatches) {
    const strategy = match.matchMethod;
    matchesByStrategy.set(strategy, (matchesByStrategy.get(strategy) || 0) + 1);
  }

  // Build report (exact matches only)
  const report = {
    timestamp: new Date().toISOString(),
    executionMode: DRY_RUN ? 'DRY_RUN (no database changes)' : 'LIVE (database updated)',
    note: 'This report contains only exact matches (Strategy 2 & 3). Fuzzy matches saved separately.',
    statistics: {
      totalModelsToMatch: stats.totalModelsToMatch,
      exactMatchesApplied: exactMatches.length,
      fuzzyMatchesSeparated: fuzzyMatches.length,
      totalUnmatched: unmatchedModels.length,
      matchRate: `${matchRate}%`,
      byStrategy: {
        strategy1_exactSlug: stats.strategy1_exactSlug,
        strategy2_exactNameExide: stats.strategy2_exactName,
        strategy3_brandInName: stats.strategy3_brandInName,
        strategy4_fuzzySlug_separated: stats.strategy4_fuzzySlug
      }
    },
    sampleMatchesByStrategy: {
      exactSlug: exactMatches.filter(m => m.matchMethod === 'exact_slug').slice(0, 10),
      exactNameExide: exactMatches.filter(m => m.matchMethod === 'exact_name_exide').slice(0, 10),
      brandInName: exactMatches.filter(m => m.matchMethod === 'brand_in_name').slice(0, 10)
    },
    unmatchedModelsSample: unmatchedModels.slice(0, 50),
    topBrandsByMatchCount: topBrands,
    allExactMatches: exactMatches,
    allUnmatchedModels: unmatchedModels
  };

  // Write report to file
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
  console.log(`✅ Match report written to: ${REPORT_FILE}\n`);

  // Display summary
  console.log('═'.repeat(80));
  console.log('📊 MATCH SUMMARY (EXACT MATCHES ONLY)');
  console.log('═'.repeat(80));
  console.log();
  console.log(`Total car models to match: ${stats.totalModelsToMatch}`);
  console.log(`Exact matches (will be applied): ${exactMatches.length} (${matchRate}%)`);
  console.log(`Fuzzy matches (saved for review): ${fuzzyMatches.length}`);
  console.log(`Unmatched: ${unmatchedModels.length} (${((unmatchedModels.length / stats.totalModelsToMatch) * 100).toFixed(1)}%)`);
  console.log();
  console.log('Exact Matches by Strategy:');
  console.log(`  Strategy 1 (Exact slug): ${stats.strategy1_exactSlug}`);
  console.log(`  Strategy 2 (Exact name from Exide): ${stats.strategy2_exactName}`);
  console.log(`  Strategy 3 (Brand in name): ${stats.strategy3_brandInName}`);
  console.log(`  Strategy 4 (Fuzzy slug - separated): ${stats.strategy4_fuzzySlug}`);
  console.log();

  if (topBrands.length > 0) {
    console.log('Top 20 brands by match count:');
    topBrands.forEach((brand, i) => {
      console.log(`  ${(i + 1).toString().padStart(2)}. ${brand.brand}: ${brand.modelCount} models`);
    });
    console.log();
  }

  // ============ PHASE 6: UPDATE DATABASE (EXACT MATCHES ONLY) ============
  if (!DRY_RUN && exactMatches.length > 0) {
    console.log('📦 PHASE 6: Updating Database (Exact Matches Only)');
    console.log('─'.repeat(80));
    console.log();

    console.log(`⚠️  LIVE MODE: Will insert ${exactMatches.length} brand-model relationships`);
    console.log(`   Note: ${fuzzyMatches.length} fuzzy matches saved for manual review`);
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

      for (const match of exactMatches) {
        try {
          insertStmt.run(match.modelId, match.brandId);
          insertedCount++;

          if (insertedCount % PROGRESS_INTERVAL === 0 || insertedCount === exactMatches.length) {
            console.log(`  Progress: ${insertedCount}/${exactMatches.length} relationships inserted...`);
          }
        } catch (error) {
          logError(error, `Inserting relationship for model ${match.modelId} -> brand ${match.brandId}`);
        }
      }

      // Commit transaction
      db.prepare('COMMIT').run();
      console.log();
      console.log(`✅ Transaction committed: ${insertedCount} relationships inserted\n`);

      // ============ PHASE 7: VALIDATION ============
      console.log('📦 PHASE 7: Validating Results');
      console.log('─'.repeat(80));
      console.log();

      // Re-count models without brand
      const remainingWithoutBrand = db.prepare(`
        SELECT COUNT(*) as count
        FROM models m
        LEFT JOIN models_brand_lnk lnk ON m.id = lnk.model_id
        WHERE lnk.brand_id IS NULL
          AND m.published_at IS NOT NULL
          AND m.vehicle_type = 'car'
      `).get();

      const expectedRemaining = unmatchedModels.length;

      console.log('Validation results:');
      console.log(`  Car models without brand before: ${stats.totalModelsToMatch}`);
      console.log(`  Exact matches inserted: ${insertedCount}`);
      console.log(`  Fuzzy matches separated: ${fuzzyMatches.length}`);
      console.log(`  Car models without brand after: ${remainingWithoutBrand.count}`);
      console.log(`  Expected remaining: ${expectedRemaining}`);
      console.log(`  Actual remaining: ${remainingWithoutBrand.count}`);

      if (remainingWithoutBrand.count === expectedRemaining) {
        console.log('  ✅ Validation passed!\n');
      } else {
        console.log('  ⚠️  Count mismatch detected\n');
      }

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
    console.log('📦 PHASE 6: Skipped (DRY_RUN mode)');
    console.log('─'.repeat(80));
    console.log();
    console.log('⚠️  DRY_RUN mode: No database changes were made');
    console.log(`   Exact matches ready to apply: ${exactMatches.length}`);
    console.log(`   Fuzzy matches saved for review: ${fuzzyMatches.length}`);
    console.log(`   To apply exact matches, set DRY_RUN = false and run again\n`);
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
    console.log('  1. Review the exact match report: cat scripts/match-report-enhanced.json | jq \'.statistics\'');
    console.log('  2. Review fuzzy matches: cat scripts/fuzzy-matches-review.json | jq \'.matches[:10]\'');
    console.log('  3. Set DRY_RUN = false in the script');
    console.log('  4. Run the script again to apply exact matches only');
  } else {
    console.log('  1. Re-export brands to see updated model counts');
    console.log('  2. Run: node scripts/export-all-brands-models-direct.js');
    console.log('  3. Review fuzzy matches: scripts/fuzzy-matches-review.json');
    console.log('  4. Manually verify and apply fuzzy matches if desired');
  }
  console.log();

} catch (error) {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
