// Direct import script - run this while Strapi is running
// Usage: node scripts/import-models-direct.cjs

const fs = require('fs');
const path = require('path');

// Basic slugify function
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
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

async function importModels() {
  console.log('🚀 Starting model import...');
  
  const inputPath = path.join(process.cwd(), "scripts", "models.json");
  
  if (!fs.existsSync(inputPath)) {
    console.error('❌ Models file not found at:', inputPath);
    return;
  }

  const rows = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  console.log(`📄 Loaded ${rows.length} models from file`);

  // Pre-dedupe by slug
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

  // Create a simple JSON file with the processed data
  const outputPath = path.join(process.cwd(), "scripts", "models-processed.json");
  fs.writeFileSync(outputPath, JSON.stringify(items, null, 2));
  
  console.log(`✅ Processed models saved to: ${outputPath}`);
  console.log(`📋 Sample models:`);
  items.slice(0, 5).forEach(item => {
    console.log(`  - ${item.name} (${item.brandSlug})`);
  });
  
  console.log(`\n🎯 Next steps:`);
  console.log(`1. Go to Strapi admin: http://localhost:1338/admin`);
  console.log(`2. Go to Content Manager > Models`);
  console.log(`3. Click "Create new entry"`);
  console.log(`4. Use the data from: ${outputPath}`);
  console.log(`5. Or use the bulk import feature if available`);
  
  return items;
}

// Run the import
importModels().catch(console.error);
