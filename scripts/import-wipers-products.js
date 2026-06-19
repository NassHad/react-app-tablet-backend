const fs = require("fs");
const path = require("path");

// Configuration
const WIPERS_DATA_PATH = path.join(
  __dirname,
  "wipers",
  "wipers_database_janv2026.json",
);
const BATCH_SIZE = 50; // Process in batches to avoid memory issues
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

// Helper function to create slug
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// Helper function to delay execution
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper function to transform wipers data to positions array
function transformWipersToPositions(wipersData) {
  const positions = [];

  // arriere is a direct string ref, not an object
  if (wipersData.arriere && typeof wipersData.arriere === "string") {
    positions.push({
      position: "Arrière",
      ref: wipersData.arriere,
      category: "arriere",
    });
  }

  const positionNames = {
    kitAvant: "Kit Avant",
    coteConducteur: "Côté Conducteur",
    monoBalais: "Mono Balais",
    cotePassager: "Côté Passager",
  };

  // Process multiconnexion and standard (object categories)
  ["multiconnexion", "standard"].forEach((category) => {
    const categoryData = wipersData[category];
    if (!categoryData || typeof categoryData !== "object") return;

    Object.keys(categoryData).forEach((positionKey) => {
      const ref = categoryData[positionKey];
      if (!ref || typeof ref !== "string") return;

      positions.push({
        position: positionNames[positionKey] || positionKey,
        ref: ref,
        category: category,
      });
    });
  });

  return positions;
}

async function importWipersProducts() {
  try {
    console.log("🚀 Starting wipers products import...");

    // Check if wipers data file exists
    if (!fs.existsSync(WIPERS_DATA_PATH)) {
      throw new Error(`Wipers data file not found at: ${WIPERS_DATA_PATH}`);
    }

    // Load wipers data
    console.log("📖 Loading wipers data...");
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, "utf8"));

    if (!wipersData.brands) {
      throw new Error("Invalid wipers data format: brands property not found");
    }

    console.log(
      `📊 Found ${Object.keys(wipersData.brands).length} brands in wipers data`,
    );

    // Get all existing brands and models for reference
    console.log("🔍 Fetching existing brands and models...");
    const existingBrands = await strapi.entityService.findMany(
      "api::brand.brand",
      {
        populate: "*",
      },
    );
    const existingModels = await strapi.entityService.findMany(
      "api::model.model",
      {
        populate: ["brand"],
      },
    );

    // Create lookup maps
    const brandMap = new Map();
    existingBrands.forEach((brand) => {
      brandMap.set(brand.name.toUpperCase(), brand);
    });

    const modelMap = new Map();
    existingModels.forEach((model) => {
      if (!model.brand) return;
      const key = `${model.brand.name.toUpperCase()}-${model.name.toUpperCase()}`;
      modelMap.set(key, model);
    });

    console.log(
      `📋 Found ${existingBrands.length} existing brands and ${existingModels.length} existing models`,
    );

    // Process brands and their models
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    const brands = Object.keys(wipersData.brands);

    for (let i = 0; i < brands.length; i += BATCH_SIZE) {
      const brandBatch = brands.slice(i, i + BATCH_SIZE);

      console.log(
        `\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(brands.length / BATCH_SIZE)} (${brandBatch.length} brands)`,
      );

      for (const brandName of brandBatch) {
        try {
          const brandData = wipersData.brands[brandName];
          if (!brandData || !Array.isArray(brandData)) {
            console.log(`⚠️  Skipping brand ${brandName}: invalid data format`);
            totalSkipped++;
            continue;
          }

          // Find existing brand
          const existingBrand = brandMap.get(brandName.toUpperCase());
          if (!existingBrand) {
            console.log(
              `⚠️  Skipping brand ${brandName}: not found in existing brands`,
            );
            totalSkipped++;
            continue;
          }

          // Process each model for this brand
          for (const modelData of brandData) {
            try {
              if (!modelData.model || !modelData.wipers) {
                console.log(
                  `⚠️  Skipping model ${modelData.model || "Unknown"}: missing required data`,
                );
                totalSkipped++;
                continue;
              }

              // Find existing model
              const modelKey = `${brandName.toUpperCase()}-${modelData.model.toUpperCase()}`;
              const existingModel = modelMap.get(modelKey);
              if (!existingModel) {
                console.log(
                  `⚠️  Skipping model ${modelData.model}: not found in existing models`,
                );
                totalSkipped++;
                continue;
              }

              // Transform wipers data to positions array
              const wipersPositions = transformWipersToPositions(
                modelData.wipers,
              );

              if (wipersPositions.length === 0) {
                console.log(
                  `⚠️  Skipping model ${modelData.model}: no wiper positions found`,
                );
                totalSkipped++;
                continue;
              }

              // Check if wipers product already exists for this model
              const existingProducts = await strapi.entityService.findMany(
                "api::wipers-product.wipers-product",
                {
                  filters: {
                    model: {
                      id: existingModel.id,
                    },
                  },
                },
              );

              const updateData = {
                wipersPositions: wipersPositions,
                constructionYearStart: modelData.productionYears?.start || null,
                constructionYearEnd: modelData.productionYears?.end || null,
                direction: modelData.direction || null,
                source: "Database_PerfectVision_Janv2026.csv",
              };

              if (existingProducts.length > 0) {
                // Update all existing wiper products for this model
                for (const existing of existingProducts) {
                  await strapi.entityService.update(
                    "api::wipers-product.wipers-product",
                    existing.id,
                    { data: updateData },
                  );
                }
                console.log(
                  `🔄 Updated ${existingProducts.length} product(s) for ${existingBrand.name} ${existingModel.name} (${wipersPositions.length} positions)`,
                );
                totalUpdated++;
              } else {
                // Create new wiper product
                await strapi.entityService.create(
                  "api::wipers-product.wipers-product",
                  {
                    data: {
                      name: `${existingBrand.name} ${existingModel.name} - Wipers`,
                      ref: `WIPERS-${existingBrand.slug}-${existingModel.slug}`,
                      description: `Wipers for ${existingBrand.name} ${existingModel.name}`,
                      brand: existingBrand.id,
                      model: existingModel.id,
                      ...updateData,
                      category: "wipers",
                      isActive: true,
                      publishedAt: new Date(),
                    },
                  },
                );
                console.log(
                  `✅ Created wipers product for ${existingBrand.name} ${existingModel.name} (${wipersPositions.length} positions)`,
                );
                totalCreated++;
              }
            } catch (modelError) {
              console.error(
                `❌ Error processing model ${modelData.model}:`,
                modelError.message,
              );
              totalErrors++;
            }

            totalProcessed++;
          }
        } catch (brandError) {
          console.error(
            `❌ Error processing brand ${brandName}:`,
            brandError.message,
          );
          totalErrors++;
        }
      }

      // Add delay between batches
      if (i + BATCH_SIZE < brands.length) {
        console.log(
          `⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`,
        );
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    console.log("\n🎉 Wipers products import completed!");
    console.log(`📊 Summary:`);
    console.log(`   - Total processed: ${totalProcessed}`);
    console.log(`   - Created: ${totalCreated}`);
    console.log(`   - Updated: ${totalUpdated}`);
    console.log(`   - Skipped: ${totalSkipped}`);
    console.log(`   - Errors: ${totalErrors}`);
  } catch (error) {
    console.error("💥 Import failed:", error);
    throw error;
  }
}

// Run the import if this script is executed directly
if (require.main === module) {
  importWipersProducts()
    .then(() => {
      console.log("✅ Import completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Import failed:", error);
      process.exit(1);
    });
}

module.exports = { importWipersProducts };
