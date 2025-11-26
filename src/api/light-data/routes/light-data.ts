/**
 * light-data router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::light-data.light-data', {
  config: {
    find: {
      auth: false,
    },
    findOne: {
      auth: false,
    },
  },
});
