// Simple import script that works with the running Strapi instance
// Usage: node scripts/import-simple.js

const fs = require("fs");
const path = require("path");
const axios = require('axios');

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

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Paths to JSON files
const brandsPath = path.join(process.cwd(), "scripts", "json_data", "final_brands.json");
const modelsPath = path.join(process.cwd(), "scripts", "json_data", "cleaned_models.json");

const shouldPublish = String(process.env.PUBLISH || "").toLowerCase() === "true";

async function makeRequest(endpoint, method = 'GET', data = null) {
  try {
    const config = {
      method,
      url: `${STRAPI_URL}/api${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (API_TOKEN) {
      config.headers.Authorization = `Bearer ${API_TOKEN}`;
    }
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error making request to ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

async function importBrands() {
  console.log("\n🚀 Starting brand import...");
  
  if (!fs.existsSync(brandsPath)) {
    throw new Error(`Brands file not found: ${brandsPath}`);
  }

  const rows = JSON.parse(fs.readFileSync(brandsPath, "utf8"));
  console.log(`Found ${rows.length} brand(s) in file`);

  // Pre-dedupe by slug inside the file
  const seen = new Set();
  const items = [];
  for (const row of rows) {
    const name = String(row?.name || "").trim();
    if (!name) continue;
    
    const slug = String(row?.slug || "").trim() || slugify(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    
    items.push({
      slug,
      name,
      isActive: typeof row.isActive === "boolean" ? row.isActive : true,
    });
  }

  console.log(`Processing ${items.length} unique brand(s)...`);

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    try {
      // Check if brand exists
      const existingBrands = await makeRequest(`/brands?filters[slug][$eq]=${item.slug}`);
      
      if (existingBrands.data && existingBrands.data.length > 0) {
        skipped++;
        console.log(`⏭  Brand exists, skipping: ${item.name} [${item.slug}]`);
        continue;
      }

      const data = {
        data: {
          slug: item.slug,
          name: item.name,
          isActive: item.isActive,
          ...(shouldPublish ? { publishedAt: new Date().toISOString() } : {}),
        }
      };

      await makeRequest('/brands', 'POST', data);
      created++;
      console.log(`✅  Brand created: ${item.name} [${item.slug}]${shouldPublish ? " (published)" : ""}`);
    } catch (err) {
      console.error(`❌  Error creating brand "${item.name}":`, err.message);
    }
  }

  console.log(`\n📊 Brand import complete. Created: ${created}, Skipped: ${skipped}`);
  return { created, skipped };
}

async function importModels() {
  console.log("\n🚀 Starting model import...");
  
  if (!fs.existsSync(modelsPath)) {
    throw new Error(`Models file not found: ${modelsPath}`);
  }

  const rows = JSON.parse(fs.readFileSync(modelsPath, "utf8"));
  console.log(`Found ${rows.length} model(s) in file`);

  // Pre-dedupe by slug inside the file
  const seen = new Set();
  const items = [];
  for (const row of rows) {
    const name = String(row?.name || "").trim();
    if (!name) continue;
    
    const slug = String(row?.modelSlug || "").trim() || slugify(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    
    const brandSlug = String(row?.brandSlug || "").trim();
    if (!brandSlug) {
      console.log(`⚠️  Skipping model "${name}" - no brand slug`);
      continue;
    }

    items.push({
      slug,
      name,
      brandSlug,
      isActive: true, // Default to active
    });
  }

  console.log(`Processing ${items.length} unique model(s)...`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Create a map of brand slugs to brand IDs for faster lookup
  const brandMap = new Map();
  try {
    const allBrands = await makeRequest('/brands?pagination[limit]=-1');
    if (allBrands.data) {
      for (const brand of allBrands.data) {
        brandMap.set(brand.attributes.slug, brand.id);
      }
    }
  } catch (err) {
    console.error('Error fetching brands:', err.message);
    return { created, skipped, errors };
  }

  for (const item of items) {
    try {
      // Check if model already exists
      const existingModels = await makeRequest(`/models?filters[slug][$eq]=${item.slug}`);
      
      if (existingModels.data && existingModels.data.length > 0) {
        skipped++;
        console.log(`⏭  Model exists, skipping: ${item.name} [${item.slug}]`);
        continue;
      }

      // Find the brand by slug
      const brandId = brandMap.get(item.brandSlug);
      if (!brandId) {
        console.log(`⚠️  Brand not found for slug "${item.brandSlug}", skipping model: ${item.name}`);
        errors++;
        continue;
      }

      const data = {
        data: {
          slug: item.slug,
          name: item.name,
          brand: brandId,
          isActive: item.isActive,
          ...(shouldPublish ? { publishedAt: new Date().toISOString() } : {}),
        }
      };

      await makeRequest('/models', 'POST', data);
      created++;
      console.log(`✅  Model created: ${item.name} [${item.slug}] (Brand: ${item.brandSlug})${shouldPublish ? " (published)" : ""}`);
    } catch (err) {
      console.error(`❌  Error creating model "${item.name}":`, err.message);
      errors++;
    }
  }

  console.log(`\n📊 Model import complete. Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
  return { created, skipped, errors };
}

async function main() {
  console.log('🚀 Starting import process...');
  console.log(`Using Strapi URL: ${STRAPI_URL}`);

  try {
    // Test connection
    try {
      await makeRequest('/brands?pagination[limit]=1');
      console.log('✅ Connected to Strapi successfully');
    } catch (err) {
      console.error('❌ Cannot connect to Strapi. Make sure it\'s running on', STRAPI_URL);
      process.exit(1);
    }
    
    // Import brands first
    const brandStats = await importBrands();
    
    // Import models (depends on brands)
    const modelStats = await importModels();
    
    // Summary
    console.log('\n🎉 Import completed successfully!');
    console.log('📊 Summary:');
    console.log(`   Brands: ${brandStats.created} created, ${brandStats.skipped} skipped`);
    console.log(`   Models: ${modelStats.created} created, ${modelStats.skipped} skipped, ${modelStats.errors} errors`);
    
    if (shouldPublish) {
      console.log('📝 All entries have been published');
    } else {
      console.log('📝 Entries are in draft mode (set PUBLISH=true to auto-publish)');
    }
    
  } catch (err) {
    console.error("❌ Import error:", err);
    process.exitCode = 1;
  }
}

main();
