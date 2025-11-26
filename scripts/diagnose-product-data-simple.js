const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../.tmp/data.db');

function query(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function diagnoseProductData(brandSlug, modelSlug) {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('❌ Error opening database:', err.message);
      process.exit(1);
    }
  });

  try {
    console.log('\n🔍 Diagnosing product data for:', brandSlug, '/', modelSlug);
    console.log('=' .repeat(60));

    // Step 1: Find brand
    console.log('\n📋 Step 1: Checking Brand...');
    const brands = await query(db, 'SELECT * FROM brands WHERE slug = ?', [brandSlug]);

    if (brands.length === 0) {
      console.error(`\n❌ Brand not found for slug: "${brandSlug}"`);
      console.log('\nTip: Check the brands table for the correct slug');
      db.close();
      process.exit(1);
    }

    const brand = brands[0];
    console.log('✅ Brand found:', {
      id: brand.id,
      name: brand.name,
      slug: brand.slug
    });

    // Step 2: Find model
    console.log('\n📋 Step 2: Checking Model...');
    const models = await query(db,
      `SELECT m.*, b.name as brand_name
       FROM models m
       LEFT JOIN models_brand_lnk mbl ON m.id = mbl.model_id
       LEFT JOIN brands b ON mbl.brand_id = b.id
       WHERE m.slug = ? AND mbl.brand_id = ?`,
      [modelSlug, brand.id]
    );

    if (models.length === 0) {
      console.error(`\n❌ Model not found for slug: "${modelSlug}" with brand ID: ${brand.id}`);
      console.log('\nTip: Check if the model exists and is linked to the correct brand');

      // Try to find model without brand filter
      const anyModel = await query(db,
        `SELECT m.*, b.name as brand_name, b.id as brand_id
         FROM models m
         LEFT JOIN models_brand_lnk mbl ON m.id = mbl.model_id
         LEFT JOIN brands b ON mbl.brand_id = b.id
         WHERE m.slug = ?
         LIMIT 5`,
        [modelSlug]
      );

      if (anyModel.length > 0) {
        console.log('\n⚠️  Found model(s) with this slug but different brand:');
        anyModel.forEach(m => console.log(`  - ID: ${m.id}, Name: ${m.name}, Brand: ${m.brand_name || 'N/A'} (ID: ${m.brand_id || 'N/A'})`));
      }

      db.close();
      process.exit(1);
    }

    const model = models[0];
    console.log('✅ Model found:', {
      id: model.id,
      name: model.name,
      slug: model.slug,
      brand: model.brand_name
    });

    // Step 3: Check lights products
    console.log('\n📋 Step 3: Checking Lights Products...');
    const lights = await query(db,
      `SELECT lp.*, b.name as brand_name, m.name as model_name
       FROM lights_products lp
       LEFT JOIN lights_products_brand_lnk lpbl ON lp.id = lpbl.lights_product_id
       LEFT JOIN brands b ON lpbl.brand_id = b.id
       LEFT JOIN lights_products_model_lnk lpml ON lp.id = lpml.lights_product_id
       LEFT JOIN models m ON lpml.model_id = m.id
       WHERE lpbl.brand_id = ? AND lpml.model_id = ?`,
      [brand.id, model.id]
    );

    console.log(`\n${lights.length > 0 ? '✅' : '❌'} Lights products: ${lights.length} found`);
    if (lights.length > 0) {
      lights.forEach(p => console.log(`  - [${p.is_active ? 'ACTIVE' : 'INACTIVE'}] ${p.ref}: ${p.name}`));
    } else {
      console.log('  No lights products found for this vehicle combination');
    }

    const activeLights = lights.filter(p => p.is_active);
    const inactiveLights = lights.filter(p => !p.is_active);
    if (inactiveLights.length > 0) {
      console.log(`\n⚠️  Warning: ${inactiveLights.length} inactive lights products found`);
    }
    console.log(`\n📊 Active lights: ${activeLights.length} / ${lights.length} total`);

    // Step 4: Check wipers products
    console.log('\n📋 Step 4: Checking Wipers Products...');
    const wipers = await query(db,
      `SELECT wp.*, b.name as brand_name, m.name as model_name
       FROM wipers_products wp
       LEFT JOIN wipers_products_brand_lnk wpbl ON wp.id = wpbl.wipers_product_id
       LEFT JOIN brands b ON wpbl.brand_id = b.id
       LEFT JOIN wipers_products_model_lnk wpml ON wp.id = wpml.wipers_product_id
       LEFT JOIN models m ON wpml.model_id = m.id
       WHERE wpbl.brand_id = ? AND wpml.model_id = ?`,
      [brand.id, model.id]
    );

    console.log(`\n${wipers.length > 0 ? '✅' : '❌'} Wipers products: ${wipers.length} found`);
    if (wipers.length > 0) {
      wipers.forEach(p => console.log(`  - [${p.is_active ? 'ACTIVE' : 'INACTIVE'}] ${p.ref}: ${p.name}`));
    } else {
      console.log('  No wipers products found for this vehicle combination');
    }

    const activeWipers = wipers.filter(p => p.is_active);
    const inactiveWipers = wipers.filter(p => !p.is_active);
    if (inactiveWipers.length > 0) {
      console.log(`\n⚠️  Warning: ${inactiveWipers.length} inactive wipers products found`);
    }
    console.log(`\n📊 Active wipers: ${activeWipers.length} / ${wipers.length} total`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 SUMMARY\n');
    console.log(`Brand: ${brand.name} (ID: ${brand.id}, slug: ${brand.slug})`);
    console.log(`Model: ${model.name} (ID: ${model.id}, slug: ${model.slug})`);
    console.log(`\nProducts found:`);
    console.log(`  Lights: ${activeLights.length} active (${lights.length} total)`);
    console.log(`  Wipers: ${activeWipers.length} active (${wipers.length} total)`);

    if (activeLights.length === 0 || activeWipers.length === 0) {
      console.log('\n⚠️  ACTION NEEDED:');
      if (activeLights.length === 0) {
        console.log('  - No active lights products found. Products may need to be imported or activated.');
      }
      if (activeWipers.length === 0) {
        console.log('  - No active wipers products found. Products may need to be imported or activated.');
      }
    } else {
      console.log('\n✅ All products found successfully!');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    db.close();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    db.close();
    process.exit(1);
  }
}

const [brandSlug, modelSlug] = process.argv.slice(2);
if (!brandSlug || !modelSlug) {
  console.error('\n❌ Usage: node scripts/diagnose-product-data-simple.js <brandSlug> <modelSlug>');
  console.error('\nExample:');
  console.error('  node scripts/diagnose-product-data-simple.js alfa-romeo 155\n');
  process.exit(1);
}

diagnoseProductData(brandSlug, modelSlug);
