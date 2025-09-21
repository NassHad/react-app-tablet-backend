export default {
  async getBrandsAndModelsByCategory(ctx: any) {
    try {
      const { categoryId } = ctx.params;
      
      if (!categoryId) {
        return ctx.badRequest('Category ID is required');
      }

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
        return ctx.send({
          category: null,
          brands: [],
          models: []
        });
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
        return ctx.send({
          category: (products[0] as any).category,
          brands: [],
          models: []
        });
      }

      const vehicleIds = compatibilities.map((c: any) => c.vehicle.id);

      // Get all light position data for these vehicles
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

      // Filter by vehicle compatibility (this would need to be implemented based on your vehicle matching logic)
      // For now, we'll return all available brands and models
      const brandsMap = new Map();
      const modelsMap = new Map();

      lightData.forEach((data: any) => {
        const position = data.lightsPosition;
        if (position && position.lightsModels && position.lightsModels.length > 0) {
          position.lightsModels.forEach((model: any) => {
            if (model.lightsBrand) {
              const brand = model.lightsBrand;

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
        }
      });

      return ctx.send({
        category: (products[0] as any).category,
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

      lightData.forEach((data: any) => {
        const position = data.lightsPosition;
        if (position && position.lightsModels && position.lightsModels.length > 0) {
          position.lightsModels.forEach((model: any) => {
            if (model.lightsBrand) {
              const brand = model.lightsBrand;

              if (!brandsMap.has(brand.id)) {
                brandsMap.set(brand.id, {
                  id: brand.id,
                  name: brand.name,
                  slug: brand.slug
                });
              }
            }
          });
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

      // Get all light position data for this brand
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
        if (position && position.lightsModels && position.lightsModels.length > 0) {
          position.lightsModels.forEach((model: any) => {
            if (model.lightsBrand) {
              const brand = model.lightsBrand;

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

      // Get all positions for this model
      const positions = await strapi.entityService.findMany('api::lights-position.lights-position', {
        filters: {
          lightsModels: {
            id: modelId
          },
          isActive: true
        },
        populate: {
          lightsModels: {
            populate: {
              lightsBrand: true
            }
          }
        }
      });

      return ctx.send(positions);

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

      // Get all light data for this position
      const lightData = await strapi.entityService.findMany('api::light-position-data.light-position-data', {
        filters: {
          lightsPosition: {
            id: positionId
          },
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

      return ctx.send(lightData);

    } catch (error) {
      console.error('Error fetching light data by position:', error);
      return ctx.internalServerError('Failed to fetch light data');
    }
  }
};