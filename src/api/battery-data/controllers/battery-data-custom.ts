/**
 * battery-data custom controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::battery-data.battery-data', ({ strapi }) => ({
  // Get battery data by reference code
  async getByRef(ctx) {
    try {
      const { ref } = ctx.params;
      
      if (!ref) {
        return ctx.badRequest('Battery reference code is required');
      }

      const batteryData = await strapi.entityService.findMany('api::battery-data.battery-data', {
        filters: {
          ref: ref,
          isActive: true
        },
        populate: {
          img: true,
          brandImg: true
        }
      });

      if (!batteryData || batteryData.length === 0) {
        return ctx.send({
          data: null,
          success: true,
          message: `No battery data found for reference: ${ref}`
        });
      }

      return ctx.send({
        data: batteryData[0],
        success: true,
        message: `Battery data found for reference: ${ref}`
      });

    } catch (error) {
      console.error('Error fetching battery data by ref:', error);
      return ctx.internalServerError('Failed to fetch battery data');
    }
  },

  // Get all battery data by brand
  async getByBrand(ctx) {
    try {
      const { brand } = ctx.query;
      
      if (!brand) {
        return ctx.badRequest('Brand is required');
      }

      const batteryData = await strapi.entityService.findMany('api::battery-data.battery-data', {
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
        data: batteryData,
        success: true,
        message: `Found ${batteryData.length} battery data entries for brand: ${brand}`
      });

    } catch (error) {
      console.error('Error fetching battery data by brand:', error);
      return ctx.internalServerError('Failed to fetch battery data');
    }
  },

  // Get all unique brands
  async getBrands(ctx) {
    try {
      const allBatteryData = await strapi.entityService.findMany('api::battery-data.battery-data', {
        filters: {
          isActive: true
        }
      });

      const uniqueBrands = [...new Set(allBatteryData.map(item => item.brand))];
      
      return ctx.send({
        data: uniqueBrands,
        success: true,
        message: `Found ${uniqueBrands.length} unique brands`
      });

    } catch (error) {
      console.error('Error fetching battery brands:', error);
      return ctx.internalServerError('Failed to fetch battery brands');
    }
  },

  // Get all unique reference codes
  async getRefs(ctx) {
    try {
      const allBatteryData = await strapi.entityService.findMany('api::battery-data.battery-data', {
        filters: {
          isActive: true
        }
      });

      const refs = allBatteryData.map(item => ({
        ref: item.ref,
        brand: item.brand
      }));
      
      return ctx.send({
        data: refs,
        success: true,
        message: `Found ${refs.length} battery reference codes`
      });

    } catch (error) {
      console.error('Error fetching battery refs:', error);
      return ctx.internalServerError('Failed to fetch battery reference codes');
    }
  }
}));
