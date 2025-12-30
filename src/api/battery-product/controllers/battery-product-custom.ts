/**
 * battery-product custom controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::battery-product.battery-product', ({ strapi }) => ({
  // Get battery products by brand and model slugs
  async getProductsBySlugs(ctx) {
    try {
      const { brandSlug, modelSlug } = ctx.query;
      
      if (!brandSlug || !modelSlug) {
        return ctx.badRequest('brandSlug and modelSlug are required');
      }

      const products = await strapi.entityService.findMany('api::battery-product.battery-product', {
        filters: {
          brandSlug: brandSlug,
          modelSlug: modelSlug,
          isActive: true
        }
      });

      if (!products || products.length === 0) {
        return ctx.send({
          data: [],
          success: true,
          message: `No battery products found for ${brandSlug} ${modelSlug}`
        });
      }

      const product = products[0];
      const motorisations = (product.motorisations as any[]) || [];

      // Format motorisations for frontend with battery types
      const formattedMotorisations = motorisations.map((motor, index) => ({
        id: `motor-${index}`,
        motorisation: motor.motorisation || 'Unknown',
        fuel: motor.fuel || 'Unknown',
        startDate: motor.startDate,
        endDate: motor.endDate,
        batteryTypes: {
          AGM: motor.batteryAGM || null,
          EFB: motor.batteryEFB || null,
          Conventional: motor.batteryConventional || null
        },
        batteryProductId: product.id,
        batteryProductSlug: product.slug
      }));

      return ctx.send({
        data: formattedMotorisations,
        success: true,
        message: `Found ${formattedMotorisations.length} motorisation(s) with battery types for ${brandSlug} ${modelSlug}`,
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          brandSlug: product.brandSlug,
          modelName: product.modelName,
          modelSlug: product.modelSlug
        }
      });

    } catch (error) {
      console.error('Error fetching battery products by slugs:', error);
      return ctx.internalServerError('Failed to fetch battery products');
    }
  },

  // Get all battery products by brand
  async getProductsByBrand(ctx) {
    try {
      const { brandSlug } = ctx.query;
      
      if (!brandSlug) {
        return ctx.badRequest('brandSlug is required');
      }

      const products = await strapi.entityService.findMany('api::battery-product.battery-product', {
        filters: {
          brandSlug: brandSlug,
          isActive: true
        },
        sort: ['name:asc']
      });

      const formattedProducts = products.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        brandSlug: product.brandSlug,
        modelName: product.modelName,
        modelSlug: product.modelSlug,
        motorisationCount: ((product.motorisations as any[]) || []).length
      }));

      return ctx.send({
        data: formattedProducts,
        success: true,
        message: `Found ${formattedProducts.length} battery product(s) for brand ${brandSlug}`
      });

    } catch (error) {
      console.error('Error fetching battery products by brand:', error);
      return ctx.internalServerError('Failed to fetch battery products');
    }
  },

  // Get all battery products that use a specific battery reference
  async getProductsByBatteryRef(ctx) {
    try {
      const { batteryRef } = ctx.params;
      
      if (!batteryRef) {
        return ctx.badRequest('Battery reference is required');
      }

      const products = await strapi.entityService.findMany('api::battery-product.battery-product', {
        filters: {
          isActive: true
        },
        sort: ['name:asc']
      });

      // Filter products that contain the battery reference in any of their motorisations
      const matchingProducts = products.filter((product) => {
        const motorisations = (product.motorisations as any[]) || [];
        return motorisations.some((motor) => 
          motor.batteryAGM === batteryRef || 
          motor.batteryEFB === batteryRef || 
          motor.batteryConventional === batteryRef
        );
      });

      if (matchingProducts.length === 0) {
        return ctx.send({
          data: [],
          success: false,
          message: `No battery products found using battery reference ${batteryRef}`
        });
      }

      // Format the response with detailed motorisation information
      const formattedProducts = matchingProducts.map((product) => {
        const motorisations = (product.motorisations as any[]) || [];
        const relevantMotorisations = motorisations.filter((motor) => 
          motor.batteryAGM === batteryRef || 
          motor.batteryEFB === batteryRef || 
          motor.batteryConventional === batteryRef
        );

        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          brandSlug: product.brandSlug,
          modelName: product.modelName,
          modelSlug: product.modelSlug,
          batteryBrand: product.batteryBrand,
          motorisations: relevantMotorisations.map((motor, index) => ({
            id: `motor-${product.id}-${index}`,
            motorisation: motor.motorisation || 'Unknown',
            fuel: motor.fuel || 'Unknown',
            startDate: motor.startDate,
            endDate: motor.endDate,
            batteryTypes: {
              AGM: motor.batteryAGM || null,
              EFB: motor.batteryEFB || null,
              Conventional: motor.batteryConventional || null
            },
            batteryType: motor.batteryAGM === batteryRef ? 'AGM' : 
                        motor.batteryEFB === batteryRef ? 'EFB' : 
                        motor.batteryConventional === batteryRef ? 'Conventional' : 'Unknown'
          }))
        };
      });

      return ctx.send({
        data: formattedProducts,
        success: true,
        message: `Found ${formattedProducts.length} battery product(s) using battery reference ${batteryRef}`
      });

    } catch (error) {
      console.error('Error fetching battery products by battery reference:', error);
      return ctx.internalServerError('Failed to fetch battery products by battery reference');
    }
  },

  // Get battery types summary
  async getBatteryTypesSummary(ctx) {
    try {
      const products = await strapi.entityService.findMany('api::battery-product.battery-product', {
        filters: {
          isActive: true
        }
      });

      const batteryTypesCount = {
        AGM: 0,
        EFB: 0,
        Conventional: 0,
        total: 0
      };

      products.forEach((product) => {
        const motorisations = (product.motorisations as any[]) || [];
        motorisations.forEach((motor) => {
          if (motor.batteryAGM) batteryTypesCount.AGM++;
          if (motor.batteryEFB) batteryTypesCount.EFB++;
          if (motor.batteryConventional) batteryTypesCount.Conventional++;
          batteryTypesCount.total++;
        });
      });

      return ctx.send({
        data: batteryTypesCount,
        success: true,
        message: 'Battery types summary retrieved successfully'
      });

    } catch (error) {
      console.error('Error fetching battery types summary:', error);
      return ctx.internalServerError('Failed to fetch battery types summary');
    }
  }
}));
