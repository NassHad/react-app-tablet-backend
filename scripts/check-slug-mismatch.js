// Check for slug mismatch between original data and database
const fs = require("fs");
const path = require("path");
const http = require("http");

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';

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

async function checkSlugMismatch() {
  try {
    console.log('🔍 Checking for slug mismatch between original data and database...');
    
    // Step 1: Read original models data
    const modelsPath = path.join(process.cwd(), "scripts", "json_data", "cleaned_models.json");
    if (!fs.existsSync(modelsPath)) {
      console.error(`❌ Models file not found: ${modelsPath}`);
      return;
    }
    
    const originalModelsData = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
    console.log(`📊 Found ${originalModelsData.length} models in original data`);
    
    // Step 2: Get all existing models from database
    console.log('📊 Fetching all existing models from database...');
    let allModels = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;
    
    while (hasMore) {
      try {
        const response = await makeRequest(`/models?pagination[page]=${page}&pagination[pageSize]=${pageSize}`);
        
        if (response.data && response.data.length > 0) {
          allModels = allModels.concat(response.data);
          
          if (response.meta && response.meta.pagination) {
            const { page: currentPage, pageCount } = response.meta.pagination;
            if (currentPage >= pageCount) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
          
          page++;
        } else {
          hasMore = false;
        }
      } catch (err) {
        console.log(`⚠️  Error fetching models page ${page}: ${err.message}`);
        hasMore = false;
      }
    }
    
    console.log(`📊 Found ${allModels.length} models in database`);
    
    // Step 3: Create maps for comparison
    const originalSlugs = new Set(originalModelsData.map(m => m.modelSlug));
    const databaseSlugs = new Set(allModels.map(m => m.slug));
    
    console.log(`📊 Original data has ${originalSlugs.size} unique slugs`);
    console.log(`📊 Database has ${databaseSlugs.size} unique slugs`);
    
    // Step 4: Find mismatches
    const missingInDatabase = [];
    const missingInOriginal = [];
    const commonSlugs = [];
    
    for (const slug of originalSlugs) {
      if (databaseSlugs.has(slug)) {
        commonSlugs.push(slug);
      } else {
        missingInDatabase.push(slug);
      }
    }
    
    for (const slug of databaseSlugs) {
      if (!originalSlugs.has(slug)) {
        missingInOriginal.push(slug);
      }
    }
    
    console.log(`\n📊 Comparison Results:`);
    console.log(`✅ Common slugs: ${commonSlugs.length}`);
    console.log(`❌ Missing in database: ${missingInDatabase.length}`);
    console.log(`❌ Missing in original: ${missingInOriginal.length}`);
    
    // Step 5: Show some examples
    if (missingInDatabase.length > 0) {
      console.log(`\n🔍 First 10 slugs missing in database:`);
      missingInDatabase.slice(0, 10).forEach(slug => {
        const originalModel = originalModelsData.find(m => m.modelSlug === slug);
        console.log(`  - ${slug} (${originalModel ? originalModel.name : 'Unknown'})`);
      });
    }
    
    if (missingInOriginal.length > 0) {
      console.log(`\n🔍 First 10 slugs missing in original data:`);
      missingInOriginal.slice(0, 10).forEach(slug => {
        const dbModel = allModels.find(m => m.slug === slug);
        console.log(`  - ${slug} (${dbModel ? dbModel.name : 'Unknown'})`);
      });
    }
    
    // Step 6: Check if there are any models with brand relationships
    const modelsWithBrands = allModels.filter(m => m.brand);
    console.log(`\n📊 Models with brand relationships: ${modelsWithBrands.length}`);
    
    if (modelsWithBrands.length > 0) {
      console.log(`\n🔍 First 10 models with brand relationships:`);
      modelsWithBrands.slice(0, 10).forEach(model => {
        console.log(`  - ${model.name} (${model.slug}) -> Brand: ${model.brand ? model.brand.name : 'None'}`);
      });
    }
    
    // Step 7: Check for models without brand relationships
    const modelsWithoutBrands = allModels.filter(m => !m.brand);
    console.log(`\n📊 Models without brand relationships: ${modelsWithoutBrands.length}`);
    
    if (modelsWithoutBrands.length > 0) {
      console.log(`\n🔍 First 10 models without brand relationships:`);
      modelsWithoutBrands.slice(0, 10).forEach(model => {
        console.log(`  - ${model.name} (${model.slug})`);
      });
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkSlugMismatch();
