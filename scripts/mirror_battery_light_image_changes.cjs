/**
 * Mirrors today's frontend-only changes into the local dev Strapi DB
 * (.tmp/data.db), so a future content-type rebuild/reseed sourced from
 * Strapi doesn't silently lose them:
 *
 *  A) jpg->png (or hash-changed re-upload) swap for battery_data/light_data
 *     `img` file relations -- matched the SAME way the frontend script
 *     (react-app-tablet/scripts/apply_png_folder_replacements.cjs) matched
 *     SQLite rows: exact stem, then leading-numeric-product-code fallback,
 *     against public/assets/img/products/png/. Draft and published rows
 *     share one file_id (confirmed via files_related_mph), so each swap is
 *     one `files` UPDATE, no relation-table changes needed.
 *  B) Removes EK700 (battery_data, both draft+published rows + their
 *     files_related_mph links + its unique product-photo `files` row --
 *     the shared Exide brand logo file is left alone). Not in RECAP.
 *  C) Inserts the 10 missing Exide moto battery_data refs (draft+published
 *     pairs, new `files` rows for each product photo, reusing the existing
 *     Exide brand logo file for brandImg).
 *
 * Run with the Strapi dev server STOPPED (direct sqlite writes while
 * Strapi holds the file open risk being clobbered/corrupted).
 *
 * Usage: node scripts/mirror_battery_light_image_changes.cjs [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const FRONTEND_ROOT = path.join(__dirname, '..', '..', 'react-app-tablet');
const PRODUCTS_DIR = path.join(FRONTEND_ROOT, 'public', 'assets', 'img', 'products');
const PNG_DIR = path.join(PRODUCTS_DIR, 'png');
const STRAPI_DB = path.join(__dirname, '..', '.tmp', 'data.db');

function generateDocumentId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const bytes = crypto.randomBytes(24);
  for (let i = 0; i < 24; i++) id += chars[bytes[i] % chars.length];
  return id;
}

// ---------- Phase A: match png/ files against currently-linked Strapi files ----------
const CONTENT_TYPES = {
  battery_: 'api::battery-data.battery-data',
  light_: 'api::light-data.light-data',
};

function analyzeImageSwaps(db) {
  const pngFiles = fs.readdirSync(PNG_DIR).filter((f) => fs.statSync(path.join(PNG_DIR, f)).isFile());
  const results = [];

  for (const file of pngFiles) {
    const ext = path.extname(file);
    const base = path.basename(file, ext);
    let prefix = null, rawStem = base;
    for (const p of Object.keys(CONTENT_TYPES)) {
      if (base.startsWith(p)) { prefix = p; rawStem = base.slice(p.length); break; }
    }
    if (!prefix) continue; // brand_ and no-prefix files handled separately / not needed here

    const uid = CONTENT_TYPES[prefix];
    const links = db.prepare(`
      SELECT DISTINCT f.id as file_id, f.url, f.ext as file_ext
      FROM files_related_mph m
      JOIN files f ON f.id = m.file_id
      WHERE m.related_type = ? AND m.field = 'img'
    `).all(uid);

    const codeMatch = rawStem.match(/^\d+/);
    const leadingCode = codeMatch ? codeMatch[0] : null;
    let exact = [], byCode = [];
    for (const link of links) {
      const urlBase = path.basename(link.url, path.extname(link.url));
      if (urlBase === rawStem) exact.push(link);
      else if (leadingCode && urlBase.match(/^\d+/)?.[0] === leadingCode) byCode.push(link);
    }
    const matches = exact.length ? exact : byCode;
    if (matches.length === 0) {
      results.push({ file, status: 'NOT_FOUND' });
    } else {
      results.push({ file, rawStem, ext, status: 'UPDATE', matches });
    }
  }
  return results;
}

// ---------- Main ----------
const db = new Database(STRAPI_DB, { readonly: DRY_RUN });

console.log('=== Phase A: image file swaps ===');
const swapResults = analyzeImageSwaps(db);
const toUpdate = swapResults.filter((r) => r.status === 'UPDATE');
const notFound = swapResults.filter((r) => r.status === 'NOT_FOUND');
console.log(`${toUpdate.length} file(s) to update, ${notFound.length} not linked in Strapi (skipped):`);
for (const r of notFound) console.log(`  SKIP ${r.file}`);

console.log('\n=== Phase B: EK700 removal ===');
const ek700Rows = db.prepare("SELECT id, published_at FROM battery_data WHERE ref = 'EK700'").all();
console.log(`${ek700Rows.length} battery_data row(s) for EK700`);
let ek700ImgFileId = null;
if (ek700Rows.length) {
  const link = db.prepare(`
    SELECT file_id FROM files_related_mph
    WHERE related_type = 'api::battery-data.battery-data' AND related_id = ? AND field = 'img'
  `).get(ek700Rows[0].id);
  ek700ImgFileId = link?.file_id ?? null;
  console.log(`  unique img file_id to delete: ${ek700ImgFileId}`);
}

console.log('\n=== Phase C: new Exide moto refs ===');
const NEW_MOTO_REFS = [
  { ref: 'AGM12-4', description: '3Ah 50A AGM12-4', code: '908130' },
  { ref: 'AGM12-5', description: '4Ah 70A AGM12-5', code: '908140' },
  { ref: 'AGM12-7', description: '6Ah 100A AGM12-7', code: '908150' },
  { ref: 'AGM12-7.5', description: '8Ah 120A AGM12-7.5', code: '908160' },
  { ref: 'AGM12-9', description: '9Ah 120A AGM12-9', code: '908180' },
  { ref: 'AGM12-10', description: '10Ah 150A AGM12-10', code: '908190' },
  { ref: 'AGM12-12', description: '12Ah 200A AGM12-12', code: '908200' },
  { ref: 'AGM12-14', description: '12Ah 210A AGM12-14', code: '908210' },
  { ref: 'AGM12-19', description: '18Ah 270A AGM12-19', code: '908220' },
  { ref: 'GEL12-19', description: '19Ah 170A GEL12-19', code: '908230' },
];

const existingRefs = db.prepare('SELECT DISTINCT ref FROM battery_data').all().map((r) => r.ref);
const exideBrandLogo = db.prepare(`
  SELECT f.id FROM files_related_mph m JOIN files f ON f.id = m.file_id
  WHERE m.related_type = 'api::battery-data.battery-data' AND m.field = 'brandImg'
  AND m.related_id = (SELECT id FROM battery_data WHERE ref = 'AGM12-8' LIMIT 1)
`).get();
const brandLogoFileId = exideBrandLogo?.id ?? null;
console.log(`Exide brand logo file_id (reused for brandImg): ${brandLogoFileId}`);

const newRows = [];
for (const r of NEW_MOTO_REFS) {
  if (existingRefs.includes(r.ref)) {
    console.log(`  SKIP ${r.ref}: already exists`);
    continue;
  }
  const productFile = fs.readdirSync(PRODUCTS_DIR).find(
    (f) => f.startsWith(`battery_${r.code}_`) && f.toLowerCase().endsWith('.png')
  );
  if (!productFile) {
    console.log(`  SKIP ${r.ref}: no product image found in products/ for code ${r.code}`);
    continue;
  }
  newRows.push({ ...r, productFile });
}
console.log(`${newRows.length} new row(s) to insert: ${newRows.map((r) => r.ref).join(', ')}`);

if (!brandLogoFileId && newRows.length) {
  console.error('Could not resolve Exide brand logo file_id -- aborting Phase C.');
  process.exit(1);
}

if (DRY_RUN) {
  console.log('\n--dry-run: no changes written.');
  db.close();
  process.exit(0);
}

db.close();
const wdb = new Database(STRAPI_DB);
const now = new Date().toISOString();

const txn = wdb.transaction(() => {
  // Phase A: update file metadata in place
  const updateFile = wdb.prepare('UPDATE files SET name=?, hash=?, ext=?, mime=?, size=?, url=?, updated_at=? WHERE id=?');
  const seenFileIds = new Set();
  for (const r of toUpdate) {
    for (const m of r.matches) {
      if (seenFileIds.has(m.file_id)) continue;
      seenFileIds.add(m.file_id);
      const srcPath = path.join(PNG_DIR, r.file);
      const sizeKb = fs.statSync(srcPath).size / 1024;
      const name = r.file.replace(/^(battery_|light_)/, '').replace(/\.png$/i, '') + '.png';
      updateFile.run(name, r.rawStem, r.ext, 'image/png', sizeKb, `/uploads/${r.rawStem}${r.ext}`, now, m.file_id);
    }
  }
  console.log(`Phase A: updated ${seenFileIds.size} files row(s)`);

  // Phase B: remove EK700
  if (ek700Rows.length) {
    const ids = ek700Rows.map((r) => r.id);
    for (const id of ids) {
      wdb.prepare("DELETE FROM files_related_mph WHERE related_type = 'api::battery-data.battery-data' AND related_id = ?").run(id);
    }
    wdb.prepare(`DELETE FROM battery_data WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    if (ek700ImgFileId) {
      wdb.prepare('DELETE FROM files WHERE id = ?').run(ek700ImgFileId);
    }
    console.log(`Phase B: deleted ${ids.length} battery_data row(s) + unique img file`);
  }

  // Phase C: insert new moto refs
  const insertFile = wdb.prepare(`
    INSERT INTO files (document_id, name, hash, ext, mime, size, url, provider, folder_path, created_at, updated_at, published_at)
    VALUES (?, ?, ?, '.png', 'image/png', ?, ?, 'local', '/2', ?, ?, ?)
  `);
  const insertBatteryData = wdb.prepare(`
    INSERT INTO battery_data (document_id, ref, brand, is_active, description, category, created_at, updated_at, published_at)
    VALUES (?, ?, 'Exide', 1, ?, 'battery', ?, ?, ?)
  `);
  const insertLink = wdb.prepare(`
    INSERT INTO files_related_mph (file_id, related_id, related_type, field, "order")
    VALUES (?, ?, 'api::battery-data.battery-data', ?, 1.0)
  `);

  for (const r of newRows) {
    const srcPath = path.join(PRODUCTS_DIR, r.productFile);
    const sizeKb = fs.statSync(srcPath).size / 1024;
    const rawStem = r.productFile.replace(/^battery_/, '').replace(/\.png$/i, '');
    const displayName = r.productFile.replace(/^battery_\d+_/, '').replace(/_[a-f0-9]{10}\.png$/i, '').replace(/_/g, ' ');

    const fileInfo = insertFile.run(generateDocumentId(), `${displayName}.png`, rawStem, sizeKb, `/uploads/${rawStem}.png`, now, now, now);
    const fileId = fileInfo.lastInsertRowid;

    const documentId = generateDocumentId();
    const draftInfo = insertBatteryData.run(documentId, r.ref, r.description, now, now, null);
    const pubInfo = insertBatteryData.run(documentId, r.ref, r.description, now, now, now);
    const draftId = draftInfo.lastInsertRowid;
    const pubId = pubInfo.lastInsertRowid;

    for (const rowId of [draftId, pubId]) {
      insertLink.run(fileId, rowId, 'img');
      insertLink.run(brandLogoFileId, rowId, 'brandImg');
    }
    console.log(`Phase C: inserted ${r.ref} (draft id=${draftId}, published id=${pubId}, file id=${fileId})`);
  }
});

txn();
wdb.close();
console.log('\nDone.');
