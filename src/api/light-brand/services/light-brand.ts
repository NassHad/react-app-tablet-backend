export default ({ strapi }: { strapi: any }) => ({
  async findMany(params: any) {
    return await strapi.entityService.findMany('api::light-brand.light-brand', params);
  },

  async findOne(id: string | number, params: any = {}) {
    return await strapi.entityService.findOne('api::light-brand.light-brand', id, params);
  },

  async create(data: any) {
    return await strapi.entityService.create('api::light-brand.light-brand', { data });
  },

  async update(id: string | number, data: any) {
    return await strapi.entityService.update('api::light-brand.light-brand', id, { data });
  },

  async delete(id: string | number) {
    return await strapi.entityService.delete('api::light-brand.light-brand', id);
  },
});
