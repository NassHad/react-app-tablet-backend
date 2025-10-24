/**
 * Custom routes for filter-compatibility
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/filter-compatibility/search',
      handler: 'filter-compatibility.search',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/filter-compatibility/variants',
      handler: 'filter-compatibility.getVariants',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/filter-compatibility/:id/available-products',
      handler: 'filter-compatibility.getAvailableProducts',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/filter-compatibility/match-product',
      handler: 'filter-compatibility.matchProduct',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
