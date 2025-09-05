// Run: node scripts/import-brands.cjs .\data\brands.json
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

const BRAND_UID = "api::brand.brand";
const inputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(process.cwd(), "data", "brands.json");
const shouldPublish = String(process.env.PUBLISH || "").toLowerCase() === "true";

async function main() {
  // IMPORTANT: require(), not import()
  // const { createStrapi } = require("@strapi/strapi");
  const strapi = await createStrapi();
  await strapi.start();

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
      items.push({
        slug,
        name,
        isActive: typeof row.active === "boolean" ? row.active : Boolean(row.active),
      });
    }

    console.log(`Found ${items.length} unique brand(s) in file.`);

    let created = 0;
    let skipped = 0;

    for (const item of items) {
      const exists = await strapi.entityService.count(BRAND_UID, {
        filters: { slug: item.slug },
      });

      if (exists > 0) {
        skipped++;
        console.log(`⏭  Exists, skipping: ${item.name} [${item.slug}]`);
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
      console.log(`✅  Created: ${item.name} [${item.slug}]${shouldPublish ? " (published)" : ""}`);
    }

    console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  } catch (err) {
    console.error("Import error:", err);
    process.exitCode = 1;
  } finally {
    await strapi.destroy();
  }
}

main();
