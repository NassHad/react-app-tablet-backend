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
  ],
};
