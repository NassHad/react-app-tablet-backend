const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

/**
 * Complete Strapi import script for Purflux filter system
 * Imports products, creates brands/models, and populates compatibility data
 */

const CSV_PRODUCTS = path.join(__dirname, 'liste_affectation', 'recap_data_purflux.csv');
const CSV_COMPATIBILITY = path.join(__dirname, 'liste_affectation', 'Applications_borne_20240118_Purflux.csv');

// Strapi API configuration
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Helper function to make API calls to Strapi
async function strapiRequest(endpoint, method = 'GET', data = null) {
  const url = `${STRAPI_URL}/api${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(API_TOKEN && { 'Authorization': `Bearer ${API_TOKEN}` })
    }
  };

  if (data) {
    options.body = JSON.stringify({ data });
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error.message);
    throw error;
  }
}

// Helper function to find or create brand
async function findOrCreateBrand(brandName) {
  try {
    // Try to find existing brand
    const existing = await strapiRequest(`/brands?filters[name][$eq]=${encodeURIComponent(brandName)}`);
    
    if (existing.data && existing.data.length > 0) {
      return existing.data[0].id;
    }

    // Create new brand
    const newBrand = await strapiRequest('/brands', 'POST', {
      name: brandName,
      slug: brandName.toLowerCase().replace(/\s+/g, '-'),
      isActive: true
    });

    return newBrand.data.id;
  } catch (error) {
    console.error(`❌ Error with brand ${brandName}:`, error.message);
    throw error;
  }
}

// Helper function to find or create model
async function findOrCreateModel(modelName, brandId) {
  try {
    // Clean model name for Strapi
    const cleanModelName = modelName
      .replace(/[^\w\s\-]/g, '') // Remove special characters except spaces, hyphens, and underscores
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim()
      .substring(0, 100); // Limit to 100 characters
    
    if (!cleanModelName) {
      throw new Error(`Invalid model name: ${modelName}`);
    }

    // Try to find existing model
    const existing = await strapiRequest(`/models?filters[name][$eq]=${encodeURIComponent(cleanModelName)}&filters[brand][id][$eq]=${brandId}`);
    
    if (existing.data && existing.data.length > 0) {
      return existing.data[0].id;
    }

    // Create new model
    const newModel = await strapiRequest('/models', 'POST', {
      name: cleanModelName,
      slug: cleanModelName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, ''),
      brand: brandId,
      isActive: true
    });

    return newModel.data.id;
  } catch (error) {
    console.error(`❌ Error with model ${modelName}:`, error.message);
    throw error;
  }
}

// Import Filter Products
async function importFilterProducts() {
  console.log('🚀 Starting FilterProduct import...');
  
  const records = [];
  let processedCount = 0;
  let errorCount = 0;

  const CATEGORY_TO_FILTER_TYPE = {
    'FILTRE A HUILE': 'oil',
    'FILTRE GAZOLE': 'diesel', 
    'FILTRE A AIR': 'air',
    'FILTRE HABITACLE': 'cabin'
  };

  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PRODUCTS)
      .pipe(parse({
        delimiter: ';',
        columns: ['gsa', 'type', 'category', 'brand', 'sku', 'name', 'ean'],
        skip_empty_lines: true,
        trim: true
      }))
      .on('data', (row) => {
        try {
          const category = row.category;
          const filterType = CATEGORY_TO_FILTER_TYPE[category];
          
          if (!filterType) {
            console.warn(`⚠️  Unknown category: ${category}`);
            return;
          }

          const fullName = row.name;
          const internalSKU = row.sku;
          const ean = row.ean;

          if (!internalSKU || !ean || !fullName) {
            console.warn(`⚠️  Missing required data for: ${fullName}`);
            return;
          }

          // Extract reference from full name
          const refMatch = fullName.match(/PURFLUX FILTRE \w+ (\w+)( -(\d+))?/);
          if (!refMatch) {
            console.warn(`⚠️  Could not parse reference from: ${fullName}`);
            return;
          }

          const reference = refMatch[1];
          const fullReference = refMatch[3] || '';

           const record = {
             brand: 'PURFLUX',
             filterType,
             reference,
             fullReference,
             fullName,
             ean,
             internalSKU,
             category,
             slug: fullName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, ''),
             isActive: true
           };

          records.push(record);
          processedCount++;

          if (processedCount % 10 === 0) {
            console.log(`📊 Processed ${processedCount} products...`);
          }

        } catch (error) {
          console.error(`❌ Error processing product row:`, error);
          errorCount++;
        }
      })
      .on('end', async () => {
        console.log(`\n📈 FilterProduct Summary:`);
        console.log(`   ✅ Successfully processed: ${processedCount} products`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📦 Total records to import: ${records.length}`);

        if (records.length === 0) {
          console.log('⚠️  No products to import.');
          resolve([]);
          return;
        }

        try {
          // Import to Strapi
          console.log('\n🔄 Importing products to Strapi...');
          const importedProducts = [];
          
          for (const record of records) {
            try {
              const result = await strapiRequest('/filter-products', 'POST', record);
              importedProducts.push(result.data);
              console.log(`✅ Imported: ${record.reference} - ${record.fullName}`);
            } catch (error) {
              console.error(`❌ Failed to import ${record.reference}:`, error.message);
            }
          }

          console.log(`\n✅ FilterProduct import completed: ${importedProducts.length}/${records.length} products imported`);
          resolve(importedProducts);
        } catch (error) {
          console.error('❌ Error during product import:', error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('❌ CSV parsing error:', error);
        reject(error);
      });
  });
}

