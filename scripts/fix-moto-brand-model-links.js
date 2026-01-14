const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Fix Motorcycle Brand-Model Links
 *
 * Creates missing links in models_brand_lnk table for motorcycle models
 * using moto_models.json as the source of truth.
 *
 * Usage: node scripts/fix-moto-brand-model-links.js [--dry-run] [--verify] [--brand=slug]
 */

const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');
const MOTO_MODELS_FILE = path.join(__dirname, 'json_data', 'moto_models.json');
const BATCH_SIZE = 100;

// Parse command-line arguments
function parseCommandLineArgs() {
  const args = {
    dryRun: process.argv.includes('--dry-run'),
    verify: process.argv.includes('--verify'),
    verbose: process.argv.includes('--verbose'),
    brandFilter: null
  };

  const brandArg = process.argv.find(arg => arg.startsWith('--brand='));
  if (brandArg) {
    args.brandFilter = brandArg.split('=')[1];
  }

  return args;
}

// Load and validate motorcycle models from JSON
function loadMotoModels(filePath) {
  console.log('📦 Loading motorcycle models from JSON...');

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!Array.isArray(data)) {
    throw new Error('Invalid JSON structure: expected array');
  }

  // Validate structure
  for (const item of data) {
    if (!item.brandSlug || !item.modelSlug) {
      throw new Error(`Invalid entry: missing brandSlug or modelSlug - ${JSON.stringify(item)}`);
    }
  }

  console.log(`✅ Loaded ${data.length} motorcycle models\n`);
  return data;
}

// Build lookup maps for brands and models
function buildLookupMaps(db) {
  console.log('🔍 Building lookup maps...');

  // Get all brands
  const brands = db.prepare('SELECT id, slug FROM brands').all();
  const brandMap = new Map(brands.map(b => [b.slug, b.id]));

  // Get all models - handle duplicate slugs
  const models = db.prepare('SELECT id, slug, vehicle_type FROM models').all();
  const modelMap = new Map();

  for (const model of models) {
    if (!modelMap.has(model.slug)) {
      modelMap.set(model.slug, []);
    }
    modelMap.get(model.slug).push(model);
  }

  console.log(`✅ Found ${brandMap.size} brands and ${models.length} models in database\n`);

  return { brands: brandMap, models: modelMap };
}

// Get existing links for motorcycle models
function getExistingLinks(db) {
  console.log('🔗 Querying existing motorcycle brand-model links...');

  const links = db.prepare(`
    SELECT mbl.model_id, mbl.brand_id
    FROM models_brand_lnk mbl
    JOIN models m ON mbl.model_id = m.id
    WHERE m.vehicle_type = 'moto'
  `).all();

  const linkSet = new Set();
  for (const link of links) {
    linkSet.add(`${link.model_id}-${link.brand_id}`);
  }

  console.log(`✅ Found ${linkSet.size} existing moto model-brand links\n`);

  return linkSet;
}

// Analyze which links need to be created
function analyzeLinks(motoModels, lookupMaps, existingLinks, brandFilter) {
  console.log('📊 Analyzing links to create...\n');

  const linksToCreate = [];
  const warnings = {
    missingBrands: new Set(),
    missingModels: new Set(),
    duplicateSlugs: new Set(),
    alreadyLinked: 0
  };

  for (const item of motoModels) {
    // Filter by brand if specified
    if (brandFilter && item.brandSlug !== brandFilter) {
      continue;
    }

    // Check if brand exists
    const brandId = lookupMaps.brands.get(item.brandSlug);
    if (!brandId) {
      warnings.missingBrands.add(item.brandSlug);
      continue;
    }

    // Check if model exists
    const modelMatches = lookupMaps.models.get(item.modelSlug);
    if (!modelMatches || modelMatches.length === 0) {
      warnings.missingModels.add(`${item.brandSlug}::${item.modelSlug}`);
      continue;
    }

    // Handle duplicate model slugs
    let modelId;
    if (modelMatches.length > 1) {
      warnings.duplicateSlugs.add(item.modelSlug);
      // Prefer the one marked as 'moto' vehicle type
      const motoModel = modelMatches.find(m => m.vehicle_type === 'moto');
      modelId = motoModel ? motoModel.id : modelMatches[0].id;
    } else {
      modelId = modelMatches[0].id;
    }

    // Check if link already exists
    const linkKey = `${modelId}-${brandId}`;
    if (existingLinks.has(linkKey)) {
      warnings.alreadyLinked++;
      continue;
    }

    // Add to creation list
    linksToCreate.push({
      modelId,
      brandId,
      modelSlug: item.modelSlug,
      brandSlug: item.brandSlug,
      modelName: item.name || item.modelSlug
    });
  }

  return { linksToCreate, warnings };
}

