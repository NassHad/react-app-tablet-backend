// Simple import script that can be run from Strapi console
// Usage: In Strapi console, run: require('./scripts/import-models-simple.cjs')

const fs = require("fs");
const path = require("path");

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

async function importModels() {
  console.log('🚀 Starting model import...');
  
  const inputPath = path.join(process.cwd(), "scripts", "models.json");
  const shouldPublish = String(process.env.PUBLISH || "").toLowerCase() === "true";

  try {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`File not found: ${inputPath}`);
    }

    const rows = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    console.log(`📄 Loaded ${rows.length} models from file`);

    // Pre-dedupe by slug inside the file
    const seen = new Set();
    const items = [];
    for (const row of rows) {
      const name = String(row?.name || "").trim();
      if (!name) continue;
      const slug = slugify(name);
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
        startDate: parseDate(row.startDate),
        endDate: parseDate(row.endDate),
        isActive: true,
      });
    }

    console.log(`📊 Found ${items.length} unique model(s) to import`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of items) {
      try {
        // Check if model already exists
        const exists = await strapi.entityService.count('api::model.model', {
          filters: { slug: item.slug },
        });

        if (exists > 0) {
          skipped++;
          console.log(`⏭  Exists, skipping: ${item.name} [${item.slug}]`);
          continue;
        }

        // Find the brand by slug
        const brands = await strapi.entityService.findMany('api::brand.brand', {
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

        await strapi.entityService.create('api::model.model', { data });
        created++;
        console.log(`✅  Created: ${item.name} [${item.slug}] (Brand: ${brand.name})${shouldPublish ? " (published)" : ""}`);
      } catch (err) {
        console.error(`❌  Error creating model "${item.name}":`, err.message);
        errors++;
      }
    }

    console.log(`\n🎉 Import completed! Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
    return { created, skipped, errors };
  } catch (err) {
    console.error("❌ Import error:", err);
    throw err;
  }
}

// Export the function for use in Strapi console
module.exports = { importModels };

// If running directly, execute the import
if (require.main === module) {
  importModels().catch(console.error);
}
