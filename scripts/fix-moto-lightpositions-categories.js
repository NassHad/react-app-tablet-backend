/**
 * Fix Motorcycle LightPositions Categories
 *
 * Removes "_moto" suffix from category values in lightPositions
 * for all motorcycle products (where brand or model vehicle_type = "moto")
 *
 * Usage: Copy and paste this ENTIRE script into Strapi console
 *
 * Example transformations:
 * - "feu_croisement_moto" → "feu_croisement"
 * - "feu_route_moto" → "feu_route"
 * - "clignotant_arriere_moto" → "clignotant_arriere"
 */

// ============ HELPER FUNCTIONS ============

/**
 * Removes "_moto" suffix from category string
 * @param {string} category - Category value
 * @returns {string} Category without "_moto" suffix
 */
function removeMotoSuffix(category) {
  if (typeof category !== 'string') return category;
  return category.endsWith('_moto') ? category.slice(0, -5) : category;
}

/**
 * Transforms lightPositions array by removing "_moto" suffix from categories
 * @param {Array} lightPositions - Array of light position objects
 * @returns {Object} Object with transformed array, hasChanges flag, and changes array
 */
function transformLightPositions(lightPositions) {
  if (!Array.isArray(lightPositions)) {
    return { transformed: lightPositions, hasChanges: false, changes: [] };
  }

  let hasChanges = false;
  const changes = [];

  const transformed = lightPositions.map(position => {
    const originalCategory = position.category;
    const newCategory = removeMotoSuffix(originalCategory);

    if (originalCategory !== newCategory) {
      hasChanges = true;
      changes.push({ from: originalCategory, to: newCategory });
    }

    return {
      ...position,
      category: newCategory
    };
  });

  return { transformed, hasChanges, changes };
}

// ============ MAIN SCRIPT ============

