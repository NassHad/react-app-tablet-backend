// Investigate CITROEN Issue - Check why CITROEN models aren't being found
// Copy and paste this ENTIRE script into your Strapi console

const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log('🔍 Investigating CITROEN Issue...');
    
    // 1. Check CITROEN brand in database
    console.log('\n1. Checking CITROEN brand in database:');
    const citroenBrand = await strapi.entityService.findMany('api::brand.brand', {
      filters: { slug: 'citroen' }
    });
    
    if (citroenBrand.length > 0) {
      console.log(`✅ CITROEN brand exists: ${citroenBrand[0].name}`);
      
      // Get CITROEN models from database
      const citroenModels = await strapi.entityService.findMany('api::model.model', {
        filters: { brand: { slug: 'citroen' } },
        populate: { brand: true }
      });
      
      console.log(`📊 CITROEN models in database: ${citroenModels.length}`);
      if (citroenModels.length > 0) {
        console.log('Sample CITROEN models:');
        citroenModels.slice(0, 10).forEach((model, index) => {
          console.log(`  ${index + 1}. ${model.slug} (${model.name})`);
        });
      }
    } else {
      console.log('❌ CITROEN brand not found in database');
    }
    
    // 2. Check CITROEN models in cleaned_models.json
    console.log('\n2. Checking CITROEN models in cleaned_models.json:');
    const cleanedModelsPath = path.join(process.cwd(), 'scripts', 'json_data', 'cleaned_models.json');
    const cleanedModelsData = fs.readFileSync(cleanedModelsPath, 'utf8');
    const cleanedModels = JSON.parse(cleanedModelsData);
    
    const citroenCleanedModels = cleanedModels.filter(model => model.brandSlug === 'citroen');
    console.log(`📊 CITROEN models in cleaned_models.json: ${citroenCleanedModels.length}`);
    
    if (citroenCleanedModels.length > 0) {
      console.log('Sample CITROEN models from cleaned_models.json:');
      citroenCleanedModels.slice(0, 10).forEach((model, index) => {
        console.log(`  ${index + 1}. ${model.modelSlug} (${model.originalModel})`);
      });
    }
    
    // 3. Check CITROEN entries in osram data
    console.log('\n3. Checking CITROEN entries in osram data:');
    const osramPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_with_slugs.json');
    const osramData = fs.readFileSync(osramPath, 'utf8');
    const osramRecords = JSON.parse(osramData);
    
    const citroenOsramRecords = osramRecords.filter(record => 
      record.brandSlug === 'citroen' || 
      record.originalBrand?.toLowerCase().includes('citroen') ||
      record.originalBrand?.toLowerCase().includes('citro')
    );
    
    console.log(`📊 CITROEN records in osram data: ${citroenOsramRecords.length}`);
    
    if (citroenOsramRecords.length > 0) {
      console.log('Sample CITROEN records from osram data:');
      citroenOsramRecords.slice(0, 10).forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.brandSlug}/${record.modelSlug} (${record.originalBrand} ${record.originalModel})`);
      });
    }
    
    // 4. Check for corrupted entries
    console.log('\n4. Checking for corrupted entries in osram data:');
    const corruptedEntries = osramRecords.filter(record => 
      record.brandSlug?.includes('*') || 
      record.brandSlug?.includes(';') ||
      record.modelSlug?.includes('*') ||
      record.modelSlug?.includes(';') ||
      record.originalBrand?.includes('*') ||
      record.originalModel?.includes('*')
    );
    
    console.log(`📊 Corrupted entries found: ${corruptedEntries.length}`);
    
    if (corruptedEntries.length > 0) {
      console.log('Sample corrupted entries:');
      corruptedEntries.slice(0, 10).forEach((record, index) => {
        console.log(`  ${index + 1}. Brand: "${record.brandSlug}", Model: "${record.modelSlug}"`);
        console.log(`      Original: "${record.originalBrand}" "${record.originalModel}"`);
      });
    }
    
    // 5. Check specific CITROEN model matches
    console.log('\n5. Checking specific CITROEN model matches:');
    
    if (citroenOsramRecords.length > 0 && citroenCleanedModels.length > 0) {
      const osramModelSlugs = new Set(citroenOsramRecords.map(r => r.modelSlug));
      const cleanedModelSlugs = new Set(citroenCleanedModels.map(m => m.modelSlug));
      
      const matchingSlugs = [...osramModelSlugs].filter(slug => cleanedModelSlugs.has(slug));
      const missingInCleaned = [...osramModelSlugs].filter(slug => !cleanedModelSlugs.has(slug));
      const missingInOsram = [...cleanedModelSlugs].filter(slug => !osramModelSlugs.has(slug));
      
      console.log(`Matching model slugs: ${matchingSlugs.length}`);
      console.log(`Missing in cleaned_models.json: ${missingInCleaned.length}`);
      console.log(`Missing in osram data: ${missingInOsram.length}`);
      
      if (matchingSlugs.length > 0) {
        console.log('Matching slugs:', matchingSlugs.slice(0, 10).join(', '));
      }
      
      if (missingInCleaned.length > 0) {
        console.log('Missing in cleaned_models.json:', missingInCleaned.slice(0, 10).join(', '));
      }
    }
    
    // 6. Check database vs cleaned_models.json for CITROEN
    console.log('\n6. Checking database vs cleaned_models.json for CITROEN:');
    
    if (citroenBrand.length > 0 && citroenCleanedModels.length > 0) {
      const citroenModels = await strapi.entityService.findMany('api::model.model', {
        filters: { brand: { slug: 'citroen' } },
        populate: { brand: true }
      });
      const dbModelSlugs = new Set(citroenModels.map(m => m.slug));
      const cleanedModelSlugs = new Set(citroenCleanedModels.map(m => m.modelSlug));
      
      const inDbNotInCleaned = [...dbModelSlugs].filter(slug => !cleanedModelSlugs.has(slug));
      const inCleanedNotInDb = [...cleanedModelSlugs].filter(slug => !dbModelSlugs.has(slug));
      
      console.log(`Models in DB but not in cleaned_models.json: ${inDbNotInCleaned.length}`);
      console.log(`Models in cleaned_models.json but not in DB: ${inCleanedNotInDb.length}`);
      
      if (inCleanedNotInDb.length > 0) {
        console.log('Missing in DB:', inCleanedNotInDb.slice(0, 10).join(', '));
      }
    }
    
    console.log('\n✅ CITROEN investigation complete!');
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
})();
