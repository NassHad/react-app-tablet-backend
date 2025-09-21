export default {
  routes: [
    {
      method: 'GET',
      path: '/light-brands',
      handler: 'light-brand.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/light-brands/:id',
      handler: 'light-brand.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/light-brands',
      handler: 'light-brand.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/light-brands/:id',
      handler: 'light-brand.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/light-brands/:id',
      handler: 'light-brand.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
