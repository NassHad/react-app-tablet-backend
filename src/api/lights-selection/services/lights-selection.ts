export default {
  async getBrandsAndModelsByCategory(categoryId: string) {
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
      return {
        category: null,
        brands: [],
        models: []
      };
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

    return {
      category: { id: categoryId, name: 'Lights Category' },
      brands: Array.from(brandsMap.values()),
      models: Array.from(modelsMap.values())
    };
  },

  async getBrandsByCategory(categoryId: string) {
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

    return Array.from(brandsMap.values());
  },

  async getModelsByCategoryAndBrand(categoryId: string, brandId: string) {
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

    return Array.from(modelsMap.values());
  }
};
