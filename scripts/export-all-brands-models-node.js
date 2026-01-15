/**
 * Export All Brands & Models to JSON Files
 *
 * Node.js standalone script that connects to Strapi and exports data
 *
 * Usage: node scripts/export-all-brands-models-node.js
 */

const fs = require('fs');
const path = require('path');

// ============ CONFIGURATION ============
const DRY_RUN = false;  // Set to true to test without writing files
const PAGE_SIZE = 1000;  // Database query pagination
const BATCH_SIZE = 1000;  // Models per no-brand file
const PARALLEL_WRITES = 10;  // Concurrent brand file writes
const LOG_PROGRESS_EVERY = 10;  // Log progress every N brands

const OUTPUT_DIR = 'exported_data';
const BASE_DIR = process.cwd();
const EXPORT_DIR = path.join(BASE_DIR, 'scripts', OUTPUT_DIR);
const BRANDS_DIR = path.join(EXPORT_DIR, 'brands');
const NO_BRAND_DIR = path.join(EXPORT_DIR, 'no-brand');

// ============ BOOTSTRAP STRAPI ============
async function bootstrapStrapi() {
  // Import Strapi's factory
  const strapiFactory = require('@strapi/strapi');

  // Create and load Strapi instance
  const appContext = await strapiFactory.createStrapi({
    distDir: './dist',
    autoReload: false,
    serveAdminPanel: false
  }).load();

  return appContext;
}

