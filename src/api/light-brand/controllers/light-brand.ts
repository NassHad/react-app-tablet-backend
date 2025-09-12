export default {
  async find(ctx: any) {
    const { query } = ctx;
    const entities = await strapi.entityService.findMany('api::light-brand.light-brand', {
      ...query,
    });
    return entities;
  },

  async findOne(ctx: any) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.findOne('api::light-brand.light-brand', id);
    return entity;
  },

  async create(ctx: any) {
    const { data } = ctx.request.body;
    const entity = await strapi.entityService.create('api::light-brand.light-brand', {
      data,
    });
    return entity;
  },

  async update(ctx: any) {
    const { id } = ctx.params;
    const { data } = ctx.request.body;
    const entity = await strapi.entityService.update('api::light-brand.light-brand', id, {
      data,
    });
    return entity;
  },

  async delete(ctx: any) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.delete('api::light-brand.light-brand', id);
    return entity;
  },
};
