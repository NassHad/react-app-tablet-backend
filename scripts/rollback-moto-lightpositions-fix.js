/**
 * Rollback Moto LightPositions Fix
 *
 * Restores original lightPositions data from backup JSON file
 * Use this if you need to revert the "_moto" suffix removal
 *
 * Usage: Copy and paste this ENTIRE script into Strapi console
 * OR run: node scripts/rollback-moto-lightpositions-fix.js
 *
 * IMPORTANT: You need to specify the backup file path before running
 */

(async () => {
  const fs = require('fs');
  const path = require('path');

  // ============ CONFIGURATION ============
  const DRY_RUN = true;  // Set to false to actually rollback
  const BACKUP_FILE = ''; // REQUIRED: Set to backup file path (e.g., 'backups/lights-products-moto-backup-1234567890.json')
  const BATCH_SIZE = 100;
  const DELAY_MS = 100;

  console.log('🔄 Rollback Moto LightPositions Fix');
  console.log('═══════════════════════════════════════════════\n');
  console.log(`Mode: ${DRY_RUN ? '🧪 DRY-RUN' : '⚡ LIVE ROLLBACK'}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Delay: ${DELAY_MS}ms\n`);

  try {
    // ============ STEP 1: VALIDATE BACKUP FILE ============
    if (!BACKUP_FILE) {
      console.error('❌ ERROR: BACKUP_FILE is required!');
      console.log('\nPlease set BACKUP_FILE to the path of your backup JSON file:');
      console.log('Example: const BACKUP_FILE = "backups/lights-products-moto-backup-1704484800000.json";\n');

      // List available backup files
      const backupDir = path.join(__dirname, 'backups');
      if (fs.existsSync(backupDir)) {
        const backupFiles = fs.readdirSync(backupDir)
          .filter(f => f.startsWith('lights-products-moto-backup-') && f.endsWith('.json'))
          .sort()
          .reverse();

        if (backupFiles.length > 0) {
          console.log('📁 Available backup files:\n');
          backupFiles.slice(0, 10).forEach((file, i) => {
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            const date = new Date(stats.mtime).toLocaleString();
            console.log(`  ${i + 1}. ${file}`);
            console.log(`     Created: ${date}\n`);
          });
        }
      }

      return;
    }

    const backupPath = path.isAbsolute(BACKUP_FILE)
      ? BACKUP_FILE
      : path.join(__dirname, BACKUP_FILE);

    if (!fs.existsSync(backupPath)) {
      console.error(`❌ ERROR: Backup file not found: ${backupPath}\n`);
      return;
    }

    console.log(`📦 Reading backup file: ${path.basename(backupPath)}`);

    // ============ STEP 2: LOAD BACKUP DATA ============
    let backupData;
    try {
      const fileContent = fs.readFileSync(backupPath, 'utf8');
      backupData = JSON.parse(fileContent);
    } catch (error) {
      console.error(`❌ ERROR: Failed to read/parse backup file: ${error.message}\n`);
      return;
    }

    if (!Array.isArray(backupData)) {
      console.error('❌ ERROR: Backup data is not an array\n');
      return;
    }

    console.log(`✅ Loaded ${backupData.length} products from backup\n`);

    if (backupData.length === 0) {
      console.log('⚠️ Backup file is empty. Nothing to restore.\n');
      return;
    }

    // ============ STEP 3: RESTORE IN BATCHES ============
    console.log('🔄 Starting rollback process...\n');

    let processedCount = 0;
    let restoredCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    const errors = [];

    // Process in batches
    for (let i = 0; i < backupData.length; i += BATCH_SIZE) {
      const batch = backupData.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(backupData.length / BATCH_SIZE);

      console.log(`🔧 Batch ${batchNumber}/${totalBatches} (Products ${i + 1}-${Math.min(i + BATCH_SIZE, backupData.length)})`);

      for (const backupProduct of batch) {
        try {
          // Verify product exists
          const currentProduct = await strapi.entityService.findOne(
            'api::lights-product.lights-product',
            backupProduct.id,
            {
              fields: ['id', 'name', 'lightPositions']
            }
          );

          if (!currentProduct) {
            notFoundCount++;
            errors.push({
              productId: backupProduct.id,
              productName: backupProduct.name,
              error: 'Product not found in database'
            });
            continue;
          }

          // Check if lightPositions are different
          const currentJson = JSON.stringify(currentProduct.lightPositions);
          const backupJson = JSON.stringify(backupProduct.lightPositions);

          if (currentJson === backupJson) {
            skippedCount++;
            continue;
          }

          // Restore lightPositions (if not dry-run)
          if (!DRY_RUN) {
            await strapi.entityService.update(
              'api::lights-product.lights-product',
              backupProduct.id,
              {
                data: { lightPositions: backupProduct.lightPositions }
              }
            );
          }

          restoredCount++;

        } catch (error) {
          errors.push({
            productId: backupProduct.id,
            productName: backupProduct.name,
            error: error.message
          });
        }
      }

      processedCount += batch.length;

      console.log(`  ✅ Processed: ${batch.length}`);
      console.log(`  🔄 ${DRY_RUN ? 'Would restore' : 'Restored'}: ${restoredCount}`);
      console.log(`  ⏭️  Skipped (no changes): ${skippedCount}`);
      console.log(`  ❌ Errors: ${errors.length}`);

      // Delay between batches
      if (i + BATCH_SIZE < backupData.length) {
        console.log(`⏳ Waiting ${DELAY_MS}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    // ============ STEP 4: SUMMARY ============
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 Rollback Summary:\n');
    console.log(`  Total products in backup: ${backupData.length}`);
    console.log(`  Products processed: ${processedCount}`);
    console.log(`  ${DRY_RUN ? 'Would restore' : 'Restored'}: ${restoredCount}`);
    console.log(`  Skipped (no changes): ${skippedCount}`);
    console.log(`  Not found: ${notFoundCount}`);
    console.log(`  Errors: ${errors.length}\n`);

    if (errors.length > 0) {
      console.log('❌ Errors:\n');
      errors.slice(0, 10).forEach((err, i) => {
        console.log(`  ${i + 1}. Product ${err.productId} (${err.productName})`);
        console.log(`     Error: ${err.error}\n`);
      });

      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors\n`);
      }
    }

    console.log('═══════════════════════════════════════════════\n');

    if (DRY_RUN) {
      console.log('🧪 DRY-RUN COMPLETE');
      console.log('ℹ️  No changes were made. Set DRY_RUN = false to apply rollback.\n');
    } else {
      console.log('✅ ROLLBACK COMPLETE');
      console.log('ℹ️  Original lightPositions data has been restored.\n');
      console.log('🔍 Run the verification script to confirm:\n');
      console.log('   node scripts/verify-moto-lightpositions-fix.js\n');
    }

  } catch (error) {
    console.error('\n❌ Rollback failed:', error.message);
    console.error(error.stack);
  }
})();
