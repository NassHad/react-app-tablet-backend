/**
 * Export LightsProduct data to CSV (SQLite direct query)
 * One row per light position (lightPositions JSON array flattened)
 * Only published entries.
 * Usage: node scripts/export-lights-products-to-csv.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');
const OUTPUT_FILE = path.join(__dirname, 'exported_data', 'lights-products-export.csv');
const BATCH_SIZE = 1000;

const CSV_HEADERS = [
  'marque', 'modele', 'nom', 'ref', 'position_feu', 'type_ampoule', 'categorie',
  'annee_debut', 'annee_fin', 'typeConception', 'partNumber', 'notes', 'source', 'isActive'
];

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsvRow(values) {
  return values.map(escapeCell).join(';');
}

// MM/YY → MM/YYYY  (YY >= 30 → 19YY, YY < 30 → 20YY)
function formatDate(value) {
  if (!value) return value;
  const match = String(value).match(/^(\d{2})\/(\d{2})$/);
  if (!match) return value;
  const [, month, yy] = match;
  const year = parseInt(yy, 10) >= 30 ? `19${yy}` : `20${yy}`;
  return `${month}/${year}`;
}

const QUERY = `
  SELECT
    lp.id,
    lp.name,
    lp.ref,
    lp.light_positions,
    lp.construction_year_start,
    lp.construction_year_end,
    lp.type_conception,
    lp.part_number,
    lp.notes,
    lp.source,
    lp.is_active,
    b.name AS brand_name,
    m.name AS model_name
  FROM lights_products lp
  LEFT JOIN lights_products_brand_lnk bln ON bln.lights_product_id = lp.id
  LEFT JOIN brands b ON b.id = bln.brand_id
  LEFT JOIN lights_products_model_lnk mln ON mln.lights_product_id = lp.id
  LEFT JOIN models m ON m.id = mln.model_id
  WHERE lp.published_at IS NOT NULL
  ORDER BY lp.id
  LIMIT ? OFFSET ?
`;

function main() {
  const db = new Database(DB_PATH, { readonly: true });

  const total = db.prepare(
    'SELECT COUNT(*) AS cnt FROM lights_products WHERE published_at IS NOT NULL'
  ).get().cnt;

  console.log(`Found ${total} published LightsProduct entries.`);

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const stream = fs.createWriteStream(OUTPUT_FILE, { encoding: 'utf8' });
  stream.write(toCsvRow(CSV_HEADERS) + '\n');

  const stmt = db.prepare(QUERY);
  let offset = 0;
  let totalRows = 0;

  while (offset < total) {
    const products = stmt.all(BATCH_SIZE, offset);

    for (const product of products) {
      let positions;
      try {
        positions = product.light_positions ? JSON.parse(product.light_positions) : [];
      } catch {
        positions = [];
      }

      if (positions.length === 0) positions = [{}];

      for (const pos of positions) {
        stream.write(toCsvRow([
          product.brand_name ?? '',
          product.model_name ?? '',
          product.name ?? '',
          product.ref ?? '',
          pos.position ?? '',
          pos.ref ?? '',
          pos.category ?? '',
          formatDate(product.construction_year_start) ?? '',
          formatDate(product.construction_year_end) ?? '',
          product.type_conception ?? '',
          product.part_number ?? '',
          product.notes ?? '',
          product.source ?? '',
          product.is_active ?? ''
        ]) + '\n');
        totalRows++;
      }
    }

    offset += BATCH_SIZE;
    console.log(`  Processed ${Math.min(offset, total)}/${total} products, ${totalRows} rows written...`);
  }

  stream.end();
  db.close();

  console.log(`\nDone. ${total} products → ${totalRows} rows.`);
  console.log(OUTPUT_FILE);
}

main();
