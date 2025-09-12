export default {
  async find(ctx: any) {
    const { query } = ctx;
    const entities = await strapi.entityService.findMany('api::light-model.light-model', {
      ...query,
      populate: {
        lightBrand: true,
      },
    });
    return entities;
  },

  async findOne(ctx: any) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.findOne('api::light-model.light-model', id, {
      populate: {
        lightBrand: true,
      },
    });
    return entity;
  },

  async create(ctx: any) {
    const { data } = ctx.request.body;
    const entity = await strapi.entityService.create('api::light-model.light-model', {
      data,
      populate: {
        lightBrand: true,
      },
    });
    return entity;
  },

  async update(ctx: any) {
    const { id } = ctx.params;
    const { data } = ctx.request.body;
    const entity = await strapi.entityService.update('api::light-model.light-model', id, {
      data,
      populate: {
        lightBrand: true,
      },
    });
    return entity;
  },

  async delete(ctx: any) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.delete('api::light-model.light-model', id);
    return entity;
  },
};
