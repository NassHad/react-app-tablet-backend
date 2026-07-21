/**
 * Reverts the PNG->JPG product image conversion (2026-07-19), driven by the
 * manifests written during apply:
 *   - this repo:      scripts/reports/jpg_conversion_manifest.json (180+3 entries,
 *                      backend `files` table rows -- Strapi media library)
 *   - frontend repo:  scripts/reports/jpg_conversion_frontend_only.json (3 entries,
 *                      OilProductsScreen.tsx hardcoded references, no Strapi row)
 *
 * What it does:
 *   1. Backend `files` table: restore ext/mime/url/size to the manifest's
 *      recorded old values, by fileId. Never touches physical bytes in
 *      backend public/uploads/ -- those aren't shipped in the app (no APK
 *      size cost), so there's nothing to gain by cleaning them up, and every
 *      old physical file that existed pre-conversion was left untouched by
 *      the apply step anyway (nothing to restore).
 *   2. Frontend: moves each archived PNG in image_archive/products_png/ back
 *      to public/assets/img/products/, and removes the corresponding .jpg
 *      from that same shipped folder (still recoverable from
 *      image_conversion_workspace/jpg_staging/ if needed again).
 *   3. OilProductsScreen.tsx: reverts the 3 hardcoded .jpg strings back to
 *      .png using the frontend-only manifest's recorded oldValue/newValue.
 *   4. Re-runs the frontend's generateSeed.js against the now-reverted
 *      backend so public/assets/databases/react-app-db.db (and its Android
 *      mirror, copied manually) reflect the reverted `files` table --
 *      reuses the existing, already-correct pipeline rather than hand
 *      patching SQLite a second way.
 *
 * Does NOT: touch DB_VERSION in src/db/database.ts (a source edit, revert
 * manually -- it was 32 before this bump to 33) or re-run `npx cap sync`
 * (run it yourself after this script, same as the apply step required).
 *
 * Usage: node scripts/revert_jpg_conversion.cjs [--dry-run]
 * Requires: local Strapi dev server running on :1338 (for step 4).
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { execSync } = require('child_process');

const DRY_RUN = process.argv.includes('--dry-run');

const BACKEND_ROOT = path.join(__dirname, '..');
const FRONTEND_ROOT = path.join(__dirname, '..', '..', 'react-app-tablet');
const DB_PATH = path.join(BACKEND_ROOT, '.tmp', 'data.db');
const BACKEND_MANIFEST_PATH = path.join(BACKEND_ROOT, 'scripts', 'reports', 'jpg_conversion_manifest.json');
const FRONTEND_MANIFEST_PATH = path.join(FRONTEND_ROOT, 'scripts', 'reports', 'jpg_conversion_frontend_only.json');
const PRODUCTS_DIR = path.join(FRONTEND_ROOT, 'public', 'assets', 'img', 'products');
const ARCHIVE_DIR = path.join(FRONTEND_ROOT, 'image_archive', 'products_png');
const OIL_SCREEN_PATH = path.join(FRONTEND_ROOT, 'src', 'pages', 'products', 'OilProductsScreen.tsx');

function log(...args) { console.log(DRY_RUN ? '[DRY RUN]' : '[REVERT]', ...args); }

// ---- 1. Backend files table ----
const backendManifest = JSON.parse(fs.readFileSync(BACKEND_MANIFEST_PATH, 'utf8'));
console.log(`Backend manifest: ${backendManifest.entries.length} entries`);

const db = new Database(DB_PATH, { readonly: DRY_RUN });
const restoreStmt = DRY_RUN ? null : db.prepare('UPDATE files SET ext=?, mime=?, size=?, url=?, updated_at=? WHERE id=?');
const now = new Date().toISOString();
let restored = 0;
for (const e of backendManifest.entries) {
  log(`files.id=${e.fileId} (${e.hash}): ${e.newExt} -> ${e.oldExt}`);
  if (!DRY_RUN) restoreStmt.run(e.oldExt, e.oldMime, e.oldSize, e.oldUrl, now, e.fileId);
  restored++;
}
db.close();
console.log(`Backend files rows ${DRY_RUN ? 'would be' : ''} restored: ${restored}`);

// ---- 2. Frontend shipped files: move PNGs back from archive, drop our JPGs ----
function restoreArchived(pngFilename, jpgFilename) {
  const archived = path.join(ARCHIVE_DIR, pngFilename);
  const restoredPath = path.join(PRODUCTS_DIR, pngFilename);
  const jpgPath = path.join(PRODUCTS_DIR, jpgFilename);
  if (!fs.existsSync(archived)) { console.log(`  SKIP (not in archive): ${pngFilename}`); return; }
  log(`restore ${pngFilename} from archive; remove ${jpgFilename}`);
  if (!DRY_RUN) {
    fs.renameSync(archived, restoredPath);
    if (fs.existsSync(jpgPath)) fs.unlinkSync(jpgPath);
  }
}

const archivedFiles = fs.readdirSync(ARCHIVE_DIR);
console.log(`\nArchived PNGs found: ${archivedFiles.length}`);
for (const pngFilename of archivedFiles) {
  const jpgFilename = pngFilename.replace(/\.png$/i, '.jpg');
  restoreArchived(pngFilename, jpgFilename);
}

// ---- 3. OilProductsScreen.tsx ----
const frontendManifest = JSON.parse(fs.readFileSync(FRONTEND_MANIFEST_PATH, 'utf8'));
console.log(`\nFrontend-only (hardcoded) manifest: ${frontendManifest.entries.length} entries`);
let source = fs.readFileSync(OIL_SCREEN_PATH, 'utf8');
for (const e of frontendManifest.entries) {
  if (source.includes(e.newValue)) {
    log(`OilProductsScreen.tsx: revert "${e.newValue}" -> "${e.oldValue}"`);
    source = source.replace(e.newValue, e.oldValue);
  } else {
    console.log(`  SKIP (already reverted or not found): ${e.newValue}`);
  }
}
if (!DRY_RUN) fs.writeFileSync(OIL_SCREEN_PATH, source);

console.log(`\n${DRY_RUN ? '[DRY RUN] Nothing was written.' : 'Done.'}`);
console.log('Remaining manual steps:');
console.log('  1. In react-app-tablet: node scripts/generateSeed.js (requires local Strapi running on :1338)');
console.log('  2. Copy the regenerated public/assets/databases/react-app-db.db over android/app/src/main/assets/databases/react-app-db.db');
console.log('  3. Revert DB_VERSION in src/db/database.ts back to 32 (currently bumped to 33 for this conversion)');
console.log('  4. npm run build && npx cap sync android');
