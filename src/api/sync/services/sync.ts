export default ({ strapi }) => ({
  async getCurrentDbVersion() {
    // Utiliser un timestamp ou un hash des données pour la version
    // Pour l'instant, on utilise un timestamp simple
    return Date.now().toString();
  },

  async getSyncData() {
    try {
      // Récupérer toutes les données nécessaires pour la synchronisation
      const [
        categories,
        products,
        vehicles,
        vehicleTypes,
        brands,
        models,
        batteryBrands,
        batteryModels,
        batteryProducts,
        batteryData,
        lightsProducts,
        lightsPositions,
        lightsPositionData,
        lightData,
        compatibilities,
        specificQuestions,
        motorisations
      ] = await Promise.all([
        strapi.entityService.findMany('api::category.category', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::product.product', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::vehicle.vehicle', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::vehicle-type.vehicle-type', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::brand.brand', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::model.model', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::battery-brand.battery-brand', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::battery-model.battery-model', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::battery-product.battery-product', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::battery-data.battery-data', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::lights-product.lights-product', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::lights-position.lights-position', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::light-position-data.light-position-data', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::light-data.light-data', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::compatibility.compatibility', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::specific-question.specific-question', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::motorisation.motorisation', {
          populate: '*',
          sort: 'id:asc'
        })
      ]);

      return {
        categories,
        products,
        vehicles,
        vehicleTypes,
        brands,
        models,
        batteryBrands,
        batteryModels,
        batteryProducts,
        batteryData,
        lightsProducts,
        lightsPositions,
        lightsPositionData,
        lightData,
        compatibilities,
        specificQuestions,
        motorisations
      };
    } catch (error) {
      strapi.log.error('Error fetching sync data:', error);
      throw error;
    }
  },

  async generateSqliteSeed() {
    try {
      const syncData = await this.getSyncData();
      
      // Créer les tables SQLite
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
      `;

      // Générer les données d'insertion
      const insertDataSQL = this.generateInsertSQL(syncData);

      return {
        createTablesSQL,
        insertDataSQL,
        data: syncData
      };
    } catch (error) {
      strapi.log.error('Error generating SQLite seed:', error);
      throw error;
    }
  },

  generateInsertSQL(data: any) {
    let sql = '';

    // Helper function pour échapper les chaînes
    const escapeString = (str: any) => {
      if (str === null || str === undefined) return 'NULL';
      return `'${String(str).replace(/'/g, "''")}'`;
    };

    // Helper function pour formater les dates
    const formatDate = (date: any) => {
      if (!date) return 'NULL';
      return `'${new Date(date).toISOString()}'`;
    };

    // Insert categories
    if (data.categories) {
      sql += 'INSERT OR REPLACE INTO categories (id, name, slug, description, image_url, created_at, updated_at) VALUES\n';
      const categoryValues = data.categories.map((cat: any) => 
        `(${cat.id}, ${escapeString(cat.name)}, ${escapeString(cat.slug)}, ${escapeString(cat.description)}, ${escapeString(cat.image_url)}, ${formatDate(cat.createdAt)}, ${formatDate(cat.updatedAt)})`
      ).join(',\n');
      sql += categoryValues + ';\n\n';
    }

    // Insert products
    if (data.products) {
      sql += 'INSERT OR REPLACE INTO products (id, name, slug, description, price, image_url, category_id, created_at, updated_at) VALUES\n';
      const productValues = data.products.map((prod: any) => 
        `(${prod.id}, ${escapeString(prod.name)}, ${escapeString(prod.slug)}, ${escapeString(prod.description)}, ${prod.price || 'NULL'}, ${escapeString(prod.image_url)}, ${prod.category?.id || 'NULL'}, ${formatDate(prod.createdAt)}, ${formatDate(prod.updatedAt)})`
      ).join(',\n');
      sql += productValues + ';\n\n';
    }

    // Insert vehicle types
    if (data.vehicleTypes) {
      sql += 'INSERT OR REPLACE INTO vehicle_types (id, name, slug, created_at, updated_at) VALUES\n';
      const vehicleTypeValues = data.vehicleTypes.map((vt: any) => 
        `(${vt.id}, ${escapeString(vt.name)}, ${escapeString(vt.slug)}, ${formatDate(vt.createdAt)}, ${formatDate(vt.updatedAt)})`
      ).join(',\n');
      sql += vehicleTypeValues + ';\n\n';
    }

    // Insert brands
    if (data.brands) {
      sql += 'INSERT OR REPLACE INTO brands (id, name, slug, logo_url, created_at, updated_at) VALUES\n';
      const brandValues = data.brands.map((brand: any) => 
        `(${brand.id}, ${escapeString(brand.name)}, ${escapeString(brand.slug)}, ${escapeString(brand.logo_url)}, ${formatDate(brand.createdAt)}, ${formatDate(brand.updatedAt)})`
      ).join(',\n');
      sql += brandValues + ';\n\n';
    }

    // Insert models
    if (data.models) {
      sql += 'INSERT OR REPLACE INTO models (id, name, slug, brand_id, created_at, updated_at) VALUES\n';
      const modelValues = data.models.map((model: any) => 
        `(${model.id}, ${escapeString(model.name)}, ${escapeString(model.slug)}, ${model.brand?.id || 'NULL'}, ${formatDate(model.createdAt)}, ${formatDate(model.updatedAt)})`
      ).join(',\n');
      sql += modelValues + ';\n\n';
    }

    // Insert vehicles
    if (data.vehicles) {
      sql += 'INSERT OR REPLACE INTO vehicles (id, name, slug, year, brand_id, model_id, vehicle_type_id, created_at, updated_at) VALUES\n';
      const vehicleValues = data.vehicles.map((vehicle: any) => 
        `(${vehicle.id}, ${escapeString(vehicle.name)}, ${escapeString(vehicle.slug)}, ${vehicle.year || 'NULL'}, ${vehicle.brand?.id || 'NULL'}, ${vehicle.model?.id || 'NULL'}, ${vehicle.vehicle_type?.id || 'NULL'}, ${formatDate(vehicle.createdAt)}, ${formatDate(vehicle.updatedAt)})`
      ).join(',\n');
      sql += vehicleValues + ';\n\n';
    }

    // Insert battery brands
    if (data.batteryBrands) {
      sql += 'INSERT OR REPLACE INTO battery_brands (id, name, slug, logo_url, created_at, updated_at) VALUES\n';
      const batteryBrandValues = data.batteryBrands.map((bb: any) => 
        `(${bb.id}, ${escapeString(bb.name)}, ${escapeString(bb.slug)}, ${escapeString(bb.logo_url)}, ${formatDate(bb.createdAt)}, ${formatDate(bb.updatedAt)})`
      ).join(',\n');
      sql += batteryBrandValues + ';\n\n';
    }

    // Insert battery models
    if (data.batteryModels) {
      sql += 'INSERT OR REPLACE INTO battery_models (id, name, slug, battery_brand_id, created_at, updated_at) VALUES\n';
      const batteryModelValues = data.batteryModels.map((bm: any) => 
        `(${bm.id}, ${escapeString(bm.name)}, ${escapeString(bm.slug)}, ${bm.battery_brand?.id || 'NULL'}, ${formatDate(bm.createdAt)}, ${formatDate(bm.updatedAt)})`
      ).join(',\n');
      sql += batteryModelValues + ';\n\n';
    }

    // Insert battery products
    if (data.batteryProducts) {
      sql += 'INSERT OR REPLACE INTO battery_products (id, name, slug, description, price, image_url, battery_brand_id, battery_model_id, created_at, updated_at) VALUES\n';
      const batteryProductValues = data.batteryProducts.map((bp: any) => 
        `(${bp.id}, ${escapeString(bp.name)}, ${escapeString(bp.slug)}, ${escapeString(bp.description)}, ${bp.price || 'NULL'}, ${escapeString(bp.image_url)}, ${bp.battery_brand?.id || 'NULL'}, ${bp.battery_model?.id || 'NULL'}, ${formatDate(bp.createdAt)}, ${formatDate(bp.updatedAt)})`
      ).join(',\n');
      sql += batteryProductValues + ';\n\n';
    }

    // Insert battery data
    if (data.batteryData) {
      sql += 'INSERT OR REPLACE INTO battery_data (id, vehicle_id, battery_product_id, compatibility_notes, created_at, updated_at) VALUES\n';
      const batteryDataValues = data.batteryData.map((bd: any) => 
        `(${bd.id}, ${bd.vehicle?.id || 'NULL'}, ${bd.battery_product?.id || 'NULL'}, ${escapeString(bd.compatibility_notes)}, ${formatDate(bd.createdAt)}, ${formatDate(bd.updatedAt)})`
      ).join(',\n');
      sql += batteryDataValues + ';\n\n';
    }

    // Insert lights products
    if (data.lightsProducts) {
      sql += 'INSERT OR REPLACE INTO lights_products (id, name, slug, description, price, image_url, created_at, updated_at) VALUES\n';
      const lightsProductValues = data.lightsProducts.map((lp: any) => 
        `(${lp.id}, ${escapeString(lp.name)}, ${escapeString(lp.slug)}, ${escapeString(lp.description)}, ${lp.price || 'NULL'}, ${escapeString(lp.image_url)}, ${formatDate(lp.createdAt)}, ${formatDate(lp.updatedAt)})`
      ).join(',\n');
      sql += lightsProductValues + ';\n\n';
    }

    // Insert lights positions
    if (data.lightsPositions) {
      sql += 'INSERT OR REPLACE INTO lights_positions (id, name, slug, created_at, updated_at) VALUES\n';
      const lightsPositionValues = data.lightsPositions.map((lp: any) => 
        `(${lp.id}, ${escapeString(lp.name)}, ${escapeString(lp.slug)}, ${formatDate(lp.createdAt)}, ${formatDate(lp.updatedAt)})`
      ).join(',\n');
      sql += lightsPositionValues + ';\n\n';
    }

    // Insert lights position data
    if (data.lightsPositionData) {
      sql += 'INSERT OR REPLACE INTO lights_position_data (id, vehicle_id, lights_position_id, lights_product_id, compatibility_notes, created_at, updated_at) VALUES\n';
      const lightsPositionDataValues = data.lightsPositionData.map((lpd: any) => 
        `(${lpd.id}, ${lpd.vehicle?.id || 'NULL'}, ${lpd.lights_position?.id || 'NULL'}, ${lpd.lights_product?.id || 'NULL'}, ${escapeString(lpd.compatibility_notes)}, ${formatDate(lpd.createdAt)}, ${formatDate(lpd.updatedAt)})`
      ).join(',\n');
      sql += lightsPositionDataValues + ';\n\n';
    }

    // Insert light data
    if (data.lightData) {
      sql += 'INSERT OR REPLACE INTO light_data (id, vehicle_id, lights_product_id, compatibility_notes, created_at, updated_at) VALUES\n';
      const lightDataValues = data.lightData.map((ld: any) => 
        `(${ld.id}, ${ld.vehicle?.id || 'NULL'}, ${ld.lights_product?.id || 'NULL'}, ${escapeString(ld.compatibility_notes)}, ${formatDate(ld.createdAt)}, ${formatDate(ld.updatedAt)})`
      ).join(',\n');
      sql += lightDataValues + ';\n\n';
    }

    // Insert compatibilities
    if (data.compatibilities) {
      sql += 'INSERT OR REPLACE INTO compatibilities (id, vehicle_id, product_id, compatibility_notes, created_at, updated_at) VALUES\n';
      const compatibilityValues = data.compatibilities.map((comp: any) => 
        `(${comp.id}, ${comp.vehicle?.id || 'NULL'}, ${comp.product?.id || 'NULL'}, ${escapeString(comp.compatibility_notes)}, ${formatDate(comp.createdAt)}, ${formatDate(comp.updatedAt)})`
      ).join(',\n');
      sql += compatibilityValues + ';\n\n';
    }

    // Insert specific questions
    if (data.specificQuestions) {
      sql += 'INSERT OR REPLACE INTO specific_questions (id, question, answer, vehicle_id, created_at, updated_at) VALUES\n';
      const questionValues = data.specificQuestions.map((sq: any) => 
        `(${sq.id}, ${escapeString(sq.question)}, ${escapeString(sq.answer)}, ${sq.vehicle?.id || 'NULL'}, ${formatDate(sq.createdAt)}, ${formatDate(sq.updatedAt)})`
      ).join(',\n');
      sql += questionValues + ';\n\n';
    }

    // Insert motorisations
    if (data.motorisations) {
      sql += 'INSERT OR REPLACE INTO motorisations (id, name, slug, created_at, updated_at) VALUES\n';
      const motorisationValues = data.motorisations.map((mot: any) => 
        `(${mot.id}, ${escapeString(mot.name)}, ${escapeString(mot.slug)}, ${formatDate(mot.createdAt)}, ${formatDate(mot.updatedAt)})`
      ).join(',\n');
      sql += motorisationValues + ';\n\n';
    }

    // Insert current version
    const currentVersion = Date.now().toString();
    sql += `INSERT OR REPLACE INTO db_versions (id, version, created_at) VALUES (1, '${currentVersion}', '${new Date().toISOString()}');\n`;

    return sql;
  }
});
