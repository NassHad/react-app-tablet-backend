export default {
  routes: [
    {
      method: 'GET',
      path: '/light-models',
      handler: 'light-model.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/light-models/:id',
      handler: 'light-model.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/light-models',
      handler: 'light-model.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/light-models/:id',
      handler: 'light-model.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/light-models/:id',
      handler: 'light-model.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
