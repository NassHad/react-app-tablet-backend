#!/usr/bin/env node

/**
 * Comprehensive Model Deduplication Script
 *
 * This script detects and merges duplicate models in the Strapi database.
 * Duplicates occur when models have the same name with/without brand prefix.
 * Example: "145" vs "Alfa 145" vs "Alfa Romeo 145"
 *
 * Usage:
 *   Phase 1 (Detection):  node scripts/deduplicate-models.js --detect
 *   Phase 2 (Planning):   node scripts/deduplicate-models.js --plan
 *   Phase 3 (Execute):    node scripts/deduplicate-models.js --execute
 *   Phase 4 (Validate):   node scripts/deduplicate-models.js --validate
 *   Rollback:             node scripts/deduplicate-models.js --rollback --backup=<path>
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const {
  normalizeModelName,
  generateSlug,
  detectDuplicates,
  selectPrimaryModel,
  countRelationships,
  migrateRelationships,
  deleteDuplicateModels,
  validateIntegrity,
  createSnapshot,
  createBackup
} = require('./deduplicate-models-lib');

// Configuration
const CONFIG = {
  DB_PATH: path.join(process.cwd(), '.tmp', 'data.db'),
  REPORT_DIR: path.join(process.cwd(), 'scripts', 'deduplication-reports'),
  SIMILARITY_THRESHOLD: 0.90,
  MAX_TOTAL_DELETIONS: 3000,
  MAX_DUPLICATES_PER_GROUP: 10,
  RELATIONSHIP_TABLES: [
    { table: 'battery_models', column: 'model_id' },
    { table: 'lights_products', column: 'model_id' },
    { table: 'wipers_products', column: 'model_id' },
    { table: 'filter_compatibilities', column: 'model_id' }
  ]
};

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args.find(arg => arg.startsWith('--'))?.replace('--', '');
const backupArg = args.find(arg => arg.startsWith('--backup='))?.split('=')[1];

// Ensure report directory exists
if (!fs.existsSync(CONFIG.REPORT_DIR)) {
  fs.mkdirSync(CONFIG.REPORT_DIR, { recursive: true });
}

/**
 * PHASE 1: DETECTION
 * Identify all duplicate models without making changes
 */
