export default ({ strapi }: { strapi: any }) => ({
  async findMany(params: any) {
    return await strapi.entityService.findMany('api::light-model.light-model', params);
  },

  async findOne(id: string | number, params: any = {}) {
    return await strapi.entityService.findOne('api::light-model.light-model', id, params);
  },

  async create(data: any) {
    return await strapi.entityService.create('api::light-model.light-model', { data });
  },

  async update(id: string | number, data: any) {
    return await strapi.entityService.update('api::light-model.light-model', id, { data });
  },

  async delete(id: string | number) {
    return await strapi.entityService.delete('api::light-model.light-model', id);
  },
});
