export default {
  async getMotorisationsByModel(modelId: string) {
    return await strapi.entityService.findMany('api::battery-model.battery-model', {
      filters: {
        id: modelId,
        isActive: true
      },
      populate: {
        batteryBrand: true
      }
    });
  },

  async getMotorisationsByModelAndBrand(brandId: string, modelName: string) {
    return await strapi.entityService.findMany('api::battery-model.battery-model', {
      filters: {
        name: modelName,
        batteryBrand: {
          id: brandId
        },
        isActive: true
      },
      populate: {
        batteryBrand: true
      },
      sort: { motorisation: 'asc' }
    });
  }
};
