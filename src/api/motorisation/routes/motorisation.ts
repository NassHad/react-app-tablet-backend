export default {
  routes: [
    {
      method: 'GET',
      path: '/motorisation/model/:modelId',
      handler: 'motorisation.getMotorisationsByModel',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/motorisation/brand/:brandId/model/:modelName',
      handler: 'motorisation.getMotorisationsByModelAndBrand',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
