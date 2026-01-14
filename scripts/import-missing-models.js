// Import missing models from Exide data into Strapi
// Usage: node scripts/import-missing-models.js
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

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Path to missing models JSON file
const missingModelsPath = path.join(process.cwd(), "scripts", "json_data", "missing-models-by-brand.json");

// Auto-publish is enabled by default as per user requirement
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

async function importModels() {
  console.log('🚀 Starting import of missing models...');
  
  // Read missing models data
  if (!fs.existsSync(missingModelsPath)) {
    console.error(`❌ Missing models file not found: ${missingModelsPath}`);
    return;
  }
  
  const missingModelsData = JSON.parse(fs.readFileSync(missingModelsPath, 'utf8'));
  
  if (!missingModelsData || typeof missingModelsData !== 'object') {
    console.error('❌ Invalid format: missing-models-by-brand.json should be an object with brand names as keys');
    return;
  }
  
  // Count total models
  let totalModels = 0;
  for (const brandName in missingModelsData) {
    if (Array.isArray(missingModelsData[brandName])) {
      totalModels += missingModelsData[brandName].length;
    }
  }
  
  console.log(`📊 Found ${totalModels} missing models across ${Object.keys(missingModelsData).length} brands`);
  
  let created = 0;
  let skipped = 0;
  let errors = 0;
  
  // Fetch all brands from Strapi and create slug-to-ID and name-to-ID maps
  const brandSlugToIdMap = new Map();
  const brandNameToIdMap = new Map();
  try {
    console.log('📋 Fetching brands from Strapi...');
    
    // Fetch all brands with proper pagination
    let allBrands = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;
    
    while (hasMore) {
      const response = await makeRequest(`/brands?pagination[page]=${page}&pagination[pageSize]=${pageSize}`);
      
      if (response.data && response.data.length > 0) {
        allBrands = allBrands.concat(response.data);
        
        // Check if there are more pages
        if (response.meta && response.meta.pagination) {
          const { page: currentPage, pageCount } = response.meta.pagination;
          console.log(`   📄 Page ${currentPage}/${pageCount}: Found ${response.data.length} brands`);
          if (currentPage >= pageCount) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          // If no pagination meta, check if we got fewer than pageSize
          if (response.data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      } else {
        hasMore = false;
      }
    }
    
    // Build maps from all brands
    for (const brand of allBrands) {
      if (brand.id) {
        // Map by slug (lowercase)
        if (brand.slug) {
          brandSlugToIdMap.set(brand.slug.toLowerCase(), brand.id);
        }
        // Map by name (case-insensitive)
        if (brand.name) {
          brandNameToIdMap.set(brand.name.toLowerCase().trim(), brand.id);
        }
      }
    }
    
    console.log(`📋 Found ${brandSlugToIdMap.size} brands in database`);
  } catch (err) {
    console.log(`⚠️  Could not fetch brands: ${err.message}`);
    console.log('⚠️  Cannot proceed without brands');
    return;
  }
  
  // Fetch existing models to avoid duplicates
  const existingModelSlugs = new Set();
  try {
    console.log('📋 Fetching existing models from Strapi...');
    
    // Fetch all models with proper pagination
    let allModels = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;
    
    while (hasMore) {
      const response = await makeRequest(`/models?pagination[page]=${page}&pagination[pageSize]=${pageSize}`);
      
      if (response.data && response.data.length > 0) {
        allModels = allModels.concat(response.data);
        
        // Check if there are more pages
        if (response.meta && response.meta.pagination) {
          const { page: currentPage, pageCount } = response.meta.pagination;
          if (currentPage >= pageCount) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          if (response.data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      } else {
        hasMore = false;
      }
    }
    
    // Build set from all models
    for (const model of allModels) {
      if (model.slug) {
        existingModelSlugs.add(model.slug.toLowerCase());
      }
    }
    
    console.log(`📋 Found ${existingModelSlugs.size} existing models in database`);
  } catch (err) {
    console.log(`⚠️  Could not fetch existing models: ${err.message}`);
    console.log('⚠️  Will proceed but may create duplicates if models already exist');
  }
  
  console.log('\n🔄 Starting model import...\n');
  
  let processedCount = 0;
  
  // Process each brand
  for (const brandName in missingModelsData) {
    const models = missingModelsData[brandName];
    
    if (!Array.isArray(models) || models.length === 0) {
      continue;
    }
    
    // Get brand ID - try slug first, then name
    const brandSlug = slugify(brandName);
    let brandId = brandSlugToIdMap.get(brandSlug.toLowerCase());
    
    // If not found by slug, try by name (case-insensitive)
    if (!brandId) {
      brandId = brandNameToIdMap.get(brandName.toLowerCase().trim());
    }
    
    if (!brandId) {
      console.log(`⚠️  Brand not found in Strapi: ${brandName} [${brandSlug}], skipping ${models.length} models`);
      errors += models.length;
      continue;
    }
    
    // Process each model for this brand
    for (const modelName of models) {
      try {
        const modelSlug = slugify(modelName);
        
        // Check if model already exists by slug
        if (existingModelSlugs.has(modelSlug.toLowerCase())) {
          skipped++;
          processedCount++;
          continue;
        }
        
        // Create model data with publishedAt set directly
        const modelPayload = {
          data: {
            name: modelName,
            slug: modelSlug,
            brand: brandId,
            isActive: true,
            publishedAt: new Date().toISOString()
          }
        };
        
        // Create model
        const result = await makeRequest('/models', 'POST', modelPayload);
        
        if (result.data && result.data.id) {
          console.log(`✅ Created model: ${modelName} [${modelSlug}] → ${brandName} (ID: ${result.data.id})`);
          created++;
          // Add to existing set to avoid duplicates in same run
          existingModelSlugs.add(modelSlug.toLowerCase());
        } else {
          console.log(`❌ Failed to create model: ${modelName} → ${brandName}`);
          errors++;
        }
        
      } catch (err) {
        // Check if error is due to duplicate (slug conflict)
        if (err.message && (err.message.includes('duplicate') || err.message.includes('409') || err.message.includes('unique'))) {
          console.log(`⏭️  Model already exists (duplicate detected): ${modelName} → ${brandName}`);
          skipped++;
          existingModelSlugs.add(slugify(modelName).toLowerCase());
        } else {
          console.log(`❌ Error creating model "${modelName}" → ${brandName}: ${err.message}`);
          errors++;
        }
      }
      
      processedCount++;
      
      // Progress indicator every 50 models
      if (processedCount % 50 === 0) {
        console.log(`📊 Progress: ${processedCount}/${totalModels} models processed (${created} created, ${skipped} skipped, ${errors} errors)`);
      }
    }
  }
  
  console.log('\n🎉 Model import completed!');
  console.log(`📊 Summary:`);
  console.log(`   ✅ Created: ${created} models`);
  console.log(`   ⏭️  Skipped: ${skipped} models (already existed)`);
  console.log(`   ❌ Errors: ${errors} models`);
  console.log(`📢 All created models have been published automatically`);
  
  return { created, skipped, errors };
}

// Run the import
importModels().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
