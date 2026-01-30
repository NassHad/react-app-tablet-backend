/**
 * Deduplicate wiper positions based on ref+position+brand (or position+brand+size+description if no ref).
 * Keeps the first occurrence and removes subsequent duplicates.
 */
function deduplicatePositions(positions: any[]): any[] {
  const seen = new Set<string>();
  return positions.filter((pos: any) => {
    const ref = (pos.ref || '').toString().trim().toLowerCase();
    const position = (pos.position || pos.name || '').toString().trim().toLowerCase();
    const brand = (pos.brand || '').toString().trim().toLowerCase();

    let key: string;
    if (ref) {
      key = `${ref}|${position}|${brand}`;
    } else {
      const size = (pos.size || '').toString().trim().toLowerCase();
      const description = (pos.description || '').toString().trim().toLowerCase();
      key = `${position}|${brand}|${size}|${description}`;
    }

    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export default {
  async getBrandsAndModelsByCategory(categoryId: string) {
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
      return {
        category: null,
        brands: [],
        models: []
      };
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

    return {
      category: { id: categoryId, name: 'Wipers Category' },
      brands: Array.from(brandsMap.values()),
      models: Array.from(modelsMap.values())
    };
  },

  async getBrandsByCategory(categoryId: string) {
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

    return Array.from(brandsMap.values());
  },

  async getModelsByCategoryAndBrand(categoryId: string, brandId: string) {
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

    return Array.from(modelsMap.values());
  },

  async getPositionsByModel(modelId: string) {
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
      return [];
    }

    // Extract positions from the wipersPositions JSON field
    const product = wipersProduct[0];
    const positions = deduplicatePositions((product as any).wipersPositions || []);

    // Transform positions to match expected format
    const formattedPositions = positions.map((pos: any, index: number) => ({
      id: `pos-${index}`,
      name: pos.position,
      slug: pos.position.toLowerCase().replace(/\s+/g, '-'),
      isActive: true,
      ref: pos.ref,
      category: pos.category
    }));

    return formattedPositions;
  },

  async getWiperDataByPosition(positionId: string) {
    // For grouped positions, we need to find the product and extract the specific position
    // The positionId format is "pos-{index}" where index is the position in the array
    const positionIndex = parseInt(positionId.replace('pos-', ''));
    
    if (isNaN(positionIndex)) {
      throw new Error('Invalid position ID format');
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
      const positions = deduplicatePositions((product as any).wipersPositions || []);
      return positions.length > positionIndex;
    });

    // Transform to match the expected format
    const wiperData = matchingProducts.map((product: any) => {
      const positions = deduplicatePositions((product as any).wipersPositions || []);
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

    return wiperData;
  },

  async getProductsByModelAndPosition(modelSlug: string, position: string) {
    // Validate position parameter
    const validPositions = ['conducteur', 'passager', 'arriere'];
    if (!validPositions.includes(position)) {
      throw new Error(`Invalid position. Must be one of: ${validPositions.join(', ')}`);
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
      return [];
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
      return [];
    }

    // Filter products that have the requested position
    const filteredProducts = wipersProducts.filter((product: any) => {
      const positions = deduplicatePositions((product as any).wipersPositions || []);
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

    // Transform products to include all matching positions
    const formattedProducts = filteredProducts.map((product: any) => {
      const positions = deduplicatePositions((product as any).wipersPositions || []);
      
      // Find all matching position data
      const selectedPositions = positions.filter((pos: any) => {
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
        selectedPositions: selectedPositions.map((pos: any) => ({
          position: pos.position,
          ref: pos.ref,
          description: pos.description,
          category: position,
          brand: pos.brand || product.wiperBrand || 'Valeo'
        })),
        constructionYearStart: product.constructionYearStart,
        constructionYearEnd: product.constructionYearEnd,
        direction: product.direction,
        wiperBrand: product.wiperBrand,
        source: product.source,
        category: product.category,
        isActive: product.isActive
      };
    });

    return formattedProducts;
  }
};
