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
      strapi.entityService.findMany('api::vehicle.vehicle', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::vehicle-type.vehicle-type', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::brand.brand', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::model.model', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::battery-brand.battery-brand', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::battery-model.battery-model', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::battery-product.battery-product', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::battery-data.battery-data', {
        populate: '*',
        sort: 'id:asc'
      }).catch(() => []),
      strapi.entityService.findMany('api::lights-product.lights-product', {
        populate: '*',
        sort: 'id:asc'
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
        populate: '*',
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
}