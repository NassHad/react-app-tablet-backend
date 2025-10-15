export default {
  async getBrandsAndModelsByCategory(ctx: any) {
    try {
      const { categoryId } = ctx.params;
      
      if (!categoryId) {
        return ctx.badRequest('Category ID is required');
      }

      // Get all wipers products
      const wipersProducts = await strapi.entityService.findMany('api::wipers-product.wipers-product', {
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

      if (!wipersProducts || wipersProducts.length === 0) {
        return ctx.send({
          category: null,
          brands: [],
          models: []
        });
      }

      // Extract unique brands and models
      const brandsMap = new Map();
      const modelsMap = new Map();

      wipersProducts.forEach((product: any) => {
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
        category: { id: categoryId, name: 'Wipers Category' },
        brands: Array.from(brandsMap.values()),
        models: Array.from(modelsMap.values())
      });

    } catch (error) {
      console.error('Error fetching wipers brands and models by category:', error);
      return ctx.internalServerError('Failed to fetch wipers data');
    }
  },

  async getBrandsByCategory(ctx: any) {
    try {
      const { categoryId } = ctx.params;
      
      if (!categoryId) {
        return ctx.badRequest('Category ID is required');
      }

      // Get all wipers products
      const wipersProducts = await strapi.entityService.findMany('api::wipers-product.wipers-product', {
        filters: {
          isActive: true
        },
        populate: {
          brand: true,
          model: true
        }
      });

      const brandsMap = new Map();

      wipersProducts.forEach((product: any) => {
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
      console.error('Error fetching wipers brands by category:', error);
      return ctx.internalServerError('Failed to fetch wipers brands');
    }
  },

  async getModelsByCategoryAndBrand(ctx: any) {
    try {
      const { categoryId, brandId } = ctx.params;
      
      if (!categoryId || !brandId) {
        return ctx.badRequest('Category ID and Brand ID are required');
      }

      // Get all wipers products for this brand
      const wipersProducts = await strapi.entityService.findMany('api::wipers-product.wipers-product', {
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

      wipersProducts.forEach((product: any) => {
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
      console.error('Error fetching wipers models by category and brand:', error);
      return ctx.internalServerError('Failed to fetch wipers models');
    }
  },

  async getPositionsByModel(ctx: any) {
    try {
      const { modelId } = ctx.params;
      
      if (!modelId) {
        return ctx.badRequest('Model ID is required');
      }

      // Get the wipers product for this model
      const wipersProduct = await strapi.entityService.findMany('api::wipers-product.wipers-product', {
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

      if (wipersProduct.length === 0) {
        return ctx.send([]);
      }

      // Extract positions from the wipersPositions JSON field
      const product = wipersProduct[0];
      const positions = (product as any).wipersPositions || [];

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

  async getWiperDataByPosition(ctx: any) {
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

      // Get all wipers products and find the one with the requested position
      const wipersProducts = await strapi.entityService.findMany('api::wipers-product.wipers-product', {
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
      const matchingProducts = wipersProducts.filter((product: any) => {
        const positions = (product as any).wipersPositions || [];
        return positions.length > positionIndex;
      });

      // Transform to match the expected format
      const wiperData = matchingProducts.map((product: any) => {
        const positions = (product as any).wipersPositions || [];
        const position = positions[positionIndex];
        
        return {
          id: `${product.id}-${positionIndex}`,
          wiperType: position.ref,
          position: position.position,
          category: position.category,
          direction: product.direction,
          partNumber: product.partNumber,
          notes: product.notes,
          source: product.source,
          constructionYearStart: product.constructionYearStart,
          constructionYearEnd: product.constructionYearEnd,
          brand: product.brand,
          model: product.model
        };
      });

      return ctx.send(wiperData);

    } catch (error) {
      console.error('Error fetching wiper data by position:', error);
      return ctx.internalServerError('Failed to fetch wiper data');
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

      // Get all wipers products and extract unique models
      const wipersProducts = await strapi.entityService.findMany('api::wipers-product.wipers-product', {
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
      
      wipersProducts.forEach((product: any) => {
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

      // Get the wipers product for this model
      const wipersProduct = await strapi.entityService.findMany('api::wipers-product.wipers-product', {
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

      if (wipersProduct.length === 0) {
        return ctx.send([]);
      }

      // Extract positions from the wipersPositions JSON field
      const product = wipersProduct[0];
      const positions = (product as any).wipersPositions || [];

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

  // New endpoint: Get all wiper positions (master list)
  async getAllPositions(ctx: any) {
    try {
      const positions = await strapi.entityService.findMany('api::wipers-position.wipers-position', {
        filters: { isActive: true },
        sort: ['sort:asc']
      });

      return ctx.send({
        data: positions,
        success: true,
        message: `Found ${positions.length} wiper positions`
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

      // Get the wipers product for this model
      const wipersProducts = await strapi.entityService.findMany('api::wipers-product.wipers-product', {
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

      if (wipersProducts.length === 0) {
        return ctx.send({
          data: [],
          success: true,
          message: 'No products found for the specified brand and model'
        });
      }

      // Filter by position if specified
      let filteredProducts = wipersProducts;
      if (positionSlug) {
        filteredProducts = wipersProducts.filter((product: any) => {
          const positions = (product as any).wipersPositions || [];
          return positions.some((pos: any) => 
            pos.position.toLowerCase().replace(/\s+/g, '-') === positionSlug
          );
        });
      }

      // Transform products to match expected format
      const formattedProducts = filteredProducts.map((product: any) => {
        const positions = (product as any).wipersPositions || [];
        
        return {
          id: product.id,
          name: product.name,
          ref: product.ref,
          description: product.description,
          brand: product.brand,
          model: product.model,
          wipersPositions: positions.map((pos: any, index: number) => ({
            id: `pos-${index}`,
            name: pos.position,
            slug: pos.position.toLowerCase().replace(/\s+/g, '-'),
            isActive: true,
            ref: pos.ref,
            category: pos.category
          })),
          constructionYearStart: product.constructionYearStart,
          constructionYearEnd: product.constructionYearEnd,
          direction: product.direction,
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
  },

  // New endpoint: Get wipers products filtered by model and position
  async getProductsByModelAndPosition(ctx: any) {
    try {
      const { modelSlug, position } = ctx.params;

      if (!modelSlug || !position) {
        return ctx.badRequest('Model slug and position are required');
      }

      // Validate position parameter
      const validPositions = ['conducteur', 'passager', 'arriere'];
      if (!validPositions.includes(position)) {
        return ctx.badRequest(`Invalid position. Must be one of: ${validPositions.join(', ')}`);
      }

      // First, find the model by slug
      const models = await strapi.entityService.findMany('api::model.model', {
        filters: {
          slug: modelSlug,
          isActive: true
        },
        populate: {
          brand: true
        }
      });

      if (models.length === 0) {
        return ctx.send([]);
      }

      const model = models[0];

      // Get wipers products for this model
      const wipersProducts = await strapi.entityService.findMany('api::wipers-product.wipers-product', {
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

      if (wipersProducts.length === 0) {
        return ctx.send([]);
      }

      // Filter products that have the requested position
      const filteredProducts = wipersProducts.filter((product: any) => {
        const positions = (product as any).wipersPositions || [];
        return positions.some((pos: any) => {
          // Map position categories to our 3 main categories
          const positionMapping = {
            'conducteur': ['coteConducteur', 'conducteur'],
            'passager': ['cotePassager', 'passager'],
            'arriere': ['arriere']
          };
          
          const mappedCategories = positionMapping[position] || [];
          return mappedCategories.some(category => 
            pos.category === category || 
            pos.position.toLowerCase().includes(category.toLowerCase())
          );
        });
      });

      // Transform products to include only the selected position
      const formattedProducts = filteredProducts.map((product: any) => {
        const positions = (product as any).wipersPositions || [];
        
        // Find the specific position data
        const selectedPosition = positions.find((pos: any) => {
          const positionMapping = {
            'conducteur': ['coteConducteur', 'conducteur'],
            'passager': ['cotePassager', 'passager'],
            'arriere': ['arriere']
          };
          
          const mappedCategories = positionMapping[position] || [];
          return mappedCategories.some(category => 
            pos.category === category || 
            pos.position.toLowerCase().includes(category.toLowerCase())
          );
        });

        return {
          id: product.id,
          name: product.name,
          ref: product.ref,
          description: product.description,
          slug: product.slug,
          brand: product.brand,
          model: product.model,
          selectedPosition: selectedPosition ? {
            position: selectedPosition.position,
            ref: selectedPosition.ref,
            description: selectedPosition.description,
            category: position
          } : null,
          constructionYearStart: product.constructionYearStart,
          constructionYearEnd: product.constructionYearEnd,
          direction: product.direction,
          wiperBrand: product.wiperBrand,
          source: product.source,
          category: product.category,
          isActive: product.isActive
        };
      });

      return ctx.send(formattedProducts);

    } catch (error) {
      console.error('Error fetching products by model and position:', error);
      return ctx.internalServerError('Failed to fetch products');
    }
  }
};
