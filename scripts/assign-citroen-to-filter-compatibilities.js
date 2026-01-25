const http = require('http');

/**
 * Assign Citroen brand to FilterCompatibility entries (IDs 4849-5759)
 *
 * This script assigns the Citroen brand to FilterCompatibility entries
 * that are currently without a brand association.
 *
 * Usage:
 *   1. Start Strapi: npm run dev
 *   2. Run this script: node scripts/assign-citroen-to-filter-compatibilities.js
 *   3. For production: DRY_RUN=false node scripts/assign-citroen-to-filter-compatibilities.js
 */

// Configuration
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';
const DRY_RUN = process.env.DRY_RUN !== 'false';

// ID range to process
const MIN_ID = 4849;
const MAX_ID = 5759;
const BATCH_SIZE = 10; // Reduced to avoid SQLite "too many terms" error
const DELAY_MS = 200; // Increased delay between batches

/**
 * Make HTTP request to Strapi API
 */
function makeRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${STRAPI_URL}/api${endpoint}`);

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (API_TOKEN) {
      options.headers['Authorization'] = `Bearer ${API_TOKEN}`;
    }

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${parsedData.message || responseData}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Get Citroen brand from Strapi
 */
async function getCitroenBrand() {
  console.log('📋 Fetching Citroen brand...\n');

  try {
    const response = await makeRequest('/brands?filters[slug][$eq]=citroen');
    
    // Handle both response formats: direct array or wrapped in data property
    const brandsArray = Array.isArray(response) ? response : (response.data || []);

    if (brandsArray.length === 0) {
      throw new Error('Citroen brand not found. Make sure the brand exists with slug "citroen"');
    }

    const brand = brandsArray[0];
    console.log(`✅ Found Citroen brand: ${brand.name} (ID: ${brand.id}, documentId: ${brand.documentId})\n`);

    return {
      id: brand.id,
      documentId: brand.documentId
    };
  } catch (error) {
    console.error(`❌ Error fetching Citroen brand: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch FilterCompatibility entries in the ID range
 */
