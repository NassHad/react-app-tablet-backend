/**
 * Custom battery-product routes
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/battery-products/by-slugs',
      handler: 'battery-product-custom.getProductsBySlugs',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/battery-products/by-brand',
      handler: 'battery-product-custom.getProductsByBrand',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/battery-products/battery-types-summary',
      handler: 'battery-product-custom.getBatteryTypesSummary',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/battery-products/battery-ref/:batteryRef',
      handler: 'battery-product-custom.getProductsByBatteryRef',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
