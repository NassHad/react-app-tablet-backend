/**
 * Verify Moto LightPositions Fix
 *
 * Verifies that no "_moto" suffixes remain in lightPositions categories
 * for motorcycle products after running the fix script
 *
 * Usage: Copy and paste this ENTIRE script into Strapi console
 * OR run: node scripts/verify-moto-lightpositions-fix.js
 */

(async () => {
  console.log('🔍 Verifying Motorcycle LightPositions Categories');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // ============ STEP 1: COUNT MOTO PRODUCTS ============
    console.log('📊 Counting motorcycle products...');

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

    // ============ STEP 2: FETCH AND VERIFY ============
    console.log('🔎 Checking for remaining "_moto" suffixes...\n');

    let page = 1;
    const pageSize = 100;
    let processedCount = 0;
    let remainingSuffixes = 0;
    const productsWithSuffixes = [];
    const categoryCount = new Map();

    while (processedCount < totalCount) {
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
          pagination: { page, pageSize },
          fields: ['id', 'documentId', 'name', 'lightPositions']
        }
      );

      if (products.length === 0) break;

      // Check each product
      for (const product of products) {
        if (!Array.isArray(product.lightPositions)) continue;

        const suffixesInProduct = [];

        product.lightPositions.forEach(pos => {
          if (pos.category && typeof pos.category === 'string' && pos.category.endsWith('_moto')) {
            remainingSuffixes++;
            suffixesInProduct.push(pos.category);

            // Count category occurrences
            categoryCount.set(pos.category, (categoryCount.get(pos.category) || 0) + 1);
          }
        });

        if (suffixesInProduct.length > 0) {
          productsWithSuffixes.push({
            id: product.id,
            name: product.name,
            brand: product.brand?.name,
            model: product.model?.name,
            categories: suffixesInProduct
          });
        }
      }

      processedCount += products.length;
      page++;

      // Progress update
      if (processedCount % 500 === 0 || processedCount === totalCount) {
        console.log(`Progress: ${processedCount}/${totalCount} products checked...`);
      }
    }

    // ============ STEP 3: REPORT RESULTS ============
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 Verification Results:\n');
    console.log(`  Total motorcycle products: ${totalCount}`);
    console.log(`  Products checked: ${processedCount}`);
    console.log(`  Products with "_moto" suffixes: ${productsWithSuffixes.length}`);
    console.log(`  Total "_moto" occurrences: ${remainingSuffixes}\n`);

    if (remainingSuffixes === 0) {
      console.log('✅ VERIFICATION PASSED');
      console.log('   No "_moto" suffixes found in any motorcycle product!\n');
    } else {
      console.log('❌ VERIFICATION FAILED');
      console.log(`   Found ${remainingSuffixes} instances of "_moto" suffix\n`);

      // Show category breakdown
      if (categoryCount.size > 0) {
        console.log('🔢 Remaining "_moto" Categories:\n');
        const sortedCategories = [...categoryCount.entries()].sort((a, b) => b[1] - a[1]);
        sortedCategories.forEach(([category, count]) => {
          console.log(`  ${category}: ${count} occurrences`);
        });
        console.log();
      }

      // Show affected products
      console.log('⚠️ Affected Products:\n');
      productsWithSuffixes.slice(0, 20).forEach((product, i) => {
        console.log(`  ${i + 1}. Product ${product.id}: ${product.name}`);
        if (product.brand) console.log(`     Brand: ${product.brand}`);
        if (product.model) console.log(`     Model: ${product.model}`);
        console.log(`     Categories: ${product.categories.join(', ')}\n`);
      });

      if (productsWithSuffixes.length > 20) {
        console.log(`  ... and ${productsWithSuffixes.length - 20} more products\n`);
      }

      console.log('💡 Recommendation:');
      console.log('   Run the fix script again with DRY_RUN = false\n');
    }

    console.log('═══════════════════════════════════════════════\n');

    // ============ STEP 4: ADDITIONAL CHECKS ============
    console.log('🔍 Additional Validation Checks:\n');

    // Check if any car products have "_moto" suffix (shouldn't happen)
    const carProductsWithMotoSuffix = [];
    let carPage = 1;
    let carProcessed = 0;

    // Get car products count
    const carCount = await strapi.db.query('api::lights-product.lights-product').count({
      where: {
        $and: [
          {
            $or: [
              { brand: { vehicle_type: 'car' } },
              { model: { vehicle_type: 'car' } }
            ]
          },
          {
            $not: {
              $or: [
                { brand: { vehicle_type: 'moto' } },
                { model: { vehicle_type: 'moto' } }
              ]
            }
          }
        ]
      }
    });

    console.log(`Checking ${carCount} car products for accidental "_moto" suffixes...`);

    while (carProcessed < Math.min(carCount, 1000)) { // Check first 1000 car products
      const carProducts = await strapi.entityService.findMany(
        'api::lights-product.lights-product',
        {
          filters: {
            $and: [
              {
                $or: [
                  { brand: { vehicle_type: 'car' } },
                  { model: { vehicle_type: 'car' } }
                ]
              },
              {
                $not: {
                  $or: [
                    { brand: { vehicle_type: 'moto' } },
                    { model: { vehicle_type: 'moto' } }
                  ]
                }
              }
            ]
          },
          pagination: { page: carPage, pageSize: 100 },
          fields: ['id', 'name', 'lightPositions']
        }
      );

      if (carProducts.length === 0) break;

      carProducts.forEach(product => {
        if (!Array.isArray(product.lightPositions)) return;

        const hasMotoSuffix = product.lightPositions.some(pos =>
          pos.category && typeof pos.category === 'string' && pos.category.endsWith('_moto')
        );

        if (hasMotoSuffix) {
          carProductsWithMotoSuffix.push({
            id: product.id,
            name: product.name
          });
        }
      });

      carProcessed += carProducts.length;
      carPage++;
    }

    if (carProductsWithMotoSuffix.length === 0) {
      console.log('✅ No car products have "_moto" suffixes (correct)\n');
    } else {
      console.log(`⚠️ Found ${carProductsWithMotoSuffix.length} car products with "_moto" suffixes (unexpected):\n`);
      carProductsWithMotoSuffix.slice(0, 5).forEach((product, i) => {
        console.log(`  ${i + 1}. Product ${product.id}: ${product.name}`);
      });
      console.log();
    }

    console.log('═══════════════════════════════════════════════\n');

    // Final verdict
    if (remainingSuffixes === 0 && carProductsWithMotoSuffix.length === 0) {
      console.log('🎉 ALL CHECKS PASSED!');
      console.log('   The fix was applied successfully.\n');
    } else {
      console.log('⚠️ ISSUES FOUND - Please review the results above.\n');
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
  }
})();
