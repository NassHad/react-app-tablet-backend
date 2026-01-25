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
        wipersProducts,
        wipersPositions,
        wipersData,
        compatibilities,
        specificQuestions,
        motorisations
      ] = await Promise.all([
        strapi.entityService.findMany('api::category.category', {
          populate: '*',
          sort: 'order:asc'
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
        strapi.entityService.findMany('api::wipers-product.wipers-product', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::wipers-position.wipers-position', {
          populate: '*',
          sort: 'id:asc'
        }),
        strapi.entityService.findMany('api::wiper-data.wiper-data', {
          populate: {
            img: true,
            brandImg: true
          },
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
        wipersProducts,
        wipersPositions,
        wipersData,
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
          order INTEGER,
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
          ref TEXT,
          brand TEXT,
          category TEXT,
          description TEXT,
          EAN INTEGER,
          refGTI INTEGER,
          img_url TEXT,
          brandImg_url TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TEXT,
          updated_at TEXT
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

        -- Wipers Data
        CREATE TABLE IF NOT EXISTS wipers_data (
          id INTEGER PRIMARY KEY,
          ref TEXT NOT NULL UNIQUE,
          category TEXT,
          brand TEXT,
          size TEXT,
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          img_url TEXT,
          brandImg_url TEXT,
          gtiCode INTEGER,
          genCode INTEGER,
          created_at TEXT,
          updated_at TEXT
        );

        -- Filter Products
        CREATE TABLE IF NOT EXISTS filter_products (
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
          img_url TEXT,
          brandImg_url TEXT,
          created_at TEXT,
          updated_at TEXT
        );

        -- Filter Compatibilities
        CREATE TABLE IF NOT EXISTS filter_compatibilities (
          id INTEGER PRIMARY KEY,
          brand_id INTEGER,
          model_id INTEGER,
          vehicle_model TEXT NOT NULL,
          vehicle_variant TEXT,
          engine_code TEXT NOT NULL,
          power TEXT,
          production_start TEXT,
          production_end TEXT,
          filters TEXT NOT NULL,
          metadata TEXT,
          created_at TEXT,
          updated_at TEXT,
          FOREIGN KEY (brand_id) REFERENCES brands(id),
          FOREIGN KEY (model_id) REFERENCES models(id)
        );

        -- Indexes for filter compatibilities
        CREATE INDEX IF NOT EXISTS idx_filter_compat_brand_model ON filter_compatibilities(brand_id, model_id);
        CREATE INDEX IF NOT EXISTS idx_filter_compat_variant ON filter_compatibilities(vehicle_variant);

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

    // Helper function pour extraire l'URL d'un objet Media Strapi
    const getMediaUrl = (media: any) => {
      if (!media) return null;
      if (typeof media === 'string') return media;
      // Priorité: formats.small > url > formats.thumbnail
      return media.formats?.small?.url || media.url || media.formats?.thumbnail?.url || null;
    };

    // Insert categories
    if (data.categories) {
      sql += 'INSERT OR REPLACE INTO categories (id, name, slug, description, image_url, order, created_at, updated_at) VALUES\n';
      const categoryValues = data.categories.map((cat: any) => 
        `(${cat.id}, ${escapeString(cat.name)}, ${escapeString(cat.slug)}, ${escapeString(cat.description)}, ${escapeString(cat.image_url)}, ${cat.order !== null && cat.order !== undefined ? cat.order : 'NULL'}, ${formatDate(cat.createdAt)}, ${formatDate(cat.updatedAt)})`
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
      sql += 'INSERT OR REPLACE INTO light_data (id, ref, brand, category, description, EAN, refGTI, img_url, brandImg_url, is_active, created_at, updated_at) VALUES\n';
      const lightDataValues = data.lightData.map((ld: any) => {
        const imgUrl = getMediaUrl(ld.img);
        const brandImgUrl = getMediaUrl(ld.brandImg);
        // Convertir biginteger en INTEGER (ou null si undefined)
        const ean = ld.EAN ? parseInt(String(ld.EAN)) : 'NULL';
        const refGTI = ld.refGTI ? parseInt(String(ld.refGTI)) : 'NULL';
        return `(${ld.id}, ${escapeString(ld.ref)}, ${escapeString(ld.brand)}, ${escapeString(ld.category)}, ${escapeString(ld.description)}, ${ean}, ${refGTI}, ${escapeString(imgUrl)}, ${escapeString(brandImgUrl)}, ${ld.isActive !== false ? 1 : 0}, ${formatDate(ld.createdAt)}, ${formatDate(ld.updatedAt)})`;
      }).join(',\n');
      sql += lightDataValues + ';\n\n';
    }

    // Insert wipers data
    if (data.wipersData) {
      sql += 'INSERT OR REPLACE INTO wipers_data (id, ref, category, brand, size, description, is_active, img_url, brandImg_url, gtiCode, genCode, created_at, updated_at) VALUES\n';
      const wipersDataValues = data.wipersData.map((wd: any) => {
        const imgUrl = getMediaUrl(wd.img);
        const brandImgUrl = getMediaUrl(wd.brandImg);
        // Convertir biginteger en INTEGER (ou null si undefined)
        const gtiCode = wd.gtiCode ? parseInt(String(wd.gtiCode)) : 'NULL';
        const genCode = wd.genCode ? parseInt(String(wd.genCode)) : 'NULL';
        return `(${wd.id}, ${escapeString(wd.ref)}, ${escapeString(wd.category)}, ${escapeString(wd.brand)}, ${escapeString(wd.size)}, ${escapeString(wd.description)}, ${wd.isActive !== false ? 1 : 0}, ${escapeString(imgUrl)}, ${escapeString(brandImgUrl)}, ${gtiCode}, ${genCode}, ${formatDate(wd.createdAt)}, ${formatDate(wd.updatedAt)})`;
      }).join(',\n');
      sql += wipersDataValues + ';\n\n';
    }

    // Insert filter products
    if (data.filterProducts) {
      sql += 'INSERT OR REPLACE INTO filter_products (id, brand, filter_type, reference, full_reference, full_name, ean, internal_sku, category, is_active, slug, img_url, brandImg_url, created_at, updated_at) VALUES\n';
      const filterProductValues = data.filterProducts.map((fp: any) => {
        const imgUrl = getMediaUrl(fp.img);
        const brandImgUrl = getMediaUrl(fp.brandImg);
        return `(${fp.id}, ${escapeString(fp.brand || 'PURFLUX')}, ${escapeString(fp.filterType)}, ${escapeString(fp.reference)}, ${escapeString(fp.fullReference || null)}, ${escapeString(fp.fullName)}, ${escapeString(fp.ean)}, ${escapeString(fp.internalSKU)}, ${escapeString(fp.category)}, ${fp.isActive !== false ? 1 : 0}, ${escapeString(fp.slug)}, ${escapeString(imgUrl)}, ${escapeString(brandImgUrl)}, ${formatDate(fp.createdAt)}, ${formatDate(fp.updatedAt)})`;
      }).join(',\n');
      sql += filterProductValues + ';\n\n';
    }

    // Insert filter compatibilities
    if (data.filterCompatibilities) {
      sql += 'INSERT OR REPLACE INTO filter_compatibilities (id, brand_id, model_id, vehicle_model, vehicle_variant, engine_code, power, production_start, production_end, filters, metadata, created_at, updated_at) VALUES\n';
      const filterCompatValues = data.filterCompatibilities.map((fc: any) => {
        const filtersJson = JSON.stringify(fc.filters || {});
        const metadataJson = fc.metadata ? JSON.stringify(fc.metadata) : null;
        return `(${fc.id}, ${fc.brand?.id || 'NULL'}, ${fc.model?.id || 'NULL'}, ${escapeString(fc.vehicleModel)}, ${escapeString(fc.vehicleVariant || null)}, ${escapeString(fc.engineCode)}, ${escapeString(fc.power || null)}, ${escapeString(fc.productionStart || null)}, ${escapeString(fc.productionEnd || null)}, ${escapeString(filtersJson)}, ${metadataJson ? escapeString(metadataJson) : 'NULL'}, ${formatDate(fc.createdAt)}, ${formatDate(fc.updatedAt)})`;
      }).join(',\n');
      sql += filterCompatValues + ';\n\n';
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