function runDetection(db) {
  console.log('═'.repeat(70));
  console.log('PHASE 1: DUPLICATE DETECTION');
  console.log('═'.repeat(70));
  console.log();

  // Create snapshot
  console.log('📸 Creating database snapshot...');
  const snapshot = createSnapshot(db);
  console.log(`   Total models: ${snapshot.totalModels}`);
  console.log(`   Published models: ${snapshot.publishedModels}`);
  console.log(`   Total brands: ${snapshot.totalBrands}`);
  console.log();

  // Load all published models with brands
  console.log('📖 Loading models from database...');
  const modelsQuery = db.prepare(`
    SELECT m.id, m.document_id, m.name, m.slug, m.vehicle_type,
           m.is_active, m.published_at, m.created_at,
           b.id as brand_id, b.name as brand_name, b.slug as brand_slug
    FROM models m
    INNER JOIN models_brand_lnk lnk ON m.id = lnk.model_id
    INNER JOIN brands b ON lnk.brand_id = b.id
    WHERE m.published_at IS NOT NULL
    ORDER BY b.slug, m.vehicle_type, m.name
  `);

  const allModels = modelsQuery.all();
  console.log(`   Loaded ${allModels.length} models with brand relationships`);
  console.log();

  // Group models by brand + vehicle type
  console.log('🔍 Grouping models by brand and vehicle type...');
  const modelsByBrand = new Map();

  for (const model of allModels) {
    const key = `${model.brand_id}|${model.vehicle_type}`;
    if (!modelsByBrand.has(key)) {
      modelsByBrand.set(key, {
        brandId: model.brand_id,
        brandName: model.brand_name,
        brandSlug: model.brand_slug,
        vehicleType: model.vehicle_type,
        models: []
      });
    }
    modelsByBrand.get(key).models.push(model);
  }

  console.log(`   Found ${modelsByBrand.size} brand+vehicle_type combinations`);
  console.log();

  // Detect duplicates in each group
  console.log('🔎 Detecting duplicates...');
  const allDuplicateGroups = [];
  let processedGroups = 0;

  for (const [key, group] of modelsByBrand.entries()) {
    const duplicateGroups = detectDuplicates(
      group.models,
      group.brandName,
      CONFIG.SIMILARITY_THRESHOLD
    );

    for (const dupGroup of duplicateGroups) {
      allDuplicateGroups.push({
        brandId: group.brandId,
        brandName: group.brandName,
        brandSlug: group.brandSlug,
        vehicleType: group.vehicleType,
        normalizedName: dupGroup.normalizedName,
        duplicates: dupGroup.duplicates,
        count: dupGroup.count
      });
    }

    processedGroups++;
    if (processedGroups % 50 === 0) {
      console.log(`   Processed ${processedGroups}/${modelsByBrand.size} groups...`);
    }
  }

  console.log(`   ✅ Detection complete`);
  console.log();

  // Calculate statistics
  const totalDuplicates = allDuplicateGroups.reduce((sum, g) => sum + g.count, 0);
  const totalToDelete = allDuplicateGroups.reduce((sum, g) => sum + (g.count - 1), 0);
  const affectedBrands = new Set(allDuplicateGroups.map(g => g.brandId)).size;

  const byVehicleType = {};
  for (const group of allDuplicateGroups) {
    if (!byVehicleType[group.vehicleType]) {
      byVehicleType[group.vehicleType] = {
        duplicateGroups: 0,
        duplicateModels: 0
      };
    }
    byVehicleType[group.vehicleType].duplicateGroups++;
    byVehicleType[group.vehicleType].duplicateModels += group.count;
  }

  const suspiciousGroups = allDuplicateGroups.filter(
    g => g.count > CONFIG.MAX_DUPLICATES_PER_GROUP
  );

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    phase: 'DETECTION',
    snapshot,
    summary: {
      totalModels: allModels.length,
      totalBrands: snapshot.totalBrands,
      duplicateGroupsFound: allDuplicateGroups.length,
      totalDuplicateModels: totalDuplicates,
      estimatedDeletions: totalToDelete,
      affectedBrands
    },
    byVehicleType,
    suspiciousGroups: suspiciousGroups.map(g => ({
      brandName: g.brandName,
      vehicleType: g.vehicleType,
      normalizedName: g.normalizedName,
      duplicateCount: g.count,
      reason: 'Exceeds MAX_DUPLICATES_PER_GROUP'
    })),
    topDuplicatedBrands: getTopDuplicatedBrands(allDuplicateGroups, 10),
    sampleDuplicates: allDuplicateGroups.slice(0, 20).map(g => ({
      brandName: g.brandName,
      vehicleType: g.vehicleType,
      normalizedName: g.normalizedName,
      count: g.count,
      models: g.duplicates.map(m => ({
        id: m.id,
        name: m.name,
        slug: m.slug
      }))
    })),
    allDuplicateGroups: allDuplicateGroups.map(g => ({
      brandId: g.brandId,
      brandName: g.brandName,
      brandSlug: g.brandSlug,
      vehicleType: g.vehicleType,
      normalizedName: g.normalizedName,
      count: g.count,
      duplicates: g.duplicates.map(m => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        created_at: m.created_at
      }))
    }))
  };

  // Save report
  const reportPath = path.join(CONFIG.REPORT_DIR, '1-duplicate-detection.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('═'.repeat(70));
  console.log('DETECTION SUMMARY');
  console.log('═'.repeat(70));
  console.log();
  console.log(`✅ Duplicate groups found: ${allDuplicateGroups.length}`);
  console.log(`📊 Total duplicate models: ${totalDuplicates}`);
  console.log(`🗑️  Estimated deletions: ${totalToDelete}`);
  console.log(`🏷️  Affected brands: ${affectedBrands}`);
  console.log();

  if (Object.keys(byVehicleType).length > 0) {
    console.log('By vehicle type:');
    for (const [type, stats] of Object.entries(byVehicleType)) {
      console.log(`  ${type}: ${stats.duplicateGroups} groups, ${stats.duplicateModels} models`);
    }
    console.log();
  }

  if (suspiciousGroups.length > 0) {
    console.log(`⚠️  WARNING: ${suspiciousGroups.length} groups have > ${CONFIG.MAX_DUPLICATES_PER_GROUP} duplicates`);
    suspiciousGroups.slice(0, 5).forEach(g => {
      console.log(`   - ${g.brandName} "${g.normalizedName}": ${g.count} duplicates`);
    });
    console.log();
  }

  console.log(`📄 Full report saved to: ${reportPath}`);
  console.log();
  console.log('Next step: Review the report, then run with --plan');
  console.log();

  return report;
}

