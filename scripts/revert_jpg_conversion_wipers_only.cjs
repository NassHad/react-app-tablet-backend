/**
 * Reverts the PNG->JPG conversion for wiper product photos ONLY (2026-07-19)
 * -- every other category (batteries, lights, filters, oil) keeps its JPG
 * size savings from the original catalog-wide conversion.
 *
 * Scope determined via Strapi's `files_related_mph` polymorphic relation
 * table: exactly 54 of the 183 entries in jpg_conversion_manifest.json
 * belong to `wipers_data.img` (product photos). 0 belong to
 * `wipers_data.brandImg` (brand logos were never converted -- already
 * small, skipped by the original size-based filter). This script derives
 * that 54-entry scope itself (not hardcoded) so it stays correct if the
 * manifest or DB state changes.
 *
 * Never touches physical bytes: apply_jpg_conversion.cjs never deleted the
 * old PNG upload when converting (backend public/uploads/ isn't shipped in
 * the app, no size cost to leaving it) -- the old .png file is already
 * sitting in public/uploads/ under its original hash. This is a pure
 * `files` table metadata flip (ext/mime/size/url) for the 54 wiper rows.
 *
 * Usage: node scripts/revert_jpg_conversion_wipers_only.cjs [--dry-run]
 * Remaining manual steps after running (same as the full revert script):
 *   1. In react-app-tablet: node scripts/generateSeed.js (local Strapi running)
 *   2. node scripts/download-images.js (re-downloads the reverted PNGs)
 *   3. Remove stale wiper_*.jpg files superseded by the re-downloaded PNGs
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

const wiperImgFileIds = new Set(
  db.prepare(
    "SELECT DISTINCT file_id FROM files_related_mph WHERE related_type='api::wiper-data.wiper-data' AND field='img'"
  ).all().map((r) => r.file_id)
);
console.log(`wipers_data.img file ids in DB: ${wiperImgFileIds.size}`);

const wiperEntries = manifest.entries.filter((e) => wiperImgFileIds.has(e.fileId));
console.log(`Manifest entries matching wipers_data.img: ${wiperEntries.length}`);

const restoreStmt = DRY_RUN ? null : db.prepare('UPDATE files SET ext=?, mime=?, size=?, url=?, updated_at=? WHERE id=?');
const now = new Date().toISOString();
let restored = 0;
for (const e of wiperEntries) {
  console.log(`  ${DRY_RUN ? '[DRY RUN] ' : ''}files.id=${e.fileId} (${e.hash}): ${e.newExt} -> ${e.oldExt}`);
  if (!DRY_RUN) restoreStmt.run(e.oldExt, e.oldMime, e.oldSize, e.oldUrl, now, e.fileId);
  restored++;
}
db.close();

console.log(`\n${DRY_RUN ? '[DRY RUN] Would restore' : 'Restored'}: ${restored} wipers_data.img row(s)`);
console.log(`\n${DRY_RUN ? '[DRY RUN] Nothing was written.' : 'Done.'}`);
console.log('Remaining manual steps:');
console.log('  1. In react-app-tablet: node scripts/generateSeed.js (requires local Strapi running on :1338)');
console.log('  2. In react-app-tablet: node scripts/download-images.js');
console.log('  3. Remove stale wiper_*.jpg files superseded by the re-downloaded .png files');
console.log('  4. Copy public/assets/databases/react-app-db.db to android/app/src/main/assets/databases/');
console.log('  5. Bump DB_VERSION in src/db/database.ts');
