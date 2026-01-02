const fs = require('fs');
const path = require('path');

/**
 * Extract motorcycle brands and models from osram-moto-lamps.json
 * Creates structured JSON files similar to final_brands.json and cleaned_models.json
 */

const MOTO_LAMPS_FILE = path.join(__dirname, 'liste_affectation', 'osram-moto-lamps.json');
const CAR_BRANDS_FILE = path.join(__dirname, 'json_data', 'final_brands.json');
const OUTPUT_BRANDS_FILE = path.join(__dirname, 'json_data', 'moto_brands.json');
const OUTPUT_MODELS_FILE = path.join(__dirname, 'json_data', 'moto_models.json');

// Starting IDs
const BRAND_START_ID = 71;   // After 70 car brands
const MODEL_START_ID = 2361; // After 2360 car models

/**
 * Check if slug is corrupted (LED data)
 */
function isCorrupted(slug) {
  return slug === 'led' || slug === 'led-led-led-led';
}

/**
 * Extract unique brands from motorcycle lamps data
 */
function extractBrands(motoLamps, carBrandSlugs) {
  const brandsMap = new Map();
  let excludedCount = 0;

  motoLamps.forEach(lamp => {
    const brandSlug = lamp.brandSlug;
    const brandName = lamp.originalBrand;

    // Skip corrupted data
    if (isCorrupted(brandSlug)) {
      excludedCount++;
      return;
    }

    // Only keep first occurrence (deduplication)
    if (!brandsMap.has(brandSlug)) {
      brandsMap.set(brandSlug, {
        slug: brandSlug,
        name: brandName
      });
    }
  });

  // Convert to array and assign IDs
  const brands = [];
  let brandId = BRAND_START_ID;

  // Sort by slug alphabetically
  const sortedSlugs = Array.from(brandsMap.keys()).sort();

  sortedSlugs.forEach(slug => {
    const brand = brandsMap.get(slug);

    // Determine vehicleType
    const vehicleType = carBrandSlugs.has(slug) ? 'car-moto' : 'moto';

    brands.push({
      id: brandId++,
      name: brand.name,
      slug: brand.slug,
      isActive: true,
      vehicleType: vehicleType
    });
  });

  console.log(`\n📊 Brands extraction:`);
  console.log(`   ✅ Unique brands found: ${brands.length}`);
  console.log(`   ❌ Corrupted brands excluded: ${excludedCount}`);

  // Count by vehicleType
  const carMotoCount = brands.filter(b => b.vehicleType === 'car-moto').length;
  const motoOnlyCount = brands.filter(b => b.vehicleType === 'moto').length;
  console.log(`   🔀 car-moto brands: ${carMotoCount}`);
  console.log(`   🏍️  moto-only brands: ${motoOnlyCount}`);

  // Show car-moto brands
  const carMotoBrands = brands.filter(b => b.vehicleType === 'car-moto');
  if (carMotoBrands.length > 0) {
    console.log(`\n   🔀 Brands existing in both cars and motos:`);
    carMotoBrands.forEach(b => {
      console.log(`      - ${b.name} (${b.slug})`);
    });
  }

  return brands;
}

/**
 * Extract unique models from motorcycle lamps data
 */
function extractModels(motoLamps) {
  const modelsMap = new Map();
  let excludedCount = 0;

  motoLamps.forEach(lamp => {
    const brandSlug = lamp.brandSlug;
    const modelSlug = lamp.modelSlug;
    const modelName = lamp.originalModel;

    // Skip corrupted data
    if (isCorrupted(brandSlug)) {
      excludedCount++;
      return;
    }

    // Create unique key
    const key = `${brandSlug}|||${modelSlug}`;

    // Only keep first occurrence (deduplication)
    if (!modelsMap.has(key)) {
      modelsMap.set(key, {
        brandSlug: brandSlug,
        modelSlug: modelSlug,
        name: modelName
      });
    }
  });

  // Convert to array and assign IDs
  const models = [];
  let modelId = MODEL_START_ID;

  // Sort by brandSlug then modelSlug
  const sortedKeys = Array.from(modelsMap.keys()).sort((a, b) => {
    const [brandA, modelA] = a.split('|||');
    const [brandB, modelB] = b.split('|||');

    if (brandA !== brandB) {
      return brandA.localeCompare(brandB);
    }
    return modelA.localeCompare(modelB);
  });

  sortedKeys.forEach(key => {
    const model = modelsMap.get(key);

    models.push({
      id: modelId++,
      name: model.name,
      brandSlug: model.brandSlug,
      modelSlug: model.modelSlug
    });
  });

  console.log(`\n📊 Models extraction:`);
  console.log(`   ✅ Unique models found: ${models.length}`);
  console.log(`   ❌ Corrupted models excluded: ${excludedCount}`);

  // Count models per brand (top 10)
  const modelsPerBrand = {};
  models.forEach(m => {
    modelsPerBrand[m.brandSlug] = (modelsPerBrand[m.brandSlug] || 0) + 1;
  });

  const topBrands = Object.entries(modelsPerBrand)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);

  console.log(`\n   📈 Top 10 brands by model count:`);
  topBrands.forEach(([brand, count]) => {
    console.log(`      ${brand}: ${count} models`);
  });

  return models;
}

/**
 * Main extraction function
 */
function extractMotoBrandsModels() {
  console.log('🏍️  Starting motorcycle brands and models extraction...\n');
  console.log(`📁 Reading: ${MOTO_LAMPS_FILE}`);
  console.log(`📁 Reading: ${CAR_BRANDS_FILE}\n`);

  try {
    // Load data
    const motoLamps = JSON.parse(fs.readFileSync(MOTO_LAMPS_FILE, 'utf-8'));
    const carBrands = JSON.parse(fs.readFileSync(CAR_BRANDS_FILE, 'utf-8'));

    console.log(`📊 Input data:`);
    console.log(`   Motorcycle lamp entries: ${motoLamps.length}`);
    console.log(`   Car brands loaded: ${carBrands.length}`);

    // Create set of car brand slugs for comparison
    const carBrandSlugs = new Set(carBrands.map(b => b.slug));

    // Extract brands
    const brands = extractBrands(motoLamps, carBrandSlugs);

    // Extract models
    const models = extractModels(motoLamps);

    // Write output files
    console.log(`\n📝 Writing output files...`);

    fs.writeFileSync(
      OUTPUT_BRANDS_FILE,
      JSON.stringify(brands, null, 2),
      'utf-8'
    );
    console.log(`   ✅ Created: ${OUTPUT_BRANDS_FILE} (${brands.length} brands)`);

    fs.writeFileSync(
      OUTPUT_MODELS_FILE,
      JSON.stringify(models, null, 2),
      'utf-8'
    );
    console.log(`   ✅ Created: ${OUTPUT_MODELS_FILE} (${models.length} models)`);

    // Summary
    console.log(`\n✨ Extraction completed successfully!`);
    console.log(`\n📈 Summary:`);
    console.log(`   🏷️  Total brands: ${brands.length}`);
    console.log(`   📦 Total models: ${models.length}`);
    console.log(`   🔀 Mixed brands (car+moto): ${brands.filter(b => b.vehicleType === 'car-moto').length}`);
    console.log(`   🏍️  Moto-only brands: ${brands.filter(b => b.vehicleType === 'moto').length}`);

  } catch (error) {
    console.error('\n💥 Extraction failed:', error.message);
    throw error;
  }
}

// Run extraction
if (require.main === module) {
  try {
    extractMotoBrandsModels();
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  }
}

module.exports = { extractMotoBrandsModels };