(async () => {
  const fs = require('fs');
  const path = require('path');

  // ============ CONFIGURATION ============
  const DRY_RUN = false;  // Set to false to actually update
  const BATCH_SIZE = 100;
  const DELAY_MS = 100;
  const CREATE_BACKUP = false;  // Set to false to skip backup (saves memory)

  console.log('🔧 Fix Motorcycle LightPositions Categories');
  console.log('═══════════════════════════════════════════════\n');
  console.log(`Mode: ${DRY_RUN ? '🧪 DRY-RUN' : '⚡ LIVE UPDATE'}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Delay: ${DELAY_MS}ms\n`);

  try {
    // ============ STEP 1: BACKUP ============
    if (CREATE_BACKUP && !DRY_RUN) {
      console.log('📦 Creating backup...');
      const backupDir = path.join(process.cwd(), 'scripts', 'backups');

      // Create backups directory if it doesn't exist
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const backupPath = path.join(backupDir, `lights-products-moto-backup-${Date.now()}.json`);

      // Fetch all moto products to backup
      const productsToBackup = [];
      let backupPage = 1;
      let hasMoreToBackup = true;

      while (hasMoreToBackup) {
        const batch = await strapi.entityService.findMany(
          'api::lights-product.lights-product',
          {
            filters: {
              $or: [
                { brand: { vehicle_type: 'moto' } },
                { model: { vehicle_type: 'moto' } }
              ]
            },
            pagination: { page: backupPage, pageSize: 1000 }
          }
        );

        if (batch.length === 0) {
          hasMoreToBackup = false;
        } else {
          productsToBackup.push(...batch);
          backupPage++;
        }
      }

      fs.writeFileSync(backupPath, JSON.stringify(productsToBackup, null, 2));
      console.log(`✅ Backup created: ${backupPath}`);
      console.log(`   Backed up ${productsToBackup.length} products\n`);
    }

    // ============ STEP 2: COUNT TOTAL ============
    console.log('📊 Counting motorcycle products...');

    // Use db.query to count (more reliable than entityService.count)
    const totalCount = await strapi.db.query('api::lights-product.lights-product').count({
      where: {
        $or: [
          { brand: { vehicle_type: 'moto' } },
          { model: { vehicle_type: 'moto' } }
        ]
      }
    });

    console.log(`Found ${totalCount} motorcycle products\n`);

    if (totalCount === 0) {
      console.log('⚠️ No motorcycle products found. Exiting...\n');
      return;
    }

    // ============ STEP 3: PROCESS IN BATCHES ============
    let page = 1;
    let processedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];
    const categoryStats = new Map();

    while (processedCount < totalCount) {
      // Query batch
      const products = await strapi.entityService.findMany(
        'api::lights-product.lights-product',
        {
          filters: {
            $or: [
              { brand: { vehicle_type: 'moto' } },
              { model: { vehicle_type: 'moto' } }
            ]
          },
          populate: {
            brand: { fields: ['id', 'name', 'vehicle_type'] },
            model: { fields: ['id', 'name', 'vehicle_type'] }
          },
          pagination: { page, pageSize: BATCH_SIZE },
          fields: ['id', 'documentId', 'name', 'lightPositions']
        }
      );

      if (products.length === 0) break;

      console.log(`\n🔧 Batch ${page} (Products ${processedCount + 1}-${processedCount + products.length})`);

      // Process batch
      for (const product of products) {
        try {
          const result = transformLightPositions(product.lightPositions);

          if (!result.hasChanges) {
            skippedCount++;
            continue;
          }

          // Track category transformations
          result.changes.forEach(change => {
            const key = `${change.from} → ${change.to}`;
            categoryStats.set(key, (categoryStats.get(key) || 0) + 1);
          });

          // Update product (if not dry-run)
          if (!DRY_RUN) {
            await strapi.entityService.update(
              'api::lights-product.lights-product',
              product.id,
              {
                data: { lightPositions: result.transformed }
              }
            );
          }

          updatedCount++;

        } catch (error) {
          errors.push({
            productId: product.id,
            productName: product.name,
            brandName: product.brand?.name,
            modelName: product.model?.name,
            error: error.message
          });
        }
      }

      console.log(`  ✅ Analyzed: ${products.length}`);
      console.log(`  📝 ${DRY_RUN ? 'Would update' : 'Updated'}: ${updatedCount - (processedCount > 0 ? updatedCount - products.filter(p => transformLightPositions(p.lightPositions).hasChanges).length : 0)}`);
      console.log(`  ⏭️  Skipped: ${skippedCount}`);
      console.log(`  ❌ Errors: ${errors.length}`);

      processedCount += products.length;
      page++;

      // Delay between batches
      if (processedCount < totalCount) {
        console.log(`⏳ Waiting ${DELAY_MS}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    // ============ STEP 4: SUMMARY ============
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 Final Summary:\n');
    console.log(`  Total products processed: ${processedCount}`);
    console.log(`  ${DRY_RUN ? 'Would update' : 'Updated'}: ${updatedCount}`);
    console.log(`  Skipped (no changes): ${skippedCount}`);
    console.log(`  Errors: ${errors.length}\n`);

    if (categoryStats.size > 0) {
      console.log('🔄 Category Transformations:\n');
      const sortedStats = [...categoryStats.entries()].sort((a, b) => b[1] - a[1]);
      sortedStats.forEach(([transformation, count]) => {
        console.log(`  ${transformation}: ${count} occurrences`);
      });
      console.log();
    }

    if (errors.length > 0) {
      console.log('❌ Errors:\n');
      errors.slice(0, 10).forEach((err, i) => {
        console.log(`  ${i + 1}. Product ${err.productId} (${err.productName})`);
        if (err.brandName) console.log(`     Brand: ${err.brandName}`);
        if (err.modelName) console.log(`     Model: ${err.modelName}`);
        console.log(`     Error: ${err.error}\n`);
      });

      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors\n`);
      }
    }

    console.log('═══════════════════════════════════════════════\n');

    if (DRY_RUN) {
      console.log('🧪 DRY-RUN COMPLETE');
      console.log('ℹ️  No changes were made. Set DRY_RUN = false to apply updates.\n');
    } else {
      console.log('✅ UPDATE COMPLETE');
      console.log('ℹ️  All motorcycle product categories have been updated.\n');
      console.log('🔍 Run the verification script to confirm:\n');
      console.log('   node scripts/verify-moto-lightpositions-fix.js\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
  }
})();