/**
 * PHASE 2: PLANNING
 * Create detailed merge plan with safety checks
 */
function runPlanning(db) {
  console.log('═'.repeat(70));
  console.log('PHASE 2: MERGE PLANNING');
  console.log('═'.repeat(70));
  console.log();

  // Load detection report
  const detectionReportPath = path.join(CONFIG.REPORT_DIR, '1-duplicate-detection.json');
  if (!fs.existsSync(detectionReportPath)) {
    console.error('❌ Error: Detection report not found. Run --detect first.');
    process.exit(1);
  }

  console.log('📖 Loading detection report...');
  const detectionReport = JSON.parse(fs.readFileSync(detectionReportPath, 'utf8'));
  const duplicateGroups = detectionReport.allDuplicateGroups;
  console.log(`   Loaded ${duplicateGroups.length} duplicate groups`);
  console.log();

  // Create merge plan
  console.log('📋 Creating merge plan...');
  const mergePlans = [];
  let totalRelationships = 0;

  for (const group of duplicateGroups) {
    // Reconstruct model objects for selectPrimaryModel
    const models = group.duplicates.map(d => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      created_at: d.created_at
    }));

    const { primary, toMerge } = selectPrimaryModel(
      models,
      db,
      CONFIG.RELATIONSHIP_TABLES
    );

    // Count relationships for each model
    const primaryRelations = countRelationships(db, primary.id, CONFIG.RELATIONSHIP_TABLES);
    const duplicateRelations = toMerge.map(m => ({
      id: m.id,
      ...countRelationships(db, m.id, CONFIG.RELATIONSHIP_TABLES)
    }));

    const totalRelationsToMigrate = duplicateRelations.reduce((sum, r) => sum + r.total, 0);
    totalRelationships += totalRelationsToMigrate;

    // Clean model name
    const cleanedName = normalizeModelName(primary.name, group.brandName);
    const newSlug = generateSlug(cleanedName);

    mergePlans.push({
      brandName: group.brandName,
      brandSlug: group.brandSlug,
      vehicleType: group.vehicleType,
      normalizedName: group.normalizedName,
      primary: {
        id: primary.id,
        currentName: primary.name,
        cleanedName: cleanedName,
        currentSlug: primary.slug,
        newSlug: newSlug,
        relationships: primaryRelations
      },
      toMerge: toMerge.map((m, idx) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        relationships: duplicateRelations[idx]
      })),
      relationshipsToMigrate: totalRelationsToMigrate
    });
  }

  console.log(`   ✅ Merge plan created`);
  console.log();

  // Safety validation
  console.log('🛡️  Running safety checks...');
  const validation = {
    passed: true,
    checks: [],
    warnings: [],
    errors: []
  };

  // Check 1: Total deletions limit
  const totalToDelete = mergePlans.reduce((sum, p) => sum + p.toMerge.length, 0);
  validation.checks.push({
    name: 'Total Deletions',
    value: totalToDelete,
    limit: CONFIG.MAX_TOTAL_DELETIONS,
    passed: totalToDelete <= CONFIG.MAX_TOTAL_DELETIONS
  });

  if (totalToDelete > CONFIG.MAX_TOTAL_DELETIONS) {
    validation.errors.push({
      check: 'Total Deletions',
      message: `Attempting to delete ${totalToDelete} models (limit: ${CONFIG.MAX_TOTAL_DELETIONS})`
    });
    validation.passed = false;
  }

  // Check 2: Relationship tables exist
  for (const rel of CONFIG.RELATIONSHIP_TABLES) {
    try {
      db.prepare(`SELECT COUNT(*) as count FROM ${rel.table} LIMIT 1`).get();
      validation.checks.push({
        name: `Table ${rel.table}`,
        status: 'exists',
        passed: true
      });
    } catch (error) {
      validation.errors.push({
        check: `Table ${rel.table}`,
        message: 'Table does not exist'
      });
      validation.passed = false;
    }
  }

  // Check 3: Suspicious groups
  const suspiciousPlans = mergePlans.filter(p => p.toMerge.length > CONFIG.MAX_DUPLICATES_PER_GROUP);
  if (suspiciousPlans.length > 0) {
    validation.warnings.push({
      check: 'Suspicious Groups',
      message: `${suspiciousPlans.length} groups have > ${CONFIG.MAX_DUPLICATES_PER_GROUP} duplicates`,
      groups: suspiciousPlans.map(p => ({
        brand: p.brandName,
        normalizedName: p.normalizedName,
        count: p.toMerge.length + 1
      }))
    });
  }

  console.log(`   ✅ Safety checks complete`);
  console.log();

  // Generate plan report
  const planReport = {
    timestamp: new Date().toISOString(),
    phase: 'PLANNING',
    summary: {
      totalMerges: mergePlans.length,
      totalDeletions: totalToDelete,
      totalRelationshipsToMigrate: totalRelationships
    },
    validation,
    mergePlans
  };

  // Save report
  const reportPath = path.join(CONFIG.REPORT_DIR, '2-merge-plan.json');
  fs.writeFileSync(reportPath, JSON.stringify(planReport, null, 2));

  // Print summary
  console.log('═'.repeat(70));
  console.log('PLANNING SUMMARY');
  console.log('═'.repeat(70));
  console.log();
  console.log(`✅ Total merges planned: ${mergePlans.length}`);
  console.log(`🗑️  Total deletions: ${totalToDelete}`);
  console.log(`🔗 Total relationships to migrate: ${totalRelationships}`);
  console.log();

  if (validation.warnings.length > 0) {
    console.log(`⚠️  Warnings: ${validation.warnings.length}`);
    validation.warnings.forEach(w => {
      console.log(`   - ${w.check}: ${w.message}`);
    });
    console.log();
  }

  if (validation.errors.length > 0) {
    console.log(`❌ Errors: ${validation.errors.length}`);
    validation.errors.forEach(e => {
      console.log(`   - ${e.check}: ${e.message}`);
    });
    console.log();
    console.log('⚠️  Cannot proceed with execution due to validation errors');
    console.log();
  } else {
    console.log('✅ All safety checks passed');
    console.log();
  }

  console.log(`📄 Full plan saved to: ${reportPath}`);
  console.log();

  if (validation.passed) {
    console.log('Next step: Review the plan, then run with --execute');
  } else {
    console.log('Fix validation errors before proceeding');
  }
  console.log();

  return planReport;
}