// Import Filter Compatibility
async function importFilterCompatibility() {
  console.log('\n🚀 Starting FilterCompatibility import...');
  
  const consolidatedRecords = new Map();
  let processedCount = 0;
  let errorCount = 0;
  let originalRowCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_COMPATIBILITY)
      .pipe(parse({
        delimiter: ';',
        columns: [
          'marque', 'typemodele', 'modele', 'puissance', 'moteur', 
          'debut', 'fin', 'comfixe', 'commentaire', 'date', 
          'air', 'habitacle', 'gazole', 'huile'
        ],
        skip_empty_lines: true,
        trim: true
      }))
      .on('data', (row) => {
        try {
          originalRowCount++;
          
          // Skip header row
          if (row.marque === 'Marque') {
            return;
          }

          // Create unique key for consolidation
          const uniqueKey = `${row.marque}|${row.modele}|${row.moteur}|${row.puissance}`;
          
          // Extract vehicle variant
          let vehicleVariant = '';
          if (row.modele && row.typemodele) {
            const baseModel = row.typemodele.trim();
            const fullModel = row.modele.trim();
            
            if (fullModel.includes(baseModel)) {
              vehicleVariant = fullModel
                .substring(fullModel.indexOf(baseModel) + baseModel.length)
                .replace(/^[\s\/]+/, '')
                .trim();
            } else {
              vehicleVariant = fullModel;
            }
          }
          
          // Initialize or get existing record
          if (!consolidatedRecords.has(uniqueKey)) {
            consolidatedRecords.set(uniqueKey, {
              brand: row.marque,
              typeModele: row.typemodele,
              vehicleModel: row.modele,
              vehicleVariant: vehicleVariant,
              engineCode: row.moteur,
              power: row.puissance,
              productionStart: row.debut,
              productionEnd: row.fin,
              filters: {
                oil: [],
                air: [],
                diesel: [],
                cabin: []
              },
              metadata: {
                chassisNote: null,
                generalComment: null
              }
            });
          }

          const record = consolidatedRecords.get(uniqueKey);

          // Helper function to add or merge filter with deduplication
          const addFilterWithDedup = (filterArray, ref, notes) => {
            const existing = filterArray.find(f => f.ref === ref);
            
            if (existing) {
              notes.forEach(note => {
                if (note && !existing.notes.includes(note)) {
                  existing.notes.push(note);
                }
              });
            } else {
              filterArray.push({
                ref: ref,
                notes: notes.filter(n => n)
              });
            }
          };

          // Add filter references if they exist
          if (row.huile) {
            const notes = [];
            if (row.date) notes.push(`Date: ${row.date}`);
            if (row.commentaire) notes.push(row.commentaire);
            addFilterWithDedup(record.filters.oil, row.huile, notes);
          }

          if (row.air) {
            const notes = [];
            if (row.date) notes.push(`Date: ${row.date}`);
            if (row.commentaire) notes.push(row.commentaire);
            addFilterWithDedup(record.filters.air, row.air, notes);
          }

          if (row.gazole) {
            const notes = [];
            if (row.date) notes.push(`Date: ${row.date}`);
            if (row.commentaire) notes.push(row.commentaire);
            addFilterWithDedup(record.filters.diesel, row.gazole, notes);
          }

          if (row.habitacle) {
            const notes = [];
            if (row.date) notes.push(`Date: ${row.date}`);
            if (row.commentaire) notes.push(row.commentaire);
            addFilterWithDedup(record.filters.cabin, row.habitacle, notes);
          }

          // Update metadata
          if (row.comfixe) {
            record.metadata.chassisNote = row.comfixe;
          }
          if (row.commentaire && !row.huile && !row.air && !row.gazole && !row.habitacle) {
            record.metadata.generalComment = row.commentaire;
          }

          processedCount++;

          if (processedCount % 1000 === 0) {
            console.log(`📊 Processed ${processedCount} rows...`);
          }

        } catch (error) {
          console.error(`❌ Error processing compatibility row:`, error);
          errorCount++;
        }
      })
      .on('end', async () => {
        console.log(`\n📈 Consolidation Summary:`);
        console.log(`   📥 Original rows: ${originalRowCount}`);
        console.log(`   📦 Consolidated records: ${consolidatedRecords.size}`);
        console.log(`   📉 Reduction: ${((1 - consolidatedRecords.size / originalRowCount) * 100).toFixed(1)}%`);
        console.log(`   ✅ Successfully processed: ${processedCount} rows`);
        console.log(`   ❌ Errors: ${errorCount}`);

        if (consolidatedRecords.size === 0) {
          console.log('⚠️  No compatibility records to import.');
          resolve([]);
          return;
        }

        try {
          // Convert Map to Array for processing
          const records = Array.from(consolidatedRecords.values());
          
          console.log('\n🔄 Importing compatibility records to Strapi...');
          const importedCompatibilities = [];
          
          // Create brand and model cache
          const brandCache = new Map();
          const modelCache = new Map();
          
           for (const record of records) {
             try {
               // Get or create brand
               let brandId = brandCache.get(record.brand);
               if (!brandId) {
                 brandId = await findOrCreateBrand(record.brand);
                 brandCache.set(record.brand, brandId);
               }

               // Get or create model
               const modelKey = `${record.brand}|${record.typeModele}`;
               let modelId = modelCache.get(modelKey);
               if (!modelId) {
                 modelId = await findOrCreateModel(record.typeModele, brandId);
                 modelCache.set(modelKey, modelId);
               }

               // Create compatibility record
               const compatibilityData = {
                 brand: brandId,
                 model: modelId,
                 vehicleModel: record.vehicleModel,
                 vehicleVariant: record.vehicleVariant,
                 engineCode: record.engineCode,
                 power: record.power,
                 productionStart: record.productionStart,
                 productionEnd: record.productionEnd,
                 filters: record.filters,
                 metadata: record.metadata
               };

               const result = await strapiRequest('/filter-compatibilities', 'POST', compatibilityData);
               importedCompatibilities.push(result.data);
               
               if (importedCompatibilities.length % 100 === 0) {
                 console.log(`✅ Imported ${importedCompatibilities.length} compatibility records...`);
               }

             } catch (error) {
               console.error(`❌ Failed to import compatibility for ${record.vehicleModel}:`, error.message);
               // Continue with next record instead of stopping
               continue;
             }
           }

          console.log(`\n✅ FilterCompatibility import completed: ${importedCompatibilities.length}/${records.length} records imported`);
          resolve(importedCompatibilities);
        } catch (error) {
          console.error('❌ Error during compatibility import:', error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('❌ CSV parsing error:', error);
        reject(error);
      });
  });
}

