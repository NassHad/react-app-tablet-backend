const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Find and assign Citroen brand to FilterCompatibility records without a brand.
 *
 * Usage:
 *   # Step 0 (optional): Fix the Citroen brand name/slug
 *   node scripts/find-citroen-filter-compatibilities.js --fix-brand
 *   DRY_RUN=false node scripts/find-citroen-filter-compatibilities.js --fix-brand
 *
 *   # Step 1: Find candidates and output to JSON for review
 *   node scripts/find-citroen-filter-compatibilities.js --find
 *
 *   # Step 2: Manually review/edit scripts/citroen-filter-compatibilities-candidates.json
 *
 *   # Step 3: Assign Citroen brand (dry-run first)
 *   node scripts/find-citroen-filter-compatibilities.js --assign
 *
 *   # Step 4: Apply for real
 *   DRY_RUN=false node scripts/find-citroen-filter-compatibilities.js --assign
 */

// Configuration
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const PAGE_SIZE = 100;
const BATCH_SIZE = 10;
const DELAY_MS = 200;
const CANDIDATES_FILE = path.join(__dirname, 'citroen-filter-compatibilities-candidates.json');

// Citroen model name patterns
const CITROEN_PATTERNS = [
  /^C[1-8]\b/i,           // C1, C2, C3, C4, C5, C6, C8 + variants
  /^CX\b/i,               // CX
  /^DS\s*[3-9]\b/i,       // DS3, DS4, DS5 (not standalone "DS" which is a separate brand)
  /^BERLINGO/i,
  /^XSARA/i,
  /^SAXO/i,
  /^ZX\b/i,
  /^BX\b/i,
  /^AX\b/i,
  /^XM\b/i,
  /^XANTIA/i,
  /^VISA\b/i,
  /^DYANE/i,
  /^MEHARI/i,
  /^GS\b/i,
  /^SM\b/i,
  /^ID\s/i,
  /^HY\b/i,
  /^LNA\b/i,
  /^ACADIANE/i,
  /^NEMO/i,
  /^JUMPER/i,
  /^JUMPY/i,
  /^DISPATCH/i,
  /^RELAY/i,
  /PICASSO/i,             // Any Picasso variant
  /^[eë]-C/i,             // Electric variants (ë-C4)
  /^2\s*CV/i,             // 2CV
  /^AMI\b/i,              // AMI
  /^TRACTION/i,           // Traction Avant
  /^EVASION/i,
  /^SPACETOURER/i,
  /^C-ELYSEE/i,
  /^C-CROSSER/i,
  /^C-ZERO/i,
];

// Make HTTP request
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
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsedData });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Check if a vehicleModel matches Citroen patterns
function isCitroenModel(vehicleModel) {
  if (!vehicleModel) return false;
  const trimmed = vehicleModel.trim();
  return CITROEN_PATTERNS.some(pattern => pattern.test(trimmed));
}

// Fetch all FilterCompatibility records without a brand (paginated)
async function fetchRecordsWithoutBrand() {
  console.log('Fetching FilterCompatibility records without a brand...\n');

  let allRecords = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await makeRequest(
      `/filter-compatibilities?filters[brand][id][$null]=true&populate=brand&pagination[page]=${page}&pagination[pageSize]=${PAGE_SIZE}`
    );

    if (response.status !== 200) {
      throw new Error(`Failed to fetch records: HTTP ${response.status}`);
    }

    const records = response.data.data || [];
    allRecords = allRecords.concat(records);

    console.log(`  Page ${page}: ${records.length} records (total: ${allRecords.length})`);

    hasMore = records.length === PAGE_SIZE;
    page++;
  }

  console.log(`\nTotal records without brand: ${allRecords.length}\n`);
  return allRecords;
}

// Find Citroen brand in DB (checks both "citroen" and "citron" slugs)
async function findCitroenBrand() {
  // Try "citron" first (the one with 203 models)
  let response = await makeRequest('/brands?filters[slug][$eq]=citron');
  let brands = response.data?.data || response.data || [];
  if (brands.length > 0) {
    const brand = brands[0];
    console.log(`Found Citroen brand: "${brand.name}" (ID: ${brand.id}, slug: "citron", documentId: ${brand.documentId})`);
    return brand;
  }

  // Try "citroen" slug
  response = await makeRequest('/brands?filters[slug][$eq]=citroen');
  brands = response.data?.data || response.data || [];
  if (brands.length > 0) {
    const brand = brands[0];
    console.log(`Found Citroen brand: "${brand.name}" (ID: ${brand.id}, slug: "citroen", documentId: ${brand.documentId})`);
    return brand;
  }

  throw new Error('No Citroen brand found (checked slugs "citron" and "citroen")');
}

