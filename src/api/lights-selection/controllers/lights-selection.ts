export default {
  async getBrandsAndModelsByCategory(ctx: any) {
    try {
      const { categoryId } = ctx.params;
      
      if (!categoryId) {
        return ctx.badRequest('Category ID is required');
      }

      // Get all lights products
      const lightsProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
        filters: {
          isActive: true
        },
        populate: {
          brand: true,
          model: {
            populate: {
              brand: true
            }
          },
          lights_position: true
        }
      });

      if (!lightsProducts || lightsProducts.length === 0) {
        return ctx.send({
          category: null,
          brands: [],
          models: []
        });
      }

      // Extract unique brands and models
      const brandsMap = new Map();
      const modelsMap = new Map();

      lightsProducts.forEach((product: any) => {
        const model = product.model;
        const brand = product.brand;

        if (model && brand) {
          // Add brand
          if (!brandsMap.has(brand.id)) {
            brandsMap.set(brand.id, {
              id: brand.id,
              name: brand.name,
              slug: brand.slug
            });
          }

          // Add model
          const modelKey = `${brand.id}-${model.id}`;
          if (!modelsMap.has(modelKey)) {
            modelsMap.set(modelKey, {
              id: model.id,
              name: model.name,
              slug: model.slug,
              brand: {
                id: brand.id,
                name: brand.name,
                slug: brand.slug
              }
            });
          }
        }
      });

      return ctx.send({
        category: { id: categoryId, name: 'Lights Category' },
        brands: Array.from(brandsMap.values()),
        models: Array.from(modelsMap.values())
      });

    } catch (error) {
      console.error('Error fetching lights brands and models by category:', error);
      return ctx.internalServerError('Failed to fetch lights data');
    }
  },

  async getBrandsByCategory(ctx: any) {
    try {
      const { categoryId } = ctx.params;
      
      if (!categoryId) {
        return ctx.badRequest('Category ID is required');
      }

      // Get all lights products
      const lightsProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
        filters: {
          isActive: true
        },
        populate: {
          brand: true,
          model: true
        }
      });

      const brandsMap = new Map();

      lightsProducts.forEach((product: any) => {
        const brand = product.brand;

        if (brand) {
          if (!brandsMap.has(brand.id)) {
            brandsMap.set(brand.id, {
              id: brand.id,
              name: brand.name,
              slug: brand.slug
            });
          }
        }
      });

      return ctx.send(Array.from(brandsMap.values()));

    } catch (error) {
      console.error('Error fetching lights brands by category:', error);
      return ctx.internalServerError('Failed to fetch lights brands');
    }
  },

  async getModelsByCategoryAndBrand(ctx: any) {
    try {
      const { categoryId, brandId } = ctx.params;
      
      if (!categoryId || !brandId) {
        return ctx.badRequest('Category ID and Brand ID are required');
      }

      // Get all lights products for this brand
      const lightsProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
        filters: {
          isActive: true,
          brand: {
            id: brandId
          }
        },
        populate: {
          brand: true,
          model: {
            populate: {
              brand: true
            }
          }
        }
      });

      const modelsMap = new Map();

      lightsProducts.forEach((product: any) => {
        const model = product.model;
        const brand = product.brand;

        if (model && brand && brand.id == brandId) {
          const modelKey = `${brand.id}-${model.id}`;
          if (!modelsMap.has(modelKey)) {
            modelsMap.set(modelKey, {
              id: model.id,
              name: model.name,
              slug: model.slug,
              brand: {
                id: brand.id,
                name: brand.name,
                slug: brand.slug
              }
            });
          }
        }
      });

      return ctx.send(Array.from(modelsMap.values()));

    } catch (error) {
      console.error('Error fetching lights models by category and brand:', error);
      return ctx.internalServerError('Failed to fetch lights models');
    }
  },

  async getPositionsByModel(ctx: any) {
    try {
      const { modelId } = ctx.params;
      
      if (!modelId) {
        return ctx.badRequest('Model ID is required');
      }

      // Get the lights product for this model
      const lightsProduct = await strapi.entityService.findMany('api::lights-product.lights-product', {
        filters: {
          isActive: true,
          model: {
            id: modelId
          }
        },
        populate: {
          brand: true,
          model: {
            populate: {
              brand: true
            }
          }
        }
      });

      if (lightsProduct.length === 0) {
        return ctx.send([]);
      }

      // Extract positions from the lightPositions JSON field
      const product = lightsProduct[0];
      const positions = (product as any).lightPositions || [];

      // Transform positions to match expected format
      const formattedPositions = positions.map((pos: any, index: number) => ({
        id: `pos-${index}`,
        name: pos.position,
        slug: pos.position.toLowerCase().replace(/\s+/g, '-'),
        isActive: true,
        ref: pos.ref,
        category: pos.category
      }));

      return ctx.send(formattedPositions);

    } catch (error) {
      console.error('Error fetching positions by model:', error);
      return ctx.internalServerError('Failed to fetch positions');
    }
  },

  async getLightDataByPosition(ctx: any) {
    try {
      const { positionId } = ctx.params;
      
      if (!positionId) {
        return ctx.badRequest('Position ID is required');
      }

      // For grouped positions, we need to find the product and extract the specific position
      // The positionId format is "pos-{index}" where index is the position in the array
      const positionIndex = parseInt(positionId.replace('pos-', ''));
      
      if (isNaN(positionIndex)) {
        return ctx.badRequest('Invalid position ID format');
      }

      // Get all lights products and find the one with the requested position
      const lightsProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
        filters: {
          isActive: true
        },
        populate: {
          brand: true,
          model: {
            populate: {
              brand: true
            }
          }
        }
      });

      // Find products that have the requested position
      const matchingProducts = lightsProducts.filter((product: any) => {
        const positions = (product as any).lightPositions || [];
        return positions.length > positionIndex;
      });

      // Transform to match the expected format
      const lightData = matchingProducts.map((product: any) => {
        const positions = (product as any).lightPositions || [];
        const position = positions[positionIndex];
        
        return {
          id: `${product.id}-${positionIndex}`,
          lightType: position.ref,
          position: position.position,
          category: position.category,
          typeConception: product.typeConception,
          partNumber: product.partNumber,
          notes: product.notes,
          source: product.source,
          constructionYearStart: product.constructionYearStart,
          constructionYearEnd: product.constructionYearEnd,
          brand: product.brand,
          model: product.model
        };
      });

      return ctx.send(lightData);

    } catch (error) {
      console.error('Error fetching light data by position:', error);
      return ctx.internalServerError('Failed to fetch light data');
    }
  },

  // New endpoint: Get all brands
  async getBrands(ctx: any) {
    try {
      const brands = await strapi.entityService.findMany('api::brand.brand', {
        filters: {
          isActive: true
        },
        sort: ['name:asc']
      });

      return ctx.send(brands);

    } catch (error) {
      console.error('Error fetching brands:', error);
      return ctx.internalServerError('Failed to fetch brands');
    }
  },

  // New endpoint: Get models by brand ID
  async getModelsByBrand(ctx: any) {
    try {
      const { brandId } = ctx.params;

      if (!brandId) {
        return ctx.badRequest('Brand ID is required');
      }

      const models = await strapi.entityService.findMany('api::model.model', {
        filters: {
          isActive: true,
          brand: {
            id: brandId
          }
        },
        populate: {
          brand: true
        },
        sort: ['name:asc']
      });

      return ctx.send(models);

    } catch (error) {
      console.error('Error fetching models by brand:', error);
      return ctx.internalServerError('Failed to fetch models');
    }
  },

  // New endpoint: Get models by brand slug
  async getModelsByBrandSlug(ctx: any) {
    try {
      const { brandSlug } = ctx.params;

      if (!brandSlug) {
        return ctx.badRequest('Brand slug is required');
      }

      // First get the brand by slug
      const brands = await strapi.entityService.findMany('api::brand.brand', {
        filters: {
          slug: brandSlug,
          isActive: true
        }
      });

      if (brands.length === 0) {
        return ctx.send({
          data: [],
          success: true,
          message: `No brand found with slug: ${brandSlug}`
        });
      }

      const brand = brands[0];

      // Get models for this brand
      const models = await strapi.entityService.findMany('api::model.model', {
        filters: {
          isActive: true,
          brand: {
            id: brand.id
          }
        },
        populate: {
          brand: true
        },
        sort: ['name:asc']
      });

      return ctx.send({
        data: models,
        success: true,
        message: `Found ${models.length} models for brand: ${brand.name}`
      });

    } catch (error) {
      console.error('Error fetching models by brand slug:', error);
      return ctx.internalServerError('Failed to fetch models');
    }
  },

  // Alternative endpoint: Get models from products (works even without brand relationships)
  async getModelsFromProducts(ctx: any) {
    try {
      const { brandSlug } = ctx.query;

      if (!brandSlug) {
        return ctx.badRequest('Brand slug is required');
      }

      // Get all lights products and extract unique models
      const lightsProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
        filters: {
          isActive: true
        },
        populate: {
          brand: true,
          model: {
            populate: {
              brand: true
            }
          }
        }
      });

      // Filter products by brand slug and extract unique models
      const modelsMap = new Map();
      
      lightsProducts.forEach((product: any) => {
        if (product.brand && product.brand.slug === brandSlug && product.model) {
          const model = product.model;
          if (!modelsMap.has(model.id)) {
            modelsMap.set(model.id, {
              id: model.id,
              name: model.name,
              slug: model.slug,
              brand: product.brand
            });
          }
        }
      });

      const models = Array.from(modelsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      return ctx.send({
        data: models,
        success: true,
        message: `Found ${models.length} models for brand: ${brandSlug}`
      });

    } catch (error) {
      console.error('Error fetching models from products:', error);
      return ctx.internalServerError('Failed to fetch models');
    }
  },

  // New endpoint: Get positions by brand and model slugs
  async getPositionsBySlugs(ctx: any) {
    try {
      const { brandSlug, modelSlug } = ctx.query;

      if (!brandSlug || !modelSlug) {
        return ctx.badRequest('Brand slug and model slug are required');
      }

      // Find the model by slug and brand slug
      const models = await strapi.entityService.findMany('api::model.model', {
        filters: {
          slug: modelSlug,
          brand: {
            slug: brandSlug
          }
        },
        populate: {
          brand: true
        }
      });

      if (models.length === 0) {
        return ctx.send([]);
      }

      const model = models[0];

      // Get the lights product for this model
      const lightsProduct = await strapi.entityService.findMany('api::lights-product.lights-product', {
        filters: {
          isActive: true,
          model: {
            id: model.id
          }
        },
        populate: {
          brand: true,
          model: {
            populate: {
              brand: true
            }
          }
        }
      });

      if (lightsProduct.length === 0) {
        return ctx.send([]);
      }

      // Extract positions from the lightPositions JSON field
      const product = lightsProduct[0];
      const positions = (product as any).lightPositions || [];

      // Transform positions to match expected format
      const formattedPositions = positions.map((pos: any, index: number) => ({
        id: `pos-${index}`,
        name: pos.position,
        slug: pos.position.toLowerCase().replace(/\s+/g, '-'),
        isActive: true,
        ref: pos.ref,
        category: pos.category
      }));

      return ctx.send(formattedPositions);

    } catch (error) {
      console.error('Error fetching positions by slugs:', error);
      return ctx.internalServerError('Failed to fetch positions');
    }
  },

  // New endpoint: Get all light positions (master list)
  async getAllPositions(ctx: any) {
    try {
      const positions = await strapi.entityService.findMany('api::lights-position.lights-position', {
        filters: { isActive: true },
        sort: ['sort:asc']
      });

      return ctx.send({
        data: positions,
        success: true,
        message: `Found ${positions.length} light positions`
      });

    } catch (error) {
      console.error('Error fetching all positions:', error);
      return ctx.internalServerError('Failed to fetch positions');
    }
  },

  // New endpoint: Get products by brand, model, and optional position slugs
  async getProductsBySlugs(ctx: any) {
    try {
      const { brandSlug, modelSlug, positionSlug } = ctx.query;

      if (!brandSlug || !modelSlug) {
        return ctx.badRequest('Brand slug and model slug are required');
      }

      // Find the model by slug and brand slug
      const models = await strapi.entityService.findMany('api::model.model', {
        filters: {
          slug: modelSlug,
          brand: {
            slug: brandSlug
          }
        },
        populate: {
          brand: true
        }
      });

      if (models.length === 0) {
        return ctx.send({
          data: [],
          success: true,
          message: 'No products found for the specified brand and model'
        });
      }

      const model = models[0];

      // Get the lights product for this model
      const lightsProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
        filters: {
          isActive: true,
          model: {
            id: model.id
          }
        },
        populate: {
          brand: true,
          model: {
            populate: {
              brand: true
            }
          }
        }
      });

      if (lightsProducts.length === 0) {
        return ctx.send({
          data: [],
          success: true,
          message: 'No products found for the specified brand and model'
        });
      }

      // Filter by position if specified
      let filteredProducts = lightsProducts;
      if (positionSlug) {
        filteredProducts = lightsProducts.filter((product: any) => {
          const positions = (product as any).lightPositions || [];
          return positions.some((pos: any) => 
            pos.position.toLowerCase().replace(/\s+/g, '-') === positionSlug
          );
        });
      }

      // Transform products to match expected format
      const formattedProducts = filteredProducts.map((product: any) => {
        const positions = (product as any).lightPositions || [];
        
        return {
          id: product.id,
          name: product.name,
          ref: product.ref,
          description: product.description,
          brand: product.brand,
          model: product.model,
          lightPositions: positions.map((pos: any, index: number) => ({
            id: `pos-${index}`,
            name: pos.position,
            slug: pos.position.toLowerCase().replace(/\s+/g, '-'),
            isActive: true,
            ref: pos.ref,
            category: pos.category
          })),
          constructionYearStart: product.constructionYearStart,
          constructionYearEnd: product.constructionYearEnd,
          typeConception: product.typeConception,
          partNumber: product.partNumber,
          notes: product.notes,
          source: product.source,
          category: product.category,
          isActive: product.isActive,
          slug: product.slug
        };
      });

      return ctx.send({
        data: formattedProducts,
        success: true,
        message: `Found ${formattedProducts.length} product(s)`
      });

    } catch (error) {
      console.error('Error fetching products by slugs:', error);
      return ctx.internalServerError('Failed to fetch products');
    }
  }
};