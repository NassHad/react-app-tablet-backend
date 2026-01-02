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
    
    // Ensure vehicle_type is populated if filters include it
    const queryWithPopulate: any = {
      ...query,
      populate: (query as any).populate || {}
    };
    
    // If filtering by vehicle_type, we need to populate it
    const filters = (query as any).filters || {};
    if (filters.vehicle_type || filters['vehicle_type']) {
      queryWithPopulate.populate = {
        ...queryWithPopulate.populate,
        vehicle_type: true
      };
    }
    
    const entities = await strapi.entityService.findMany('api::brand.brand', queryWithPopulate);
    
    return entities;
  }
}));
