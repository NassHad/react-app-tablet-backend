// Import script for brands and models
// Usage: node scripts/import-brands-and-models.cjs
// Set PUBLISH=true to auto-publish entries
// Set CLEAR_EXISTING=true to clear existing data before import

try {
  require('ts-node/register/transpile-only'); // hooks .ts require()
} catch (e) {
  console.error('ts-node is missing. Run: npm i -D ts-node typescript @types/node');
  process.exit(1);
}

const fs = require("fs");
const path = require("path");
const { createStrapi } = require('@strapi/strapi');

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

const BRAND_UID = "api::brand.brand";
const MODEL_UID = "api::model.model";

const shouldPublish = String(process.env.PUBLISH || "").toLowerCase() === "true";
const shouldClearExisting = String(process.env.CLEAR_EXISTING || "").toLowerCase() === "true";

// Paths to JSON files
const brandsPath = path.join(process.cwd(), "scripts", "json_data", "final_brands.json");
const modelsPath = path.join(process.cwd(), "scripts", "json_data", "cleaned_models.json");

async function clearExistingData(strapi) {
  if (!shouldClearExisting) return;
  
  console.log("🗑️  Clearing existing data...");
  
  // Clear models first (due to foreign key constraints)
  const modelCount = await strapi.entityService.count(MODEL_UID);
  if (modelCount > 0) {
    console.log(`Deleting ${modelCount} existing models...`);
    const models = await strapi.entityService.findMany(MODEL_UID, { limit: -1 });
    for (const model of models) {
      await strapi.entityService.delete(MODEL_UID, model.id);
    }
  }
  
  // Clear brands
  const brandCount = await strapi.entityService.count(BRAND_UID);
  if (brandCount > 0) {
    console.log(`Deleting ${brandCount} existing brands...`);
    const brands = await strapi.entityService.findMany(BRAND_UID, { limit: -1 });
    for (const brand of brands) {
      await strapi.entityService.delete(BRAND_UID, brand.id);
    }
  }
  
  console.log("✅ Existing data cleared");
}

async function importBrands(strapi) {
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
      const exists = await strapi.entityService.count(BRAND_UID, {
        filters: { slug: item.slug },
      });

      if (exists > 0) {
        skipped++;
        console.log(`⏭  Brand exists, skipping: ${item.name} [${item.slug}]`);
        continue;
      }

      const data = {
        slug: item.slug,
        name: item.name,
        isActive: item.isActive,
        ...(shouldPublish ? { publishedAt: new Date() } : {}),
      };

      await strapi.entityService.create(BRAND_UID, { data });
      created++;
      console.log(`✅  Brand created: ${item.name} [${item.slug}]${shouldPublish ? " (published)" : ""}`);
    } catch (err) {
      console.error(`❌  Error creating brand "${item.name}":`, err.message);
    }
  }

  console.log(`\n📊 Brand import complete. Created: ${created}, Skipped: ${skipped}`);
  return { created, skipped };
}

async function importModels(strapi) {
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
  const allBrands = await strapi.entityService.findMany(BRAND_UID, { limit: -1 });
  for (const brand of allBrands) {
    brandMap.set(brand.slug, brand.id);
  }

  for (const item of items) {
    try {
      // Check if model already exists
      const exists = await strapi.entityService.count(MODEL_UID, {
        filters: { slug: item.slug },
      });

      if (exists > 0) {
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
        slug: item.slug,
        name: item.name,
        brand: brandId,
        isActive: item.isActive,
        ...(shouldPublish ? { publishedAt: new Date() } : {}),
      };

      await strapi.entityService.create(MODEL_UID, { data });
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
  console.log('🚀 Starting Strapi...');
  const strapi = await createStrapi();
  console.log('✅ Strapi instance created, starting...');
  await strapi.start();
  console.log('✅ Strapi started successfully!');

  try {
    // Clear existing data if requested
    await clearExistingData(strapi);
    
    // Import brands first
    const brandStats = await importBrands(strapi);
    
    // Import models (depends on brands)
    const modelStats = await importModels(strapi);
    
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
  } finally {
    await strapi.destroy();
  }
}

main();
