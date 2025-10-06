/**
 * Custom battery-data routes
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/battery-datas/ref/:ref',
      handler: 'battery-data-custom.getByRef',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/battery-datas/brand',
      handler: 'battery-data-custom.getByBrand',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/battery-datas/brands',
      handler: 'battery-data-custom.getBrands',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/battery-datas/refs',
      handler: 'battery-data-custom.getRefs',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
