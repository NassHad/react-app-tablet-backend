const fs = require('fs');
const path = require('path');

// Use native fetch (Node 18+) or http/https for compatibility
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Simple fetch implementation using http/https
async function simpleFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseObj = {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          _data: data,
          json: async () => {
            try {
              return JSON.parse(data);
            } catch (e) {
              throw new Error(`Failed to parse JSON: ${e.message}. Response: ${data.substring(0, 200)}`);
            }
          },
          text: async () => data
        };
        
        resolve(responseObj);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// Configuration
const RECAP_CSV_PATH = path.join(__dirname, 'liste_affectation', 'RECAP BASE DE DONNEES REFERENCEMENT.csv');
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';
const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES = 1000;

// Helper function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to make API calls to Strapi
async function strapiRequest(endpoint, method = 'GET', data = null) {
  const url = `${STRAPI_URL}/api${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Node-Import-Script',
      ...(API_TOKEN && { 'Authorization': `Bearer ${API_TOKEN}` })
    }
  };

  if (data) {
    options.body = JSON.stringify({ data });
  }

  try {
    const response = await simpleFetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      console.error(`   URL: ${url}`);
      console.error(`   Response: ${errorText.substring(0, 500)}`);
      throw new Error(`${errorMsg} - ${errorText.substring(0, 200)}`);
    }
    
    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error.message);
    throw error;
  }
}

// Parse size from formats like "600mm" or "600MM"
function parseSize(sizeStr) {
  if (!sizeStr) return null;
  
  const cleaned = sizeStr.trim().toUpperCase();
  const match = cleaned.match(/(\d+)\s*MM/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  return null;
}

// Parse CSV line (semicolon-delimited)
function parseCSVLine(line) {
  const parts = line.split(';');
  if (parts.length < 7) return null;
  
  // Helper to clean quoted strings
  const clean = (str) => {
    if (!str) return '';
    str = str.trim();
    // Remove surrounding quotes and unescape double quotes
    if (str.startsWith('"') && str.endsWith('"')) {
      str = str.slice(1, -1).replace(/""/g, '"');
    }
    return str.trim();
  };
  
  return {
    cata: clean(parts[0]) || '',
    famille: clean(parts[1]) || '',
    sousFamille: clean(parts[2]) || '',
    marque: clean(parts[3]) || '',
    ref: clean(parts[4]) || '',
    designation: clean(parts[5]) || '',
    codeBarres: clean(parts[6]) || ''
  };
}

// Load IMDICAR wiper-data from RECAP CSV
function loadImdicarWiperData() {
  console.log('📖 Loading IMDICAR wiper-data from RECAP CSV...');
  
  if (!fs.existsSync(RECAP_CSV_PATH)) {
    throw new Error(`RECAP CSV file not found at: ${RECAP_CSV_PATH}`);
  }
  
  const csvContent = fs.readFileSync(RECAP_CSV_PATH, 'utf8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  // Skip header lines (first 4 lines)
  const dataLines = lines.slice(4);
  
  const imdicarData = [];
  
  for (const line of dataLines) {
    const row = parseCSVLine(line);
    if (!row || !row.marque || !row.ref || !row.designation) continue;
    
    // Only process IMDICAR brand and BEG PLATS category
    if (row.marque.toUpperCase() === 'IMDICAR' && row.sousFamille.toUpperCase() === 'PLATS') {
      // Parse size from designation like "BEG PLAT 600MM 24''"
      const size = parseSize(row.designation);
      if (size) {
        imdicarData.push({
          size: size,
          ref: row.ref,
          designation: row.designation
        });
      }
    }
  }
  
  // Sort by size ascending
  imdicarData.sort((a, b) => a.size - b.size);
  
  console.log(`✅ Loaded ${imdicarData.length} IMDICAR wiper-data records`);
  return imdicarData;
}

// Find closest wiper-data size that is <= position size
function findClosestSize(imdicarData, positionSize) {
  // Filter to only sizes <= positionSize
  const validSizes = imdicarData.filter(item => item.size <= positionSize);
  
  if (validSizes.length === 0) {
    return null;
  }
  
  // Return the largest size (closest to positionSize)
  return validSizes[validSizes.length - 1];
}

async function updateImdicarPositionRefs() {
  try {
    console.log('🚀 Starting IMDICAR position refs update...');
    
    // Step 1: Load IMDICAR wiper-data
    const imdicarData = loadImdicarWiperData();
    
    if (imdicarData.length === 0) {
      throw new Error('No IMDICAR wiper-data found in RECAP CSV');
    }
    
    // Step 2: Load all wipers-products from Strapi
    console.log('🔍 Fetching wipers-products from Strapi...');
    
    let allProducts = [];
    let productPage = 1;
    const productPageSize = 100;
    let hasMoreProducts = true;
    
    while (hasMoreProducts) {
      const response = await strapiRequest(`/wipers-products?pagination[page]=${productPage}&pagination[pageSize]=${productPageSize}`);
      const products = response.data || [];
      
      allProducts.push(...products);
      
      if (products.length === 0 || products.length < productPageSize) {
        hasMoreProducts = false;
      } else {
        productPage++;
      }
    }
    
    console.log(`📋 Loaded ${allProducts.length} wipers-products`);
    
    // Statistics
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalMatched = 0;
    let totalUnmatched = 0;
    let totalErrors = 0;
    
    // Logging arrays
    const updatedPositions = [];
    const unmatchedPositions = [];
    const errors = [];
    
    // Step 3: Process each product
    console.log('\n📦 Processing products...');
    
    for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
      const batch = allProducts.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allProducts.length / BATCH_SIZE);
      
      console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} products)`);
      
      for (const product of batch) {
        try {
          const productId = product.documentId || product.id;
          const productName = product.attributes?.name || product.name;
          const brandData = product.attributes?.brand?.data || product.brand?.data || product.brand;
          const modelData = product.attributes?.model?.data || product.model?.data || product.model;
          
          const brandName = brandData?.attributes?.name || brandData?.name || '';
          const modelName = modelData?.attributes?.name || modelData?.name || '';
          
          const currentPositions = product.attributes?.wipersPositions || product.wipersPositions || [];
          
          if (!Array.isArray(currentPositions) || currentPositions.length === 0) {
            continue;
          }
          
          // Find positions with brand "Imdicar" and missing/empty ref
          const updatedPositionsArray = [];
          let hasChanges = false;
          let matchedInProduct = 0;
          
          for (let j = 0; j < currentPositions.length; j++) {
            const position = currentPositions[j];
            
            // Only process positions with brand "Imdicar" and missing/empty ref
            if (position.brand === 'Imdicar' && (!position.ref || position.ref.trim() === '')) {
              const positionSize = parseSize(position.size);
              
              if (!positionSize) {
                unmatchedPositions.push({
                  productId,
                  productName,
                  brand: brandName,
                  model: modelName,
                  position: position.position,
                  size: position.size,
                  reason: 'Could not parse size from position.size field'
                });
                totalUnmatched++;
                // Keep original position without ref
                updatedPositionsArray.push(position);
                continue;
              }
              
              // Find closest matching wiper-data
              const matchedData = findClosestSize(imdicarData, positionSize);
              
              if (matchedData) {
                // Update position with ref
                const updatedPosition = {
                  ...position,
                  ref: matchedData.ref
                };
                updatedPositionsArray.push(updatedPosition);
                hasChanges = true;
                matchedInProduct++;
                
                updatedPositions.push({
                  productId,
                  productName,
                  brand: brandName,
                  model: modelName,
                  position: position.position,
                  size: position.size,
                  matchedSize: matchedData.size,
                  ref: matchedData.ref
                });
                totalMatched++;
              } else {
                // No match found
                unmatchedPositions.push({
                  productId,
                  productName,
                  brand: brandName,
                  model: modelName,
                  position: position.position,
                  size: position.size,
                  positionSize: positionSize,
                  reason: `No IMDICAR wiper-data found with size <= ${positionSize}mm`
                });
                totalUnmatched++;
                // Keep original position without ref
                updatedPositionsArray.push(position);
              }
              
              totalProcessed++;
            } else {
              // Keep original position (not Imdicar or already has ref)
              updatedPositionsArray.push(position);
            }
          }
          
          // Step 4: Update product if there are changes
          if (hasChanges) {
            try {
              await strapiRequest(`/wipers-products/${productId}`, 'PUT', {
                wipersPositions: updatedPositionsArray
              });
              
              totalUpdated++;
              console.log(`✅ Updated ${productName} (${matchedInProduct} position(s) matched)`);
            } catch (updateError) {
              console.error(`❌ Error updating product ${productId}:`, updateError.message);
              errors.push({
                productId,
                productName,
                brand: brandName,
                model: modelName,
                error: updateError.message
              });
              totalErrors++;
            }
          }
          
        } catch (productError) {
          console.error(`❌ Error processing product:`, productError.message);
          errors.push({
            productId: product.id || product.documentId,
            error: productError.message
          });
          totalErrors++;
        }
      }
      
      // Delay between batches
      if (i + BATCH_SIZE < allProducts.length) {
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }
    
    // Step 5: Generate summary report
    console.log('\n' + '='.repeat(80));
    console.log('🎉 Update completed!');
    console.log('='.repeat(80));
    console.log('\n📊 Summary:');
    console.log(`   - Total positions processed: ${totalProcessed}`);
    console.log(`   - Positions matched & updated: ${totalMatched}`);
    console.log(`   - Products updated: ${totalUpdated}`);
    console.log(`   - Positions unmatched: ${totalUnmatched}`);
    console.log(`   - Errors: ${totalErrors}`);
    
    // Log unmatched positions
    if (unmatchedPositions.length > 0) {
      console.log('\n⚠️  Unmatched Positions (first 20):');
      unmatchedPositions.slice(0, 20).forEach(item => {
        console.log(`   - ${item.brand} / ${item.model} / ${item.position} / ${item.size} (${item.reason})`);
      });
      if (unmatchedPositions.length > 20) {
        console.log(`   ... and ${unmatchedPositions.length - 20} more`);
      }
    }
    
    // Save detailed logs to JSON file
    const logData = {
      summary: {
        totalProcessed,
        totalMatched,
        totalUpdated,
        totalUnmatched,
        totalErrors
      },
      updatedPositions,
      unmatchedPositions,
      errors
    };
    
    const logFilePath = path.join(__dirname, 'update-imdicar-refs-log.json');
    fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2));
    console.log(`\n📄 Detailed logs saved to: ${logFilePath}`);
    
  } catch (error) {
    console.error('💥 Update failed:', error);
    throw error;
  }
}

// Run the update if this script is executed directly
if (require.main === module) {
  updateImdicarPositionRefs()
    .then(() => {
      console.log('\n✅ Update completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Update failed:', error);
      process.exit(1);
    });
}

module.exports = { updateImdicarPositionRefs };

