export default {
  routes: [
    {
      method: 'GET',
      path: '/sync/:tabletId',
      handler: 'sync.index',
      config: {
        auth: false, // ou true si tu veux token obligatoire
      },
    },
  ],
};
