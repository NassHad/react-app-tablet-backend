/**
 * Applies the JPG conversion (done in the frontend repo's
 * image_conversion_workspace/jpg_staging/) to Strapi's media library: for
 * each staged .jpg file that matches an existing `files` row by hash (the
 * filename stem, sans category prefix and extension), writes the new bytes
 * into public/uploads/ and updates the row's hash/ext/mime/size/url. The
 * `hash` itself is kept identical -- only the extension/bytes change -- so
 * matching stays simple and stable.
 *
 * `files` has no draft/publish duality (verified: 0 rows with NULL
 * published_at) -- a single UPDATE per row is enough, unlike the
 * models/lights_products draft+pub pairs from the earlier lights fix.
 *
 * Never deletes anything: if an old physical upload existed, it's left in
 * place (backend public/uploads/ never ships in the app, so it doesn't cost
 * APK size -- no reason to touch it). Old file bytes for the ones that did
 * exist were already snapshotted to .jpg_conversion_backup/uploads/ by a
 * prior manual step; this script does not depend on that copy to run, only
 * the revert script does.
 *
 * Writes scripts/reports/jpg_conversion_manifest.json (backend-side) with
 * one entry per applied row, consumed by revert_jpg_conversion.cjs.
 *
 * Usage: node scripts/apply_jpg_conversion.cjs [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
const JPG_STAGING_DIR = path.join(__dirname, '..', '..', 'react-app-tablet', 'image_conversion_workspace', 'jpg_staging');
const STEMS_LIST = path.join(__dirname, '..', '..', 'react-app-tablet', 'scripts', 'reports', 'product_images_audit.json');
const MANIFEST_PATH = path.join(__dirname, 'reports', 'jpg_conversion_manifest.json');

const PREFIXES = ['battery_', 'light_', 'wiper_', 'filtration_', 'brand_'];
function stripPrefix(filename) {
  for (const p of PREFIXES) {
    if (filename.startsWith(p)) return filename.slice(p.length);
  }
  return filename;
}

const stagedFiles = fs.readdirSync(JPG_STAGING_DIR).filter((f) => f.endsWith('.jpg'));
console.log(`Found ${stagedFiles.length} staged .jpg files`);

const db = new Database(DB_PATH);
const findByHash = db.prepare('SELECT id, hash, ext, mime, url, size, formats FROM files WHERE hash = ?');
const updateStmt = db.prepare('UPDATE files SET ext = ?, mime = ?, size = ?, url = ?, updated_at = ? WHERE id = ?');

const manifest = [];
let applied = 0, skippedNoMatch = 0;
const now = new Date().toISOString();

for (const file of stagedFiles) {
  const stem = stripPrefix(path.basename(file, '.jpg'));
  const row = findByHash.get(stem);
  if (!row) { skippedNoMatch++; continue; }

  const stagedPath = path.join(JPG_STAGING_DIR, file);
  const newExt = '.jpg';
  const newUrl = `/uploads/${row.hash}${newExt}`;
  const newSizeBytes = fs.statSync(stagedPath).size;
  const newSizeKb = newSizeBytes / 1024;
  const oldPhysicalPath = path.join(UPLOADS_DIR, `${row.hash}${row.ext}`);
  const oldPhysicalExisted = fs.existsSync(oldPhysicalPath);

  manifest.push({
    fileId: row.id,
    hash: row.hash,
    oldExt: row.ext,
    oldMime: row.mime,
    oldUrl: row.url,
    oldSize: row.size,
    newExt,
    newMime: 'image/jpeg',
    newUrl,
    newSize: newSizeKb,
    oldPhysicalExisted,
    oldPhysicalBackup: oldPhysicalExisted ? path.join('.jpg_conversion_backup', 'uploads', `${row.hash}${row.ext}`) : null,
  });

  if (!DRY_RUN) {
    const newPhysicalPath = path.join(UPLOADS_DIR, `${row.hash}${newExt}`);
    fs.copyFileSync(stagedPath, newPhysicalPath);
    updateStmt.run(newExt, 'image/jpeg', newSizeKb, newUrl, now, row.id);
  }
  applied++;
}

console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Applied: ${applied}, skipped (no matching files row): ${skippedNoMatch}`);

if (!DRY_RUN) {
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ generatedAt: now, entries: manifest }, null, 2));
  console.log(`Manifest written to ${MANIFEST_PATH}`);
} else {
  console.log('--dry-run: no DB rows or files written.');
}

db.close();
