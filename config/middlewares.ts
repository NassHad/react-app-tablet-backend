export default [
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https://market-assets.strapi.io'],
          'media-src': ["'self'", 'data:', 'blob:'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      headers: '*',
      origin: ['http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000', 'http://localhost:3002', 'https://tablet.gti-sodifac.com']
    }
  },
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  {
    name: 'strapi::session',
    config: {
      cookie: {
        secure: true,
        sameSite: 'lax',
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
