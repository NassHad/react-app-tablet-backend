const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Diagnose Model Duplicates and Missing Models
 *
 * Investigates why some models appear in database but not in Strapi admin
 * and checks for duplicate models
 *
 * Usage: node scripts/diagnose-model-duplicates.js
 */

const DB_PATH = path.join(process.cwd(), '.tmp', 'data.db');

console.log('🔍 Diagnosing Model Issues');
console.log('═'.repeat(60));
console.log();

try {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database not found: ${DB_PATH}`);
  }

  const db = new Database(DB_PATH, { readonly: true });
  console.log('✅ Database opened\n');

  // ============ CHECK 1: TOTAL MODELS ============
  console.log('📊 CHECK 1: Total Models Count');
  console.log('─'.repeat(60));

  const totalModels = db.prepare('SELECT COUNT(*) as count FROM models').get();
  console.log(`Total models in database: ${totalModels.count}\n`);

  // ============ CHECK 2: MODELS BY PUBLISHED STATUS ============
  console.log('📊 CHECK 2: Models by Published Status');
  console.log('─'.repeat(60));

  const publishedModels = db.prepare(`
    SELECT COUNT(*) as count
    FROM models
    WHERE published_at IS NOT NULL
  `).get();

  const unpublishedModels = db.prepare(`
    SELECT COUNT(*) as count
    FROM models
    WHERE published_at IS NULL
  `).get();

  console.log(`Published models: ${publishedModels.count}`);
  console.log(`Unpublished models (HIDDEN from admin): ${unpublishedModels.count}`);
  console.log();

  // ============ CHECK 3: INVESTIGATE SPECIFIC MODEL ============
  console.log('📊 CHECK 3: Investigating Model ID 28145');
  console.log('─'.repeat(60));

  const model = db.prepare(`
    SELECT id, document_id, name, slug, vehicle_type, is_active,
           created_at, updated_at, published_at, locale
    FROM models
    WHERE id = 28145
  `).get();

  if (model) {
    console.log('Model found:');
    console.log(`  ID: ${model.id}`);
    console.log(`  Document ID: ${model.document_id}`);
    console.log(`  Name: ${model.name}`);
    console.log(`  Slug: ${model.slug}`);
    console.log(`  Vehicle Type: ${model.vehicle_type}`);
    console.log(`  Is Active: ${model.is_active === 1}`);
    console.log(`  Published At: ${model.published_at || 'NOT PUBLISHED ❌'}`);
    console.log(`  Locale: ${model.locale}`);
    console.log(`  Created: ${model.created_at}`);
    console.log(`  Updated: ${model.updated_at}`);

    // Check if it has a brand
    const brandLink = db.prepare(`
      SELECT brand_id
      FROM models_brand_lnk
      WHERE model_id = 28145
    `).get();

    if (brandLink) {
      const brand = db.prepare('SELECT id, name FROM brands WHERE id = ?').get(brandLink.brand_id);
      console.log(`  Brand: ${brand ? brand.name : 'Unknown'} (ID: ${brandLink.brand_id})`);
    } else {
      console.log(`  Brand: NO BRAND RELATIONSHIP ❌`);
    }
  } else {
    console.log('❌ Model ID 28145 not found');
  }
  console.log();

  // ============ CHECK 4: DUPLICATE NAMES ============
  console.log('📊 CHECK 4: Checking for Duplicate Model Names');
  console.log('─'.repeat(60));

  const duplicateNames = db.prepare(`
    SELECT name, slug, vehicle_type, COUNT(*) as count
    FROM models
    GROUP BY name, vehicle_type
    HAVING count > 1
    ORDER BY count DESC
    LIMIT 20
  `).all();

  console.log(`Found ${duplicateNames.length} duplicate name combinations\n`);

  if (duplicateNames.length > 0) {
    console.log('Top 20 duplicates:');
    duplicateNames.forEach((dup, i) => {
      console.log(`  ${i + 1}. "${dup.name}" (${dup.vehicle_type}): ${dup.count} occurrences`);
    });
    console.log();

    // Show details of first duplicate
    if (duplicateNames[0]) {
      console.log(`Detailed view of "${duplicateNames[0].name}" duplicates:`);
      const details = db.prepare(`
        SELECT id, document_id, name, slug, published_at, created_at
        FROM models
        WHERE name = ? AND vehicle_type = ?
        ORDER BY id
      `).all(duplicateNames[0].name, duplicateNames[0].vehicle_type);

      details.forEach((d, i) => {
        console.log(`  ${i + 1}. ID: ${d.id}, Slug: ${d.slug}, Published: ${d.published_at ? 'Yes' : 'NO'}, Created: ${d.created_at}`);
      });
    }
    console.log();
  }

  // ============ CHECK 5: DUPLICATE SLUGS ============
  console.log('📊 CHECK 5: Checking for Duplicate Model Slugs');
  console.log('─'.repeat(60));

  const duplicateSlugs = db.prepare(`
    SELECT slug, vehicle_type, COUNT(*) as count
    FROM models
    GROUP BY slug, vehicle_type
    HAVING count > 1
    ORDER BY count DESC
    LIMIT 20
  `).all();

  console.log(`Found ${duplicateSlugs.length} duplicate slug combinations\n`);

  if (duplicateSlugs.length > 0) {
    console.log('Top 20 duplicate slugs:');
    duplicateSlugs.forEach((dup, i) => {
      console.log(`  ${i + 1}. "${dup.slug}" (${dup.vehicle_type}): ${dup.count} occurrences`);
    });
    console.log();
  }

  // ============ CHECK 6: DOCUMENT_ID ANALYSIS ============
  console.log('📊 CHECK 6: Document ID Analysis (Strapi v5 Draft System)');
  console.log('─'.repeat(60));

  const uniqueDocIds = db.prepare(`
    SELECT COUNT(DISTINCT document_id) as count
    FROM models
  `).get();

  const totalRows = db.prepare('SELECT COUNT(*) as count FROM models').get();

  console.log(`Total model rows: ${totalRows.count}`);
  console.log(`Unique document IDs: ${uniqueDocIds.count}`);
  console.log(`Difference (drafts/versions): ${totalRows.count - uniqueDocIds.count}`);
  console.log();

  if (totalRows.count > uniqueDocIds.count) {
    console.log('⚠️ FOUND THE ISSUE: Multiple versions per document_id');
    console.log('In Strapi v5, each document can have multiple versions (drafts).');
    console.log('The admin panel only shows the latest published version.\n');

    // Show examples of models with multiple versions
    const multiVersion = db.prepare(`
      SELECT document_id, COUNT(*) as version_count
      FROM models
      GROUP BY document_id
      HAVING version_count > 1
      ORDER BY version_count DESC
      LIMIT 5
    `).all();

    if (multiVersion.length > 0) {
      console.log('Examples of models with multiple versions:');
      multiVersion.forEach((mv, i) => {
        const versions = db.prepare(`
          SELECT id, name, published_at, locale
          FROM models
          WHERE document_id = ?
          ORDER BY id
        `).all(mv.document_id);

        console.log(`  ${i + 1}. Document ${mv.document_id} (${mv.version_count} versions):`);
        versions.forEach(v => {
          console.log(`     - ID ${v.id}: "${v.name}", Published: ${v.published_at ? 'Yes' : 'NO'}, Locale: ${v.locale}`);
        });
      });
      console.log();
    }
  }

  // ============ CHECK 7: MODELS WITHOUT BRAND ============
  console.log('📊 CHECK 7: Models Without Brand Breakdown');
  console.log('─'.repeat(60));

  const noBrandByStatus = db.prepare(`
    SELECT
      vehicle_type,
      CASE WHEN published_at IS NULL THEN 'unpublished' ELSE 'published' END as status,
      COUNT(*) as count
    FROM models m
    LEFT JOIN models_brand_lnk lnk ON m.id = lnk.model_id
    WHERE lnk.brand_id IS NULL
    GROUP BY vehicle_type, status
    ORDER BY vehicle_type, status
  `).all();

  console.log('Models without brand:');
  noBrandByStatus.forEach(row => {
    console.log(`  ${row.vehicle_type} (${row.status}): ${row.count}`);
  });
  console.log();

  // ============ RECOMMENDATIONS ============
  console.log('═'.repeat(60));
  console.log('💡 RECOMMENDATIONS');
  console.log('═'.repeat(60));
  console.log();

  if (unpublishedModels.count > 0) {
    console.log('1. UNPUBLISHED MODELS:');
    console.log(`   - ${unpublishedModels.count} models are unpublished (hidden from admin)`);
    console.log('   - These models exist in database but won\'t appear in admin panel');
    console.log('   - You can either:');
    console.log('     a) Publish them via script');
    console.log('     b) Delete unpublished drafts if they\'re not needed');
    console.log();
  }

  if (duplicateNames.length > 0) {
    console.log('2. DUPLICATE NAMES:');
    console.log(`   - ${duplicateNames.length} model names appear multiple times`);
    console.log('   - This could be due to:');
    console.log('     a) Strapi v5 draft system (multiple versions)');
    console.log('     b) Actual duplicate imports');
    console.log('   - Consider consolidating or keeping only published versions');
    console.log();
  }

  if (totalRows.count > uniqueDocIds.count) {
    console.log('3. MULTIPLE VERSIONS:');
    console.log(`   - ${totalRows.count - uniqueDocIds.count} extra rows due to versioning`);
    console.log('   - Strapi v5 keeps drafts as separate rows with same document_id');
    console.log('   - Your export should filter by:');
    console.log('     a) published_at IS NOT NULL (only published)');
    console.log('     b) OR use DISTINCT document_id to get unique models');
    console.log();
  }

  // ============ GENERATE CLEANUP SCRIPT SUGGESTION ============
  console.log('═'.repeat(60));
  console.log('🛠️ SUGGESTED FIX');
  console.log('═'.repeat(60));
  console.log();
  console.log('Update the export script to only export published models:');
  console.log();
  console.log('Change line in export-all-brands-models-direct.js:');
  console.log('FROM:');
  console.log('  SELECT id, name, slug, vehicle_type, is_active as isActive');
  console.log('  FROM models');
  console.log();
  console.log('TO:');
  console.log('  SELECT id, name, slug, vehicle_type, is_active as isActive');
  console.log('  FROM models');
  console.log('  WHERE published_at IS NOT NULL');
  console.log();

  db.close();

} catch (error) {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