/**
 * PHASE 3: EXECUTION
 * Perform deduplication with transaction safety
 */
function runExecution(db) {
  console.log('═'.repeat(70));
  console.log('PHASE 3: EXECUTION');
  console.log('═'.repeat(70));
  console.log();

  // Load merge plan
  const planReportPath = path.join(CONFIG.REPORT_DIR, '2-merge-plan.json');
  if (!fs.existsSync(planReportPath)) {
    console.error('❌ Error: Merge plan not found. Run --plan first.');
    process.exit(1);
  }

  console.log('📖 Loading merge plan...');
  const planReport = JSON.parse(fs.readFileSync(planReportPath, 'utf8'));

  if (!planReport.validation.passed) {
    console.error('❌ Error: Merge plan has validation errors. Cannot proceed.');
    process.exit(1);
  }

  const mergePlans = planReport.mergePlans;
  console.log(`   Loaded ${mergePlans.length} merge operations`);
  console.log();

  // Create backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = CONFIG.DB_PATH + `.backup.${timestamp}`;
  console.log('💾 Creating database backup...');
  createBackup(db, backupPath);
  console.log();

  // Start transaction
  console.log('🚀 Starting transaction...');
  db.prepare('BEGIN EXCLUSIVE').run();

  const executionLog = {
    timestamp: new Date().toISOString(),
    phase: 'EXECUTION',
    backupPath,
    merges: [],
    errors: []
  };

  let completed = 0;

  try {
    // Process each merge
    for (const plan of mergePlans) {
      try {
        // 1. Update primary model name and slug
        db.prepare(`
          UPDATE models
          SET name = ?, slug = ?
          WHERE id = ?
        `).run(plan.primary.cleanedName, plan.primary.newSlug, plan.primary.id);

        // 2. Migrate relationships
        const duplicateIds = plan.toMerge.map(m => m.id);
        const migrationLog = migrateRelationships(
          db,
          plan.primary.id,
          duplicateIds,
          CONFIG.RELATIONSHIP_TABLES
        );

        // 3. Delete duplicates
        const deletionLog = deleteDuplicateModels(db, duplicateIds);

        // Record merge
        executionLog.merges.push({
          brandName: plan.brandName,
          vehicleType: plan.vehicleType,
          primaryModelId: plan.primary.id,
          primaryModelName: plan.primary.cleanedName,
          duplicateModelIds: duplicateIds,
          duplicatesDeleted: deletionLog.deletedModelIds.length,
          relationshipsMigrated: migrationLog.migrations.reduce(
            (sum, m) => sum + (m.recordsUpdated || 0), 0
          )
        });

        completed++;
        if (completed % 100 === 0) {
          console.log(`   Processed ${completed}/${mergePlans.length} merges...`);
        }

      } catch (error) {
        executionLog.errors.push({
          plan,
          error: error.message,
          stack: error.stack
        });
      }
    }

    console.log(`   ✅ All merges completed`);
    console.log();

    // Validate before commit
    console.log('🔍 Validating transaction...');
    const validation = validateIntegrity(db, CONFIG.RELATIONSHIP_TABLES);

    if (!validation.passed) {
      throw new Error('Validation failed: ' + JSON.stringify(validation.checks));
    }

    console.log(`   ✅ Validation passed`);
    console.log();

    // Commit transaction
    console.log('💾 Committing transaction...');
    db.prepare('COMMIT').run();
    console.log(`   ✅ Transaction committed`);
    console.log();

    // Create post-execution snapshot
    console.log('📸 Creating post-execution snapshot...');
    executionLog.postSnapshot = createSnapshot(db);
    console.log();

  } catch (error) {
    // Rollback on error
    console.error('❌ Error during execution:', error.message);
    console.log();
    console.log('🔄 Rolling back transaction...');

    try {
      db.prepare('ROLLBACK').run();
      console.log('   ✅ Transaction rolled back');
    } catch (rollbackError) {
      console.error('   ❌ Rollback failed:', rollbackError.message);
    }

    executionLog.errors.push({
      fatal: true,
      error: error.message,
      stack: error.stack
    });

    // Save error log
    const errorLogPath = path.join(CONFIG.REPORT_DIR, '3-execution-log-ERROR.json');
    fs.writeFileSync(errorLogPath, JSON.stringify(executionLog, null, 2));

    console.log();
    console.log(`📄 Error log saved to: ${errorLogPath}`);
    console.log(`💾 Database backup available at: ${backupPath}`);
    console.log();

    process.exit(1);
  }

  // Save execution log
  const reportPath = path.join(CONFIG.REPORT_DIR, '3-execution-log.json');
  fs.writeFileSync(reportPath, JSON.stringify(executionLog, null, 2));

  // Print summary
  console.log('═'.repeat(70));
  console.log('EXECUTION SUMMARY');
  console.log('═'.repeat(70));
  console.log();
  console.log(`✅ Total merges completed: ${executionLog.merges.length}`);
  console.log(`🗑️  Total models deleted: ${executionLog.merges.reduce((sum, m) => sum + m.duplicatesDeleted, 0)}`);
  console.log(`🔗 Total relationships migrated: ${executionLog.merges.reduce((sum, m) => sum + m.relationshipsMigrated, 0)}`);
  console.log(`❌ Errors: ${executionLog.errors.length}`);
  console.log();
  console.log(`💾 Backup saved at: ${backupPath}`);
  console.log(`📄 Execution log saved to: ${reportPath}`);
  console.log();
  console.log('Next step: Run --validate to verify results');
  console.log();

  return executionLog;
}

