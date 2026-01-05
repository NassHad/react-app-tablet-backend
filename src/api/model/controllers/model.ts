/**
 * model controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::model.model', ({ strapi }) => ({
  async find(ctx) {
    // Add default sorting by name
    if (!ctx.query.sort) {
      ctx.query.sort = ['name:asc'];
    }

    // Call the default find method
    const { query } = ctx;
    const entities = await strapi.entityService.findMany('api::model.model', query);

    return entities;
  }
}));
