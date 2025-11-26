const { createStrapi } = require('@strapi/strapi');

async function diagnoseProductData(brandSlug, modelSlug) {
  let app;

  try {
    console.log('\n🚀 Starting Strapi...\n');
    app = await createStrapi();
    await app.load();

    console.log(`\n🔍 Diagnosing product data for: ${brandSlug} / ${modelSlug}\n`);
    console.log('='.repeat(60));

    // Step 1: Check brand
    console.log('\n📋 Step 1: Checking Brand...');
    const brands = await app.entityService.findMany('api::brand.brand', {
      filters: { slug: brandSlug },
      limit: 1
    });

    if (!brands || brands.length === 0) {
      console.error(`\n❌ Brand not found for slug: "${brandSlug}"`);
      console.log('\nTip: Check the brands table for the correct slug');
      process.exit(1);
    }

    const brand = brands[0];
    console.log('✅ Brand found:', {
      id: brand.id,
      name: brand.name,
      slug: brand.slug
    });

    // Step 2: Check model
    console.log('\n📋 Step 2: Checking Model...');
    const models = await app.entityService.findMany('api::model.model', {
      filters: {
        slug: modelSlug,
        brand: { id: brand.id }
      },
      populate: { brand: true },
      limit: 1
    });

    if (!models || models.length === 0) {
      console.error(`\n❌ Model not found for slug: "${modelSlug}" with brand ID: ${brand.id}`);
      console.log('\nTip: Check if the model exists and is linked to the correct brand');

      // Try to find the model without brand filter
      const anyModel = await app.entityService.findMany('api::model.model', {
        filters: { slug: modelSlug },
        populate: { brand: true },
        limit: 5
      });

      if (anyModel && anyModel.length > 0) {
        console.log('\n⚠️  Found model(s) with this slug but different brand:');
        anyModel.forEach(m => console.log(`  - ID: ${m.id}, Name: ${m.name}, Brand: ${m.brand?.name || 'N/A'} (ID: ${m.brand?.id || 'N/A'})`));
      }

      process.exit(1);
    }

    const model = models[0];
    console.log('✅ Model found:', {
      id: model.id,
      name: model.name,
      slug: model.slug,
      brand: model.brand?.name
    });

    // Step 3: Check lights products
    console.log('\n📋 Step 3: Checking Lights Products...');
    const lights = await app.entityService.findMany('api::lights-product.lights-product', {
      filters: {
        brand: { id: brand.id },
        model: { id: model.id }
      },
      populate: {
        brand: true,
        model: true
      }
    });

    console.log(`\n${lights.length > 0 ? '✅' : '❌'} Lights products: ${lights.length} found`);
    if (lights.length > 0) {
      lights.forEach(p => console.log(`  - [${p.isActive ? 'ACTIVE' : 'INACTIVE'}] ${p.ref}: ${p.name}`));
    } else {
      console.log('  No lights products found for this vehicle combination');
    }

    // Check for active vs inactive
    const activeLights = lights.filter(p => p.isActive);
    const inactiveLights = lights.filter(p => !p.isActive);
    if (inactiveLights.length > 0) {
      console.log(`\n⚠️  Warning: ${inactiveLights.length} inactive lights products found`);
    }
    console.log(`\n📊 Active lights: ${activeLights.length} / ${lights.length} total`);

    // Step 4: Check wipers products
    console.log('\n📋 Step 4: Checking Wipers Products...');
    const wipers = await app.entityService.findMany('api::wipers-product.wipers-product', {
      filters: {
        brand: { id: brand.id },
        model: { id: model.id }
      },
      populate: {
        brand: true,
        model: true
      }
    });

    console.log(`\n${wipers.length > 0 ? '✅' : '❌'} Wipers products: ${wipers.length} found`);
    if (wipers.length > 0) {
      wipers.forEach(p => console.log(`  - [${p.isActive ? 'ACTIVE' : 'INACTIVE'}] ${p.ref}: ${p.name}`));
    } else {
      console.log('  No wipers products found for this vehicle combination');
    }

    // Check for active vs inactive
    const activeWipers = wipers.filter(p => p.isActive);
    const inactiveWipers = wipers.filter(p => !p.isActive);
    if (inactiveWipers.length > 0) {
      console.log(`\n⚠️  Warning: ${inactiveWipers.length} inactive wipers products found`);
    }
    console.log(`\n📊 Active wipers: ${activeWipers.length} / ${wipers.length} total`);

    // Step 5: Summary
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
        console.log('  - No active lights products found. Check if products need to be imported or activated.');
      }
      if (activeWipers.length === 0) {
        console.log('  - No active wipers products found. Check if products need to be imported or activated.');
      }
    } else {
      console.log('\n✅ All products found successfully!');
    }

    console.log('\n' + '='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Error during diagnosis:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    if (app) {
      await app.destroy();
    }
  }
}

const [brandSlug, modelSlug] = process.argv.slice(2);
if (!brandSlug || !modelSlug) {
  console.error('\n❌ Usage: node scripts/diagnose-product-data.js <brandSlug> <modelSlug>');
  console.error('\nExample:');
  console.error('  node scripts/diagnose-product-data.js alfa-romeo 155\n');
  process.exit(1);
}

diagnoseProductData(brandSlug, modelSlug);
