// Test script to verify the import works correctly
// Usage: node scripts/test-import.cjs

try {
  require('ts-node/register/transpile-only');
} catch (e) {
  console.error('ts-node is missing. Run: npm i -D ts-node typescript @types/node');
  process.exit(1);
}

const fs = require("fs");
const path = require("path");
const { createStrapi } = require('@strapi/strapi');

const BRAND_UID = "api::brand.brand";
const MODEL_UID = "api::model.model";

async function testImport() {
  console.log('🧪 Testing import script...');
  
  const strapi = await createStrapi();
  await strapi.start();

  try {
    // Test brands
    const brandCount = await strapi.entityService.count(BRAND_UID);
    console.log(`📊 Total brands in database: ${brandCount}`);
    
    if (brandCount > 0) {
      const sampleBrands = await strapi.entityService.findMany(BRAND_UID, { limit: 5 });
      console.log('📋 Sample brands:');
      sampleBrands.forEach(brand => {
        console.log(`   - ${brand.name} [${brand.slug}] (Active: ${brand.isActive})`);
      });
    }

    // Test models
    const modelCount = await strapi.entityService.count(MODEL_UID);
    console.log(`\n📊 Total models in database: ${modelCount}`);
    
    if (modelCount > 0) {
      const sampleModels = await strapi.entityService.findMany(MODEL_UID, { 
        limit: 5,
        populate: ['brand']
      });
      console.log('📋 Sample models:');
      sampleModels.forEach(model => {
        console.log(`   - ${model.name} [${model.slug}] (Brand: ${model.brand?.name || 'N/A'})`);
      });
    }

    // Test relationships
    if (modelCount > 0) {
      const modelsWithBrands = await strapi.entityService.findMany(MODEL_UID, {
        filters: { brand: { $notNull: true } },
        limit: 1,
        populate: ['brand']
      });
      
      if (modelsWithBrands.length > 0) {
        console.log('\n🔗 Relationship test:');
        const model = modelsWithBrands[0];
        console.log(`   Model: ${model.name} -> Brand: ${model.brand?.name || 'N/A'}`);
      }
    }

    console.log('\n✅ Test completed successfully!');
    
  } catch (err) {
    console.error("❌ Test error:", err);
    process.exitCode = 1;
  } finally {
    await strapi.destroy();
  }
}

testImport();
