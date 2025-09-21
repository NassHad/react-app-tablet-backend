export default {
  async getBrandsAndModelsByCategory(categoryId: string) {
    // Get all products for this category
    const products = await strapi.entityService.findMany('api::product.product', {
      filters: {
        category: {
          id: categoryId
        },
        isActive: true
      },
      populate: {
        category: true
      }
    });

    if (!products || products.length === 0) {
      return {
        category: null,
        brands: [],
        models: []
      };
    }

    const productIds = products.map((p: any) => p.id);

    // Get all compatibilities for these products
    const compatibilities = await strapi.entityService.findMany('api::compatibility.compatibility', {
      filters: {
        product: {
          id: {
            $in: productIds
          }
        }
      },
      populate: {
        vehicle: true
      }
    });

    if (!compatibilities || compatibilities.length === 0) {
      return {
        category: (products[0] as any).category,
        brands: [],
        models: []
      };
    }

    // Get all light position data
    const lightData = await strapi.entityService.findMany('api::light-position-data.light-position-data', {
      filters: {
        isActive: true
      },
      populate: {
        lightsPosition: {
          populate: {
              lightsModels: {
                populate: {
                  lightsBrand: true
                }
              }
          }
        }
      }
    });

    const brandsMap = new Map();
    const modelsMap = new Map();

    lightData.forEach((data: any) => {
      const position = data.lightsPosition;
      if (position && position.lightsModel && position.lightsModel.lightsBrand) {
        const brand = position.lightsModel.lightsBrand;
        const model = position.lightsModel;

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
            constructionYearStart: model.constructionYearStart,
            constructionYearEnd: model.constructionYearEnd,
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
      category: (products[0] as any).category,
      brands: Array.from(brandsMap.values()),
      models: Array.from(modelsMap.values())
    };
  },

  async getBrandsByCategory(categoryId: string) {
    const lightData = await strapi.entityService.findMany('api::light-position-data.light-position-data', {
      filters: {
        isActive: true
      },
      populate: {
        lightsPosition: {
          populate: {
              lightsModels: {
                populate: {
                  lightsBrand: true
                }
              }
          }
        }
      }
    });

    const brandsMap = new Map();

    lightData.forEach((data: any) => {
      const position = data.lightsPosition;
      if (position && position.lightsModel && position.lightsModel.lightsBrand) {
        const brand = position.lightsModel.lightsBrand;

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
    const lightData = await strapi.entityService.findMany('api::light-position-data.light-position-data', {
      filters: {
        isActive: true
      },
      populate: {
        lightsPosition: {
          populate: {
              lightsModels: {
                populate: {
                  lightsBrand: true
                }
              }
          }
        }
      }
    });

    const modelsMap = new Map();

    lightData.forEach((data: any) => {
      const position = data.lightsPosition;
      if (position && position.lightsModel && position.lightsModel.lightsBrand) {
        const brand = position.lightsModel.lightsBrand;
        const model = position.lightsModel;

        if (brand.id == brandId) {
          const modelKey = `${brand.id}-${model.id}`;
          if (!modelsMap.has(modelKey)) {
            modelsMap.set(modelKey, {
              id: model.id,
              name: model.name,
              slug: model.slug,
              constructionYearStart: model.constructionYearStart,
              constructionYearEnd: model.constructionYearEnd,
              brand: {
                id: brand.id,
                name: brand.name,
                slug: brand.slug
              }
            });
          }
        }
      }
    });

    return Array.from(modelsMap.values());
  }
};
