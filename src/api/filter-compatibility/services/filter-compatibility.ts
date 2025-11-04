/**
 * filter-compatibility service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::filter-compatibility.filter-compatibility', ({ strapi }) => ({
  /**
   * Find compatible filters for a specific vehicle
   */
  async findCompatibleFilters(brand: string, model: string, engine: string, filterType: string) {
    const compatibilities = await strapi.entityService.findMany('api::filter-compatibility.filter-compatibility', {
      filters: {
        vehicleModel: { $containsi: model },
        engineCode: { $containsi: engine }
      },
      populate: ['brand', 'model']
    });

    return compatibilities;
  },

  /**
   * Get all vehicle variants for a specific brand and model
   * Optimized for dropdown population
   */
  async getVehicleVariants(brandName: string, modelName: string) {
    const compatibilities = await strapi.entityService.findMany('api::filter-compatibility.filter-compatibility', {
      filters: {
        brand: {
          name: { $eq: brandName }
        },
        model: {
          name: { $eq: modelName }
        }
      },
      populate: ['brand', 'model'],
      sort: ['vehicleVariant:asc']
    });

    // Return unique variants with their details
    const variantsMap = new Map();
    compatibilities.forEach((compat: any) => {
      if (!variantsMap.has(compat.vehicleVariant)) {
        variantsMap.set(compat.vehicleVariant, {
          variant: compat.vehicleVariant,
          fullName: compat.vehicleModel,
          engineCode: compat.engineCode,
          power: compat.power,
          id: compat.id
        });
      }
    });

    return Array.from(variantsMap.values());
  },

  /**
   * Smart reference matching between compatibility and available products
   * Handles variations like "L330" matches "L330AY", "L358A" matches "L358AY"
   */
  async matchAvailableProduct(compatibilityRef: string, filterType: string) {
    // Extract reference part from format "37-L330" -> "L330"
    const refParts = compatibilityRef.split('-');
    if (refParts.length < 2) {
      return null;
    }
    
    const refPart = refParts[1]; // "L330"
    
    // Try exact match first
    let products = await strapi.entityService.findMany('api::filter-product.filter-product', {
      filters: {
        reference: refPart,
        filterType: filterType as any,
        isActive: true
      },
      populate: {
        img: true,
        brandImg: true
      }
    });

    if (products.length > 0) {
      return products[0];
    }

    // Try fuzzy matching - find products where reference starts with refPart
    products = await strapi.entityService.findMany('api::filter-product.filter-product', {
      filters: {
        reference: { $startsWith: refPart },
        filterType: filterType as any,
        isActive: true
      },
      populate: {
        img: true,
        brandImg: true
      }
    });

    if (products.length > 0) {
      return products[0];
    }

    // Try reverse fuzzy matching - find products where refPart starts with reference
    products = await strapi.entityService.findMany('api::filter-product.filter-product', {
      filters: {
        filterType: filterType as any,
        isActive: true
      },
      populate: {
        img: true,
        brandImg: true
      }
    });

    const fuzzyMatch = products.find(product => 
      product.reference && product.reference.startsWith(refPart)
    );

    return fuzzyMatch || null;
  },

  /**
   * Clean filter reference to try multiple variants for matching
   * Returns array of reference variants to try
   */
  cleanFilterReference(ref: string): string[] {
    // Returns multiple variants to try matching
    const variants = [ref.trim()];
    
    // If contains "-", also try without prefix
    if (ref.includes('-')) {
      const withoutPrefix = ref.split('-').slice(1).join('-').trim();
      variants.push(withoutPrefix);
    }
    
    return variants;
  },

  /**
   * Find products by reference with smart matching
   * Tries exact match first, then "starts with" match
   * Example: "56-CS701" → cleaned to "CS701" → matches "CS701", "CS701A", "CS701AY"
   */
  async findProductByReference(ref: string, filterType: string) {
    const variants = this.cleanFilterReference(ref);
    
    // Use the cleaned reference (without prefix) for matching
    // For "56-CS701", variants will be ["56-CS701", "CS701"], we use "CS701"
    const cleanedRef = variants.length > 1 ? variants[1] : variants[0];
    
    if (!cleanedRef) {
      return [];
    }
    
    // Step 1: Try exact match first
    const exactMatches = await strapi.entityService.findMany('api::filter-product.filter-product', {
      filters: {
        reference: { $eq: cleanedRef },
        filterType: filterType as any,
        isActive: true
      },
      populate: {
        img: true,
        brandImg: true
      },
      limit: 100
    });
    
    if (exactMatches && exactMatches.length > 0) {
      return exactMatches;
    }
    
    // Step 2: If no exact match, try "starts with" match
    // This finds products where reference starts with cleanedRef
    // e.g., "CS701" matches "CS701", "CS701A", "CS701AY"
    const startsWithMatches = await strapi.entityService.findMany('api::filter-product.filter-product', {
      filters: {
        reference: { $startsWith: cleanedRef },
        filterType: filterType as any,
        isActive: true
      },
      populate: {
        img: true,
        brandImg: true
      },
      limit: 100
    });
    
    return startsWithMatches || [];
  },

  /**
   * Complete flow: Find compatibility and match with available products
   */
  async getFilterForVehicle(vehicleData: {
    brand: string;
    model: string;
    engine: string;
    filterType: string;
  }) {
    const { brand, model, engine, filterType } = vehicleData;

    // Step 1: Find compatibility record
    const compatibilities = await this.findCompatibleFilters(brand, model, engine, filterType);
    
    if (compatibilities.length === 0) {
      return {
        status: 'no_compatibility',
        message: 'No compatibility data found for this vehicle',
        products: []
      };
    }

    const compatibility = compatibilities[0];
    const filterRefs = compatibility.filters[filterType] || [];

    if (filterRefs.length === 0) {
      return {
        status: 'no_filters',
        message: `No ${filterType} filters found for this vehicle`,
        products: []
      };
    }

    // Step 2: Match with available products
    const availableProducts = [];
    const unavailableRefs = [];

    for (const filterRef of filterRefs) {
      const product = await this.matchAvailableProduct(filterRef.ref, filterType);
      
      if (product) {
        availableProducts.push({
          product,
          compatibilityRef: filterRef.ref,
          notes: filterRef.notes || []
        });
      } else {
        unavailableRefs.push({
          ref: filterRef.ref,
          notes: filterRef.notes || []
        });
      }
    }

    return {
      status: availableProducts.length > 0 ? 'success' : 'no_products',
      message: availableProducts.length > 0 
        ? `Found ${availableProducts.length} available ${filterType} filters`
        : `No ${filterType} filters available in catalog`,
      products: availableProducts,
      unavailable: unavailableRefs
    };
  }
}));
