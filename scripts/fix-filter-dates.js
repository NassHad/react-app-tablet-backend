const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

/**
 * Script to fix corrupted dates in FilterCompatibility records
 *
 * Problem: The Purflux CSV file had dates corrupted by Excel
 * - 08/08 (August 2008) became "08-août" (August 8)
 * - 05/10 (May 2010) became "05-oct" (October 5)
 *
 * Solution: Use the v2 CSV file (with correct dates) as reference
 */

const CSV_FILE = path.join(__dirname, 'liste_affectation', 'Applications_borne_20240118_v2.csv');

// CLI options
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find(arg => arg.startsWith('--limit='));
const RECORD_LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : null;

// Helper function to make API calls to Strapi
async function strapiRequest(endpoint, method = 'GET', data = null) {
  const url = `${STRAPI_URL}/api${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(API_TOKEN && { 'Authorization': `Bearer ${API_TOKEN}` })
    }
  };

  if (data) {
    options.body = JSON.stringify({ data });
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return await response.json();
}

// Load correct dates from v2 CSV file
async function loadCorrectDates() {
  console.log(`\n📁 Loading correct dates from: ${CSV_FILE}`);

  const datesMap = new Map();

  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(parse({
        delimiter: ';',
        columns: [
          'marque', 'typemodele', 'modele', 'puissance', 'moteur',
          'debut', 'fin', 'comfixe', 'commentaire', 'date',
          'air', 'habitacle', 'gazole', 'huile'
        ],
        skip_empty_lines: true,
        trim: true
      }))
      .on('data', (row) => {
        // Skip header row
        if (row.marque === 'Marque') return;

        // Create unique key (same as import script)
        const uniqueKey = `${row.marque}|${row.modele}|${row.moteur}|${row.puissance}`;

        // Only store first occurrence (same logic as import)
        if (!datesMap.has(uniqueKey)) {
          datesMap.set(uniqueKey, {
            debut: row.debut || '',
            fin: row.fin || ''
          });
        }
      })
      .on('end', () => {
        console.log(`   ✅ Loaded ${datesMap.size} unique date records`);
        resolve(datesMap);
      })
      .on('error', reject);
  });
}

// Fetch all FilterCompatibility records with pagination
async function fetchAllFilterCompatibilities() {
  console.log('\n📥 Fetching FilterCompatibility records from Strapi...');

  const allRecords = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    const response = await strapiRequest(
      `/filter-compatibilities?populate=brand&pagination[page]=${page}&pagination[pageSize]=${pageSize}`
    );

    if (response.data && response.data.length > 0) {
      allRecords.push(...response.data);
      console.log(`   📄 Page ${page}: ${response.data.length} records (total: ${allRecords.length})`);

      if (RECORD_LIMIT && allRecords.length >= RECORD_LIMIT) {
        allRecords.splice(RECORD_LIMIT);
        hasMore = false;
      } else if (response.data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  console.log(`   ✅ Fetched ${allRecords.length} records total`);
  return allRecords;
}

// Update a single FilterCompatibility record
async function updateRecord(documentId, productionStart, productionEnd) {
  return strapiRequest(`/filter-compatibilities/${documentId}`, 'PUT', {
    productionStart,
    productionEnd
  });
}

// Main fix function
async function fixFilterDates() {
  console.log('🔧 FilterCompatibility Date Fix Script');
  console.log('=====================================');

  if (DRY_RUN) {
    console.log('🧪 DRY RUN MODE - No changes will be made');
  }
  if (RECORD_LIMIT) {
    console.log(`📊 Limiting to ${RECORD_LIMIT} records`);
  }

  // Step 1: Load correct dates from v2 CSV
  const correctDates = await loadCorrectDates();

  // Step 2: Fetch all FilterCompatibility records
  const records = await fetchAllFilterCompatibilities();

  // Step 3: Compare and update
  console.log('\n🔄 Comparing and updating dates...');

  const stats = {
    checked: 0,
    needsUpdate: 0,
    updated: 0,
    noMatch: 0,
    errors: 0
  };

  const changes = [];

  for (const record of records) {
    stats.checked++;

    // Reconstruct the unique key
    const brandName = record.brand?.name || '';
    const uniqueKey = `${brandName}|${record.vehicleModel}|${record.engineCode}|${record.power}`;

    const correctData = correctDates.get(uniqueKey);

    if (!correctData) {
      stats.noMatch++;
      continue;
    }

    // Check if dates need updating
    const currentStart = record.productionStart || '';
    const currentEnd = record.productionEnd || '';
    const needsUpdate = currentStart !== correctData.debut || currentEnd !== correctData.fin;

    if (needsUpdate) {
      stats.needsUpdate++;

      changes.push({
        id: record.id,
        documentId: record.documentId,
        brand: brandName,
        model: record.vehicleModel,
        before: { start: currentStart, end: currentEnd },
        after: { start: correctData.debut, end: correctData.fin }
      });

      if (!DRY_RUN) {
        try {
          await updateRecord(record.documentId, correctData.debut, correctData.fin);
          stats.updated++;

          if (stats.updated % 100 === 0) {
            console.log(`   ✏️  Updated ${stats.updated} records...`);
          }
        } catch (error) {
          console.error(`   ❌ Error updating record ${record.documentId}: ${error.message}`);
          stats.errors++;
        }
      }
    }
  }

  // Step 4: Print report
  console.log('\n📊 Summary Report');
  console.log('=================');
  console.log(`   📋 Records checked: ${stats.checked}`);
  console.log(`   🔍 No match in CSV: ${stats.noMatch}`);
  console.log(`   ⚠️  Needs update: ${stats.needsUpdate}`);

  if (!DRY_RUN) {
    console.log(`   ✅ Successfully updated: ${stats.updated}`);
    console.log(`   ❌ Errors: ${stats.errors}`);
  }

  // Show sample changes
  if (changes.length > 0) {
    console.log('\n📝 Sample changes (first 10):');
    console.log('─'.repeat(80));

    for (const change of changes.slice(0, 10)) {
      console.log(`   ${change.brand} | ${change.model}`);
      console.log(`      Start: "${change.before.start}" → "${change.after.start}"`);
      console.log(`      End:   "${change.before.end}" → "${change.after.end}"`);
    }

    if (changes.length > 10) {
      console.log(`   ... and ${changes.length - 10} more`);
    }
  }

  if (DRY_RUN && stats.needsUpdate > 0) {
    console.log('\n💡 Run without --dry-run to apply these changes');
  }
}

// Run the script
fixFilterDates().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
