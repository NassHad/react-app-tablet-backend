export default {
  async find(ctx: any) {
    const { query } = ctx;
    const entities = await strapi.entityService.findMany('api::battery-model.battery-model', {
      ...query,
      populate: {
        batteryBrand: true,
      },
    });
    return entities;
  },

  async findOne(ctx: any) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.findOne('api::battery-model.battery-model', id, {
      populate: {
        batteryBrand: true,
      },
    });
    return entity;
  },

  async create(ctx: any) {
    const { data } = ctx.request.body;
    const entity = await strapi.entityService.create('api::battery-model.battery-model', {
      data,
      populate: {
        batteryBrand: true,
      },
    });
    return entity;
  },

  async update(ctx: any) {
    const { id } = ctx.params;
    const { data } = ctx.request.body;
    const entity = await strapi.entityService.update('api::battery-model.battery-model', id, {
      data,
      populate: {
        batteryBrand: true,
      },
    });
    return entity;
  },

  async delete(ctx: any) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.delete('api::battery-model.battery-model', id);
    return entity;
  },
};
