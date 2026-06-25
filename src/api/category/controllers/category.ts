/**
 * category controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::category.category', ({ strapi }) => ({
  async find(ctx) {
    // Add default sorting by order
    if (!ctx.query.sort) {
      ctx.query.sort = ['order:asc'];
    }

    // Call the default find method
    const { query } = ctx;
    const entities = await strapi.entityService.findMany('api::category.category', query);

    return entities;
  },
}));