/**
 * PHASE 4: VALIDATION
 * Comprehensive post-execution validation
 */
function runValidation(db) {
  console.log('═'.repeat(70));
  console.log('PHASE 4: VALIDATION');
  console.log('═'.repeat(70));
  console.log();

  // Load execution log
  const executionLogPath = path.join(CONFIG.REPORT_DIR, '3-execution-log.json');
  if (!fs.existsSync(executionLogPath)) {
    console.error('❌ Error: Execution log not found. Run --execute first.');
    process.exit(1);
  }

  console.log('📖 Loading execution log...');
  const executionLog = JSON.parse(fs.readFileSync(executionLogPath, 'utf8'));
  console.log();

  // Load detection report for before snapshot
  const detectionReportPath = path.join(CONFIG.REPORT_DIR, '1-duplicate-detection.json');
  const detectionReport = JSON.parse(fs.readFileSync(detectionReportPath, 'utf8'));
  const beforeSnapshot = detectionReport.snapshot;
  const afterSnapshot = executionLog.postSnapshot;

  console.log('🔍 Running validation checks...');
  console.log();

  const validation = {
    timestamp: new Date().toISOString(),
    phase: 'VALIDATION',
    passed: true,
    checks: []
  };

  // Check 1: Model count change
  const expectedDecrease = executionLog.merges.reduce((sum, m) => sum + m.duplicatesDeleted, 0);
  const actualDecrease = beforeSnapshot.publishedModels - afterSnapshot.publishedModels;

  const countCheck = {
    name: 'Model Count Change',
    expected: expectedDecrease,
    actual: actualDecrease,
    passed: expectedDecrease === actualDecrease
  };
  validation.checks.push(countCheck);

  if (!countCheck.passed) {
    validation.passed = false;
  }

  console.log(`   ${countCheck.passed ? '✅' : '❌'} Model count: Expected -${expectedDecrease}, Actual -${actualDecrease}`);

  // Check 2: Integrity validation
  const integrityValidation = validateIntegrity(db, CONFIG.RELATIONSHIP_TABLES);
  validation.checks.push({
    name: 'Database Integrity',
    passed: integrityValidation.passed,
    details: integrityValidation.checks
  });

  console.log(`   ${integrityValidation.passed ? '✅' : '❌'} Database integrity`);

  if (!integrityValidation.passed) {
    validation.passed = false;
    integrityValidation.checks.forEach(check => {
      if (!check.passed) {
        console.log(`      ❌ ${check.name}: ${check.orphanedCount || 'failed'}`);
      }
    });
  }

  // Check 3: Spot-check samples
  console.log(`   🔍 Spot-checking ${Math.min(50, executionLog.merges.length)} samples...`);
  const sampleSize = Math.min(50, executionLog.merges.length);
  const samples = executionLog.merges.slice(0, sampleSize);
  const sampleChecks = [];

  for (const merge of samples) {
    const primaryExists = db.prepare('SELECT id FROM models WHERE id = ?').get(merge.primaryModelId);
    const duplicatesExist = merge.duplicateModelIds.map(id =>
      db.prepare('SELECT id FROM models WHERE id = ?').get(id)
    ).filter(Boolean);

    const samplePassed = !!primaryExists && duplicatesExist.length === 0;
    sampleChecks.push({
      primaryModelId: merge.primaryModelId,
      primaryExists: !!primaryExists,
      duplicatesDeleted: duplicatesExist.length === 0,
      passed: samplePassed
    });

    if (!samplePassed) {
      validation.passed = false;
    }
  }

  validation.checks.push({
    name: 'Sample Verification',
    samplesChecked: sampleChecks.length,
    passed: sampleChecks.every(s => s.passed),
    details: sampleChecks
  });

  const samplesPassed = sampleChecks.filter(s => s.passed).length;
  console.log(`      ${samplesPassed}/${sampleChecks.length} samples passed`);

  console.log();

  // Check 4: No duplicate names remain
  console.log('   🔍 Checking for remaining duplicates...');
  const remainingDuplicates = db.prepare(`
    SELECT b.name as brand_name, m.name, m.vehicle_type, COUNT(*) as count
    FROM models m
    JOIN models_brand_lnk lnk ON m.id = lnk.model_id
    JOIN brands b ON lnk.brand_id = b.id
    WHERE m.published_at IS NOT NULL
    GROUP BY b.id, m.name, m.vehicle_type
    HAVING count > 1
  `).all();

  validation.checks.push({
    name: 'No Duplicates Remain',
    remainingDuplicates: remainingDuplicates.length,
    passed: remainingDuplicates.length === 0
  });

  console.log(`      ${remainingDuplicates.length === 0 ? '✅' : '❌'} Remaining duplicates: ${remainingDuplicates.length}`);

  if (remainingDuplicates.length > 0) {
    validation.passed = false;
    console.log(`      ⚠️  Found ${remainingDuplicates.length} remaining duplicates:`);
    remainingDuplicates.slice(0, 10).forEach(dup => {
      console.log(`         - ${dup.brand_name} "${dup.name}" (${dup.vehicle_type}): ${dup.count} occurrences`);
    });
  }

  console.log();

  // Save validation report
  const reportPath = path.join(CONFIG.REPORT_DIR, '4-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(validation, null, 2));

  // Print summary
  console.log('═'.repeat(70));
  console.log('VALIDATION SUMMARY');
  console.log('═'.repeat(70));
  console.log();

  if (validation.passed) {
    console.log('✅ ALL VALIDATION CHECKS PASSED');
    console.log();
    console.log('Deduplication completed successfully!');
  } else {
    console.log('❌ VALIDATION FAILED');
    console.log();
    console.log('Some checks did not pass. Review the validation report for details.');
  }

  console.log();
  console.log('Before:');
  console.log(`  Total models: ${beforeSnapshot.publishedModels}`);
  console.log('After:');
  console.log(`  Total models: ${afterSnapshot.publishedModels}`);
  console.log(`  Models removed: ${beforeSnapshot.publishedModels - afterSnapshot.publishedModels}`);
  console.log();
  console.log(`📄 Validation report saved to: ${reportPath}`);
  console.log();

  return validation;
}

/**
 * ROLLBACK: Restore from backup
 */
function runRollback() {
  console.log('═'.repeat(70));
  console.log('ROLLBACK');
  console.log('═'.repeat(70));
  console.log();

  if (!backupArg) {
    console.error('❌ Error: Please specify backup file with --backup=<path>');
    console.log();
    console.log('Available backups:');
    const backups = fs.readdirSync(path.dirname(CONFIG.DB_PATH))
      .filter(f => f.startsWith('data.db.backup.'))
      .sort()
      .reverse();

    backups.slice(0, 10).forEach(backup => {
      const backupPath = path.join(path.dirname(CONFIG.DB_PATH), backup);
      const stats = fs.statSync(backupPath);
      console.log(`  ${backup} (${new Date(stats.mtime).toISOString()})`);
    });
    console.log();
    process.exit(1);
  }

  const backupPath = backupArg.startsWith('/') ? backupArg : path.join(process.cwd(), backupArg);

  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Error: Backup file not found: ${backupPath}`);
    process.exit(1);
  }

  console.log(`🔄 Restoring database from: ${backupPath}`);
  console.log();
  console.log('⚠️  WARNING: This will overwrite the current database!');
  console.log();

  // Copy backup to current database
  fs.copyFileSync(backupPath, CONFIG.DB_PATH);

  console.log('✅ Database restored successfully');
  console.log();
  console.log('⚠️  Please restart Strapi for changes to take effect');
  console.log();
}

/**
 * Helper: Get top duplicated brands
 */
function getTopDuplicatedBrands(duplicateGroups, limit = 10) {
  const brandCounts = {};

  for (const group of duplicateGroups) {
    if (!brandCounts[group.brandName]) {
      brandCounts[group.brandName] = {
        brandName: group.brandName,
        duplicateGroups: 0,
        duplicateModels: 0
      };
    }
    brandCounts[group.brandName].duplicateGroups++;
    brandCounts[group.brandName].duplicateModels += group.count;
  }

  return Object.values(brandCounts)
    .sort((a, b) => b.duplicateGroups - a.duplicateGroups)
    .slice(0, limit);
}

/**
 * Main execution
 */
function main() {
  console.log();
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║          MODEL DEDUPLICATION SCRIPT                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log();

  // Validate mode
  if (!mode) {
    console.error('Usage: node scripts/deduplicate-models.js [--detect|--plan|--execute|--validate|--rollback]');
    console.log();
    console.log('Phases:');
    console.log('  --detect    Identify duplicates (read-only)');
    console.log('  --plan      Create merge plan with safety checks');
    console.log('  --execute   Perform deduplication (creates backup)');
    console.log('  --validate  Verify results after execution');
    console.log('  --rollback  Restore from backup (--backup=<path>)');
    console.log();
    process.exit(1);
  }

  // Handle rollback (doesn't need DB connection)
  if (mode === 'rollback') {
    runRollback();
    return;
  }

  // Open database
  if (!fs.existsSync(CONFIG.DB_PATH)) {
    console.error(`❌ Error: Database not found at: ${CONFIG.DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(CONFIG.DB_PATH, {
    readonly: mode === 'detect' || mode === 'validate'
  });

  try {
    switch (mode) {
      case 'detect':
        runDetection(db);
        break;
      case 'plan':
        runPlanning(db);
        break;
      case 'execute':
        runExecution(db);
        break;
      case 'validate':
        runValidation(db);
        break;
      default:
        console.error(`❌ Unknown mode: ${mode}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run main
if (require.main === module) {
  main();
}

module.exports = {
  runDetection,
  runPlanning,
  runExecution,
  runValidation,
  runRollback
};
