export default ({ strapi }: { strapi: any }) => ({
  async getBrandsAndModelsByCategory(categoryId: string | number) {
    // Service logic can be added here if needed
    return { message: 'Battery selection service ready' };
  },
});
