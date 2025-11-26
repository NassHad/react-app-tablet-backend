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
   * Find products based on brand, model, variant, and filter type
   * GET /filter-compatibility/find-products?brand=CITROEN&model=C4 II&variant=1.6 HDi 110&filterType=oil
   */
  async findProducts(ctx) {
    try {
      const { brand, model, variant, filterType } = ctx.query;
      
      // Validate parameters
      if (!brand || !model || !filterType) {
        return ctx.badRequest('Missing required parameters: brand, model, filterType');
      }
      
      const service = strapi.service('api::filter-compatibility.filter-compatibility');
      
      // Find FilterCompatibility records
      const compatibilities = await strapi.entityService.findMany(
        'api::filter-compatibility.filter-compatibility',
        {
          filters: {
            brand: { name: { $eq: brand as string } },
            model: { name: { $eq: model as string } },
            ...(variant && { vehicleVariant: { $containsi: variant as string } })
          },
          populate: {
            brand: true,
            model: true
          }
        }
      );
      
      if (!compatibilities || compatibilities.length === 0) {
        return ctx.body = { 
          data: [], 
          meta: { 
            found: false,
            total: 0,
            filters: { brand, model, variant, filterType }
          } 
        };
      }
      
      // Extract filter references for the requested type
      const products = [];
      const availableReferences = [];
      const unavailableReferences = [];
      
      for (const compatibility of compatibilities) {
        const filters = (compatibility as any).filters[filterType as string] || [];
        
        for (const filter of filters) {
          const matchedProducts = await service.findProductByReference(
            filter.ref,
            filterType as string
          );
          
          if (matchedProducts.length > 0) {
            products.push(...matchedProducts.map(p => ({
              ...p,
              compatibilityMetadata: {
                vehicleVariant: (compatibility as any).vehicleVariant,
                engineCode: (compatibility as any).engineCode,
                power: (compatibility as any).power,
                notes: filter.notes
              }
            })));
            availableReferences.push(filter.ref);
          } else {
            unavailableReferences.push(filter.ref);
          }
        }
      }
      
      ctx.body = {
        data: products,
        meta: {
          total: products.length,
          found: products.length > 0,
          filters: { brand, model, variant, filterType },
          availability: {
            availableReferences,
            unavailableReferences,
            message: products.length === 0 ? 'No product available for this vehicle' : null
          }
        }
      };
    } catch (error) {
      ctx.internalServerError('Error finding products', error);
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