async function fetchFilterCompatibilities() {
  console.log(`📥 Fetching FilterCompatibility entries (IDs ${MIN_ID}-${MAX_ID})...\n`);

  try {
    // Fetch entries with pagination
    const allEntries = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await makeRequest(
        `/filter-compatibilities?filters[id][$gte]=${MIN_ID}&filters[id][$lte]=${MAX_ID}&populate=brand&pagination[page]=${page}&pagination[pageSize]=${pageSize}`
      );

      // Handle both response formats
      const entriesArray = Array.isArray(response) ? response : (response.data || []);

      if (entriesArray.length > 0) {
        allEntries.push(...entriesArray);
        console.log(`   📄 Page ${page}: ${entriesArray.length} entries (total: ${allEntries.length})`);

        if (entriesArray.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`\n✅ Fetched ${allEntries.length} entries total\n`);
    return allEntries;
  } catch (error) {
    console.error(`❌ Error fetching FilterCompatibility entries: ${error.message}`);
    throw error;
  }
}

/**
 * Filter entries without brand
 */
function filterEntriesWithoutBrand(entries) {
  const withoutBrand = entries.filter(entry => !entry.brand || !entry.brand.id);
  const withBrand = entries.filter(entry => entry.brand && entry.brand.id);

  console.log(`📊 Filtering entries:`);
  console.log(`   - Total entries: ${entries.length}`);
  console.log(`   - Without brand: ${withoutBrand.length}`);
  console.log(`   - With brand: ${withBrand.length}\n`);

  if (withBrand.length > 0) {
    console.log(`⚠️  Entries that already have a brand (will be skipped):`);
    withBrand.slice(0, 10).forEach(entry => {
      console.log(`   - ID ${entry.id}: ${entry.vehicleModel} (brand: ${entry.brand.name})`);
    });
    if (withBrand.length > 10) {
      console.log(`   ... and ${withBrand.length - 10} more\n`);
    } else {
      console.log();
    }
  }

  return withoutBrand;
}

/**
 * Update a FilterCompatibility entry to assign Citroen brand
 * Note: brand is a manyToOne relation, so we use direct ID assignment
 */
async function updateFilterCompatibility(entry, citroenBrandId) {
  try {
    // For manyToOne relations, use direct ID assignment (not connect array)
    const updateData = {
      data: {
        brand: citroenBrandId
      }
    };

    if (DRY_RUN) {
      console.log(`   [DRY-RUN] Would update ID ${entry.id} (${entry.vehicleModel})`);
      return { success: true, dryRun: true };
    }

    await makeRequest(`/filter-compatibilities/${entry.documentId}`, 'PUT', updateData);
    return { success: true, dryRun: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Assign Citroen Brand to FilterCompatibility');
  console.log('═══════════════════════════════════════════════\n');
  console.log(`Mode: ${DRY_RUN ? '🧪 DRY-RUN (no changes will be made)' : '⚡ LIVE UPDATE'}`);
  console.log(`ID Range: ${MIN_ID} - ${MAX_ID}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Delay: ${DELAY_MS}ms\n`);

  const stats = {
    total: 0,
    withoutBrand: 0,
    withBrand: 0,
    updated: 0,
    errors: 0,
    skipped: 0
  };

  const errors = [];

  try {
    // Step 1: Get Citroen brand
    const citroenBrand = await getCitroenBrand();

    // Step 2: Fetch FilterCompatibility entries
    const allEntries = await fetchFilterCompatibilities();
    stats.total = allEntries.length;

    if (allEntries.length === 0) {
      console.log('⚠️  No entries found in the specified ID range.\n');
      return;
    }

    // Step 3: Filter entries without brand
    const entriesToUpdate = filterEntriesWithoutBrand(allEntries);
    stats.withoutBrand = entriesToUpdate.length;
    stats.withBrand = stats.total - stats.withoutBrand;

    if (entriesToUpdate.length === 0) {
      console.log('✅ All entries already have a brand assigned!\n');
      return;
    }

    // Step 4: Update entries in batches
    console.log(`🔄 Updating ${entriesToUpdate.length} entries...\n`);

    for (let i = 0; i < entriesToUpdate.length; i += BATCH_SIZE) {
      const batch = entriesToUpdate.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(entriesToUpdate.length / BATCH_SIZE);

      console.log(`📦 Batch ${batchNumber}/${totalBatches} (Entries ${i + 1}-${Math.min(i + BATCH_SIZE, entriesToUpdate.length)})`);

      for (const entry of batch) {
        const result = await updateFilterCompatibility(entry, citroenBrand.id);

        if (result.success) {
          if (result.dryRun) {
            stats.skipped++;
          } else {
            stats.updated++;
          }
        } else {
          stats.errors++;
          errors.push({
            id: entry.id,
            documentId: entry.documentId,
            vehicleModel: entry.vehicleModel,
            error: result.error
          });
          console.log(`   ❌ Error updating ID ${entry.id}: ${result.error}`);
        }

        // Small delay between individual updates to avoid overwhelming SQLite
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`   ✅ Batch ${batchNumber} processed (${stats.updated} updated, ${stats.errors} errors)\n`);

      // Delay between batches (except for the last one)
      if (i + BATCH_SIZE < entriesToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    // Step 5: Final verification
    console.log('🔍 Verifying updates...\n');
    const verificationEntries = await fetchFilterCompatibilities();
    const stillWithoutBrand = verificationEntries.filter(entry => !entry.brand || !entry.brand.id);

    // Step 6: Summary report
    console.log('═══════════════════════════════════════════════');
    console.log('📊 Summary Report\n');
    console.log(`   Total entries in range: ${stats.total}`);
    console.log(`   Entries without brand (initial): ${stats.withoutBrand}`);
    console.log(`   Entries with brand (skipped): ${stats.withBrand}`);
    console.log(`   ${DRY_RUN ? 'Would update' : 'Updated'}: ${stats.updated}`);
    console.log(`   Errors: ${stats.errors}`);
    console.log(`   Entries still without brand: ${stillWithoutBrand.length}\n`);

    if (errors.length > 0) {
      console.log('❌ Errors encountered:\n');
      errors.slice(0, 10).forEach((err, index) => {
        console.log(`   ${index + 1}. ID ${err.id} (${err.vehicleModel}): ${err.error}`);
      });
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors\n`);
      } else {
        console.log();
      }
    }

    if (stillWithoutBrand.length > 0) {
      console.log('⚠️  Entries still without brand:\n');
      stillWithoutBrand.slice(0, 10).forEach(entry => {
        console.log(`   - ID ${entry.id}: ${entry.vehicleModel}`);
      });
      if (stillWithoutBrand.length > 10) {
        console.log(`   ... and ${stillWithoutBrand.length - 10} more\n`);
      } else {
        console.log();
      }
    } else {
      console.log('✅ All entries in the range now have the Citroen brand assigned!\n');
    }

    console.log('═══════════════════════════════════════════════\n');

    if (DRY_RUN) {
      console.log('🧪 DRY-RUN COMPLETE');
      console.log('ℹ️  No changes were made. Set DRY_RUN=false to apply updates.\n');
    } else {
      console.log('✅ UPDATE COMPLETE\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
