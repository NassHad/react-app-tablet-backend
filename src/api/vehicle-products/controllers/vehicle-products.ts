export default {
  /**
   * Get all products by vehicle, grouped by category
   * GET /api/vehicle-products/all?brandSlug=citroen&modelSlug=c4&motorisation=1.6&vehicleModel=C4 II
   */
  async getAllProductsByVehicle(ctx: any) {
    try {
      const { brandSlug, modelSlug, motorisation, vehicleModel } = ctx.query;

      // Validate required parameters
      if (!brandSlug || !modelSlug) {
        return ctx.badRequest('Brand slug and model slug are required');
      }

      const service = strapi.service('api::vehicle-products.vehicle-products');

      // Get all products grouped by category
      const productsByCategory = await service.getAllProductsByVehicle({
        brandSlug,
        modelSlug,
        motorisation,
        vehicleModel
      });

      // Calculate totals
      const total = Object.values(productsByCategory).reduce(
        (sum: number, products: any) => sum + (products?.length || 0),
        0
      );

      const byCategory = {
        Batteries: productsByCategory.Batteries?.length || 0,
        Lights: productsByCategory.Lights?.length || 0,
        Wipers: productsByCategory.Wipers?.length || 0,
        Filters: productsByCategory.Filters?.length || 0,
        Oil: productsByCategory.Oil?.length || 0
      };

      return ctx.send({
        data: productsByCategory,
        meta: {
          total,
          byCategory,
          filters: {
            brandSlug,
            modelSlug,
            motorisation: motorisation || null,
            vehicleModel: vehicleModel || null
          }
        }
      });
    } catch (error) {
      console.error('Error getting all products by vehicle:', error);
      return ctx.internalServerError('Failed to fetch products');
    }
  }
};

