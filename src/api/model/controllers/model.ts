export default {
  async find(ctx: any) {
    const { query } = ctx;
    const entities = await strapi.entityService.findMany('api::model.model', {
      ...query,
      populate: {
        brand: true,
      },
    });
    return entities;
  },

  async findOne(ctx: any) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.findOne('api::model.model', id, {
      populate: {
        brand: true,
      },
    });
    return entity;
  },

  async create(ctx: any) {
    const { data } = ctx.request.body;
    const entity = await strapi.entityService.create('api::model.model', {
      data,
      populate: {
        brand: true,
      },
    });
    return entity;
  },

  async update(ctx: any) {
    const { id } = ctx.params;
    const { data } = ctx.request.body;
    const entity = await strapi.entityService.update('api::model.model', id, {
      data,
      populate: {
        brand: true,
      },
    });
    return entity;
  },

  async delete(ctx: any) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.delete('api::model.model', id);
    return entity;
  },
};
