export default ({ strapi }: { strapi: any }) => ({
  async findMany(params: any) {
    return await strapi.entityService.findMany('api::battery-brand.battery-brand', params);
  },

  async findOne(id: string | number, params: any = {}) {
    return await strapi.entityService.findOne('api::battery-brand.battery-brand', id, params);
  },

  async create(data: any) {
    return await strapi.entityService.create('api::battery-brand.battery-brand', { data });
  },

  async update(id: string | number, data: any) {
    return await strapi.entityService.update('api::battery-brand.battery-brand', id, { data });
  },

  async delete(id: string | number) {
    return await strapi.entityService.delete('api::battery-brand.battery-brand', id);
  },
});
