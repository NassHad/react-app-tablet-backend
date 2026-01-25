import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const STRAPI_URL = 'http://localhost:1338';
const TABLET_ID = 'tablet-001';
const OUTPUT_DB_PATH = path.join(__dirname, '..', 'public', 'assets', 'databases', 'react-app-db.db');

// Ensure output directory exists
const outputDir = path.dirname(OUTPUT_DB_PATH);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function fetchStrapiData() {
  console.log('🔄 Fetching data from Strapi...');
  
  try {
    const response = await fetch(`${STRAPI_URL}/api/sync/${TABLET_ID}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Handle both old format (direct properties) and new format (data object)
    const syncData = data.data || data;
    
    // Debug: Check if models have populated brand relations
    if (syncData.models && syncData.models.length > 0) {
      const sampleModel = syncData.models[0];
      console.log('🔍 Sample model structure:', {
        id: sampleModel.id,
        name: sampleModel.name,
        hasBrand: !!sampleModel.brand,
        brandType: typeof sampleModel.brand,
        brandIsObject: typeof sampleModel.brand === 'object',
        brandHasSlug: sampleModel.brand?.slug ? 'yes' : 'no',
        brandHasName: sampleModel.brand?.name ? 'yes' : 'no',
        brandKeys: sampleModel.brand ? Object.keys(sampleModel.brand) : []
      });
      
      // Count models with/without brand
      const modelsWithBrand = syncData.models.filter(m => m.brand && m.brand.slug);
      const modelsWithoutBrand = syncData.models.length - modelsWithBrand.length;
      console.log(`📊 Models statistics: ${modelsWithBrand.length} with brand, ${modelsWithoutBrand} without brand`);
      
      // Show sample of models without brand (first 5)
      if (modelsWithoutBrand > 0) {
        const modelsWithoutBrandList = syncData.models
          .filter(m => !m.brand || !m.brand.slug)
          .slice(0, 5)
          .map(m => ({ id: m.id, name: m.name, brand: m.brand }));
        console.log('⚠️ Sample models without brand:', modelsWithoutBrandList);
      }
    }
    
    // Debug: Check brands structure
    if (syncData.brands && syncData.brands.length > 0) {
      const sampleBrand = syncData.brands[0];
      console.log('🔍 Sample brand structure:', {
        id: sampleBrand.id,
        name: sampleBrand.name,
        slug: sampleBrand.slug,
        vehicle_type: sampleBrand.vehicle_type,
        isActive: sampleBrand.isActive,
        keys: Object.keys(sampleBrand)
      });
      console.log(`📊 Total brands: ${syncData.brands.length}`);
    }
    
    console.log(`✅ Data fetched successfully:`, {
      version: data.version,
      timestamp: data.timestamp || data.version,
      tabletId: data.tabletId,
      tablesCount: Object.keys(syncData).length,
      tables: Object.keys(syncData)
    });
    
    return {
      ...data,
      data: syncData
    };
  } catch (error) {
    console.error('❌ Error fetching data from Strapi:', error);
    throw error;
  }
}

function createDatabase() {
  console.log('🗄️ Creating SQLite database...');
  
  // Remove existing database if it exists
  if (fs.existsSync(OUTPUT_DB_PATH)) {
    fs.unlinkSync(OUTPUT_DB_PATH);
  }
  
  const db = new sqlite3.Database(OUTPUT_DB_PATH);
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create tables
      db.run(`
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          icon TEXT NOT NULL,
          active BOOLEAN NOT NULL DEFAULT 1,
          "order" INTEGER
        );
      `);
      
      db.run(`
        CREATE TABLE products (
          id INTEGER PRIMARY KEY,
          brand TEXT NOT NULL,
          type TEXT NOT NULL,
          category TEXT NOT NULL,
          specifications TEXT,
          battery_type TEXT,
          lighting_type TEXT,
          power TEXT,
          tension TEXT,
          quantity TEXT,
          voltage TEXT,
          number TEXT,
          reference TEXT,
          size TEXT
        );
      `);
      
      db.run(`
        CREATE TABLE brands (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          vehicle_type TEXT,
          isActive BOOLEAN DEFAULT 1
        );
      `);
      
      db.run(`
        CREATE TABLE models (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          brand_slug TEXT NOT NULL,
          brand_name TEXT,
          vehicle_type TEXT,
          isActive BOOLEAN DEFAULT 1
        );
      `);
      
      db.run(`
        CREATE TABLE light_data (
          id INTEGER PRIMARY KEY,
          ref TEXT NOT NULL,
          brand TEXT,
          category TEXT,
          description TEXT,
          EAN INTEGER,
          refGTI INTEGER,
          brandImg TEXT,
          img TEXT,
          isActive BOOLEAN DEFAULT 1,
          specifications TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `);
      
      db.run(`
        CREATE TABLE battery_data (
          id INTEGER PRIMARY KEY,
          ref TEXT NOT NULL,
          description TEXT,
          brand TEXT,
          brandImg TEXT,
          img TEXT,
          specifications TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `);
      
      db.run(`
        CREATE TABLE wipers_data (
          id INTEGER PRIMARY KEY,
          ref TEXT NOT NULL UNIQUE,
          category TEXT,
          brand TEXT,
          size TEXT,
          description TEXT,
          isActive BOOLEAN DEFAULT 1,
          brandImg TEXT,
          img TEXT,
          gtiCode INTEGER,
          genCode INTEGER,
          created_at TEXT,
          updated_at TEXT
        );
      `);
      
      db.run(`
        CREATE TABLE battery_products (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT,
          brand TEXT,
          brand_slug TEXT,
          model_name TEXT,
          model_slug TEXT,
          motorisations TEXT,
          is_active BOOLEAN DEFAULT 1,
          category TEXT,
          battery_brand TEXT,
          img TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `);
      
      db.run(`
        CREATE TABLE lights_products (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT,
          brand TEXT,
          brand_slug TEXT,
          model_name TEXT,
          model_slug TEXT,
          light_positions TEXT,
          ref TEXT,
          description TEXT,
          construction_year_start TEXT,
          construction_year_end TEXT,
          type_conception TEXT,
          part_number TEXT,
          notes TEXT,
          source TEXT,
          category TEXT,
          is_active BOOLEAN DEFAULT 1,
          created_at TEXT,
          updated_at TEXT
        );
      `);
      
      db.run(`
        CREATE TABLE wipers_products (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT,
          brand TEXT,
          brand_slug TEXT,
          model_name TEXT,
          model_slug TEXT,
          wipers_positions TEXT,
          ref TEXT,
          description TEXT,
          construction_year_start TEXT,
          construction_year_end TEXT,
          direction TEXT,
          wiper_brand TEXT,
          source TEXT,
          category TEXT,
          is_active BOOLEAN DEFAULT 1,
          created_at TEXT,
          updated_at TEXT
        );
      `);

      db.run(`
        CREATE TABLE vehicles (
          id INTEGER PRIMARY KEY,
          brand TEXT NOT NULL,
          model TEXT NOT NULL,
          year INTEGER,
          motorisation TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `);
      
      db.run(`
        CREATE TABLE compatibilities (
          id INTEGER PRIMARY KEY,
          vehicle_id INTEGER,
          product_id INTEGER,
          created_at TEXT,
          updated_at TEXT
        );
      `);
      
      db.run(`
        CREATE TABLE questions (
          id INTEGER PRIMARY KEY,
          question TEXT NOT NULL,
          category TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `);
      
      db.run(`
        CREATE TABLE positions (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          icon TEXT,
          vehicle_type TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `);
      
      db.run(`
        CREATE TABLE motorisations (
          id INTEGER PRIMARY KEY,
          motorisation TEXT NOT NULL,
          batteryTypes TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `);

      db.run(`
        CREATE TABLE filter_products (
          id INTEGER PRIMARY KEY,
          brand TEXT NOT NULL DEFAULT 'PURFLUX',
          filter_type TEXT NOT NULL CHECK (filter_type IN ('oil', 'air', 'diesel', 'cabin')),
          reference TEXT NOT NULL,
          full_reference TEXT,
          full_name TEXT NOT NULL,
          ean TEXT UNIQUE NOT NULL,
          internal_sku TEXT UNIQUE NOT NULL,
          category TEXT NOT NULL,
          is_active BOOLEAN DEFAULT true,
          slug TEXT UNIQUE NOT NULL,
          img TEXT,
          brandImg TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `);

      db.run(`
        CREATE TABLE filter_compatibilities (
          id INTEGER PRIMARY KEY,
          brand_id INTEGER,
          model_id INTEGER,
          brand_name TEXT,
          model_name TEXT,
          vehicle_variant TEXT,
          engine_code TEXT,
          power TEXT,
          production_start TEXT,
          production_end TEXT,
          filters TEXT,
          metadata TEXT,
          created_at TEXT,
          updated_at TEXT,
          FOREIGN KEY (brand_id) REFERENCES brands(id),
          FOREIGN KEY (model_id) REFERENCES models(id)
        );
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_filter_compat_brand_model 
        ON filter_compatibilities(brand_id, model_id);
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_filter_compat_variant 
        ON filter_compatibilities(vehicle_variant);
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_filter_products_ref 
        ON filter_products(reference);
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_filter_products_type 
        ON filter_products(filter_type);
      `);
      
      db.run(`
        CREATE TABLE db_version (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version TEXT NOT NULL,
          timestamp TEXT NOT NULL
        );
      `);
      
      console.log('✅ Database tables created');
      resolve(db);
    });
  });
}

async function insertData(db, syncData) {
  console.log('📝 Inserting data into database...');
  
  // Store brands lookup for models without populated brand relation
  const brandsLookup = new Map();
  const brandsBySlug = new Map();
  if (syncData.data?.brands) {
    syncData.data.brands.forEach((brand) => {
      brandsLookup.set(brand.id, brand);
      brandsBySlug.set(brand.slug, brand);
    });
    console.log(`📋 Loaded ${brandsLookup.size} brands for lookup`);
  }
  
  // NOTE: On conserve les données Strapi originales (JSON) pour que getImageUrl() puisse
  // extraire le filename et construire le bon chemin vers les images téléchargées.
  // Les images sont téléchargées par download-images.js avec la convention: {prefix}_{filename}
  // Exemple: light_904600_OSRAM_P21_W.jpg

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const stmt = db.prepare(`
        INSERT INTO db_version (version, timestamp) VALUES (?, ?)
      `);
      stmt.run(syncData.version, syncData.timestamp);
      stmt.finalize();
      
        // Map Strapi table names to SQLite table names
        const tableMapping = {
          'categories': 'categories',
          'brands': 'brands',
          'models': 'models',
          'batteryData': 'battery_data',
          'batteryProducts': 'battery_products',
          'lightsProducts': 'lights_products',
          'lightData': 'light_data',
          'wipersData': 'wipers_data',
          'wiperData': 'wipers_data',
          'wipersProducts': 'wipers_products',
          'vehicles': 'vehicles',
          'compatibilities': 'compatibilities',
          'specificQuestions': 'questions',
          'lightsPositions': 'positions',
          'motorisations': 'motorisations',
          'filterProducts': 'filter_products',
          'filterCompatibilities': 'filter_compatibilities'
        };
        
        // Insert data for each table
        const tables = Object.keys(syncData.data);
        let completed = 0;
        
        tables.forEach(strapiTableName => {
          const sqliteTableName = tableMapping[strapiTableName];
          if (!sqliteTableName) {
            console.log(`⚠️ Skipping unmapped table: ${strapiTableName}`);
            completed++;
            if (completed === tables.length) {
              resolve();
            }
            return;
          }
          
          const data = syncData.data[strapiTableName];
          if (!Array.isArray(data) || data.length === 0) {
            console.log(`⚠️ No data for table: ${strapiTableName} -> ${sqliteTableName}`);
            completed++;
            if (completed === tables.length) {
              resolve();
            }
            return;
          }
          
          console.log(`📝 Inserting ${data.length} records into ${sqliteTableName} (from ${strapiTableName})...`);
          
          // Map Strapi columns to SQLite columns
          const columnMapping = {
            'categories': {
              'id': 'id',
              'name': 'name',
              'slug': 'slug',
              'icon': 'icon',
              'isActive': 'active',
              'order': 'order'
            },
            'brands': {
              'id': 'id',
              'name': 'name',
              'slug': 'slug',
              'vehicle_type': 'vehicle_type',
              'isActive': 'isActive'
            },
            'models': {
              'id': 'id',
              'name': 'name',
              'slug': 'slug',
              'brand.slug': 'brand_slug',
              'brand.name': 'brand_name',
              'vehicle_type': 'vehicle_type',
              'isActive': 'isActive'
            },
            'battery_data': {
              'id': 'id',
              'ref': 'ref',
              'description': 'description',
              'brand': 'brand',
              'brandImg': 'brandImg',
              'img': 'img',
              'specifications': 'specifications',
              'createdAt': 'created_at',
              'updatedAt': 'updated_at'
            },
            'light_data': {
              'id': 'id',
              'ref': 'ref',
              'brand': 'brand',
              'category': 'category',
              'description': 'description',
              'EAN': 'EAN',
              'refGTI': 'refGTI',
              'brandImg': 'brandImg',
              'img': 'img',
              'isActive': 'isActive',
              'specifications': 'specifications',
              'createdAt': 'created_at',
              'updatedAt': 'updated_at'
            },
            'wipers_data': {
              'id': 'id',
              'ref': 'ref',
              'category': 'category',
              'brand': 'brand',
              'size': 'size',
              'description': 'description',
              'isActive': 'isActive',
              'brandImg': 'brandImg',
              'img': 'img',
              'gtiCode': 'gtiCode',
              'genCode': 'genCode',
              'createdAt': 'created_at',
              'updatedAt': 'updated_at'
            },
            'battery_products': {
              'id': 'id',
              'name': 'name',
              'slug': 'slug',
              'brand': 'brand',
              'brandSlug': 'brand_slug',
              'modelName': 'model_name',
              'modelSlug': 'model_slug',
              'motorisations': 'motorisations',
              'isActive': 'is_active',
              'category': 'category',
              'batteryBrand': 'battery_brand',
              'img': 'img',
              'createdAt': 'created_at',
              'updatedAt': 'updated_at'
            },
            'lights_products': {
              'id': 'id',
              'name': 'name',
              'slug': 'slug',
              'brand.name': 'brand',
              'brand.slug': 'brand_slug',
              'model.name': 'model_name',
              'model.slug': 'model_slug',
              'lightPositions': 'light_positions',
              'ref': 'ref',
              'description': 'description',
              'constructionYearStart': 'construction_year_start',
              'constructionYearEnd': 'construction_year_end',
              'typeConception': 'type_conception',
              'partNumber': 'part_number',
              'notes': 'notes',
              'source': 'source',
              'category': 'category',
              'isActive': 'is_active',
              'createdAt': 'created_at',
              'updatedAt': 'updated_at'
            },
            'wipers_products': {
              'id': 'id',
              'name': 'name',
              'slug': 'slug',
              'brand.name': 'brand',
              'brand.slug': 'brand_slug',
              'model.name': 'model_name',
              'model.slug': 'model_slug',
              'wipersPositions': 'wipers_positions',
              'ref': 'ref',
              'description': 'description',
              'constructionYearStart': 'construction_year_start',
              'constructionYearEnd': 'construction_year_end',
              'direction': 'direction',
              'wiperBrand': 'wiper_brand',
              'source': 'source',
              'category': 'category',
              'isActive': 'is_active',
              'createdAt': 'created_at',
              'updatedAt': 'updated_at'
            },
            'positions': {
              'id': 'id',
              'name': 'name',
              'slug': 'slug',
              'icon': 'icon',
              'vehicleType': 'vehicle_type',
              'createdAt': 'created_at',
              'updatedAt': 'updated_at'
            },
            'filter_products': {
              'id': 'id',
              'brand': 'brand',
              'filterType': 'filter_type',
              'reference': 'reference',
              'fullReference': 'full_reference',
              'fullName': 'full_name',
              'ean': 'ean',
              'internalSKU': 'internal_sku',
              'category': 'category',
              'isActive': 'is_active',
              'slug': 'slug',
              'img': 'img',
              'brandImg': 'brandImg',
              'createdAt': 'created_at',
              'updatedAt': 'updated_at'
            },
            'filter_compatibilities': {
              'id': 'id',
              'brand.id': 'brand_id',
              'model.id': 'model_id',
              'brand.name': 'brand_name',
              'model.name': 'model_name',
              'vehicleVariant': 'vehicle_variant',
              'engineCode': 'engine_code',
              'power': 'power',
              'productionStart': 'production_start',
              'productionEnd': 'production_end',
              'filters': 'filters',
              'metadata': 'metadata',
              'createdAt': 'created_at',
              'updatedAt': 'updated_at'
            }
          };
          
          const mapping = columnMapping[sqliteTableName];
          if (!mapping) {
            console.log(`⚠️ No column mapping for table: ${sqliteTableName}`);
            completed++;
            if (completed === tables.length) {
              resolve();
            }
            return;
          }
          
          // Get SQLite columns and Strapi columns
          const sqliteColumns = Object.values(mapping);
          const strapiColumns = Object.keys(mapping);
          const placeholders = sqliteColumns.map(() => '?').join(', ');
          
          const stmt = db.prepare(`
            INSERT INTO ${sqliteTableName} (${sqliteColumns.join(', ')}) VALUES (${placeholders})
          `);
          
          let skippedCount = 0;
          let insertedCount = 0;
          
          data.forEach((record, index) => {
            // Handle models without brand - log more details and try to insert anyway if possible
            if (sqliteTableName === 'models') {
              // Skip models without slug (required field)
              if (!record.slug) {
                skippedCount++;
                console.log(`⚠️ Skipping model without slug: ${record.name} (ID: ${record.id})`);
                return;
              }

              // Check if brand is populated correctly
              // Strapi might return brand as an object with just id, or as null, or as a full object
              let brandSlug = null;
              let brandName = null;
              
              if (record.brand) {
                if (typeof record.brand === 'object') {
                  // Check if it's a populated object or just an ID reference
                  if (record.brand.slug) {
                    brandSlug = record.brand.slug;
                    brandName = record.brand.name;
                  } else if (record.brand.id) {
                    // It's just an ID reference, not populated
                    // Try to find the brand in the brands lookup map
                    const brandId = typeof record.brand === 'object' && record.brand.id ? record.brand.id : record.brand;
                    const brandData = brandsLookup.get(brandId);
                    
                    if (brandData) {
                      brandSlug = brandData.slug;
                      brandName = brandData.name;
                      // Update record.brand for the rest of the processing
                      record.brand = brandData;
                    }
                  }
                } else if (typeof record.brand === 'number') {
                  // Brand is just an ID number
                  const brandData = brandsLookup.get(record.brand);
                  if (brandData) {
                    brandSlug = brandData.slug;
                    brandName = brandData.name;
                    record.brand = brandData;
                  }
                }
              }
              
              // Fallback: Try to infer brand from model slug (e.g., "citroen-zx" -> "citroen")
              if (!brandSlug && record.slug) {
                const slugParts = record.slug.split('-');
                if (slugParts.length > 0) {
                  const possibleBrandSlug = slugParts[0];
                  const inferredBrand = brandsBySlug.get(possibleBrandSlug);
                  if (inferredBrand) {
                    brandSlug = inferredBrand.slug;
                    brandName = inferredBrand.name;
                    record.brand = inferredBrand;
                    console.log(`🔍 Inferred brand "${brandName}" for model "${record.name}" from slug`);
                  }
                }
              }
              
              // Skip models without brand (we need brand_slug for the foreign key)
              if (!brandSlug) {
                skippedCount++;
                if (skippedCount <= 10 || skippedCount % 100 === 0) {
                  console.log(`⚠️ Skipping model without brand: ${record.name} (ID: ${record.id})`);
                }
                return;
              }
            }
            
            // Handle filter_compatibilities brand/model relations (similar to models)
            if (sqliteTableName === 'filter_compatibilities') {
              // Handle brand relation
              if (record.brand) {
                if (typeof record.brand === 'object' && record.brand.id) {
                  // Brand is populated, extract id and name
                  if (!record.brand_id) record.brand_id = record.brand.id;
                  if (!record.brand_name) record.brand_name = record.brand.name;
                } else if (typeof record.brand === 'number') {
                  // Brand is just an ID
                  record.brand_id = record.brand;
                  const brandData = brandsLookup.get(record.brand);
                  if (brandData) {
                    record.brand_name = brandData.name;
                  }
                }
              }
              
              // Handle model relation (we need models lookup - for now, try to get from record)
              if (record.model) {
                if (typeof record.model === 'object' && record.model.id) {
                  // Model is populated, extract id and name
                  if (!record.model_id) record.model_id = record.model.id;
                  if (!record.model_name) record.model_name = record.model.name;
                } else if (typeof record.model === 'number') {
                  // Model is just an ID
                  record.model_id = record.model;
                  // Note: We don't have a models lookup here, so model_name might be null
                  // It should be populated by the API
                }
              }
            }
            
            const values = strapiColumns.map(strapiCol => {
              // Handle nested properties like 'brand.slug'
              let value;
              if (strapiCol.includes('.')) {
                const parts = strapiCol.split('.');
                value = record[parts[0]];
                for (let i = 1; i < parts.length; i++) {
                  if (value && typeof value === 'object') {
                    value = value[parts[i]];
                  } else {
                    value = null;
                    break;
                  }
                }
              } else {
                value = record[strapiCol];
              }
              
              // Convert objects to JSON strings (incluant img, brandImg, filters, metadata)
              // getImageUrl() dans environment.ts sait extraire le filename du JSON Strapi
              if (typeof value === 'object' && value !== null) {
                return JSON.stringify(value);
              }
              return value;
            });
            
            try {
              stmt.run(values);
              insertedCount++;
            } catch (error) {
              console.warn(`⚠️ Skipping record with error:`, error.message);
              if (sqliteTableName === 'models') {
                console.log('❌ Failed model record:', {
                  id: record.id,
                  name: record.name,
                  brand: record.brand ? `${record.brand.name} (${record.brand.slug})` : 'NO BRAND',
                  values: values,
                  error: error.message
                });
              }
              console.warn(`Record:`, record);
            }
          });
          
          stmt.finalize();
          if (sqliteTableName === 'models' && skippedCount > 0) {
            console.log(`✅ Inserted ${insertedCount} records into ${sqliteTableName} (skipped ${skippedCount} models without brand)`);
          } else {
            console.log(`✅ Inserted ${insertedCount} records into ${sqliteTableName}`);
          }
          
          completed++;
          if (completed === tables.length) {
            resolve();
          }
        });
    });
  });
}

async function main() {
  try {
    console.log('🚀 Starting seed generation...');
    console.log('📡 Testing Strapi connection...');
    
    // 1. Fetch data from Strapi
    const syncData = await fetchStrapiData();
    
    // 2. Create database
    const db = await createDatabase();
    
    // 3. Insert data
    await insertData(db, syncData);
    
    // 4. Close database
    db.close();
    
    console.log('🎉 Seed generation completed successfully!');
    console.log(`📁 Database saved to: ${OUTPUT_DB_PATH}`);
    
    // Verify file exists and get size
    const stats = fs.statSync(OUTPUT_DB_PATH);
    console.log(`📊 Database size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('❌ Seed generation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || 
                     import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;

if (isMainModule) {
  console.log('✅ Running main function...');
  main();
}

export { main };
