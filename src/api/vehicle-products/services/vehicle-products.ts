export default {
  /**
   * Get battery products for a vehicle
   */
  async getBatteryProducts(brandSlug: string, modelSlug: string, motorisation?: string) {
    try {
      // Find brand and model by slugs
      const brands = await strapi.entityService.findMany('api::brand.brand', {
        filters: { slug: brandSlug },
        limit: 1
      });

      if (!brands || brands.length === 0) {
        return [];
      }

      const brand = brands[0];
      const models = await strapi.entityService.findMany('api::model.model', {
        filters: {
          slug: modelSlug,
          brand: { id: brand.id }
        },
        limit: 1
      });

      if (!models || models.length === 0) {
        return [];
      }

      // Query battery products
      const batteryProducts = await strapi.entityService.findMany('api::battery-product.battery-product', {
        filters: {
          brandSlug: brandSlug,
          modelSlug: modelSlug,
          isActive: true
        },
        populate: {
          img: true
        }
      });

      // Filter by motorisation if provided
      if (motorisation && batteryProducts.length > 0) {
        return batteryProducts.filter((product: any) => {
          const motorisations = product.motorisations || [];
          return motorisations.some((motor: any) => 
            motor.motorisation && motor.motorisation.toLowerCase().includes(motorisation.toLowerCase())
          );
        });
      }

      return batteryProducts || [];
    } catch (error) {
      console.error('Error fetching battery products:', error);
      return [];
    }
  },

  /**
   * Get lights products for a vehicle
   */
  async getLightsProducts(brandSlug: string, modelSlug: string) {
    try {
      // Find brand and model by slugs
      const brands = await strapi.entityService.findMany('api::brand.brand', {
        filters: { slug: brandSlug },
        limit: 1
      });

      console.log('🔍 Lights - Brand lookup:', {
        brandSlug,
        found: brands && brands.length > 0,
        brandId: brands && brands[0] ? brands[0].id : null,
        brandName: brands && brands[0] ? brands[0].name : null
      });

      if (!brands || brands.length === 0) {
        console.log('❌ Lights - Brand not found for slug:', brandSlug);
        return [];
      }

      const brand = brands[0];
      const models = await strapi.entityService.findMany('api::model.model', {
        filters: {
          slug: modelSlug,
          brand: { id: brand.id }
        },
        limit: 1
      });

      console.log('🔍 Lights - Model lookup:', {
        modelSlug,
        brandId: brand.id,
        found: models && models.length > 0,
        modelId: models && models[0] ? models[0].id : null,
        modelName: models && models[0] ? models[0].name : null
      });

      if (!models || models.length === 0) {
        console.log('❌ Lights - Model not found for slug:', modelSlug);
        return [];
      }

      const model = models[0];

      // Query lights products directly by brand and model
      const lightsProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
        filters: {
          brand: { id: brand.id },
          model: { id: model.id },
          isActive: true
        },
        populate: {
          brand: true,
          model: {
            populate: {
              brand: true
            }
          },
          img: true
        }
      });

      console.log('📦 Lights products:', {
        brandId: brand.id,
        modelId: model.id,
        count: lightsProducts ? lightsProducts.length : 0,
        productIds: lightsProducts ? lightsProducts.map((p: any) => p.id) : []
      });

      return lightsProducts || [];
    } catch (error) {
      console.error('❌ Error fetching lights products:', error);
      return [];
    }
  },

  /**
   * Get wipers products for a vehicle
   */
  async getWipersProducts(brandSlug: string, modelSlug: string) {
    try {
      // Find brand and model by slugs
      const brands = await strapi.entityService.findMany('api::brand.brand', {
        filters: { slug: brandSlug },
        limit: 1
      });

      console.log('🔍 Wipers - Brand lookup:', {
        brandSlug,
        found: brands && brands.length > 0,
        brandId: brands && brands[0] ? brands[0].id : null,
        brandName: brands && brands[0] ? brands[0].name : null
      });

      if (!brands || brands.length === 0) {
        console.log('❌ Wipers - Brand not found for slug:', brandSlug);
        return [];
      }

      const brand = brands[0];
      const models = await strapi.entityService.findMany('api::model.model', {
        filters: {
          slug: modelSlug,
          brand: { id: brand.id }
        },
        limit: 1
      });

      console.log('🔍 Wipers - Model lookup:', {
        modelSlug,
        brandId: brand.id,
        found: models && models.length > 0,
        modelId: models && models[0] ? models[0].id : null,
        modelName: models && models[0] ? models[0].name : null
      });

      if (!models || models.length === 0) {
        console.log('❌ Wipers - Model not found for slug:', modelSlug);
        return [];
      }

      const model = models[0];

      // Query wipers products
      const wipersProducts = await strapi.entityService.findMany('api::wipers-product.wipers-product', {
        filters: {
          brand: { id: brand.id },
          model: { id: model.id },
          isActive: true
        },
        populate: {
          brand: true,
          model: true
        }
      });

      console.log('📦 Wipers products:', {
        brandId: brand.id,
        modelId: model.id,
        count: wipersProducts ? wipersProducts.length : 0,
        productIds: wipersProducts ? wipersProducts.map((p: any) => p.id) : []
      });

      return wipersProducts || [];
    } catch (error) {
      console.error('❌ Error fetching wipers products:', error);
      return [];
    }
  },

  /**
   * Get filter products (excluding oil) for a vehicle
   */
  async getFilterProducts(brandName: string, modelName: string, motorisation?: string, vehicleModel?: string) {
    try {
      // Query filter-compatibility
      const filters: any = {
        brand: { name: { $eq: brandName } },
        model: { name: { $eq: modelName } }
      };

      if (motorisation) {
        filters.engineCode = { $containsi: motorisation };
      }

      if (vehicleModel) {
        filters.vehicleModel = { $containsi: vehicleModel };
      }

      const compatibilities = await strapi.entityService.findMany('api::filter-compatibility.filter-compatibility', {
        filters,
        populate: {
          brand: true,
          model: true
        }
      });

      if (!compatibilities || compatibilities.length === 0) {
        return [];
      }

      // Use filter-compatibility service for smart matching
      const filterService = strapi.service('api::filter-compatibility.filter-compatibility');
      const productsMap = new Map();

      // Extract filter references (excluding oil) and match with products
      for (const compat of compatibilities) {
        const filtersData = (compat.filters || {}) as any;
        for (const filterType of Object.keys(filtersData)) {
          if (filterType !== 'oil') {
            const refs = filtersData[filterType] || [];
            for (const ref of refs) {
              if (ref.ref) {
                const matchedProducts = await filterService.findProductByReference(ref.ref, filterType);
                matchedProducts.forEach((product: any) => {
                  if (product && product.isActive && !productsMap.has(product.id)) {
                    productsMap.set(product.id, product);
                  }
                });
              }
            }
          }
        }
      }

      return Array.from(productsMap.values());
    } catch (error) {
      console.error('Error fetching filter products:', error);
      return [];
    }
  },

  /**
   * Get oil products for a vehicle
   */
  async getOilProducts(brandName: string, modelName: string, motorisation?: string, vehicleModel?: string) {
    try {
      // Query filter-compatibility
      const filters: any = {
        brand: { name: { $eq: brandName } },
        model: { name: { $eq: modelName } }
      };

      if (motorisation) {
        filters.engineCode = { $containsi: motorisation };
      }

      if (vehicleModel) {
        filters.vehicleModel = { $containsi: vehicleModel };
      }

      const compatibilities = await strapi.entityService.findMany('api::filter-compatibility.filter-compatibility', {
        filters,
        populate: {
          brand: true,
          model: true
        }
      });

      if (!compatibilities || compatibilities.length === 0) {
        return [];
      }

      // Use filter-compatibility service for smart matching
      const filterService = strapi.service('api::filter-compatibility.filter-compatibility');
      const productsMap = new Map();

      // Extract oil filter references and match with products
      for (const compat of compatibilities) {
        const filtersData = (compat.filters || {}) as any;
        if (filtersData.oil) {
          const refs = filtersData.oil || [];
          for (const ref of refs) {
            if (ref.ref) {
              const matchedProducts = await filterService.findProductByReference(ref.ref, 'oil');
              matchedProducts.forEach((product: any) => {
                if (product && product.isActive && !productsMap.has(product.id)) {
                  productsMap.set(product.id, product);
                }
              });
            }
          }
        }
      }

      return Array.from(productsMap.values());
    } catch (error) {
      console.error('Error fetching oil products:', error);
      return [];
    }
  },

  /**
   * Get all products by vehicle - main orchestrator
   */
  async getAllProductsByVehicle(params: {
    brandSlug: string;
    modelSlug: string;
    motorisation?: string;
    vehicleModel?: string;
  }) {
    const { brandSlug, modelSlug, motorisation, vehicleModel } = params;

    // Get brand and model names for filter queries
    let brandName: string | undefined;
    let modelName: string | undefined;

    try {
      const brands = await strapi.entityService.findMany('api::brand.brand', {
        filters: { slug: brandSlug },
        limit: 1
      });

      if (brands && brands.length > 0) {
        brandName = brands[0].name;
      }

      if (brandName) {
        const models = await strapi.entityService.findMany('api::model.model', {
          filters: {
            slug: modelSlug,
            brand: { id: brands[0].id }
          },
          limit: 1
        });

        if (models && models.length > 0) {
          modelName = models[0].name;
        }
      }
    } catch (error) {
      console.error('Error fetching brand/model names:', error);
    }

    // Query all product types in parallel
    const [batteries, lights, wipers, filters, oil] = await Promise.all([
      this.getBatteryProducts(brandSlug, modelSlug, motorisation),
      this.getLightsProducts(brandSlug, modelSlug),
      this.getWipersProducts(brandSlug, modelSlug),
      brandName && modelName 
        ? this.getFilterProducts(brandName, modelName, motorisation, vehicleModel)
        : Promise.resolve([]),
      brandName && modelName
        ? this.getOilProducts(brandName, modelName, motorisation, vehicleModel)
        : Promise.resolve([])
    ]);

    // Group by category
    return {
      Batteries: batteries || [],
      Lights: lights || [],
      Wipers: wipers || [],
      Filters: filters || [],
      Oil: oil || []
    };
  }
};

