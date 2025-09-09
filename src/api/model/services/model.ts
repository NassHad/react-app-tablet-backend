export default ({ strapi }: { strapi: any }) => ({
  async findMany(params: any) {
    return await strapi.entityService.findMany('api::model.model', params);
  },

  async findOne(id: string | number, params: any = {}) {
    return await strapi.entityService.findOne('api::model.model', id, params);
  },

  async create(data: any) {
    return await strapi.entityService.create('api::model.model', { data });
  },

  async update(id: string | number, data: any) {
    return await strapi.entityService.update('api::model.model', id, { data });
  },

  async delete(id: string | number) {
    return await strapi.entityService.delete('api::model.model', id);
  },
});
