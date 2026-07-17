/**
 * Strapi mirror of react-app-tablet/scripts/fix_hyundai_ix_casing.cjs.
 * Fixes models.name AND models.display_name (Strapi has display_name as its
 * own column, not a separate JSON mapping file like SQLite).
 *
 * Usage: node scripts/fix-hyundai-ix-casing.cjs [--dry-run]
 */
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

const RENAMES = [
  { oldName: 'iX35', newName: 'IX35', oldDisplay: 'ix35', newDisplay: 'IX35' },
  { oldName: 'ix20', newName: 'IX20', oldDisplay: 'ix 20', newDisplay: 'IX20' },
  { oldName: 'ix35 Van', newName: 'IX35 Van', oldDisplay: 'ix35', newDisplay: 'IX35' },
  { oldName: 'ix55', newName: 'IX55', oldDisplay: 'ix 55', newDisplay: 'IX55' },
];

const db = new Database(DB_PATH, { readonly: DRY_RUN });
let total = 0;
for (const r of RENAMES) {
  const rows = db.prepare(`
    SELECT m.id FROM models m JOIN models_brand_lnk lnk ON lnk.model_id=m.id JOIN brands b ON b.id=lnk.brand_id
    WHERE b.slug='hyundai' AND m.name=?
  `).all(r.oldName);
  console.log(`"${r.oldName}" -> "${r.newName}": ${rows.length} row(s)`);
  total += rows.length;
  if (!DRY_RUN) {
    for (const row of rows) {
      db.prepare('UPDATE models SET name=?, display_name=? WHERE id=?').run(r.newName, r.newDisplay, row.id);
    }
  }
}
db.close();
console.log(DRY_RUN ? `[DRY RUN] ${total} row(s) would be updated.` : `Applied to ${total} row(s).`);