// ============================================================
// MODE: --find
// ============================================================
async function findCitroenCandidates() {
  console.log('=== FIND MODE: Searching for Citroen FilterCompatibility records ===\n');

  const allRecords = await fetchRecordsWithoutBrand();

  if (allRecords.length === 0) {
    console.log('No records without brand found.');
    return;
  }

  // Filter by Citroen patterns
  const candidates = allRecords.filter(record => isCitroenModel(record.vehicleModel));

  console.log(`Citroen pattern matches: ${candidates.length} / ${allRecords.length}\n`);

  if (candidates.length === 0) {
    console.log('No Citroen candidates found.');
    return;
  }

  // Extract unique vehicleModel values for review
  const uniqueModels = [...new Set(candidates.map(c => c.vehicleModel))].sort();
  console.log(`Unique vehicleModel values (${uniqueModels.length}):`);
  uniqueModels.forEach(model => {
    const count = candidates.filter(c => c.vehicleModel === model).length;
    console.log(`  - "${model}" (${count} records)`);
  });

  // Prepare output
  const output = {
    generatedAt: new Date().toISOString(),
    totalWithoutBrand: allRecords.length,
    totalCitroenCandidates: candidates.length,
    uniqueModels: uniqueModels.length,
    candidates: candidates.map(record => ({
      id: record.id,
      documentId: record.documentId,
      vehicleModel: record.vehicleModel,
      vehicleVariant: record.vehicleVariant || null,
      engineCode: record.engineCode || null
    }))
  };

  // Write to file
  fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(output, null, 2), 'utf8');

  // Summary
  console.log('\n--- Summary ---');
  console.log(`Total without brand: ${allRecords.length}`);
  console.log(`Total matching Citroen patterns: ${candidates.length}`);
  console.log(`Output file: ${CANDIDATES_FILE}`);
  console.log('\nPlease review the file and remove any false positives before running --assign');
}

// ============================================================
// MODE: --assign
// ============================================================
async function assignCitroenBrand() {
  console.log('=== ASSIGN MODE: Assigning Citroen brand to FilterCompatibility records ===\n');
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no changes)' : 'LIVE UPDATE'}\n`);

  // Read candidates file
  if (!fs.existsSync(CANDIDATES_FILE)) {
    console.error(`Candidates file not found: ${CANDIDATES_FILE}`);
    console.error('Run with --find first to generate the candidates file.');
    process.exit(1);
  }

  const candidatesData = JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));
  const candidates = candidatesData.candidates;

  console.log(`Loaded ${candidates.length} candidates from file\n`);

  if (candidates.length === 0) {
    console.log('No candidates to process.');
    return;
  }

  // Find Citroen brand
  const citroenBrand = await findCitroenBrand();
  console.log();

  // Process in batches
  let updated = 0;
  let errors = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(candidates.length / BATCH_SIZE);

    console.log(`Batch ${batchNum}/${totalBatches} (records ${i + 1}-${Math.min(i + BATCH_SIZE, candidates.length)})`);

    for (const candidate of batch) {
      if (DRY_RUN) {
        console.log(`  [DRY-RUN] Would update ID ${candidate.id} (${candidate.vehicleModel})`);
        skipped++;
        continue;
      }

      try {
        const response = await makeRequest(
          `/filter-compatibilities/${candidate.documentId}`,
          'PUT',
          { data: { brand: citroenBrand.id } }
        );

        if (response.status === 200) {
          updated++;
          console.log(`  Updated ID ${candidate.id} (${candidate.vehicleModel})`);
        } else {
          errors++;
          console.error(`  Failed ID ${candidate.id}: HTTP ${response.status}`);
        }
      } catch (error) {
        errors++;
        console.error(`  Error ID ${candidate.id}: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (i + BATCH_SIZE < candidates.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  // Summary
  console.log('\n--- Assignment Summary ---');
  console.log(`Total candidates: ${candidates.length}`);
  if (DRY_RUN) {
    console.log(`Would update: ${skipped}`);
    console.log('\nDRY-RUN complete. Set DRY_RUN=false to apply changes.');
  } else {
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors}`);
  }
}

