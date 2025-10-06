/**
 * light-data custom controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::light-data.light-data', ({ strapi }) => ({
  // Get all light data by reference code
  async getLightDataByRef(ctx: any) {
    try {
      const { ref } = ctx.params;
      
      if (!ref) {
        return ctx.badRequest('Reference code is required');
      }

      const lightData = await strapi.entityService.findMany('api::light-data.light-data', {
        filters: {
          ref: ref,
          isActive: true
        },
        populate: {
          img: true,
          brandImg: true
        }
      });

      if (lightData.length === 0) {
        return ctx.send({
          data: [],
          success: false,
          message: `No light data found for reference ${ref}`
        });
      }

      return ctx.send({
        data: lightData,
        success: true,
        message: `Found ${lightData.length} light products for reference ${ref}`
      });
    } catch (error) {
      console.error('Error fetching light data by ref:', error);
      return ctx.internalServerError('Failed to fetch light data');
    }
  },

  // Get all lights by brand
  async getLightsByBrand(ctx: any) {
    try {
      const { brand } = ctx.query;
      
      if (!brand) {
        return ctx.badRequest('Brand parameter is required');
      }

      const lights = await strapi.entityService.findMany('api::light-data.light-data', {
        filters: {
          brand: brand,
          isActive: true
        },
        populate: {
          img: true,
          brandImg: true
        }
      });

      return ctx.send({
        data: lights,
        success: true,
        message: `Found ${lights.length} lights for brand ${brand}`
      });
    } catch (error) {
      console.error('Error fetching lights by brand:', error);
      return ctx.internalServerError('Failed to fetch lights by brand');
    }
  },

  // Get all unique brands
  async getAllBrands(ctx: any) {
    try {
      const lights = await strapi.entityService.findMany('api::light-data.light-data', {
        filters: {
          isActive: true
        },
        fields: ['brand']
      });

      const uniqueBrands = [...new Set(lights.map((light: any) => light.brand))].filter(Boolean);

      return ctx.send({
        data: uniqueBrands,
        success: true,
        message: `Found ${uniqueBrands.length} unique brands`
      });
    } catch (error) {
      console.error('Error fetching brands:', error);
      return ctx.internalServerError('Failed to fetch brands');
    }
  },

  // Get all reference codes with brands
  async getAllRefs(ctx: any) {
    try {
      const lights = await strapi.entityService.findMany('api::light-data.light-data', {
        filters: {
          isActive: true
        },
        fields: ['ref', 'brand']
      });

      const refsWithBrands = lights.map((light: any) => ({
        ref: light.ref,
        brand: light.brand
      }));

      return ctx.send({
        data: refsWithBrands,
        success: true,
        message: `Found ${refsWithBrands.length} reference codes`
      });
    } catch (error) {
      console.error('Error fetching refs:', error);
      return ctx.internalServerError('Failed to fetch reference codes');
    }
  }
}));
