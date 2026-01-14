export default {
  routes: [
    {
      method: 'POST',
      path: '/import/models',
      handler: 'import.importModels',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
