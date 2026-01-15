export default {
  async sync(ctx) {
    try {
      const { tabletId } = ctx.params;
      const { 'if-none-match': ifNoneMatch } = ctx.headers;
      
      // Récupérer la version actuelle de la DB (utiliser un timestamp fixe pour le test)
      const currentVersion = '1759133748785'; // Version fixe pour le test
      
      // Si la version est la même, retourner 304 Not Modified
      if (ifNoneMatch && ifNoneMatch === currentVersion) {
        ctx.status = 304;
        return;
      }
      
      // Récupérer toutes les données nécessaires
      const syncData = await getSyncData();
      
      // Ajouter la version et les métadonnées
      const response = {
        version: currentVersion,
        timestamp: new Date().toISOString(),
        tabletId,
        data: syncData
      };
      
      // Définir les headers de cache
      ctx.set('ETag', currentVersion);
      ctx.set('Cache-Control', 'no-cache');
      ctx.set('Content-Type', 'application/json');
      
      ctx.body = response;
    } catch (error) {
      strapi.log.error('Sync error:', error);
      ctx.throw(500, 'Sync failed');
    }
  }
};

async function getSyncData() {
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
      wipersData,
      compatibilities,
      specificQuestions,
      motorisations
    ] = await Promise.all([
      strapi.entityService.findMany('api::category.category', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::product.product', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      // Note: Vehicle content type doesn't exist in Strapi - vehicles are only in SQLite database
      Promise.resolve([]),
      strapi.entityService.findMany('api::vehicle-type.vehicle-type', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::brand.brand', {
        populate: '*',
        sort: 'name:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::model.model', {
        status: 'published',
        populate: {
          brand: {
            fields: ['id', 'name', 'slug', 'vehicle_type', 'isActive']
          }
        },
        sort: 'name:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::battery-brand.battery-brand', {
        populate: '*',
        sort: 'name:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::battery-model.battery-model', {
        populate: '*',
        sort: 'name:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::battery-product.battery-product', {
        populate: {
          img: true
        },
        sort: 'name:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::battery-data.battery-data', {
        populate: {
          img: true,
          brandImg: true
        },
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::lights-product.lights-product', {
        populate: '*',
        sort: 'name:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::lights-position.lights-position', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::light-position-data.light-position-data', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::light-data.light-data', {
        populate: {
          img: true,
          brandImg: true
        },
        sort: 'ref:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::wiper-data.wiper-data', {
        populate: {
          img: true,
          brandImg: true
        },
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::compatibility.compatibility', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::specific-question.specific-question', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::motorisation.motorisation', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => [])
    ]);

    // Enrichir les models avec leurs brands si la relation n'est pas populée
    const brandsMap = new Map();
    const brandsBySlug = new Map();
    brands.forEach(brand => {
      brandsMap.set(brand.id, brand);
      if (brand.slug) {
        brandsBySlug.set(brand.slug, brand);
      }
    });

    const enrichedModels = models.map(model => {
      // Si le model a déjà un brand complètement populé (avec slug), on le garde
      if (model.brand && typeof model.brand === 'object' && model.brand.slug) {
        return model;
      }

      // Sinon, essayer de trouver le brand par ID
      let brandId = null;
      if (model.brand) {
        // Si brand est un objet avec juste un id (non populé)
        if (typeof model.brand === 'object' && model.brand.id) {
          brandId = model.brand.id;
        }
        // Si brand est juste un nombre (ID direct)
        else if (typeof model.brand === 'number') {
          brandId = model.brand;
        }
      }

      // Si on a trouvé un brandId, essayer de le matcher avec la map
      if (brandId && brandsMap.has(brandId)) {
        const brandData = brandsMap.get(brandId);
        model.brand = {
          id: brandData.id,
          name: brandData.name,
          slug: brandData.slug,
          vehicle_type: brandData.vehicle_type,
          isActive: brandData.isActive
        };
        return model;
      }

      // Dernier recours: essayer d'inférer le brand depuis le slug du model
      // Ex: "citroen-zx" -> brand slug "citroen"
      if (!model.brand && model.slug) {
        const slugParts = model.slug.split('-');
        if (slugParts.length > 0) {
          const possibleBrandSlug = slugParts[0];
          const inferredBrand = brandsBySlug.get(possibleBrandSlug);
          if (inferredBrand) {
            model.brand = {
              id: inferredBrand.id,
              name: inferredBrand.name,
              slug: inferredBrand.slug,
              vehicle_type: inferredBrand.vehicle_type,
              isActive: inferredBrand.isActive
            };
            return model;
          }
        }
      }

      return model;
    });

    return {
      categories,
      products,
      vehicles,
      vehicleTypes,
      brands,
      models: enrichedModels,
      batteryBrands,
      batteryModels,
      batteryProducts,
      batteryData,
      lightsProducts,
      lightsPositions,
      lightsPositionData,
      lightData,
      wipersData,
      compatibilities,
      specificQuestions,
      motorisations
    };
  } catch (error) {
    strapi.log.error('Error fetching sync data:', error);
    throw error;
  }
}