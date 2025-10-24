/**
 * filter-compatibility controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::filter-compatibility.filter-compatibility', ({ strapi }) => ({
  /**
   * Get all vehicle variants for a brand and model
   * GET /filter-compatibility/variants?brand=ABARTH&model=500 II
   */
  async getVariants(ctx) {
    try {
      const { brand, model } = ctx.query;

      if (!brand || !model) {
        return ctx.badRequest('Missing required parameters: brand, model');
      }

      const service = strapi.service('api::filter-compatibility.filter-compatibility');
      const variants = await service.getVehicleVariants(brand, model);

      ctx.body = {
        data: variants,
        meta: {
          total: variants.length,
          brand,
          model
        }
      };
    } catch (error) {
      ctx.internalServerError('Error getting variants', error);
    }
  },

  /**
   * Search for vehicle compatibility by brand, model, engine
   * GET /filter-compatibility/search?brand=ABARTH&model=500 II&engine=312A1000
   */
  async search(ctx) {
    try {
      const { brand, model, engine, filterType } = ctx.query;

      if (!brand || !model || !engine) {
        return ctx.badRequest('Missing required parameters: brand, model, engine');
      }

      const service = strapi.service('api::filter-compatibility.filter-compatibility');
      const compatibilities = await service.findCompatibleFilters(brand, model, engine, filterType);

      ctx.body = {
        data: compatibilities,
        meta: {
          total: compatibilities.length,
          filters: {
            brand,
            model,
            engine,
            filterType
          }
        }
      };
    } catch (error) {
      ctx.internalServerError('Error searching compatibility', error);
    }
  },

  /**
   * Get available products for a specific compatibility record
   * GET /filter-compatibility/:id/available-products?filterType=oil
   */
  async getAvailableProducts(ctx) {
    try {
      const { id } = ctx.params;
      const { filterType } = ctx.query;

      if (!filterType) {
        return ctx.badRequest('Missing required parameter: filterType');
      }

      const compatibility = await strapi.entityService.findOne('api::filter-compatibility.filter-compatibility', id, {
        populate: ['brand', 'model']
      });

      if (!compatibility) {
        return ctx.notFound('Compatibility record not found');
      }

      const service = strapi.service('api::filter-compatibility.filter-compatibility');
      const result = await service.getFilterForVehicle({
        brand: (compatibility as any).brand?.name || compatibility.vehicleModel.split(' ')[0],
        model: compatibility.vehicleModel,
        engine: compatibility.engineCode,
        filterType
      });

      ctx.body = {
        data: result,
        meta: {
          compatibilityId: id,
          filterType
        }
      };
    } catch (error) {
      ctx.internalServerError('Error getting available products', error);
    }
  },

  /**
   * Smart product matching for a specific reference
   * POST /filter-compatibility/match-product
   * Body: { compatibilityRef: "37-L330", filterType: "oil" }
   */
  async matchProduct(ctx) {
    try {
      const { compatibilityRef, filterType } = ctx.request.body;

      if (!compatibilityRef || !filterType) {
        return ctx.badRequest('Missing required parameters: compatibilityRef, filterType');
      }

      const service = strapi.service('api::filter-compatibility.filter-compatibility');
      const product = await service.matchAvailableProduct(compatibilityRef, filterType);

      ctx.body = {
        data: {
          found: !!product,
          product,
          compatibilityRef,
          filterType
        }
      };
    } catch (error) {
      ctx.internalServerError('Error matching product', error);
    }
  }
}));
