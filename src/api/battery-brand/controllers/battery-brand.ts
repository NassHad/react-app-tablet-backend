export default {
  async find(ctx: any) {
    const { query } = ctx;
    const entities = await strapi.entityService.findMany('api::battery-brand.battery-brand', {
      ...query,
    });
    return entities;
  },

  async findOne(ctx: any) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.findOne('api::battery-brand.battery-brand', id);
    return entity;
  },

  async create(ctx: any) {
    const { data } = ctx.request.body;
    const entity = await strapi.entityService.create('api::battery-brand.battery-brand', {
      data,
    });
    return entity;
  },

  async update(ctx: any) {
    const { id } = ctx.params;
    const { data } = ctx.request.body;
    const entity = await strapi.entityService.update('api::battery-brand.battery-brand', id, {
      data,
    });
    return entity;
  },

  async delete(ctx: any) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.delete('api::battery-brand.battery-brand', id);
    return entity;
  },
};
