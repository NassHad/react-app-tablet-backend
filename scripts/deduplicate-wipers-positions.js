const http = require('http');

// Configuration
const API_BASE_URL = 'http://localhost:1338';
const PAGE_SIZE = 100;
const DELAY_BETWEEN_UPDATES = 100; // ms

// Function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request error:', e.message);
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Deduplicate wiper positions based on ref+position+brand (or position+brand+size+description if no ref)
// Keeps the first occurrence and removes subsequent duplicates
function deduplicatePositions(positions) {
  const seen = new Set();
  return positions.filter(pos => {
    const ref = (pos.ref || '').toString().trim().toLowerCase();
    const position = (pos.position || '').toString().trim().toLowerCase();
    const brand = (pos.brand || '').toString().trim().toLowerCase();

    let key;
    if (ref) {
      key = `${ref}|${position}|${brand}`;
    } else {
      const size = (pos.size || '').toString().trim().toLowerCase();
      const description = (pos.description || '').toString().trim().toLowerCase();
      key = `${position}|${brand}|${size}|${description}`;
    }

    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Main function
async function deduplicateAllWipersPositions() {
  console.log('Starting wipersPositions deduplication...\n');

  try {
    // 1. Fetch all wipers-products with pagination
    console.log('Fetching all wipers products...');
    let allProducts = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(`Fetching page ${page}...`);
      const getOptions = {
        hostname: 'localhost',
        port: 1338,
        path: `/api/wipers-products?pagination[page]=${page}&pagination[pageSize]=${PAGE_SIZE}`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const response = await makeRequest(getOptions);

      if (response.status !== 200) {
        console.error('Response status:', response.status);
        console.error('Response data:', response.data);
        throw new Error(`Failed to fetch products: HTTP ${response.status}`);
      }

      const products = response.data.data || [];
      allProducts = allProducts.concat(products);

      console.log(`Found ${products.length} products on page ${page}`);

      hasMorePages = products.length === PAGE_SIZE;
      page++;
    }

    console.log(`\nTotal products found: ${allProducts.length}\n`);

    if (allProducts.length === 0) {
      console.log('No products found to process');
      return;
    }

    // 2. Process each product
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalDuplicatesRemoved = 0;
    let totalErrors = 0;
    let totalSkipped = 0;

    for (const product of allProducts) {
      totalProcessed++;
      const positions = product.wipersPositions || [];

      if (positions.length === 0) {
        totalSkipped++;
        continue;
      }

      const deduplicated = deduplicatePositions(positions);
      const duplicatesRemoved = positions.length - deduplicated.length;

      if (duplicatesRemoved === 0) {
        totalSkipped++;
        continue;
      }

      // 3. Update the product via PUT using documentId for Strapi v5
      const productId = product.documentId || product.id;
      const updateOptions = {
        hostname: 'localhost',
        port: 1338,
        path: `/api/wipers-products/${productId}`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      try {
        const updateResponse = await makeRequest(updateOptions, {
          data: {
            wipersPositions: deduplicated
          }
        });

        if (updateResponse.status === 200) {
          totalUpdated++;
          totalDuplicatesRemoved += duplicatesRemoved;
          console.log(`Updated "${product.name}" (${productId}): removed ${duplicatesRemoved} duplicate(s), ${positions.length} -> ${deduplicated.length} positions`);
        } else {
          totalErrors++;
          console.error(`Failed to update product ${productId}: HTTP ${updateResponse.status}`);
        }
      } catch (error) {
        totalErrors++;
        console.error(`Error updating product ${productId}: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_UPDATES));
    }

    // 4. Print summary
    console.log('\n--- Deduplication Summary ---');
    console.log(`Total products scanned: ${totalProcessed}`);
    console.log(`Products updated: ${totalUpdated}`);
    console.log(`Products skipped (no duplicates): ${totalSkipped}`);
    console.log(`Total duplicates removed: ${totalDuplicatesRemoved}`);
    console.log(`Errors: ${totalErrors}`);

  } catch (error) {
    console.error('Deduplication failed:', error);
    throw error;
  }
}

// Run
if (require.main === module) {
  deduplicateAllWipersPositions()
    .then(() => {
      console.log('\nDeduplication completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nDeduplication failed:', error);
      process.exit(1);
    });
}

module.exports = { deduplicateAllWipersPositions, deduplicatePositions };
