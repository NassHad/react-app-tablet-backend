/**
 * brand controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::brand.brand', ({ strapi }) => ({
  async find(ctx) {
    // Add default sorting by name
    if (!ctx.query.sort) {
      ctx.query.sort = ['name:asc'];
    }
    // Call the default find method
    const { query } = ctx;
    const entities = await strapi.entityService.findMany('api::brand.brand', {
      ...query,
    });
    return entities;
  }
}));
