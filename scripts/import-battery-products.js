// Import battery products from Exide data into Strapi
// Usage: node scripts/import-battery-products.js
// 
// Environment variables:
//   STRAPI_URL - Strapi server URL (default: http://localhost:1338)
//   STRAPI_API_TOKEN - API token for authentication (optional)

const fs = require("fs");
const path = require("path");
const http = require("http");

// Basic slugify without external deps
function slugify(str) {
  return String(str)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// Clean motorisation name (remove parentheses and their contents)
function cleanMotorisationName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }
  // Remove everything in parentheses including the parentheses
  let cleaned = name.replace(/\s*\([^)]*\)/g, '');
  // If there's still an opening parenthesis (unclosed), remove everything from it to the end
  const parenIndex = cleaned.indexOf('(');
  if (parenIndex !== -1) {
    cleaned = cleaned.substring(0, parenIndex).trim();
  }
  return cleaned.trim();
}

// Check if two motorisations are equal (dates and battery options match)
function motorisationsAreEqual(m1, m2) {
  // Compare cleaned motorisation names
  if (cleanMotorisationName(m1.motorisation || '') !== cleanMotorisationName(m2.motorisation || '')) {
    return false;
  }
  
  // Compare dates
  if (m1.startDate !== m2.startDate) {
    return false;
  }
  if (m1.endDate !== m2.endDate) {
    return false;
  }
  
  // Compare fuel (should also match)
  if (m1.fuel !== m2.fuel) {
    return false;
  }
  
  // Compare all battery options
  const batteryKeys = ['batteryAGM', 'batteryEFB', 'batteryPremium', 'batteryExcell', 'batteryClassic'];
  for (const key of batteryKeys) {
    const b1 = m1[key] || {};
    const b2 = m2[key] || {};
    if (b1.option1 !== b2.option1 || b1.option2 !== b2.option2 || b1.option3 !== b2.option3) {
      return false;
    }
  }
  
  return true;
}

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Path to battery products JSON file
const batteryProductsPath = path.join(process.cwd(), "scripts", "json_data", "exide-battery-products.json");

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
        // Handle non-JSON responses (like "Method Not Allowed")
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (e) {
            // If response is not JSON but status is success, resolve with raw response
            resolve({ data: responseData, raw: true });
          }
        } else {
          // Error response - try to parse as JSON, fallback to plain text
          let parsedData;
          let errorMsg;
          try {
            parsedData = JSON.parse(responseData);
            errorMsg = `HTTP ${res.statusCode}: ${parsedData.message || parsedData.error?.message || responseData}`;
          } catch (e) {
            // Non-JSON error response (like "Method Not Allowed")
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
          hasMore = false; // No pagination meta, assume single page
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

async function importBatteryProducts() {
  console.log('🚀 Starting import of battery products...');
  
  // Read battery products data
  if (!fs.existsSync(batteryProductsPath)) {
    console.error(`❌ Battery products file not found: ${batteryProductsPath}`);
    return;
  }
  
  const batteryProductsData = JSON.parse(fs.readFileSync(batteryProductsPath, 'utf8'));
  
  if (!Array.isArray(batteryProductsData)) {
    console.error('❌ Invalid format: exide-battery-products.json should be an array');
    return;
  }
  
  console.log(`📊 Found ${batteryProductsData.length} battery products to import`);
  
  // Limit for testing (set to null or batteryProductsData.length to process all)
  const TEST_LIMIT = null;
  const productsToProcess = TEST_LIMIT ? batteryProductsData.slice(0, TEST_LIMIT) : batteryProductsData;
  
  if (TEST_LIMIT) {
    console.log(`🧪 TEST MODE: Processing only first ${TEST_LIMIT} products`);
  }
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const matchingStrategies = {
    slug: 0,
    'brand+model': 0,
    'brandSlug+modelSlug': 0
  };
  
  // Fetch all existing battery products from Strapi to check for duplicates
  // Use multiple Maps for different matching strategies
  // Store both id and documentId (Strapi v4+ uses documentId for API endpoints)
  const existingProductSlugs = new Map(); // slug -> {id, documentId}
  const existingProductByBrandModel = new Map(); // "brand|||model" -> {id, documentId}
  const existingProductByBrandSlugModelSlug = new Map(); // "brandSlug|||modelSlug" -> {id, documentId}
  const allExistingProducts = []; // Store full product objects for fallback matching
  
  try {
    console.log('📋 Fetching existing battery products from Strapi...');
    const allProducts = await fetchAllPaginated('/battery-products');
    if (allProducts.length > 0) {
      for (const product of allProducts) {
        const productRef = {
          id: product.id,
          documentId: product.documentId || product.id // Fallback to id if documentId not available
        };
        
        if (product.slug && productRef.id) {
          existingProductSlugs.set(product.slug.toLowerCase(), productRef);
        }
        if (product.brand && product.modelName && productRef.id) {
          const key = `${product.brand}|||${product.modelName}`.toLowerCase();
          existingProductByBrandModel.set(key, productRef);
        }
        if (product.brandSlug && product.modelSlug && productRef.id) {
          const key = `${product.brandSlug}|||${product.modelSlug}`.toLowerCase();
          existingProductByBrandSlugModelSlug.set(key, productRef);
        }
        allExistingProducts.push(product);
      }
    }
    console.log(`📋 Found ${existingProductSlugs.size} existing battery products in database`);
    console.log(`   📊 Indexed by slug: ${existingProductSlugs.size}`);
    console.log(`   📊 Indexed by brand+model: ${existingProductByBrandModel.size}`);
    console.log(`   📊 Indexed by brandSlug+modelSlug: ${existingProductByBrandSlugModelSlug.size}`);
  } catch (err) {
    console.error(`⚠️  Could not fetch existing battery products: ${err.message}`);
    console.error('⚠️  Will proceed but may create duplicates if products already exist');
  }
  
  // Function to find existing product using multiple strategies
  function findExistingProduct(productData) {
    const name = `${productData.brand} ${productData.model}`;
    const slug = slugify(name);
    
    // Strategy 1: Match by slug (primary - most reliable)
    const bySlug = existingProductSlugs.get(slug.toLowerCase());
    if (bySlug) {
      return { id: bySlug.id, documentId: bySlug.documentId, strategy: 'slug' };
    }
    
    // Strategy 2: Match by brand + modelName (handles old slugs with parentheses)
    const brandModelKey = `${productData.brand}|||${productData.model}`.toLowerCase();
    const byBrandModel = existingProductByBrandModel.get(brandModelKey);
    if (byBrandModel) {
      return { id: byBrandModel.id, documentId: byBrandModel.documentId, strategy: 'brand+model' };
    }
    
    // Strategy 3: Match by brandSlug + modelSlug
    const brandSlugModelSlugKey = `${productData.brandSlug}|||${productData.modelSlug}`.toLowerCase();
    const byBrandSlugModelSlug = existingProductByBrandSlugModelSlug.get(brandSlugModelSlugKey);
    if (byBrandSlugModelSlug) {
      return { id: byBrandSlugModelSlug.id, documentId: byBrandSlugModelSlug.documentId, strategy: 'brandSlug+modelSlug' };
    }
    
    return null;
  }
  
  // Process each battery product
  for (let i = 0; i < productsToProcess.length; i++) {
    const productData = productsToProcess[i];
    
    try {
      // Validation: Check that model name is cleaned (no parentheses)
      if (productData.model && productData.model.includes('(')) {
        console.warn(`⚠️  Warning: Model "${productData.model}" contains parentheses - may not be cleaned`);
      }
      
      // Validation: Check that modelSlug matches cleaned model name
      const expectedModelSlug = slugify(productData.model);
      if (productData.modelSlug !== expectedModelSlug) {
        console.warn(`⚠️  Warning: Model slug mismatch for "${productData.model}": expected "${expectedModelSlug}", got "${productData.modelSlug}"`);
      }
      
      // Generate name and slug
      const name = `${productData.brand} ${productData.model}`;
      const slug = slugify(name);
      const motorisationCount = productData.motorisations ? productData.motorisations.length : 0;
      
      // Check if product already exists using enhanced matching
      const existingProduct = findExistingProduct(productData);
      
      // Prepare product data for Strapi
      const productPayload = {
        data: {
          name: name,
          slug: slug,
          brand: productData.brand,
          brandSlug: productData.brandSlug,
          modelName: productData.model,
          modelSlug: productData.modelSlug,
          motorisations: productData.motorisations,
          isActive: true,
          category: "battery",
          batteryBrand: "Exide"
        }
      };
      
      if (existingProduct) {
        // Update existing product - fetch existing motorisations first
        const matchStrategy = existingProduct.strategy;
        
        // Fetch existing product to get current motorisations
        let existingMotorisations = [];
        try {
          // Use documentId for Strapi v4+ API endpoints, fallback to id
          const productId = existingProduct.documentId || existingProduct.id;
          console.log(`   🔍 Fetching existing product: ID=${existingProduct.id}, documentId=${existingProduct.documentId || 'N/A'}, using ${productId} for API call`);
          const existingProductData = await makeRequest(`/battery-products/${productId}`);
          if (existingProductData.data && existingProductData.data.motorisations) {
            existingMotorisations = Array.isArray(existingProductData.data.motorisations) 
              ? existingProductData.data.motorisations 
              : [];
          }
        } catch (fetchErr) {
          console.warn(`   ⚠️  Could not fetch existing motorisations: ${fetchErr.message}`);
          if (fetchErr.statusCode === 404) {
            console.warn(`   ⚠️  404 Error - Product may not exist or endpoint format is incorrect`);
            console.warn(`   ⚠️  Attempted endpoint: GET /battery-products/${existingProduct.documentId || existingProduct.id}`);
            if (fetchErr.responseData) {
              console.warn(`   ⚠️  Response: ${fetchErr.responseData.substring(0, 200)}`);
            }
          }
        }
        
        // Merge motorisations: combine existing + new, deduplicate
        const newMotorisations = productData.motorisations || [];
        const allMotorisations = [...existingMotorisations, ...newMotorisations];
        
        // Deduplicate motorisations
        const mergedMotorisations = [];
        const seenMotorisations = [];
        
        for (const motorisation of allMotorisations) {
          // Check if we've already seen an identical motorisation
          let isDuplicate = false;
          for (const seen of seenMotorisations) {
            if (motorisationsAreEqual(motorisation, seen)) {
              isDuplicate = true;
              break;
            }
          }
          
          // If not a duplicate, add it
          if (!isDuplicate) {
            mergedMotorisations.push(motorisation);
            seenMotorisations.push(motorisation);
          }
        }
        
        // Update payload with merged motorisations
        productPayload.data.motorisations = mergedMotorisations;
        
        const existingCount = existingMotorisations.length;
        const newCount = newMotorisations.length;
        const mergedCount = mergedMotorisations.length;
        const duplicatesRemoved = existingCount + newCount - mergedCount;
        
        // Use documentId for Strapi v4+ API endpoints, fallback to id
        const productId = existingProduct.documentId || existingProduct.id;
        
        console.log(`🔄 Updating ${name} (ID: ${existingProduct.id}, documentId: ${existingProduct.documentId || 'N/A'}, using ${productId} for API call, matched by: ${matchStrategy})...`);
        console.log(`   📊 Motorisations: ${existingCount} existing + ${newCount} new = ${mergedCount} merged (${duplicatesRemoved} duplicates removed)`);
        
        const updateResponse = await makeRequest(`/battery-products/${productId}`, 'PUT', productPayload);
        
        if (updateResponse.data && updateResponse.data.id) {
          console.log(`   ✅ Updated product ID: ${updateResponse.data.id}`);
          
          // Log if matched by fallback strategy (indicates old slug)
          if (matchStrategy !== 'slug') {
            console.log(`   ℹ️  Matched using fallback strategy: ${matchStrategy} (product may have old slug)`);
          }
          
          // Track matching strategy
          if (matchingStrategies.hasOwnProperty(matchStrategy)) {
            matchingStrategies[matchStrategy]++;
          }
          
          // Auto-publish if enabled
          // Note: In Strapi v4+, we can set publishedAt in the update payload instead of using a separate endpoint
          // But if the endpoint exists, try it first
          if (shouldPublish) {
            try {
              await makeRequest(`/battery-products/${productId}/actions/publish`, 'POST');
              console.log(`   📢 Published product ID: ${productId}`);
            } catch (publishErr) {
              // If publish endpoint doesn't work (405 Method Not Allowed), try updating with publishedAt
              if (publishErr.statusCode === 405 || publishErr.statusCode === 404) {
                console.warn(`   ⚠️  Publish endpoint not available (${publishErr.statusCode}), trying to set publishedAt in update...`);
                try {
                  // Update with publishedAt set to now
                  const publishPayload = {
                    data: {
                      publishedAt: new Date().toISOString()
                    }
                  };
                  await makeRequest(`/battery-products/${productId}`, 'PUT', publishPayload);
                  console.log(`   📢 Published product ID: ${productId} (via publishedAt)`);
                } catch (publishUpdateErr) {
                  console.warn(`   ⚠️  Could not publish product ID ${productId}: ${publishUpdateErr.message}`);
                  console.warn(`   ℹ️  Product updated but may need manual publishing`);
                }
              } else {
                console.error(`   ⚠️  Could not publish product ID ${productId}: ${publishErr.message}`);
                if (publishErr.responseData) {
                  console.error(`   ⚠️  Response: ${publishErr.responseData.substring(0, 200)}`);
                }
              }
            }
          }
          
          updated++;
        } else {
          throw new Error('Invalid response from Strapi');
        }
      } else {
        // Create new product
        console.log(`📦 Creating ${name} (${motorisationCount} motorisations)...`);
        const createResponse = await makeRequest('/battery-products', 'POST', productPayload);
        
        if (createResponse.data && createResponse.data.id) {
          const productId = createResponse.data.id;
          console.log(`   ✅ Created product ID: ${productId}`);
          
          // Add to existing products maps to avoid duplicates in same run
          const newProductRef = {
            id: productId,
            documentId: createResponse.data.documentId || productId
          };
          existingProductSlugs.set(slug.toLowerCase(), newProductRef);
          const brandModelKey = `${productData.brand}|||${productData.model}`.toLowerCase();
          existingProductByBrandModel.set(brandModelKey, newProductRef);
          const brandSlugModelSlugKey = `${productData.brandSlug}|||${productData.modelSlug}`.toLowerCase();
          existingProductByBrandSlugModelSlug.set(brandSlugModelSlugKey, newProductRef);
          
          // Auto-publish if enabled
          if (shouldPublish) {
            try {
              const publishProductId = createResponse.data.documentId || productId;
              await makeRequest(`/battery-products/${publishProductId}/actions/publish`, 'POST');
              console.log(`   📢 Published product ID: ${publishProductId}`);
            } catch (publishErr) {
              // If publish endpoint doesn't work (405 Method Not Allowed), try updating with publishedAt
              if (publishErr.statusCode === 405 || publishErr.statusCode === 404) {
                console.warn(`   ⚠️  Publish endpoint not available (${publishErr.statusCode}), trying to set publishedAt in update...`);
                try {
                  const publishProductId = createResponse.data.documentId || productId;
                  const publishPayload = {
                    data: {
                      publishedAt: new Date().toISOString()
                    }
                  };
                  await makeRequest(`/battery-products/${publishProductId}`, 'PUT', publishPayload);
                  console.log(`   📢 Published product ID: ${publishProductId} (via publishedAt)`);
                } catch (publishUpdateErr) {
                  console.warn(`   ⚠️  Could not publish product ID ${productId}: ${publishUpdateErr.message}`);
                  console.warn(`   ℹ️  Product created but may need manual publishing`);
                }
              } else {
                console.error(`   ⚠️  Could not publish product ID ${productId}: ${publishErr.message}`);
                if (publishErr.responseData) {
                  console.error(`   ⚠️  Response: ${publishErr.responseData.substring(0, 200)}`);
                }
              }
            }
          }
          
          created++;
        } else {
          throw new Error('Invalid response from Strapi - missing data.id');
        }
      }
      
    } catch (err) {
      console.error(`❌ Error processing product ${productData.brand} ${productData.model}:`);
      console.error(`   Error message: ${err.message}`);
      if (err.statusCode) {
        console.error(`   HTTP Status: ${err.statusCode}`);
      }
      if (err.endpoint) {
        console.error(`   Endpoint: ${err.method || 'GET'} ${err.endpoint}`);
        console.error(`   Full URL: ${STRAPI_URL}/api${err.endpoint}`);
      }
      if (err.responseData) {
        const responsePreview = typeof err.responseData === 'string' 
          ? err.responseData.substring(0, 300) 
          : JSON.stringify(err.responseData).substring(0, 300);
        console.error(`   Response: ${responsePreview}`);
      }
      if (err.stack) {
        console.error(`   Stack: ${err.stack.split('\n').slice(0, 3).join('\n')}`);
      }
      errors++;
    }
    
    // Progress indicator
    if ((i + 1) % 100 === 0 || (TEST_LIMIT && (i + 1) % 10 === 0)) {
      console.log(`\n📊 Progress: ${i + 1}/${productsToProcess.length} processed (Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors})\n`);
    }
  }
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Import Summary');
  console.log('='.repeat(60));
  console.log(`✅ Created: ${created} products`);
  console.log(`🔄 Updated: ${updated} products`);
  console.log(`⏭️  Skipped: ${skipped} products`);
  console.log(`❌ Errors: ${errors} products`);
  console.log(`📦 Total processed: ${productsToProcess.length} products`);
  
  if (updated > 0) {
    console.log('\n📈 Matching Strategy Statistics:');
    console.log(`   By slug: ${matchingStrategies.slug} products`);
    console.log(`   By brand+model: ${matchingStrategies['brand+model']} products`);
    console.log(`   By brandSlug+modelSlug: ${matchingStrategies['brandSlug+modelSlug']} products`);
    if (matchingStrategies['brand+model'] > 0 || matchingStrategies['brandSlug+modelSlug'] > 0) {
      console.log(`   ℹ️  Fallback strategies used: Some products matched by fallback (may have old slugs)`);
    }
  }
  
  if (TEST_LIMIT) {
    console.log(`\n🧪 TEST MODE: Only processed ${TEST_LIMIT} products. Set TEST_LIMIT to null to process all ${batteryProductsData.length} products.`);
  }
  console.log('='.repeat(60));
}

// Run the import
importBatteryProducts().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