// Report analysis results
function reportAnalysis(analysis) {
  console.log('═══════════════════════════════════════════════');
  console.log('📋 Analysis Results:\n');
  console.log(`  Links to create: ${analysis.linksToCreate.length}`);
  console.log(`  Already linked: ${analysis.warnings.alreadyLinked}`);

  if (analysis.warnings.missingBrands.size > 0) {
    console.log(`\n  ⚠️  Missing brands (${analysis.warnings.missingBrands.size}):`);
    [...analysis.warnings.missingBrands].slice(0, 5).forEach(b => {
      console.log(`     - ${b}`);
    });
    if (analysis.warnings.missingBrands.size > 5) {
      console.log(`     ... and ${analysis.warnings.missingBrands.size - 5} more`);
    }
  }

  if (analysis.warnings.missingModels.size > 0) {
    console.log(`\n  ⚠️  Missing models (${analysis.warnings.missingModels.size}):`);
    [...analysis.warnings.missingModels].slice(0, 10).forEach(m => {
      console.log(`     - ${m}`);
    });
    if (analysis.warnings.missingModels.size > 10) {
      console.log(`     ... and ${analysis.warnings.missingModels.size - 10} more`);
    }
  }

  if (analysis.warnings.duplicateSlugs.size > 0) {
    console.log(`\n  ℹ️  Duplicate slugs handled: ${analysis.warnings.duplicateSlugs.size}`);
  }

  console.log('═══════════════════════════════════════════════\n');
}

// Create links with database transaction
function createLinks(db, linksToCreate) {
  console.log('🔗 Creating brand-model links...\n');

  const insertStmt = db.prepare(`
    INSERT INTO models_brand_lnk (model_id, brand_id, model_ord)
    VALUES (?, ?, ?)
  `);

  const maxOrdStmt = db.prepare(`
    SELECT COALESCE(MAX(model_ord), 0) as max_ord
    FROM models_brand_lnk
    WHERE brand_id = ?
  `);

  // Group links by brand
  const linksByBrand = new Map();
  for (const link of linksToCreate) {
    if (!linksByBrand.has(link.brandId)) {
      linksByBrand.set(link.brandId, []);
    }
    linksByBrand.get(link.brandId).push(link);
  }

  const transaction = db.transaction(() => {
    let created = 0;

    for (const [brandId, links] of linksByBrand) {
      // Get starting ord for this brand
      const { max_ord } = maxOrdStmt.get(brandId);
      let currentOrd = max_ord;

      for (const link of links) {
        currentOrd++;
        insertStmt.run(link.modelId, link.brandId, currentOrd);
        created++;

        if (created % BATCH_SIZE === 0) {
          console.log(`  Progress: ${created}/${linksToCreate.length} links created...`);
        }
      }
    }

    return created;
  });

  const created = transaction();
  console.log(`\n✅ Created ${created} links\n`);

  return created;
}

