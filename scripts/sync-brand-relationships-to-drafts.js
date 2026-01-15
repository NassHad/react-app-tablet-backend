const Database = require('better-sqlite3');
const path = require('path');

/**
 * Sync Brand Relationships from Published to Draft Versions
 *
 * This script copies brand relationships from published model versions
 * to their corresponding draft versions (same documentId).
 *
 * Background: Strapi v5 has separate draft and published versions.
 * Our matching scripts only updated published versions, so drafts
 * don't have brand relationships yet.
 *
 * Usage: node scripts/sync-brand-relationships-to-drafts.js
 */

// ============ CONFIGURATION ============
const DRY_RUN = false;  // Set to false to actually update database
const DB_PATH = path.join(process.cwd(), '.tmp', 'data.db');

console.log('🔄 Sync Brand Relationships to Draft Versions');
console.log('═'.repeat(80));
console.log();
console.log('Configuration:');
console.log(`  DRY RUN: ${DRY_RUN ? 'YES (no database changes)' : 'NO (will update database)'}`);
console.log(`  Database: ${DB_PATH}`);
console.log();

try {
  const db = new Database(DB_PATH, { readonly: DRY_RUN });
  console.log('✅ Database opened\n');

  // ============ STEP 1: Find models with brand in published but not in draft ============
  console.log('📦 STEP 1: Finding models needing sync');
  console.log('─'.repeat(80));
  console.log();

  const query = `
    SELECT
      published.id as published_id,
      draft.id as draft_id,
      published.document_id,
      published.name,
      published.vehicle_type,
      lnk.brand_id,
      b.name as brand_name
    FROM models published
    INNER JOIN models draft ON published.document_id = draft.document_id
    INNER JOIN models_brand_lnk lnk ON published.id = lnk.model_id
    LEFT JOIN models_brand_lnk draft_lnk ON draft.id = draft_lnk.model_id
    INNER JOIN brands b ON lnk.brand_id = b.id
    WHERE published.published_at IS NOT NULL
      AND draft.published_at IS NULL
      AND draft_lnk.id IS NULL
    ORDER BY b.name, published.name
  `;

  const modelsToSync = db.prepare(query).all();

  console.log(`Found ${modelsToSync.length} models where draft needs brand relationship\n`);

  if (modelsToSync.length === 0) {
    console.log('✅ All draft versions already have brand relationships!');
    db.close();
    process.exit(0);
  }

  // Show sample
  console.log('Sample models to sync (first 10):');
  modelsToSync.slice(0, 10).forEach((model, i) => {
    console.log(`  ${i + 1}. ${model.name} → ${model.brand_name}`);
    console.log(`     Published ID: ${model.published_id}, Draft ID: ${model.draft_id}`);
  });
  console.log();

  // Count by brand
  const countsByBrand = {};
  for (const model of modelsToSync) {
    countsByBrand[model.brand_name] = (countsByBrand[model.brand_name] || 0) + 1;
  }

  console.log('Breakdown by brand:');
  const sortedBrands = Object.entries(countsByBrand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  sortedBrands.forEach(([brand, count]) => {
    console.log(`  ${brand}: ${count} models`);
  });
  console.log();

  // ============ STEP 2: Sync relationships ============
  if (!DRY_RUN) {
    console.log('📦 STEP 2: Syncing Brand Relationships');
    console.log('─'.repeat(80));
    console.log();

    console.log(`⚠️  LIVE MODE: Will insert ${modelsToSync.length} brand relationships for draft versions`);
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
      const PROGRESS_INTERVAL = 500;

      for (const model of modelsToSync) {
        try {
          insertStmt.run(model.draft_id, model.brand_id);
          insertedCount++;

          if (insertedCount % PROGRESS_INTERVAL === 0 || insertedCount === modelsToSync.length) {
            console.log(`  Progress: ${insertedCount}/${modelsToSync.length} relationships synced...`);
          }
        } catch (error) {
          console.error(`❌ Error syncing model ${model.draft_id} "${model.name}":`, error.message);
        }
      }

      // Commit transaction
      db.prepare('COMMIT').run();
      console.log();
      console.log(`✅ Transaction committed: ${insertedCount} relationships synced\n`);

      // ============ STEP 3: VALIDATION ============
      console.log('📦 STEP 3: Validating Results');
      console.log('─'.repeat(80));
      console.log();

      // Re-count drafts without brand
      const remainingDraftsWithoutBrand = db.prepare(`
        SELECT COUNT(*) as count
        FROM models m
        LEFT JOIN models_brand_lnk lnk ON m.id = lnk.model_id
        WHERE m.published_at IS NULL
          AND lnk.brand_id IS NULL
      `).get();

      console.log('Validation results:');
      console.log(`  Relationships synced: ${insertedCount}`);
      console.log(`  Draft models without brand after sync: ${remainingDraftsWithoutBrand.count}`);
      console.log();

      // Spot-check: verify the example model
      const exampleCheck = db.prepare(`
        SELECT m.id, m.name, b.name as brand_name
        FROM models m
        INNER JOIN models_brand_lnk lnk ON m.id = lnk.model_id
        INNER JOIN brands b ON lnk.brand_id = b.id
        WHERE m.name = 'BT-50 II Pickup' AND m.published_at IS NULL
      `).get();

      if (exampleCheck) {
        console.log('✅ Spot-check passed:');
        console.log(`   Draft model "${exampleCheck.name}" (id: ${exampleCheck.id}) now has brand: ${exampleCheck.brand_name}\n`);
      } else {
        console.log('⚠️  Spot-check: Could not verify example model\n');
      }

    } catch (error) {
      // Rollback on error
      console.log();
      console.log('❌ Error during sync, rolling back transaction...');
      try {
        db.prepare('ROLLBACK').run();
        console.log('✅ Transaction rolled back\n');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError.message);
      }
      throw error;
    }
  } else {
    console.log('📦 STEP 2: Skipped (DRY_RUN mode)');
    console.log('─'.repeat(80));
    console.log();
    console.log('⚠️  DRY_RUN mode: No database changes were made');
    console.log(`   To sync ${modelsToSync.length} relationships, set DRY_RUN = false and run again\n`);
  }

  // Close database
  db.close();

  console.log('═'.repeat(80));
  console.log('✅ SCRIPT COMPLETE');
  console.log('═'.repeat(80));
  console.log();

  if (DRY_RUN) {
    console.log('Next steps:');
    console.log('  1. Review the models that need syncing above');
    console.log('  2. Set DRY_RUN = false in the script');
    console.log('  3. Run the script again to sync relationships');
    console.log();
  } else {
    console.log('Next steps:');
    console.log('  1. Test API query with draft model:');
    console.log('     http://localhost:1338/api/models?filters[name]=BT-50%20II%20Pickup&populate=*');
    console.log('  2. Verify brand now appears in the response');
    console.log();
  }

} catch (error) {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
