/**
 * Reverts the PNG->JPG conversion for filter product photos ONLY (2026-07-20)
 * -- mirrors revert_jpg_conversion_wipers_only.cjs (see that script's header
 * for the full mechanism explanation). Every other category (batteries,
 * lights, oil) keeps its JPG size savings from the original catalog-wide
 * conversion.
 *
 * Scope determined via Strapi's `files_related_mph` polymorphic relation
 * table: entries belonging to `api::filter-product.filter-product`'s `img`
 * field (product photos). `brandImg` (brand logos) were never converted --
 * already small, skipped by the original size-based filter -- so this
 * derives its scope from the DB rather than hardcoding a count.
 *
 * Never touches physical bytes: apply_jpg_conversion.cjs never deleted the
 * old PNG upload when converting -- the old .png file is already sitting in
 * public/uploads/ under its original hash. This is a pure `files` table
 * metadata flip (ext/mime/size/url) for the matched filter rows.
 *
 * Usage: node scripts/revert_jpg_conversion_filters_only.cjs [--dry-run]
 * Remaining manual steps after running (same as the wipers-only revert):
 *   1. In react-app-tablet: node scripts/generateSeed.js (local Strapi running)
 *   2. node scripts/download-images.js (re-downloads the reverted PNGs)
 *   3. Remove stale filtration_*.jpg files superseded by the re-downloaded PNGs
 *   4. Copy the regenerated DB to android/app/src/main/assets/databases/
 *   5. Bump DB_VERSION in src/db/database.ts
 */
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');

const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');
const MANIFEST_PATH = path.join(__dirname, 'reports', 'jpg_conversion_manifest.json');

const manifest = require(MANIFEST_PATH);
console.log(`Full manifest: ${manifest.entries.length} entries`);

const db = new Database(DB_PATH, { readonly: DRY_RUN });

const filterImgFileIds = new Set(
  db.prepare(
    "SELECT DISTINCT file_id FROM files_related_mph WHERE related_type='api::filter-product.filter-product' AND field='img'"
  ).all().map((r) => r.file_id)
);
console.log(`filter_products.img file ids in DB: ${filterImgFileIds.size}`);

const filterEntries = manifest.entries.filter((e) => filterImgFileIds.has(e.fileId));
console.log(`Manifest entries matching filter_products.img: ${filterEntries.length}`);

const restoreStmt = DRY_RUN ? null : db.prepare('UPDATE files SET ext=?, mime=?, size=?, url=?, updated_at=? WHERE id=?');
const now = new Date().toISOString();
let restored = 0;
for (const e of filterEntries) {
  console.log(`  ${DRY_RUN ? '[DRY RUN] ' : ''}files.id=${e.fileId} (${e.hash}): ${e.newExt} -> ${e.oldExt}`);
  if (!DRY_RUN) restoreStmt.run(e.oldExt, e.oldMime, e.oldSize, e.oldUrl, now, e.fileId);
  restored++;
}
db.close();

console.log(`\n${DRY_RUN ? '[DRY RUN] Would restore' : 'Restored'}: ${restored} filter_products.img row(s)`);
console.log(`\n${DRY_RUN ? '[DRY RUN] Nothing was written.' : 'Done.'}`);
console.log('Remaining manual steps:');
console.log('  1. In react-app-tablet: node scripts/generateSeed.js (requires local Strapi running on :1338)');
console.log('  2. In react-app-tablet: node scripts/download-images.js');
console.log('  3. Remove stale filtration_*.jpg files superseded by the re-downloaded .png files');
console.log('  4. Copy public/assets/databases/react-app-db.db to android/app/src/main/assets/databases/');
console.log('  5. Bump DB_VERSION in src/db/database.ts');
