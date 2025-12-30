// Add batteryComplementaryRange field to all motorisations in battery products
// Usage: node scripts/add-battery-complementary-range.js
// 
// Environment variables:
//   STRAPI_URL - Strapi server URL (default: http://localhost:1338)
//   STRAPI_API_TOKEN - API token for authentication (optional)

const fs = require("fs");
const path = require("path");
const http = require("http");

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Auto-publish is enabled by default
const shouldPublish = true;

function makeRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${STRAPI_URL}/api${endpoint}`);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (e) {
            resolve({ data: responseData, raw: true });
          }
        } else {
          let parsedData;
          let errorMsg;
          try {
            parsedData = JSON.parse(responseData);
            errorMsg = `HTTP ${res.statusCode}: ${parsedData.message || parsedData.error?.message || responseData}`;
          } catch (e) {
            errorMsg = `HTTP ${res.statusCode}: ${responseData}`;
            parsedData = { message: responseData };
          }
          const fullError = new Error(errorMsg);
          fullError.statusCode = res.statusCode;
          fullError.endpoint = endpoint;
          fullError.method = method;
          fullError.responseData = responseData;
          reject(fullError);
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

async function fetchAllPaginated(endpoint, pageSize = 100) {
  let allItems = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      console.log(`📄 Fetching ${endpoint} page ${page}...`);
      const response = await makeRequest(`${endpoint}?pagination[page]=${page}&pagination[pageSize]=${pageSize}`);

      if (response.data && response.data.length > 0) {
        allItems = allItems.concat(response.data);
        if (response.meta && response.meta.pagination) {
          const { page: currentPage, pageCount } = response.meta.pagination;
          console.log(`   📄 Page ${currentPage}/${pageCount}: Found ${response.data.length} items`);
          if (currentPage >= pageCount) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    } catch (err) {
      console.error(`❌ Error fetching ${endpoint} page ${page}: ${err.message}`);
      hasMore = false;
    }
  }
  return allItems;
}

function normalizeBatteryComplementaryRange(motorisation) {
  // Check if batteryComplementaryRange exists
  if (!motorisation.batteryComplementaryRange) {
    // Add it with empty options
    return {
      option1: "",
      option2: ""
    };
  }
  
  // If it exists, normalize to only have option1 and option2
  const existing = motorisation.batteryComplementaryRange;
  return {
    option1: existing.option1 || "",
    option2: existing.option2 || ""
    // Explicitly exclude option3 if it exists
  };
}

function needsUpdate(motorisations) {
  if (!motorisations || !Array.isArray(motorisations)) {
    return false;
  }
  
  // Check if any motorisation needs the field added or normalized
  for (const motor of motorisations) {
    if (!motor.batteryComplementaryRange) {
      return true;
    }
    // Check if it has option3 (should be removed) or missing option1/option2
    const compRange = motor.batteryComplementaryRange;
    if (compRange.option3 !== undefined || compRange.option1 === undefined || compRange.option2 === undefined) {
      return true;
    }
  }
  
  return false;
}

async function updateBatteryProduct(product) {
  const documentId = product.documentId || product.id;
  
  // Check if product needs update
  if (!needsUpdate(product.motorisations)) {
    return { updated: false, reason: 'no_changes_needed' };
  }
  
  // Update motorisations
  const updatedMotorisations = (product.motorisations || []).map(motor => {
    return {
      ...motor,
      batteryComplementaryRange: normalizeBatteryComplementaryRange(motor)
    };
  });
  
  // Prepare update payload
  const updateData = {
    data: {
      motorisations: updatedMotorisations,
      publishedAt: shouldPublish ? new Date().toISOString() : null
    }
  };
  
  try {
    // Update product
    await makeRequest(`/battery-products/${documentId}`, 'PUT', updateData);
    
    // Try to publish if needed
    if (shouldPublish) {
      try {
        await makeRequest(`/battery-products/${documentId}/actions/publish`, 'POST');
      } catch (publishError) {
        // If publish endpoint doesn't exist (405/404), it's OK - we set publishedAt in the update
        if (publishError.statusCode !== 405 && publishError.statusCode !== 404) {
          console.warn(`   ⚠️  Could not publish product ${product.id}: ${publishError.message}`);
        }
      }
    }
    
    return { updated: true };
  } catch (error) {
    return { updated: false, reason: 'error', error: error.message };
  }
}

async function addBatteryComplementaryRange() {
  console.log('🚀 Starting addition of batteryComplementaryRange field...');
  console.log(`🔗 Strapi URL: ${STRAPI_URL}`);
  
  try {
    // Fetch all battery products
    console.log('\n📥 Fetching all battery products from Strapi...');
    const allProducts = await fetchAllPaginated('/battery-products');
    
    if (allProducts.length === 0) {
      console.log('⚠️  No battery products found in Strapi');
      return;
    }
    
    console.log(`✅ Fetched ${allProducts.length} battery products\n`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let totalMotorisationsUpdated = 0;
    
    // Process products in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < allProducts.length; i += batchSize) {
      const batch = allProducts.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(allProducts.length / batchSize);
      
      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (products ${i + 1}-${Math.min(i + batchSize, allProducts.length)})...`);
      
      const batchPromises = batch.map(async (product) => {
        const result = await updateBatteryProduct(product);
        
        if (result.updated) {
          updated++;
          const motorCount = (product.motorisations || []).length;
          totalMotorisationsUpdated += motorCount;
          console.log(`   ✅ Updated: ${product.name} (${motorCount} motorisations)`);
          return { success: true, product: product.name };
        } else if (result.reason === 'no_changes_needed') {
          skipped++;
          return { success: true, product: product.name, skipped: true };
        } else {
          errors++;
          console.error(`   ❌ Error updating ${product.name}: ${result.error || result.reason}`);
          return { success: false, product: product.name, error: result.error || result.reason };
        }
      });
      
      await Promise.all(batchPromises);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < allProducts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Summary
    console.log(`\n✅ Process completed!`);
    console.log(`\n📋 Summary:`);
    console.log(`   📦 Total products processed: ${allProducts.length}`);
    console.log(`   ✅ Products updated: ${updated}`);
    console.log(`   ⏭️  Products skipped (no changes needed): ${skipped}`);
    console.log(`   ❌ Products with errors: ${errors}`);
    console.log(`   🔧 Total motorisations updated: ${totalMotorisationsUpdated}`);
    
    if (errors > 0) {
      console.log(`\n⚠️  Some products had errors. Check the logs above for details.`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`\n❌ Error during update: ${error.message}`);
    if (error.statusCode) {
      console.error(`   HTTP Status: ${error.statusCode}`);
      console.error(`   Endpoint: ${error.endpoint}`);
    }
    process.exit(1);
  }
}

// Run update
addBatteryComplementaryRange();

