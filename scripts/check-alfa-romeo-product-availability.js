// Product Availability Checker for Alfa Romeo
// Checks all product categories for every Alfa Romeo model
// Run with: node scripts/check-alfa-romeo-product-availability.js

const fs = require('fs');
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

// Global API call logger
const apiCalls = [];

// Helper to log API calls
function logApiCall(collection, filters, resultsCount) {
  apiCalls.push({
    query: `GET ${collection}`,
    filters: filters,
    timestamp: new Date().toISOString(),
    resultsCount: resultsCount
  });
}

// Main function
async function checkAlfaRomeoAvailability(strapiApp) {
  const startTime = Date.now();
  console.log('🚀 Starting Alfa Romeo Product Availability Check...\n');

  const results = {
    metadata: {
      timestamp: new Date().toISOString(),
      brand: 'ALFA ROMEO',
      brandId: null,
      brandSlug: null,
      totalModelsChecked: 0,
      scriptVersion: '1.0.0',
      apiCalls: []
    },
    summary: {
      modelsWithAllProducts: 0,
      modelsWithMissingProducts: 0,
      categories: {
        lights: { modelsWithProducts: 0, modelsMissing: 0 },
        wipers: { modelsWithProducts: 0, modelsMissing: 0 },
        battery: { modelsWithProducts: 0, modelsMissing: 0, totalVariantsChecked: 0 },
        oilFilters: { modelsWithProducts: 0, modelsMissing: 0, totalVariantsChecked: 0 },
        airFilters: { modelsWithProducts: 0, modelsMissing: 0, totalVariantsChecked: 0 },
        dieselFilters: { modelsWithProducts: 0, modelsMissing: 0, totalVariantsChecked: 0 },
        cabinFilters: { modelsWithProducts: 0, modelsMissing: 0, totalVariantsChecked: 0 }
      }
    },
    models: []
  };

  try {
    // Step 1: Find Alfa Romeo brand
    console.log('🔍 Step 1: Finding Alfa Romeo brand...');
    const brandFilters = {
      $or: [
        { slug: { $eq: 'alfa-romeo' } },
        { name: { $containsi: 'alfa' } }
      ]
    };

    const brands = await strapiApp.entityService.findMany('api::brand.brand', {
      filters: brandFilters,
      limit: 1
    });
    logApiCall('api::brand.brand', brandFilters, brands?.length || 0);

    if (!brands || brands.length === 0) {
      console.error('❌ Alfa Romeo brand not found!');
      return;
    }

    const brand = brands[0];
    results.metadata.brandId = brand.id;
    results.metadata.brandSlug = brand.slug;
    console.log(`✅ Found brand: ${brand.name} (ID: ${brand.id}, Slug: ${brand.slug})\n`);

    // Step 2: Get all active models
    console.log('🔍 Step 2: Getting all active models...');
    const modelFilters = {
      brand: { id: brand.id },
      isActive: true
    };

    const models = await strapiApp.entityService.findMany('api::model.model', {
      filters: modelFilters,
      populate: { brand: true }
    });
    logApiCall('api::model.model', modelFilters, models?.length || 0);

    if (!models || models.length === 0) {
      console.error('❌ No active models found for Alfa Romeo!');
      return;
    }

    console.log(`✅ Found ${models.length} active models\n`);
    results.metadata.totalModelsChecked = models.length;

    // Step 3: Check products for each model
    console.log('🔍 Step 3: Checking products for each model...\n');
    console.log('='.repeat(60));

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      console.log(`\n[${i + 1}/${models.length}] Checking: ${model.name} (${model.slug})`);
      console.log('-'.repeat(60));

      const modelResult = {
        modelId: model.id,
        modelName: model.name,
        modelSlug: model.slug,
        overallStatus: 'complete',
        categories: {}
      };

      // Check each category
      modelResult.categories.lights = await checkLightsProducts(strapiApp, brand.id, model.id);
      modelResult.categories.wipers = await checkWipersProducts(strapiApp, brand.id, model.id);
      modelResult.categories.battery = await checkBatteryProducts(strapiApp, brand.slug, model.slug);
      modelResult.categories.oilFilters = await checkFilterProducts(strapiApp, brand.id, model.id, brand.name, model.name, 'oil');
      modelResult.categories.airFilters = await checkFilterProducts(strapiApp, brand.id, model.id, brand.name, model.name, 'air');
      modelResult.categories.dieselFilters = await checkFilterProducts(strapiApp, brand.id, model.id, brand.name, model.name, 'diesel');
      modelResult.categories.cabinFilters = await checkFilterProducts(strapiApp, brand.id, model.id, brand.name, model.name, 'cabin');

      // Determine overall status
      const statuses = Object.values(modelResult.categories).map(c => c.status);
      if (statuses.includes('missing')) {
        modelResult.overallStatus = 'partial';
      } else if (statuses.includes('partial')) {
        modelResult.overallStatus = 'partial';
      }

      results.models.push(modelResult);

      // Update summary
      if (modelResult.overallStatus === 'complete') {
        results.summary.modelsWithAllProducts++;
      } else {
        results.summary.modelsWithMissingProducts++;
      }

      // Update category summaries
      Object.keys(modelResult.categories).forEach(category => {
        const catResult = modelResult.categories[category];
        if (catResult.status === 'found' || catResult.status === 'partial') {
          results.summary.categories[category].modelsWithProducts++;
        } else {
          results.summary.categories[category].modelsMissing++;
        }

        // Add variant counts for battery and filters
        if (catResult.totalVariants !== undefined) {
          results.summary.categories[category].totalVariantsChecked += catResult.totalVariants;
        }
      });
    }

    // Step 4: Add API calls to metadata
    results.metadata.apiCalls = apiCalls;

    // Step 5: Write results to file
    const outputPath = path.join(__dirname, 'alfa-romeo-availability-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    // Print summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(60));
    console.log('✅ ANALYSIS COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n📊 SUMMARY:`);
    console.log(`  Total models checked: ${results.metadata.totalModelsChecked}`);
    console.log(`  Models with all products: ${results.summary.modelsWithAllProducts}`);
    console.log(`  Models with missing products: ${results.summary.modelsWithMissingProducts}`);
    console.log(`\n📋 CATEGORY BREAKDOWN:`);
    Object.keys(results.summary.categories).forEach(cat => {
      const data = results.summary.categories[cat];
      console.log(`  ${cat.padEnd(15)}: ${data.modelsWithProducts} found / ${data.modelsMissing} missing`);
    });
    console.log(`\n⏱️  Duration: ${duration}s`);
    console.log(`📁 Report saved to: ${outputPath}`);
    console.log(`📊 Total API calls made: ${apiCalls.length}\n`);

  } catch (error) {
    console.error('❌ Error during analysis:', error);
    throw error;
  }
}

// Check lights products for a model
async function checkLightsProducts(strapiApp, brandId, modelId) {
  const filters = {
    brand: { id: brandId },
    model: { id: modelId },
    isActive: true
  };

  const products = await strapiApp.entityService.findMany('api::lights-product.lights-product', {
    filters: filters,
    populate: { brand: true, model: true, img: true }
  });

  const apiCallDesc = `api::lights-product.lights-product WHERE brand.id=${brandId} AND model.id=${modelId}`;
  logApiCall(apiCallDesc, filters, products?.length || 0);

  const productsArray = products || [];
  console.log(`  Lights: ${productsArray.length > 0 ? '✅' : '❌'} ${productsArray.length} products`);

  return {
    status: productsArray.length > 0 ? 'found' : 'missing',
    apiCall: apiCallDesc,
    productsCount: productsArray.length,
    products: productsArray.map(p => ({
      id: p.id,
      name: p.name,
      ref: p.ref
    }))
  };
}

// Check wipers products for a model
async function checkWipersProducts(strapiApp, brandId, modelId) {
  const filters = {
    brand: { id: brandId },
    model: { id: modelId },
    isActive: true
  };

  const products = await strapiApp.entityService.findMany('api::wipers-product.wipers-product', {
    filters: filters,
    populate: { brand: true, model: true }
  });

  const apiCallDesc = `api::wipers-product.wipers-product WHERE brand.id=${brandId} AND model.id=${modelId}`;
  logApiCall(apiCallDesc, filters, products?.length || 0);

  const productsArray = products || [];
  console.log(`  Wipers: ${productsArray.length > 0 ? '✅' : '❌'} ${productsArray.length} products`);

  return {
    status: productsArray.length > 0 ? 'found' : 'missing',
    apiCall: apiCallDesc,
    productsCount: productsArray.length,
    products: productsArray.map(p => ({
      id: p.id,
      name: p.name,
      ref: p.ref,
      positions: p.wipersPositions
    }))
  };
}

// Check battery products and variants for a model
async function checkBatteryProducts(strapiApp, brandSlug, modelSlug) {
  const filters = {
    brandSlug: brandSlug,
    modelSlug: modelSlug,
    isActive: true
  };

  const products = await strapiApp.entityService.findMany('api::battery-product.battery-product', {
    filters: filters,
    populate: { img: true }
  });

  const apiCallDesc = `api::battery-product.battery-product WHERE brandSlug=${brandSlug} AND modelSlug=${modelSlug}`;
  logApiCall(apiCallDesc, filters, products?.length || 0);

  const productsArray = products || [];

  if (productsArray.length === 0) {
    console.log(`  Battery: ❌ 0 products`);
    return {
      status: 'missing',
      apiCall: apiCallDesc,
      totalVariants: 0,
      variantsWithProducts: 0,
      variantsMissing: 0,
      variants: {}
    };
  }

  // Extract all unique motorisations
  const variantsMap = {};
  productsArray.forEach(product => {
    const motorisations = product.motorisations || [];
    motorisations.forEach(motor => {
      const motorName = motor.motorisation;
      if (motorName) {
        if (!variantsMap[motorName]) {
          variantsMap[motorName] = {
            found: true,
            batteryTypes: new Set(),
            products: []
          };
        }
        // Track battery types
        if (motor.batteryAGM) variantsMap[motorName].batteryTypes.add('AGM');
        if (motor.batteryEFB) variantsMap[motorName].batteryTypes.add('EFB');
        if (motor.batteryConventional) variantsMap[motorName].batteryTypes.add('Conventional');

        variantsMap[motorName].products.push({
          id: product.id,
          name: product.name
        });
      }
    });
  });

  // Convert Sets to Arrays
  Object.keys(variantsMap).forEach(variant => {
    variantsMap[variant].batteryTypes = Array.from(variantsMap[variant].batteryTypes);
  });

  const totalVariants = Object.keys(variantsMap).length;
  console.log(`  Battery: ✅ ${productsArray.length} products, ${totalVariants} variants`);

  return {
    status: 'found',
    apiCall: apiCallDesc,
    totalVariants: totalVariants,
    variantsWithProducts: totalVariants,
    variantsMissing: 0,
    variants: variantsMap
  };
}

// Check filter products for a model
async function checkFilterProducts(strapiApp, brandId, modelId, brandName, modelName, filterType) {
  // Step 1: Get filter compatibility records
  const compatFilters = {
    brand: { id: brandId },
    model: { id: modelId }
  };

  const compatibilities = await strapiApp.entityService.findMany('api::filter-compatibility.filter-compatibility', {
    filters: compatFilters,
    populate: { brand: true, model: true }
  });

  const compatApiCall = `api::filter-compatibility.filter-compatibility WHERE brand.id=${brandId} AND model.id=${modelId}`;
  logApiCall(compatApiCall, compatFilters, compatibilities?.length || 0);

  const compatArray = compatibilities || [];

  if (compatArray.length === 0) {
    console.log(`  ${filterType} filters: ❌ No compatibility data`);
    return {
      status: 'missing',
      apiCalls: [compatApiCall],
      totalVariants: 0,
      variantsWithProducts: 0,
      variants: {}
    };
  }

  // Step 2: Extract variants and check products for this filter type
  const variantsMap = {};
  const filterService = strapiApp.service('api::filter-compatibility.filter-compatibility');

  for (const compat of compatArray) {
    const variantKey = `${compat.vehicleModel || modelName} - ${compat.engineCode || 'Unknown'}`;
    const filters = compat.filters || {};
    const filterRefs = filters[filterType] || [];

    if (filterRefs.length === 0) {
      // No filter refs for this type in this variant
      continue;
    }

    const products = [];
    const missingRefs = [];

    for (const refObj of filterRefs) {
      const ref = refObj.ref;

      // Use the smart matching service
      const matchedProducts = await filterService.findProductByReference(ref, filterType);

      const productApiCall = `api::filter-product.filter-product WHERE reference MATCH '${ref}' AND filterType='${filterType}'`;
      logApiCall(productApiCall, { ref, filterType }, matchedProducts?.length || 0);

      if (matchedProducts && matchedProducts.length > 0) {
        const activeProducts = matchedProducts.filter(p => p.isActive);
        activeProducts.forEach(p => {
          products.push({
            id: p.id,
            reference: p.reference,
            fullName: p.fullName || `${p.brand} ${p.reference}`,
            matchedFrom: ref
          });
        });
      } else {
        missingRefs.push({
          ref: ref,
          notes: refObj.notes || []
        });
      }
    }

    variantsMap[variantKey] = {
      found: products.length > 0,
      compatibilityRefs: filterRefs.map(r => r.ref),
      products: products,
      missingRefs: missingRefs.length > 0 ? missingRefs : undefined,
      reason: products.length === 0 ? 'Compatibility exists but no matching product in catalog' : undefined
    };
  }

  const totalVariants = Object.keys(variantsMap).length;
  const variantsWithProducts = Object.values(variantsMap).filter(v => v.found).length;
  const variantsMissing = totalVariants - variantsWithProducts;

  let status = 'missing';
  if (variantsWithProducts === totalVariants && totalVariants > 0) {
    status = 'found';
  } else if (variantsWithProducts > 0) {
    status = 'partial';
  }

  const icon = status === 'found' ? '✅' : (status === 'partial' ? '⚠️' : '❌');
  console.log(`  ${filterType} filters: ${icon} ${variantsWithProducts}/${totalVariants} variants`);

  return {
    status: status,
    apiCalls: [compatApiCall],
    totalVariants: totalVariants,
    variantsWithProducts: variantsWithProducts,
    variantsMissing: variantsMissing,
    variants: variantsMap
  };
}

// Bootstrap and run script
async function main() {
  let app;

  try {
    console.log('🔧 Bootstrapping Strapi...\n');
    app = await createStrapi();
    await app.load();

    console.log('✅ Strapi loaded successfully\n');

    await checkAlfaRomeoAvailability(app);

    console.log('\n✅ Script completed successfully');
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    if (app) {
      await app.destroy();
    }
  }
}

// Run if executed as script
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Error:', err);
      process.exit(1);
    });
}

// Export for use in Strapi console
module.exports = { checkAlfaRomeoAvailability };
