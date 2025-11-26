// Run: node scripts/import-models.cjs .\scripts\models.json
// Set PUBLISH=true to auto-publish
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

// Parse date from DD/MM/YYYY format
function parseDate(dateStr) {
  if (!dateStr) return null;
  const [day, month, year] = dateStr.split('/');
  return new Date(year, month - 1, day);
}

const MODEL_UID = "api::model.model";
const BRAND_UID = "api::brand.brand";
const inputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(process.cwd(), "scripts", "models.json");
const shouldPublish = String(process.env.PUBLISH || "").toLowerCase() === "true";

async function main() {
  console.log('🚀 Starting Strapi...');
  const strapi = await createStrapi();
  console.log('✅ Strapi instance created, starting...');
  await strapi.start();
  console.log('✅ Strapi started successfully!');

  try {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`File not found: ${inputPath}`);
    }

    const rows = JSON.parse(fs.readFileSync(inputPath, "utf8"));

    // Pre-dedupe by slug inside the file
    const seen = new Set();
    const items = [];
    for (const row of rows) {
      const name = String(row?.name || "").trim();
      if (!name) continue;
      const slug = slugify(name);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      
      // Find the brand by slug
      const brandSlug = String(row?.brandSlug || "").trim();
      if (!brandSlug) {
        console.log(`⚠️  Skipping model "${name}" - no brand slug`);
        continue;
      }

      items.push({
        slug,
        name,
        brandSlug,
        startDate: parseDate(row.startDate),
        endDate: parseDate(row.endDate),
        isActive: true, // Default to active
      });
    }

    console.log(`Found ${items.length} unique model(s) in file.`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of items) {
      try {
        // Check if model already exists
        const exists = await strapi.entityService.count(MODEL_UID, {
          filters: { slug: item.slug },
        });

        if (exists > 0) {
          skipped++;
          console.log(`⏭  Exists, skipping: ${item.name} [${item.slug}]`);
          continue;
        }

        // Find the brand by slug
        const brands = await strapi.entityService.findMany(BRAND_UID, {
          filters: { slug: item.brandSlug },
          limit: 1,
        });

        if (!brands || brands.length === 0) {
          console.log(`⚠️  Brand not found for slug "${item.brandSlug}", skipping model: ${item.name}`);
          errors++;
          continue;
        }

        const brand = brands[0];

        const data = {
          slug: item.slug,
          name: item.name,
          brand: brand.id,
          startDate: item.startDate,
          endDate: item.endDate,
          isActive: item.isActive,
          ...(shouldPublish ? { publishedAt: new Date() } : {}),
        };

        await strapi.entityService.create(MODEL_UID, { data });
        created++;
        console.log(`✅  Created: ${item.name} [${item.slug}] (Brand: ${brand.name})${shouldPublish ? " (published)" : ""}`);
      } catch (err) {
        console.error(`❌  Error creating model "${item.name}":`, err.message);
        errors++;
      }
    }

    console.log(`\nDone. Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
  } catch (err) {
    console.error("Import error:", err);
    process.exitCode = 1;
  } finally {
    await strapi.destroy();
  }
}

main();
