/**
 * filter-compatibility controller
 */

import { factories } from '@strapi/strapi'

/**
 * Parse a date string in MM/YY format to a comparable number (YYYYMM)
 * Examples: "10/00" -> 200010, "04/09" -> 200904, "03/16" -> 201603
 */
function parseDateMMYY(dateStr: string): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const match = dateStr.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return null;

  const month = parseInt(match[1], 10);
  let year = parseInt(match[2], 10);

  // Convert 2-digit year to 4-digit (00-99 -> 2000-2099 or 1900-1999)
  // Assuming years 00-50 are 2000s, 51-99 are 1900s
  year = year <= 50 ? 2000 + year : 1900 + year;

  return year * 100 + month;
}

/**
 * Parse a date string in YYYY-MM format to a comparable number (YYYYMM)
 * Example: "2024-04" -> 202404
 */
function parseDateYYYYMM(dateStr: string): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const match = dateStr.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);

  return year * 100 + month;
}

/**
 * Check if a circulation date falls within the production range
 */
function isDateInRange(dateCirculation: string, productionStart: string, productionEnd: string): boolean {
  const circDate = parseDateYYYYMM(dateCirculation);
  if (!circDate) return true; // If no valid circulation date, don't filter

  const startDate = parseDateMMYY(productionStart);
  const endDate = parseDateMMYY(productionEnd);

  // If no production dates defined, include the compatibility
  if (!startDate && !endDate) return true;

  // Check range
  if (startDate && circDate < startDate) return false;
  if (endDate && circDate > endDate) return false;

  return true;
}

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
   * Find products based on brand, model, variant, filter type, and circulation date
   * GET /filter-compatibility/find-products?brand=CITROEN&model=C4 II&variant=1.6 HDi 110&filterType=oil&dateCirculation=2024-04
   */
  async findProducts(ctx) {
    try {
      const { brand, model, variant, filterType, dateCirculation } = ctx.query;

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
            filters: { brand, model, variant, filterType, dateCirculation }
          }
        };
      }

      // Filter compatibilities by date range if dateCirculation is provided
      const filteredCompatibilities = dateCirculation
        ? compatibilities.filter(c => isDateInRange(
            dateCirculation as string,
            (c as any).productionStart || '',
            (c as any).productionEnd || ''
          ))
        : compatibilities;

      if (filteredCompatibilities.length === 0) {
        return ctx.body = {
          data: [],
          meta: {
            found: false,
            total: 0,
            filters: { brand, model, variant, filterType, dateCirculation },
            availability: {
              availableReferences: [],
              unavailableReferences: [],
              message: 'Vehicle circulation date is outside the production range'
            }
          }
        };
      }

      // Use Map for deduplication by product ID
      const productsMap = new Map();
      const availableReferencesSet = new Set<string>();
      const unavailableReferencesSet = new Set<string>();

      for (const compatibility of filteredCompatibilities) {
        const filters = (compatibility as any).filters[filterType as string] || [];

        for (const filter of filters) {
          const matchedProducts = await service.findProductByReference(
            filter.ref,
            filterType as string
          );

          if (matchedProducts.length > 0) {
            for (const p of matchedProducts) {
              // Only add if not already in map (deduplication)
              if (!productsMap.has(p.id)) {
                productsMap.set(p.id, {
                  ...p,
                  compatibilityMetadata: {
                    vehicleVariant: (compatibility as any).vehicleVariant,
                    engineCode: (compatibility as any).engineCode,
                    power: (compatibility as any).power,
                    productionStart: (compatibility as any).productionStart,
                    productionEnd: (compatibility as any).productionEnd,
                    notes: filter.notes
                  }
                });
              }
            }
            availableReferencesSet.add(filter.ref);
          } else {
            unavailableReferencesSet.add(filter.ref);
          }
        }
      }

      const products = Array.from(productsMap.values());
      const availableReferences = Array.from(availableReferencesSet);
      const unavailableReferences = Array.from(unavailableReferencesSet);

      ctx.body = {
        data: products,
        meta: {
          total: products.length,
          found: products.length > 0,
          filters: { brand, model, variant, filterType, dateCirculation },
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
