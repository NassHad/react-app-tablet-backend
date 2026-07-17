export default {
  routes: [
    {
      // Strapi's router only accepts GET/POST/PUT/PATCH/DELETE/ALL as a
      // route method (confirmed live: adding an explicit 'HEAD' entry here
      // throws "Invalid route config method" and crashes the server on
      // boot) -- HEAD requests are handled automatically by the underlying
      // Koa/Node HTTP layer running this same GET handler and stripping the
      // body, which is what syncService.isSyncNeeded()'s HEAD-based
      // connectivity check has been relying on all along. Nothing to add.
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