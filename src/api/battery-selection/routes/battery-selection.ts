export default {
  routes: [
    {
      method: 'GET',
      path: '/battery-selection/category/:categoryId',
      handler: 'battery-selection.getBrandsAndModelsByCategory',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/battery-selection/category/:categoryId/brands',
      handler: 'battery-selection.getBrandsByCategory',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/battery-selection/category/:categoryId/brand/:brandId/models',
      handler: 'battery-selection.getModelsByCategoryAndBrand',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/battery-selection/motorisations',
      handler: 'battery-selection.getMotorisationsByBrandAndModel',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