// Main import function
async function runCompleteImport() {
  console.log('🎯 Starting Complete Purflux Filter System Import');
  console.log('=' .repeat(60));
  
  try {
    // Check if Strapi is running
    console.log('🔍 Checking Strapi connection...');
    await strapiRequest('/brands');
    console.log('✅ Strapi connection successful');
    
    // Step 1: Import Filter Products
    console.log('\n📦 Step 1: Importing Filter Products');
    console.log('-'.repeat(40));
    const products = await importFilterProducts();
    
    // Step 2: Import Filter Compatibility
    console.log('\n🚗 Step 2: Importing Filter Compatibility');
    console.log('-'.repeat(40));
    const compatibilities = await importFilterCompatibility();
    
    // Final Summary
    console.log('\n🎉 IMPORT COMPLETE!');
    console.log('=' .repeat(60));
    console.log(`✅ Filter Products: ${products.length} imported`);
    console.log(`✅ Filter Compatibilities: ${compatibilities.length} imported`);
    console.log(`✅ Brands and Models: Created automatically`);
    console.log('\n🚀 Your Purflux Filter System is ready!');
    console.log('💡 Test the API endpoints:');
    console.log(`   GET ${STRAPI_URL}/api/filter-compatibility/variants?brand=ABARTH&model=500 II`);
    console.log(`   GET ${STRAPI_URL}/api/filter-compatibility/search?brand=ABARTH&model=500 II&engine=312A1000`);
    
  } catch (error) {
    console.error('\n💥 Import failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure Strapi is running: npm run develop');
    console.log('   2. Check if content types are registered');
    console.log('   3. Verify API token if using authentication');
    process.exit(1);
  }
}

// Run the import if this script is executed directly
if (require.main === module) {
  runCompleteImport()
    .then(() => {
      console.log('\n🎉 Complete import script finished!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Complete import failed:', error);
      process.exit(1);
    });
}

module.exports = { runCompleteImport, importFilterProducts, importFilterCompatibility };