// ============================================================
// MODE: --fix-brand
// ============================================================
async function fixCitroenBrand() {
  console.log('=== FIX-BRAND MODE: Fixing Citroen brand name and slug ===\n');
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no changes)' : 'LIVE UPDATE'}\n`);

  // Step 1: Find both brand entries
  const citroenResponse = await makeRequest('/brands?filters[slug][$eq]=citroen');
  const citronResponse = await makeRequest('/brands?filters[slug][$eq]=citron');

  const citroenBrands = citroenResponse.data?.data || citroenResponse.data || [];
  const citronBrands = citronResponse.data?.data || citronResponse.data || [];

  console.log('Current state:');
  if (citroenBrands.length > 0) {
    const b = citroenBrands[0];
    console.log(`  - slug "citroen": "${b.name}" (ID: ${b.id}, documentId: ${b.documentId})`);
  } else {
    console.log('  - slug "citroen": not found');
  }
  if (citronBrands.length > 0) {
    const b = citronBrands[0];
    console.log(`  - slug "citron": "${b.name}" (ID: ${b.id}, documentId: ${b.documentId})`);
  } else {
    console.log('  - slug "citron": not found');
  }
  console.log();

  // Step 2: Delete the empty "citroen" brand (ID: 590) if it exists
  if (citroenBrands.length > 0) {
    const emptyBrand = citroenBrands[0];

    // Verify it has no models
    const modelsResponse = await makeRequest(`/models?filters[brand][id][$eq]=${emptyBrand.id}&pagination[pageSize]=1`);
    const modelCount = modelsResponse.data?.data?.length || modelsResponse.data?.length || 0;

    if (modelCount > 0) {
      console.log(`WARNING: Brand "citroen" (ID: ${emptyBrand.id}) has ${modelCount} models. Skipping deletion.`);
    } else {
      if (DRY_RUN) {
        console.log(`[DRY-RUN] Would delete empty brand "citroen" (ID: ${emptyBrand.id}, documentId: ${emptyBrand.documentId})`);
      } else {
        console.log(`Deleting empty brand "citroen" (ID: ${emptyBrand.id})...`);
        const deleteResponse = await makeRequest(`/brands/${emptyBrand.documentId}`, 'DELETE');
        if (deleteResponse.status === 200 || deleteResponse.status === 204) {
          console.log('  Deleted successfully');
        } else {
          console.error(`  Failed to delete: HTTP ${deleteResponse.status}`);
          console.error('  Cannot proceed with slug rename. Exiting.');
          return;
        }
      }
    }
  }

  // Step 3: Rename "citron" -> name: "CITROEN", slug: "citroen"
  if (citronBrands.length > 0) {
    const realBrand = citronBrands[0];

    if (DRY_RUN) {
      console.log(`[DRY-RUN] Would update brand ID ${realBrand.id}:`);
      console.log(`  name: "${realBrand.name}" -> "CITROEN"`);
      console.log(`  slug: "citron" -> "citroen"`);
    } else {
      console.log(`Updating brand ID ${realBrand.id}...`);
      const updateResponse = await makeRequest(`/brands/${realBrand.documentId}`, 'PUT', {
        data: {
          name: 'CITROEN',
          slug: 'citroen'
        }
      });

      if (updateResponse.status === 200) {
        console.log('  Updated successfully: name="CITROEN", slug="citroen"');
      } else {
        console.error(`  Failed to update: HTTP ${updateResponse.status}`);
        console.error('  Response:', JSON.stringify(updateResponse.data));
      }
    }
  } else {
    console.log('No "citron" brand found to rename.');
  }

  console.log();
  if (DRY_RUN) {
    console.log('DRY-RUN complete. Set DRY_RUN=false to apply changes.');
  } else {
    console.log('Brand fix complete.');
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--find';

  try {
    switch (mode) {
      case '--find':
        await findCitroenCandidates();
        break;
      case '--assign':
        await assignCitroenBrand();
        break;
      case '--fix-brand':
        await fixCitroenBrand();
        break;
      default:
        console.log('Usage:');
        console.log('  node scripts/find-citroen-filter-compatibilities.js --find       # Find candidates');
        console.log('  node scripts/find-citroen-filter-compatibilities.js --assign     # Assign brand (dry-run)');
        console.log('  node scripts/find-citroen-filter-compatibilities.js --fix-brand  # Fix brand name/slug');
        console.log('');
        console.log('Environment variables:');
        console.log('  DRY_RUN=false         Apply changes (default: true, dry-run)');
        console.log('  STRAPI_URL=...        Strapi URL (default: http://localhost:1338)');
        console.log('  STRAPI_API_TOKEN=...  Optional API token for authenticated requests');
        process.exit(1);
    }
  } catch (error) {
    console.error('\nFatal error:', error.message);
    process.exit(1);
  }
}

main();
