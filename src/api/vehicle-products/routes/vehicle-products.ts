export default {
  routes: [
    {
      method: 'GET',
      path: '/vehicle-products/all',
      handler: 'vehicle-products.getAllProductsByVehicle',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

