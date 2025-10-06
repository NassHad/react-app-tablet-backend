export default {
  routes: [
    {
      method: 'GET',
      path: '/sync/:tabletId',
      handler: 'sync.sync',
      config: {
        auth: false, // Pas d'auth pour les tablettes
        policies: [],
        middlewares: [],
      },
    },
  ],
};