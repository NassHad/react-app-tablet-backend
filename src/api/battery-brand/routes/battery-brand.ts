export default {
  routes: [
    {
      method: 'GET',
      path: '/battery-brands',
      handler: 'battery-brand.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/battery-brands/:id',
      handler: 'battery-brand.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/battery-brands',
      handler: 'battery-brand.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/battery-brands/:id',
      handler: 'battery-brand.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/battery-brands/:id',
      handler: 'battery-brand.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
