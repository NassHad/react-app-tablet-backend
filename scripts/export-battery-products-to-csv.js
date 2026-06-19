/**
 * Export BatteryProduct data to CSV (SQLite direct query)
 * One row per motorisation entry (motorisations JSON array flattened)
 * Only published entries.
 * Usage: node scripts/export-battery-products-to-csv.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');
const OUTPUT_FILE = path.join(__dirname, 'exported_data', 'battery-products-export.csv');
const BATCH_SIZE = 1000;

const CSV_HEADERS = [
  'marque', 'modele', 'motorisation', 'carburant',
  'date_debut', 'date_fin',
  'batterie_AGM', 'batterie_EFB', 'batterie_conventionnelle',
  'complementaire_1', 'complementaire_2',
  'battery_brand', 'isActive'
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

// "1995-01-01" → "01/1995"
function formatDate(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) return value;
  const [, year, month] = match;
  return `${month}/${year}`;
}

const QUERY = `
  SELECT id, brand, model_name, motorisations, battery_brand, is_active
  FROM battery_products
  WHERE published_at IS NOT NULL
  ORDER BY id
  LIMIT ? OFFSET ?
`;

function main() {
  const db = new Database(DB_PATH, { readonly: true });

  const total = db.prepare(
    'SELECT COUNT(*) AS cnt FROM battery_products WHERE published_at IS NOT NULL'
  ).get().cnt;

  console.log(`Found ${total} published BatteryProduct entries.`);

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
      let motorisations;
      try {
        motorisations = product.motorisations ? JSON.parse(product.motorisations) : [];
      } catch {
        motorisations = [];
      }

      if (motorisations.length === 0) motorisations = [{}];

      for (const mot of motorisations) {
        const range = mot.batteryComplementaryRange ?? {};
        stream.write(toCsvRow([
          product.brand ?? '',
          product.model_name ?? '',
          mot.motorisation ?? '',
          mot.fuel ?? '',
          formatDate(mot.startDate),
          formatDate(mot.endDate),
          mot.batteryAGM ?? '',
          mot.batteryEFB ?? '',
          mot.batteryConventional ?? '',
          range.option1 ?? '',
          range.option2 ?? '',
          product.battery_brand ?? '',
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
