export default {
  routes: [
    {
      method: 'GET',
      path: '/battery-models',
      handler: 'battery-model.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/battery-models/:id',
      handler: 'battery-model.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/battery-models',
      handler: 'battery-model.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/battery-models/:id',
      handler: 'battery-model.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/battery-models/:id',
      handler: 'battery-model.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
