/**
 * light-data custom routes
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/lights-data/ref/:ref',
      handler: 'light-data-custom.getLightDataByRef',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/lights-data/brand',
      handler: 'light-data-custom.getLightsByBrand',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/lights-data/brands',
      handler: 'light-data-custom.getAllBrands',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/lights-data/refs',
      handler: 'light-data-custom.getAllRefs',
      config: {
        auth: false,
      },
    },
  ],
};
