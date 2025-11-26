/**
 * wipers-selection router
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/wipers-selection/brands-and-models/:categoryId',
      handler: 'wipers-selection.getBrandsAndModelsByCategory',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wipers-selection/brands/:categoryId',
      handler: 'wipers-selection.getBrandsByCategory',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wipers-selection/models/:categoryId/:brandId',
      handler: 'wipers-selection.getModelsByCategoryAndBrand',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wipers-selection/positions/:modelId',
      handler: 'wipers-selection.getPositionsByModel',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wipers-selection/wiper-data/:positionId',
      handler: 'wipers-selection.getWiperDataByPosition',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wipers-selection/brands',
      handler: 'wipers-selection.getBrands',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wipers-selection/models/:brandId',
      handler: 'wipers-selection.getModelsByBrand',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wipers-selection/models-by-brand-slug/:brandSlug',
      handler: 'wipers-selection.getModelsByBrandSlug',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wipers-selection/models-from-products',
      handler: 'wipers-selection.getModelsFromProducts',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wipers-selection/positions-by-slugs',
      handler: 'wipers-selection.getPositionsBySlugs',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wipers-selection/all-positions',
      handler: 'wipers-selection.getAllPositions',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wipers-selection/products-by-slugs',
      handler: 'wipers-selection.getProductsBySlugs',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wipers-selection/products/:modelSlug/:position',
      handler: 'wipers-selection.getProductsByModelAndPosition',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
