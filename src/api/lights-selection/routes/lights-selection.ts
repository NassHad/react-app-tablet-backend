export default {
  routes: [
    {
      method: 'GET',
      path: '/lights-selection/category/:categoryId',
      handler: 'lights-selection.getBrandsAndModelsByCategory',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/lights-selection/category/:categoryId/brands',
      handler: 'lights-selection.getBrandsByCategory',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/lights-selection/category/:categoryId/brand/:brandId/models',
      handler: 'lights-selection.getModelsByCategoryAndBrand',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/lights-selection/model/:modelId/positions',
      handler: 'lights-selection.getPositionsByModel',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/lights-selection/position/:positionId/data',
      handler: 'lights-selection.getLightDataByPosition',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/lights-selection/brands',
      handler: 'lights-selection.getBrands',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/lights-selection/models-by-brand/:brandId',
      handler: 'lights-selection.getModelsByBrand',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/lights-selection/models-by-brand-slug/:brandSlug',
      handler: 'lights-selection.getModelsByBrandSlug',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/lights-selection/models-from-products',
      handler: 'lights-selection.getModelsFromProducts',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/lights-selection/positions',
      handler: 'lights-selection.getPositionsBySlugs',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/lights-selection/positions/all',
      handler: 'lights-selection.getAllPositions',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/lights-selection/products',
      handler: 'lights-selection.getProductsBySlugs',
      config: { policies: [] },
    },
  ],
};
