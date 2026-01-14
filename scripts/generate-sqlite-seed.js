const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Configuration
const DB_PATH = path.join(__dirname, '../android/app/src/main/assets/databases/tablet-app.db');
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

async function generateSqliteSeed() {
  try {
    console.log('🚀 Génération du seed SQLite...');
    
    // Créer le dossier de destination s'il n'existe pas
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Supprimer l'ancienne DB si elle existe
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }

    // Créer une nouvelle DB SQLite
    const db = new sqlite3.Database(DB_PATH);

    // Créer les tables
    await createTables(db);
    
    // Récupérer les données depuis Strapi
    const syncData = await fetchSyncData();
    
    // Insérer les données
    await insertData(db, syncData);
    
    // Fermer la DB
    db.close();
    
    console.log('✅ Seed SQLite généré avec succès !');
    console.log(`📁 Fichier créé : ${DB_PATH}`);
    console.log(`📊 Taille : ${(fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la génération du seed :', error);
    process.exit(1);
  }
}

async function createTables(db) {
  console.log('📋 Création des tables...');
  
  const createTablesSQL = `
    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      description TEXT,
      image_url TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      description TEXT,
      price REAL,
      image_url TEXT,
      category_id INTEGER,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    -- Vehicle Types
    CREATE TABLE IF NOT EXISTS vehicle_types (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      created_at TEXT,
      updated_at TEXT
    );

    -- Brands
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      logo_url TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    -- Models
    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      brand_id INTEGER,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (brand_id) REFERENCES brands(id)
    );

    -- Vehicles
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      year INTEGER,
      brand_id INTEGER,
      model_id INTEGER,
      vehicle_type_id INTEGER,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (brand_id) REFERENCES brands(id),
      FOREIGN KEY (model_id) REFERENCES models(id),
      FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id)
    );

    -- Battery Brands
    CREATE TABLE IF NOT EXISTS battery_brands (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      logo_url TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    -- Battery Models
    CREATE TABLE IF NOT EXISTS battery_models (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      battery_brand_id INTEGER,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (battery_brand_id) REFERENCES battery_brands(id)
    );

    -- Battery Products
    CREATE TABLE IF NOT EXISTS battery_products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      description TEXT,
      price REAL,
      image_url TEXT,
      battery_brand_id INTEGER,
      battery_model_id INTEGER,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (battery_brand_id) REFERENCES battery_brands(id),
      FOREIGN KEY (battery_model_id) REFERENCES battery_models(id)
    );

    -- Battery Data
    CREATE TABLE IF NOT EXISTS battery_data (
      id INTEGER PRIMARY KEY,
      vehicle_id INTEGER,
      battery_product_id INTEGER,
      compatibility_notes TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (battery_product_id) REFERENCES battery_products(id)
    );

    -- Lights Products
    CREATE TABLE IF NOT EXISTS lights_products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      description TEXT,
      price REAL,
      image_url TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    -- Lights Positions
    CREATE TABLE IF NOT EXISTS lights_positions (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      created_at TEXT,
      updated_at TEXT
    );

    -- Lights Position Data
    CREATE TABLE IF NOT EXISTS lights_position_data (
      id INTEGER PRIMARY KEY,
      vehicle_id INTEGER,
      lights_position_id INTEGER,
      lights_product_id INTEGER,
      compatibility_notes TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (lights_position_id) REFERENCES lights_positions(id),
      FOREIGN KEY (lights_product_id) REFERENCES lights_products(id)
    );

    -- Light Data
    CREATE TABLE IF NOT EXISTS light_data (
      id INTEGER PRIMARY KEY,
      vehicle_id INTEGER,
      lights_product_id INTEGER,
      compatibility_notes TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (lights_product_id) REFERENCES lights_products(id)
    );

    -- Wipers Products
    CREATE TABLE IF NOT EXISTS wipers_products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      ref TEXT,
      description TEXT,
      brand_id INTEGER,
      model_id INTEGER,
      wipers_positions TEXT,
      construction_year_start TEXT,
      construction_year_end TEXT,
      direction TEXT,
      part_number TEXT,
      notes TEXT,
      source TEXT,
      category TEXT,
      is_active BOOLEAN,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (brand_id) REFERENCES brands(id),
      FOREIGN KEY (model_id) REFERENCES models(id)
    );

    -- Wipers Positions
    CREATE TABLE IF NOT EXISTS wipers_positions (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      description TEXT,
      category TEXT,
      ref TEXT,
      sort_order INTEGER,
      sort INTEGER,
      usage_count INTEGER,
      is_active BOOLEAN,
      created_at TEXT,
      updated_at TEXT
    );

    -- Compatibilities
    CREATE TABLE IF NOT EXISTS compatibilities (
      id INTEGER PRIMARY KEY,
      vehicle_id INTEGER,
      product_id INTEGER,
      compatibility_notes TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Specific Questions
    CREATE TABLE IF NOT EXISTS specific_questions (
      id INTEGER PRIMARY KEY,
      question TEXT NOT NULL,
      answer TEXT,
      vehicle_id INTEGER,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    );

    -- Motorisations
    CREATE TABLE IF NOT EXISTS motorisations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      created_at TEXT,
      updated_at TEXT
    );

    -- Database version tracking
    CREATE TABLE IF NOT EXISTS db_versions (
      id INTEGER PRIMARY KEY,
      version TEXT UNIQUE,
      created_at TEXT
    );

    -- Indexes pour améliorer les performances
    CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_models_brand_id ON models(brand_id);
    CREATE INDEX IF NOT EXISTS idx_vehicles_brand_id ON vehicles(brand_id);
    CREATE INDEX IF NOT EXISTS idx_vehicles_model_id ON vehicles(model_id);
    CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_type_id ON vehicles(vehicle_type_id);
    CREATE INDEX IF NOT EXISTS idx_battery_models_brand_id ON battery_models(battery_brand_id);
    CREATE INDEX IF NOT EXISTS idx_battery_products_brand_id ON battery_products(battery_brand_id);
    CREATE INDEX IF NOT EXISTS idx_battery_products_model_id ON battery_products(battery_model_id);
    CREATE INDEX IF NOT EXISTS idx_battery_data_vehicle_id ON battery_data(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_battery_data_product_id ON battery_data(battery_product_id);
    CREATE INDEX IF NOT EXISTS idx_lights_position_data_vehicle_id ON lights_position_data(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_lights_position_data_position_id ON lights_position_data(lights_position_id);
    CREATE INDEX IF NOT EXISTS idx_lights_position_data_product_id ON lights_position_data(lights_product_id);
    CREATE INDEX IF NOT EXISTS idx_light_data_vehicle_id ON light_data(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_light_data_product_id ON light_data(lights_product_id);
    CREATE INDEX IF NOT EXISTS idx_wipers_products_brand_id ON wipers_products(brand_id);
    CREATE INDEX IF NOT EXISTS idx_wipers_products_model_id ON wipers_products(model_id);
    CREATE INDEX IF NOT EXISTS idx_wipers_positions_category ON wipers_positions(category);
    CREATE INDEX IF NOT EXISTS idx_compatibilities_vehicle_id ON compatibilities(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_compatibilities_product_id ON compatibilities(product_id);
    CREATE INDEX IF NOT EXISTS idx_specific_questions_vehicle_id ON specific_questions(vehicle_id);
  `;

  return new Promise((resolve, reject) => {
    db.exec(createTablesSQL, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function fetchSyncData() {
  console.log('📡 Récupération des données depuis Strapi...');
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (API_TOKEN) {
    headers['Authorization'] = `Bearer ${API_TOKEN}`;
  }

  try {
    const response = await fetch(`${STRAPI_URL}/api/sync/tablet-001`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Données récupérées : ${Object.keys(data.data).length} tables`);
    
    return data.data;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des données :', error);
    throw error;
  }
}

async function insertData(db, data) {
  console.log('💾 Insertion des données...');
  
  const tables = [
    'categories', 'products', 'vehicleTypes', 'brands', 'models', 'vehicles',
    'batteryBrands', 'batteryModels', 'batteryProducts', 'batteryData',
    'lightsProducts', 'lightsPositions', 'lightsPositionData', 'lightData',
    'compatibilities', 'specificQuestions', 'motorisations'
  ];

  for (const table of tables) {
    if (data[table] && data[table].length > 0) {
      console.log(`  📊 ${table}: ${data[table].length} enregistrements`);
      await insertTableData(db, table, data[table]);
    }
  }

  // Insérer la version actuelle
  const currentVersion = Date.now().toString();
  await insertTableData(db, 'db_versions', [{
    id: 1,
    version: currentVersion,
    created_at: new Date().toISOString()
  }]);
}

async function insertTableData(db, tableName, records) {
  if (!records || records.length === 0) return;

  const tableMapping = {
    categories: 'categories',
    products: 'products',
    vehicleTypes: 'vehicle_types',
    brands: 'brands',
    models: 'models',
    vehicles: 'vehicles',
    batteryBrands: 'battery_brands',
    batteryModels: 'battery_models',
    batteryProducts: 'battery_products',
    batteryData: 'battery_data',
    lightsProducts: 'lights_products',
    lightsPositions: 'lights_positions',
    lightsPositionData: 'lights_position_data',
    lightData: 'light_data',
    compatibilities: 'compatibilities',
    specificQuestions: 'specific_questions',
    motorisations: 'motorisations',
    db_versions: 'db_versions'
  };

  const sqlTableName = tableMapping[tableName] || tableName;
  
  // Filtrer les colonnes pour ne garder que celles qui existent dans la table SQLite
  const validColumns = {
    categories: ['id', 'name', 'slug', 'description', 'image_url', 'created_at', 'updated_at'],
    products: ['id', 'name', 'slug', 'description', 'price', 'image_url', 'category_id', 'created_at', 'updated_at'],
    vehicle_types: ['id', 'name', 'slug', 'created_at', 'updated_at'],
    brands: ['id', 'name', 'slug', 'logo_url', 'created_at', 'updated_at'],
    models: ['id', 'name', 'slug', 'brand_id', 'created_at', 'updated_at'],
    vehicles: ['id', 'name', 'slug', 'year', 'brand_id', 'model_id', 'vehicle_type_id', 'created_at', 'updated_at'],
    battery_brands: ['id', 'name', 'slug', 'logo_url', 'created_at', 'updated_at'],
    battery_models: ['id', 'name', 'slug', 'battery_brand_id', 'created_at', 'updated_at'],
    battery_products: ['id', 'name', 'slug', 'description', 'price', 'image_url', 'battery_brand_id', 'battery_model_id', 'created_at', 'updated_at'],
    battery_data: ['id', 'vehicle_id', 'battery_product_id', 'compatibility_notes', 'created_at', 'updated_at'],
    lights_products: ['id', 'name', 'slug', 'description', 'price', 'image_url', 'created_at', 'updated_at'],
    lights_positions: ['id', 'name', 'slug', 'created_at', 'updated_at'],
    lights_position_data: ['id', 'vehicle_id', 'lights_position_id', 'lights_product_id', 'compatibility_notes', 'created_at', 'updated_at'],
    light_data: ['id', 'vehicle_id', 'lights_product_id', 'compatibility_notes', 'created_at', 'updated_at'],
    compatibilities: ['id', 'vehicle_id', 'product_id', 'compatibility_notes', 'created_at', 'updated_at'],
    specific_questions: ['id', 'question', 'answer', 'vehicle_id', 'created_at', 'updated_at'],
    motorisations: ['id', 'name', 'slug', 'created_at', 'updated_at'],
    db_versions: ['id', 'version', 'created_at']
  };

  const allowedColumns = validColumns[sqlTableName] || Object.keys(records[0]);
  const columns = Object.keys(records[0]).filter(col => allowedColumns.includes(col));
  
  if (columns.length === 0) {
    console.log(`⚠️  Aucune colonne valide pour ${tableName}, ignoré`);
    return;
  }

  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO ${sqlTableName} (${columns.join(', ')}) VALUES (${placeholders})`;

  return new Promise((resolve, reject) => {
    const stmt = db.prepare(sql);
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      records.forEach((record) => {
        const values = columns.map(col => {
          const value = record[col];
          if (value === null || value === undefined) return null;
          if (typeof value === 'object' && value.id) return value.id; // Relation
          return value;
        });
        
        stmt.run(values, (err) => {
          if (err) {
            console.error(`Erreur insertion ${tableName}:`, err);
          }
        });
      });
      
      stmt.finalize();
      
      db.run('COMMIT', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

// Exécuter le script
if (require.main === module) {
  generateSqliteSeed();
}

module.exports = { generateSqliteSeed };
