const Database = require('better-sqlite3');
const path = require('path');

/**
 * Verify OSRAM Motorcycle Lights Import
 *
 * This script verifies that motorcycle lights were imported correctly
 * by checking database records and data integrity.
 *
 * Usage: node scripts/verify-moto-lights-import.js
 */

const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

async function verifyImport() {
  try {
    console.log('🔍 Verifying Motorcycle Lights Import\n');
    console.log('═══════════════════════════════════════════════\n');

    // Open database
    console.log('💾 Opening database...');
    const db = new Database(DB_PATH);
    console.log('✅ Database opened\n');

    // Count total lights products
    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM lights_products').get();
    console.log(`📊 Total lights products in database: ${totalProducts.count}\n`);

    // Count motorcycle lights products
    const motoProducts = db.prepare(`
      SELECT COUNT(*) as count
      FROM lights_products
      WHERE source = 'OSRAM Motorcycle Guide PDF'
    `).get();

    console.log(`Motorcycle Lights Products:`);
    console.log(`  Total: ${motoProducts.count}`);
    console.log(`  Expected: ~2,889\n`);

    if (motoProducts.count === 0) {
      console.log('❌ No motorcycle lights products found!');
      console.log('   Please run import-moto-lights-products.js first\n');
      db.close();
      return;
    }

    // Sample some products
    console.log('📋 Sample Products:\n');
    const sampleProducts = db.prepare(`
      SELECT
        lp.id,
        lp.name,
        lp.ref,
        lp.source,
        lp.construction_year_start as yearStart,
        lp.construction_year_end as yearEnd,
        lp.type_conception as typeConception
      FROM lights_products lp
      WHERE lp.source = 'OSRAM Motorcycle Guide PDF'
      LIMIT 5
    `).all();

    sampleProducts.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   Ref: ${p.ref}`);
      console.log(`   Years: ${p.yearStart} - ${p.yearEnd}`);
      console.log(`   Type: ${p.typeConception}`);
      console.log();
    });

    // Check brand/model relationships
    console.log('🔗 Checking Relationships:\n');

    const linkedProducts = db.prepare(`
      SELECT COUNT(DISTINCT lp.id) as count
      FROM lights_products lp
      JOIN lights_products_brand_lnk lpb ON lp.id = lpb.lights_product_id
      JOIN lights_products_model_lnk lpm ON lp.id = lpm.lights_product_id
      WHERE lp.source = 'OSRAM Motorcycle Guide PDF'
    `).get();

    console.log(`Products with brand AND model links: ${linkedProducts.count}`);
    console.log(`Products without links: ${motoProducts.count - linkedProducts.count}\n`);

    // Check vehicle types
    console.log('🏍️  Vehicle Type Verification:\n');

    const motoLinkedProducts = db.prepare(`
      SELECT COUNT(DISTINCT lp.id) as count
      FROM lights_products lp
      JOIN lights_products_model_lnk lpm ON lp.id = lpm.lights_product_id
      JOIN models m ON lpm.model_id = m.id
      WHERE lp.source = 'OSRAM Motorcycle Guide PDF'
        AND m.vehicle_type = 'moto'
    `).get();

    console.log(`Products linked to moto models: ${motoLinkedProducts.count}`);

    if (motoLinkedProducts.count < motoProducts.count) {
      const nonMotoProducts = db.prepare(`
        SELECT COUNT(DISTINCT lp.id) as count
        FROM lights_products lp
        JOIN lights_products_model_lnk lpm ON lp.id = lpm.lights_product_id
        JOIN models m ON lpm.model_id = m.id
        WHERE lp.source = 'OSRAM Motorcycle Guide PDF'
          AND m.vehicle_type != 'moto'
      `).get();

      console.log(`⚠️  Products linked to non-moto models: ${nonMotoProducts.count}\n`);
    } else {
      console.log(`✅ All products correctly linked to moto models\n`);
    }

    // Check lightPositions data
    console.log('💡 Light Positions Verification:\n');

    const productsWithPositions = db.prepare(`
      SELECT COUNT(*) as count
      FROM lights_products
      WHERE source = 'OSRAM Motorcycle Guide PDF'
        AND light_positions IS NOT NULL
        AND light_positions != '[]'
    `).get();

    console.log(`Products with light positions: ${productsWithPositions.count}`);
    console.log(`Products without positions: ${motoProducts.count - productsWithPositions.count}\n`);

    // Sample light positions
    const sampleWithPositions = db.prepare(`
      SELECT light_positions
      FROM lights_products
      WHERE source = 'OSRAM Motorcycle Guide PDF'
        AND light_positions IS NOT NULL
      LIMIT 1
    `).get();

    if (sampleWithPositions && sampleWithPositions.light_positions) {
      try {
        const positions = JSON.parse(sampleWithPositions.light_positions);
        console.log(`Sample light positions structure (${positions.length} positions):`);
        positions.slice(0, 3).forEach((pos, i) => {
          console.log(`  ${i + 1}. ${pos.position} - Ref: ${pos.ref}, Category: ${pos.category}`);
        });
        console.log();
      } catch (e) {
        console.log('⚠️  Error parsing light positions JSON\n');
      }
    }

    // Category breakdown
    console.log('📊 Category Breakdown:\n');

    const allPositions = db.prepare(`
      SELECT light_positions
      FROM lights_products
      WHERE source = 'OSRAM Motorcycle Guide PDF'
        AND light_positions IS NOT NULL
    `).all();

    const categories = new Map();
    allPositions.forEach(row => {
      try {
        const positions = JSON.parse(row.light_positions);
        positions.forEach(pos => {
          if (pos.category) {
            categories.set(pos.category, (categories.get(pos.category) || 0) + 1);
          }
        });
      } catch (e) {
        // Skip invalid JSON
      }
    });

    const sortedCategories = [...categories.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`Found ${categories.size} unique light categories:\n`);
    sortedCategories.forEach(([category, count]) => {
      console.log(`  ${category}: ${count} positions`);
    });
    console.log();

    // Brand distribution
    console.log('🏢 Brand Distribution (Top 10):\n');

    const brandStats = db.prepare(`
      SELECT b.name, COUNT(DISTINCT lp.id) as product_count
      FROM lights_products lp
      JOIN lights_products_brand_lnk lpb ON lp.id = lpb.lights_product_id
      JOIN brands b ON lpb.brand_id = b.id
      WHERE lp.source = 'OSRAM Motorcycle Guide PDF'
      GROUP BY b.id
      ORDER BY product_count DESC
      LIMIT 10
    `).all();

    brandStats.forEach((stat, i) => {
      console.log(`  ${i + 1}. ${stat.name}: ${stat.product_count} products`);
    });
    console.log();

    db.close();

    // Final summary
    console.log('═══════════════════════════════════════════════');
    console.log('📊 Verification Summary:\n');

    const successRate = linkedProducts.count / motoProducts.count * 100;
    const motoLinkRate = motoLinkedProducts.count / motoProducts.count * 100;
    const positionsRate = productsWithPositions.count / motoProducts.count * 100;

    console.log(`  Total imported: ${motoProducts.count} / ~2,889 expected`);
    console.log(`  Linked to brands/models: ${successRate.toFixed(1)}%`);
    console.log(`  Linked to moto models: ${motoLinkRate.toFixed(1)}%`);
    console.log(`  With light positions: ${positionsRate.toFixed(1)}%`);
    console.log(`  Unique categories: ${categories.size}/12 expected\n`);

    if (motoProducts.count >= 2800 &&
        successRate >= 95 &&
        motoLinkRate >= 95 &&
        positionsRate >= 95 &&
        categories.size >= 10) {
      console.log('✅ Import verification PASSED!');
      console.log('   All quality checks met expectations\n');
    } else {
      console.log('⚠️  Import verification has WARNINGS:');
      if (motoProducts.count < 2800) {
        console.log(`   - Fewer products than expected (${motoProducts.count} < 2,800)`);
      }
      if (successRate < 95) {
        console.log(`   - Low relationship linkage rate (${successRate.toFixed(1)}% < 95%)`);
      }
      if (motoLinkRate < 95) {
        console.log(`   - Some products not linked to moto models (${motoLinkRate.toFixed(1)}%)`);
      }
      if (positionsRate < 95) {
        console.log(`   - Some products missing light positions (${positionsRate.toFixed(1)}%)`);
      }
      if (categories.size < 10) {
        console.log(`   - Fewer categories than expected (${categories.size} < 10)`);
      }
      console.log();
    }

    console.log('═══════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run verification
verifyImport();
