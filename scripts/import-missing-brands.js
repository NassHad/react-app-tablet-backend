// Import missing brands from Exide data into Strapi
// Usage: node scripts/import-missing-brands.js
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

// Path to missing brands JSON file
const missingBrandsPath = path.join(process.cwd(), "scripts", "json_data", "missing-brands.json");

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

async function importBrands() {
  console.log('🚀 Starting import of missing brands...');
  
  // Read missing brands data
  if (!fs.existsSync(missingBrandsPath)) {
    console.error(`❌ Missing brands file not found: ${missingBrandsPath}`);
    return;
  }
  
  const missingBrandsData = JSON.parse(fs.readFileSync(missingBrandsPath, 'utf8'));
  
  if (!missingBrandsData.data || !Array.isArray(missingBrandsData.data)) {
    console.error('❌ Invalid format: missing-brands.json should have a "data" array');
    return;
  }
  
  const brandNames = missingBrandsData.data;
  console.log(`📊 Found ${brandNames.length} missing brands to import`);
  
  let created = 0;
  let skipped = 0;
  let errors = 0;
  
  // Get existing brands to avoid duplicates (check by slug)
  const existingBrandSlugs = new Set();
  try {
    console.log('📋 Fetching existing brands from Strapi...');
    const allBrands = await makeRequest('/brands?pagination[limit]=-1');
    if (allBrands.data) {
      for (const brand of allBrands.data) {
        if (brand.slug) {
          existingBrandSlugs.add(brand.slug.toLowerCase());
        }
      }
    }
    console.log(`📋 Found ${existingBrandSlugs.size} existing brands in database`);
  } catch (err) {
    console.log(`⚠️  Could not fetch existing brands: ${err.message}`);
    console.log('⚠️  Will proceed but may create duplicates if brands already exist');
  }
  
  console.log('\n🔄 Starting brand import...\n');
  
  for (let i = 0; i < brandNames.length; i++) {
    const brandName = brandNames[i];
    
    try {
      // Generate slug from brand name
      const brandSlug = slugify(brandName);
      
      // Check if brand already exists by slug
      if (existingBrandSlugs.has(brandSlug.toLowerCase())) {
        console.log(`⏭️  Brand already exists: ${brandName} [${brandSlug}]`);
        skipped++;
        continue;
      }
      
      // Create brand data with publishedAt set directly
      const brandPayload = {
        data: {
          name: brandName,
          slug: brandSlug,
          isActive: true,
          publishedAt: new Date().toISOString()
        }
      };
      
      // Create brand
      const result = await makeRequest('/brands', 'POST', brandPayload);
      
      if (result.data && result.data.id) {
        console.log(`✅ Created brand: ${brandName} [${brandSlug}] (ID: ${result.data.id})`);
        created++;
        // Add to existing set to avoid duplicates in same run
        existingBrandSlugs.add(brandSlug.toLowerCase());
      } else {
        console.log(`❌ Failed to create brand: ${brandName}`);
        errors++;
      }
      
    } catch (err) {
      // Check if error is due to duplicate (slug conflict)
      if (err.message && (err.message.includes('duplicate') || err.message.includes('409') || err.message.includes('unique'))) {
        console.log(`⏭️  Brand already exists (duplicate detected): ${brandName}`);
        skipped++;
        existingBrandSlugs.add(slugify(brandName).toLowerCase());
      } else {
        console.log(`❌ Error creating brand "${brandName}": ${err.message}`);
        errors++;
      }
    }
    
    // Progress indicator every 10 brands
    if ((i + 1) % 10 === 0) {
      console.log(`📊 Progress: ${i + 1}/${brandNames.length} brands processed (${created} created, ${skipped} skipped, ${errors} errors)`);
    }
  }
  
  console.log('\n🎉 Brand import completed!');
  console.log(`📊 Summary:`);
  console.log(`   ✅ Created: ${created} brands`);
  console.log(`   ⏭️  Skipped: ${skipped} brands (already existed)`);
  console.log(`   ❌ Errors: ${errors} brands`);
  console.log(`📢 All created brands have been published automatically`);
  
  return { created, skipped, errors };
}

// Run the import
importBrands().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});

