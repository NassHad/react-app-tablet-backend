export default {
  routes: [
    {
      method: 'GET',
      path: '/models',
      handler: 'model.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/models/:id',
      handler: 'model.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/models',
      handler: 'model.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/models/:id',
      handler: 'model.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/models/:id',
      handler: 'model.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
