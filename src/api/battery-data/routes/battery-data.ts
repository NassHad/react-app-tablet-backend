/**
 * battery-data router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::battery-data.battery-data', {
  config: {
    find: {
      auth: false,
    },
    findOne: {
      auth: false,
    },
  },
});