// ============ HELPER FUNCTIONS ============
function sanitizeSlug(slug, id) {
  let sanitized = slug.replace(/[^a-z0-9-_]/g, '-');
  return sanitized || `brand-${id}`;
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function createDirectories() {
  if (DRY_RUN) {
    console.log('📁 [DRY-RUN] Would create directories:\n');
    console.log(`   - ${EXPORT_DIR}`);
    console.log(`   - ${BRANDS_DIR}`);
    console.log(`   - ${NO_BRAND_DIR}\n`);
    return;
  }

  try {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    fs.mkdirSync(BRANDS_DIR, { recursive: true });
    fs.mkdirSync(NO_BRAND_DIR, { recursive: true });
    console.log('📁 Created directory structure\n');
  } catch (error) {
    console.error('❌ Failed to create directories:', error.message);
    throw error;
  }
}

function writeJsonFile(filePath, data, errors) {
  if (DRY_RUN) {
    console.log(`   [DRY-RUN] Would write: ${path.relative(BASE_DIR, filePath)}`);
    return;
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`   ✅ Exported: ${path.relative(EXPORT_DIR, filePath)}`);
  } catch (error) {
    errors.push({
      phase: 'file-write',
      file: filePath,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    console.error(`   ❌ Failed to write ${path.relative(EXPORT_DIR, filePath)}:`, error.message);
  }
}

// ============ MAIN EXPORT FUNCTION ============
async function exportData(strapi) {
  console.log('🎯 Export All Brands & Models to JSON');
  console.log('═'.repeat(60));
  console.log('\nConfiguration:');
  console.log(`  DRY RUN: ${DRY_RUN ? 'Yes (no files will be written)' : 'No'}`);
  console.log(`  Output Directory: ${EXPORT_DIR}`);
  console.log(`  Page Size: ${PAGE_SIZE}`);
  console.log(`  Batch Size (no-brand): ${BATCH_SIZE}`);
  console.log(`  Parallel Writes: ${PARALLEL_WRITES}\n`);
  console.log('═'.repeat(60) + '\n');

  const startTime = Date.now();
  const stats = {
    totalBrands: 0,
    totalModels: 0,
    modelsWithBrand: 0,
    modelsWithoutBrand: 0,
    byVehicleType: { car: 0, moto: 0, unknown: 0 },
    noBrandByType: { car: 0, moto: 0, unknown: 0 },
    filesCreated: {
      allBrands: null,
      brandFiles: [],
      noBrandFiles: [],
      summary: null
    }
  };
  const errors = [];
  const warnings = [];

  try {
    createDirectories();

    // ============ PHASE 1: EXPORT ALL BRANDS ============
    console.log('📦 PHASE 1: Exporting All Brands');
    console.log('─'.repeat(60) + '\n');

    console.log('🔍 Querying brands from database...');
    const allBrands = [];
    let brandPage = 1;

    while (true) {
      const brands = await strapi.entityService.findMany('api::brand.brand', {
        fields: ['id', 'name', 'slug', 'vehicle_type', 'isActive'],
        pagination: { page: brandPage, pageSize: PAGE_SIZE }
      });

      if (brands.length === 0) break;

      allBrands.push(...brands);
      brandPage++;
    }

    console.log(`✅ Found ${allBrands.length} brands\n`);
    stats.totalBrands = allBrands.length;

    // Count models for each brand
    console.log('📊 Calculating model counts...');
    let processedBrands = 0;

    for (const brand of allBrands) {
      try {
        const modelCount = await strapi.db.query('api::model.model').count({
          where: { brand: brand.id }
        });

        brand.modelCount = modelCount;
        processedBrands++;

        if (processedBrands % 20 === 0 || processedBrands === allBrands.length) {
          console.log(`  Progress: ${processedBrands}/${allBrands.length} brands processed...`);
        }
      } catch (error) {
        errors.push({
          phase: 'count-models',
          brand: brand.name,
          brandId: brand.id,
          error: error.message
        });
        brand.modelCount = 0;
      }
    }

    console.log('✅ Counted models for all brands\n');

    // Write all-brands.json
    console.log('💾 Writing all-brands.json...');
    const allBrandsData = {
      exportDate: new Date().toISOString(),
      totalBrands: allBrands.length,
      brands: allBrands.map(b => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        vehicle_type: b.vehicle_type,
        isActive: b.isActive,
        modelCount: b.modelCount
      }))
    };

    const allBrandsPath = path.join(EXPORT_DIR, 'all-brands.json');
    writeJsonFile(allBrandsPath, allBrandsData, errors);
    stats.filesCreated.allBrands = path.relative(BASE_DIR, allBrandsPath);

    console.log('═'.repeat(60) + '\n');

    // ============ PHASE 2: EXPORT MODELS BY BRAND ============
    console.log('📦 PHASE 2: Exporting Models by Brand');
    console.log('─'.repeat(60) + '\n');

    const usedSlugs = new Map();
    let brandsWithZeroModels = 0;

    const brandBatches = chunk(allBrands, PARALLEL_WRITES);

    for (const batch of brandBatches) {
      await Promise.all(batch.map(async (brand) => {
        try {
          const currentIndex = allBrands.indexOf(brand) + 1;

          // Query all models for this brand
          const brandModels = [];
          let modelPage = 1;

          while (true) {
            const models = await strapi.entityService.findMany('api::model.model', {
              filters: { brand: { id: brand.id } },
              fields: ['id', 'name', 'slug', 'vehicle_type', 'isActive'],
              pagination: { page: modelPage, pageSize: PAGE_SIZE }
            });

            if (models.length === 0) break;

            brandModels.push(...models);
            modelPage++;
          }

          // Track statistics
          stats.modelsWithBrand += brandModels.length;
          brandModels.forEach(model => {
            const vType = model.vehicle_type || 'unknown';
            stats.byVehicleType[vType] = (stats.byVehicleType[vType] || 0) + 1;
          });

          if (brandModels.length === 0) {
            brandsWithZeroModels++;
            warnings.push({
              type: 'zero-models',
              brand: brand.name,
              brandId: brand.id
            });
          }

          // Create brand-specific JSON
          const brandData = {
            brandInfo: {
              id: brand.id,
              name: brand.name,
              slug: brand.slug,
              vehicle_type: brand.vehicle_type,
              isActive: brand.isActive
            },
            modelCount: brandModels.length,
            exportDate: new Date().toISOString(),
            models: brandModels.map(m => ({
              id: m.id,
              name: m.name,
              slug: m.slug,
              vehicle_type: m.vehicle_type,
              isActive: m.isActive
            }))
          };

          // Handle duplicate slugs
          let filename = sanitizeSlug(brand.slug, brand.id);
          if (usedSlugs.has(filename)) {
            filename = `${filename}-${brand.id}`;
            warnings.push({
              type: 'duplicate-slug',
              brand: brand.name,
              originalSlug: brand.slug,
              newFilename: filename
            });
          }
          usedSlugs.set(filename, brand.id);

          // Write brand file
          const brandFilePath = path.join(BRANDS_DIR, `${filename}.json`);
          writeJsonFile(brandFilePath, brandData, errors);
          stats.filesCreated.brandFiles.push(path.relative(BASE_DIR, brandFilePath));

          // Log progress
          if (currentIndex % LOG_PROGRESS_EVERY === 0 || currentIndex === allBrands.length) {
            console.log(`Processing brands: [${currentIndex}/${allBrands.length}] ${brand.name} (${brandModels.length} models)`);
          }

        } catch (error) {
          errors.push({
            phase: 'export-brand-models',
            brand: brand.name,
            brandId: brand.id,
            error: error.message
          });
          console.error(`❌ Error processing brand ${brand.name}:`, error.message);
        }
      }));
    }

    console.log(`\n✅ Exported ${allBrands.length} brand files`);
    if (brandsWithZeroModels > 0) {
      console.log(`⚠️  ${brandsWithZeroModels} brands have 0 models (files still created)`);
    }
    console.log();
    console.log('═'.repeat(60) + '\n');

    // ============ PHASE 3: EXPORT MODELS WITHOUT BRAND ============
    console.log('📦 PHASE 3: Exporting Models Without Brand');
    console.log('─'.repeat(60) + '\n');

    console.log('🔍 Querying models without brand...');
    const modelsWithoutBrand = [];
    let noBrandPage = 1;

    while (true) {
      const models = await strapi.entityService.findMany('api::model.model', {
        populate: { brand: { fields: ['id'] } },
        fields: ['id', 'name', 'slug', 'vehicle_type', 'isActive'],
        pagination: { page: noBrandPage, pageSize: PAGE_SIZE }
      });

      if (models.length === 0) break;

      models.forEach(model => {
        if (!model.brand || !model.brand.id) {
          modelsWithoutBrand.push({
            id: model.id,
            name: model.name,
            slug: model.slug,
            vehicle_type: model.vehicle_type || 'unknown',
            isActive: model.isActive
          });
        }
      });

      if (modelsWithoutBrand.length > 0 && modelsWithoutBrand.length % 1000 === 0) {
        console.log(`  Progress: ${modelsWithoutBrand.length} models without brand found...`);
      }

      noBrandPage++;
    }

    console.log(`✅ Found ${modelsWithoutBrand.length} models without brand\n`);
    stats.modelsWithoutBrand = modelsWithoutBrand.length;

    if (modelsWithoutBrand.length > 0) {
      const byVehicleType = {
        car: [],
        moto: [],
        unknown: []
      };

      modelsWithoutBrand.forEach(model => {
        const vType = model.vehicle_type || 'unknown';
        byVehicleType[vType] = byVehicleType[vType] || [];
        byVehicleType[vType].push(model);
        stats.noBrandByType[vType] = (stats.noBrandByType[vType] || 0) + 1;
      });

      console.log('📊 Breakdown by vehicle type:');
      Object.entries(byVehicleType).forEach(([type, models]) => {
        if (models.length > 0) {
          console.log(`  ${type}: ${models.length} models`);
        }
      });
      console.log();

      console.log('📝 Creating batched files...');

      for (const [vehicleType, models] of Object.entries(byVehicleType)) {
        if (models.length === 0) continue;

        const batches = chunk(models, BATCH_SIZE);

        batches.forEach((batch, index) => {
          const batchNumber = index + 1;
          const batchData = {
            vehicleType,
            batchNumber,
            totalInBatch: batch.length,
            exportDate: new Date().toISOString(),
            models: batch
          };

          const filename = `${vehicleType}-no-brand-${batchNumber}.json`;
          const filePath = path.join(NO_BRAND_DIR, filename);

          writeJsonFile(filePath, batchData, errors);
          stats.filesCreated.noBrandFiles.push(path.relative(BASE_DIR, filePath));

          console.log(`  [${vehicleType}] Batch ${batchNumber}/${batches.length} (${batch.length} models)`);
        });
      }

      console.log(`\n✅ Exported ${stats.filesCreated.noBrandFiles.length} no-brand files\n`);
    } else {
      console.log('✅ All models have brand relationships!\n');
    }

    console.log('═'.repeat(60) + '\n');

    // ============ PHASE 4: GENERATE SUMMARY ============
    console.log('📊 EXPORT SUMMARY');
    console.log('─'.repeat(60) + '\n');

    stats.totalModels = stats.modelsWithBrand + stats.modelsWithoutBrand;

    const topBrands = allBrands
      .filter(b => b.modelCount > 0)
      .sort((a, b) => b.modelCount - a.modelCount)
      .slice(0, 10)
      .map(b => ({ brand: b.name, modelCount: b.modelCount }));

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(1);

    const summaryData = {
      exportDate: new Date().toISOString(),
      executionTime: `${executionTime} seconds`,
      statistics: stats,
      topBrandsByModelCount: topBrands
    };

    const summaryPath = path.join(EXPORT_DIR, 'summary.json');
    writeJsonFile(summaryPath, summaryData, errors);
    stats.filesCreated.summary = path.relative(BASE_DIR, summaryPath);

    // Display summary
    console.log('Statistics:');
    console.log(`  Total Brands: ${stats.totalBrands}`);
    console.log(`  Total Models: ${stats.totalModels}`);
    console.log(`  Models with Brand: ${stats.modelsWithBrand}`);
    console.log(`  Models without Brand: ${stats.modelsWithoutBrand}\n`);

    console.log('Breakdown by Vehicle Type:');
    Object.entries(stats.byVehicleType).forEach(([type, count]) => {
      if (count > 0) {
        const noBrand = stats.noBrandByType[type] || 0;
        console.log(`  ${type}: ${count} models (${noBrand} without brand)`);
      }
    });
    console.log();

    if (topBrands.length > 0) {
      console.log('Top 10 Brands by Model Count:');
      topBrands.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.brand}: ${item.modelCount} models`);
      });
      console.log();
    }

    console.log('Files Created:');
    console.log(`  ✅ all-brands.json`);
    console.log(`  ✅ ${stats.filesCreated.brandFiles.length} brand files in brands/`);
    console.log(`  ✅ ${stats.filesCreated.noBrandFiles.length} no-brand files in no-brand/`);
    console.log(`  ✅ summary.json\n`);

    console.log(`Output Location: ${EXPORT_DIR}\n`);
    console.log(`Execution Time: ${executionTime} seconds\n`);

    if (warnings.length > 0) {
      console.log('⚠️ Warnings:');
      const duplicateSlugs = warnings.filter(w => w.type === 'duplicate-slug');
      if (duplicateSlugs.length > 0) {
        console.log(`  - ${duplicateSlugs.length} duplicate slugs handled`);
      }
      console.log();
    }

    if (errors.length > 0) {
      console.log('❌ Errors:');
      console.log(`  - ${errors.length} errors occurred during export`);
      const errorPath = path.join(EXPORT_DIR, 'export-errors.json');
      writeJsonFile(errorPath, { errors, warnings }, errors);
      console.log(`  - Error details saved to: export-errors.json\n`);
    }

    console.log('═'.repeat(60) + '\n');

    if (DRY_RUN) {
      console.log('🧪 DRY-RUN COMPLETE');
      console.log('ℹ️  No changes were made. Set DRY_RUN = false to write files.\n');
    } else {
      console.log('✅ EXPORT COMPLETE!\n');
      console.log('💡 Next Steps:');
      console.log('  1. Review exported files in scripts/exported_data/');
      console.log('  2. Check summary.json for detailed statistics');
      console.log('  3. Verify no-brand models if needed');
      console.log('  4. Use exported data for external processing\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
  }
}

// ============ MAIN ============
async function main() {
  let strapi;
  try {
    console.log('🚀 Bootstrapping Strapi...\n');
    strapi = await bootstrapStrapi();
    console.log('✅ Strapi loaded successfully\n');

    await exportData(strapi);

  } catch (error) {
    console.error('❌ Failed to run export:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (strapi) {
      console.log('🔌 Closing Strapi connection...');
      await strapi.destroy();
      console.log('✅ Done!\n');
    }
    process.exit(0);
  }
}

// Run the script
main();