// Verify links were created correctly
function verifyLinks(db, expectedLinks) {
  console.log('✓ Verifying links...');

  const checkStmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM models_brand_lnk
    WHERE model_id = ? AND brand_id = ?
  `);

  let success = 0;
  let failed = 0;

  for (const link of expectedLinks) {
    const { count } = checkStmt.get(link.modelId, link.brandId);
    if (count > 0) {
      success++;
    } else {
      failed++;
      console.warn(`  ⚠️  Link not found: ${link.brandSlug}::${link.modelSlug}`);
    }
  }

  console.log(`✅ Verification: ${success}/${expectedLinks.length} links confirmed\n`);

  return { success, failed, total: expectedLinks.length };
}

// Report final statistics
function reportFinalStatistics(db, motoModels) {
  console.log('═══════════════════════════════════════════════');
  console.log('📊 Final Statistics:\n');

  // Group models by brand from JSON
  const modelsByBrand = {};
  for (const model of motoModels) {
    if (!modelsByBrand[model.brandSlug]) {
      modelsByBrand[model.brandSlug] = 0;
    }
    modelsByBrand[model.brandSlug]++;
  }

  // Get actual link counts from DB
  const linkCounts = db.prepare(`
    SELECT b.slug, b.name, COUNT(mbl.id) as link_count
    FROM brands b
    LEFT JOIN models_brand_lnk mbl ON b.id = mbl.brand_id
    LEFT JOIN models m ON mbl.model_id = m.id
    WHERE b.vehicle_type IN ('moto', 'car-moto')
      AND (m.vehicle_type = 'moto' OR m.id IS NULL)
    GROUP BY b.id
    ORDER BY link_count DESC
  `).all();

  console.log('Motorcycle Brand-Model Links:\n');
  for (const { slug, name, link_count } of linkCounts) {
    const expected = modelsByBrand[slug] || 0;
    const status = link_count >= expected ? '✅' : (link_count > 0 ? '⚠️' : '❌');
    const displayName = (name || slug).padEnd(25);
    console.log(`  ${status} ${displayName} ${link_count.toString().padStart(4)}${expected ? ` / ${expected}` : ''}`);
  }

  // Total unlinked moto models
  const unlinked = db.prepare(`
    SELECT COUNT(*) as count
    FROM models m
    LEFT JOIN models_brand_lnk mbl ON m.id = mbl.model_id
    WHERE m.vehicle_type = 'moto' AND mbl.id IS NULL
  `).get();

  console.log(`\n📌 Unlinked moto models remaining: ${unlinked.count}`);
  console.log('═══════════════════════════════════════════════\n');
}

// Main execution
async function main() {
  const args = parseCommandLineArgs();

  console.log('🔗 Fix Motorcycle Brand-Model Links\n');
  console.log('═══════════════════════════════════════════════\n');

  if (args.dryRun) {
    console.log('💡 DRY RUN MODE - No changes will be made\n');
  }

  if (args.verify) {
    console.log('🔍 VERIFY MODE - Checking current state only\n');
  }

  if (args.brandFilter) {
    console.log(`🎯 BRAND FILTER: ${args.brandFilter}\n`);
  }

  try {
    // Step 1: Load motorcycle models from JSON
    const motoModels = loadMotoModels(MOTO_MODELS_FILE);

    // Step 2: Open database and build lookup maps
    const db = new Database(DB_PATH);
    const lookupMaps = buildLookupMaps(db);

    // Step 3: Analyze existing links
    const existingLinks = getExistingLinks(db);

    // Step 4: Determine which links to create
    const analysis = analyzeLinks(motoModels, lookupMaps, existingLinks, args.brandFilter);
    reportAnalysis(analysis);

    if (args.verify) {
      console.log('✅ Verification complete (--verify mode)\n');
      reportFinalStatistics(db, motoModels);
      db.close();
      return;
    }

    if (analysis.linksToCreate.length === 0) {
      console.log('✅ No links to create - all models already linked!\n');
      reportFinalStatistics(db, motoModels);
      db.close();
      return;
    }

    if (args.dryRun) {
      console.log('💡 Dry run complete - no changes made\n');
      db.close();
      return;
    }

    // Step 5: Create links
    const created = createLinks(db, analysis.linksToCreate);

    // Step 6: Verify links were created correctly
    const verification = verifyLinks(db, analysis.linksToCreate);

    if (verification.failed > 0) {
      console.warn(`⚠️  Warning: ${verification.failed} links could not be verified\n`);
    }

    // Step 7: Final statistics
    reportFinalStatistics(db, motoModels);

    db.close();
    console.log('✅ All done!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
