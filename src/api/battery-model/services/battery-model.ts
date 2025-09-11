export default ({ strapi }: { strapi: any }) => ({
  async findMany(params: any) {
    return await strapi.entityService.findMany('api::battery-model.battery-model', params);
  },

  async findOne(id: string | number, params: any = {}) {
    return await strapi.entityService.findOne('api::battery-model.battery-model', id, params);
  },

  async create(data: any) {
    return await strapi.entityService.create('api::battery-model.battery-model', { data });
  },

  async update(id: string | number, data: any) {
    return await strapi.entityService.update('api::battery-model.battery-model', id, { data });
  },

  async delete(id: string | number) {
    return await strapi.entityService.delete('api::battery-model.battery-model', id);
  },
});
