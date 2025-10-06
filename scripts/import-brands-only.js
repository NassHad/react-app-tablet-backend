// Import only brands (skip models for now)
// Usage: node scripts/import-brands-only.js

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

// Paths to JSON files
const brandsPath = path.join(process.cwd(), "scripts", "json_data", "final_brands.json");

const shouldPublish = String(process.env.PUBLISH || "").toLowerCase() === "true";

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

async function importBrands() {
  console.log('🚀 Starting brand import...');
  
  // Read brands data
  if (!fs.existsSync(brandsPath)) {
    console.error(`❌ Brands file not found: ${brandsPath}`);
    return;
  }
  
  const brandsData = JSON.parse(fs.readFileSync(brandsPath, 'utf8'));
  console.log(`📊 Found ${brandsData.length} brands to import`);
  
  let created = 0;
  let skipped = 0;
  let errors = 0;
  
  // Get existing brands to avoid duplicates
  const existingBrands = new Set();
  try {
    const allBrands = await makeRequest('/brands?pagination[limit]=-1');
    if (allBrands.data) {
      for (const brand of allBrands.data) {
        existingBrands.add(brand.name.toLowerCase());
      }
    }
    console.log(`📋 Found ${existingBrands.size} existing brands`);
  } catch (err) {
    console.log('⚠️  Could not fetch existing brands, will try to create all');
  }
  
  for (let i = 0; i < brandsData.length; i++) {
    const brandData = brandsData[i];
    
    try {
      // Check if brand already exists
      if (existingBrands.has(brandData.name.toLowerCase())) {
        console.log(`⏭️  Brand already exists: ${brandData.name}`);
        skipped++;
        continue;
      }
      
      // Create brand data
      const brandPayload = {
        data: {
          name: brandData.name,
          slug: slugify(brandData.name),
          isActive: true
        }
      };
      
      // Create brand
      const result = await makeRequest('/brands', 'POST', brandPayload);
      
      if (result.data) {
        console.log(`✅ Created brand: ${brandData.name} (ID: ${result.data.id})`);
        created++;
        
        // Auto-publish if requested
        if (shouldPublish && result.data.id) {
          try {
            await makeRequest(`/brands/${result.data.id}`, 'PUT', {
              data: { publishedAt: new Date().toISOString() }
            });
            console.log(`📢 Published brand: ${brandData.name}`);
          } catch (publishErr) {
            console.log(`⚠️  Could not publish brand ${brandData.name}: ${publishErr.message}`);
          }
        }
      } else {
        console.log(`❌ Failed to create brand: ${brandData.name}`);
        errors++;
      }
      
    } catch (err) {
      console.log(`❌ Error creating brand ${brandData.name}: ${err.message}`);
      errors++;
    }
    
    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`📊 Progress: ${i + 1}/${brandsData.length} brands processed`);
    }
  }
  
  console.log('\n🎉 Brand import completed!');
  console.log(`📊 Summary:`);
  console.log(`   Brands: ${created} created, ${skipped} skipped, ${errors} errors`);
  console.log(`📝 Entries are in draft mode (set PUBLISH=true to auto-publish)`);
  
  return { created, skipped, errors };
}

// Run the import
importBrands().catch(console.error);
