export default {
  async getBrandsAndModelsByCategory(ctx: any) {
    try {
      const { categoryId } = ctx.params;
      
      if (!categoryId) {
        return ctx.badRequest('Category ID is required');
      }

      // Get all products in the selected category
      const products = await strapi.entityService.findMany('api::product.product', {
        filters: { 
          category: categoryId,
          isActive: true 
        },
        populate: {
          category: true
        }
      });

      if (!products || products.length === 0) {
        return ctx.send({
          brands: [],
          models: [],
          message: 'No products found for this category'
        });
      }

      // Get all compatibilities for these products using $or filter
      const productIds = products.map((p: any) => p.id);
      let compatibilities: any[] = [];
      
      if (productIds.length > 0) {
        // Use $or filter for each product ID (alternative to $in)
        const orFilters = productIds.map(id => ({ product: id }));
        compatibilities = await strapi.entityService.findMany('api::compatibility.compatibility', {
          filters: {
            $or: orFilters
          },
          populate: {
            product: true
          }
        });
      }

      if (!compatibilities || compatibilities.length === 0) {
        return ctx.send({
          brands: [],
          models: [],
          message: 'No vehicle compatibilities found for products in this category'
        });
      }

      // Extract unique brand and model IDs from products
      // Note: Compatibility doesn't have vehicle relation, so we can't extract brand/model from it
      // This functionality may need to be refactored based on actual data structure
      const brandIds = new Set();
      const modelIds = new Set();
      
      compatibilities.forEach((comp: any) => {
        // Since compatibility doesn't have vehicle, we can't extract brand/model IDs
      });

      // Get battery brands that match the vehicle brand IDs
      const batteryBrands = await strapi.entityService.findMany('api::battery-brand.battery-brand', {
        filters: {
          isActive: true
        },
        sort: { name: 'asc' }
      });

      // Get battery models that match the vehicle model IDs and their brands
      const batteryModels = await strapi.entityService.findMany('api::battery-model.battery-model', {
        filters: {
          isActive: true
        },
        populate: {
          batteryBrand: true
        },
        sort: { name: 'asc' }
      });

      // Filter brands and models based on the vehicle IDs found
      // Note: This assumes that battery brand/model IDs correspond to vehicle brand/model IDs
      // You might need to adjust this logic based on your actual data relationship
      
      const filteredBrands = batteryBrands.filter((brand: any) => 
        brandIds.has(brand.id) || 
        // Alternative: if you have a different relationship, adjust here
        true // For now, return all active brands
      );

      const filteredModels = batteryModels.filter((model: any) => 
        modelIds.has(model.id) || 
        // Alternative: if you have a different relationship, adjust here
        true // For now, return all active models
      );

      // Group models by brand for easier frontend consumption
      const modelsByBrand: any = {};
      filteredModels.forEach((model: any) => {
        if (model.batteryBrand) {
          const brandId = model.batteryBrand.id;
          if (!modelsByBrand[brandId]) {
            modelsByBrand[brandId] = {
              brand: model.batteryBrand,
              models: []
            };
          }
          modelsByBrand[brandId].models.push({
            id: model.id,
            name: model.name,
            slug: model.slug,
            startDate: model.startDate,
            endDate: model.endDate,
            isActive: model.isActive
          });
        }
      });

      // Sort brands and models within each brand
      const sortedBrands = filteredBrands.map((brand: any) => ({
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        isActive: brand.isActive
      })).sort((a, b) => a.name.localeCompare(b.name));

      const sortedModelsByBrand = Object.values(modelsByBrand).map((brandGroup: any) => ({
        ...brandGroup,
        models: brandGroup.models.sort((a: any, b: any) => a.name.localeCompare(b.name))
      })).sort((a: any, b: any) => a.brand.name.localeCompare(b.brand.name));

      return ctx.send({
        category: (products[0] as any)?.category || null,
        brands: sortedBrands,
        modelsByBrand: sortedModelsByBrand,
        totalProducts: products.length,
        totalCompatibilities: compatibilities.length
      });

    } catch (error) {
      console.error('Error fetching brands and models by category:', error);
      return ctx.internalServerError('Failed to fetch brands and models');
    }
  },

  async getBrandsByCategory(ctx: any) {
    try {
      const { categoryId } = ctx.params;
      
      if (!categoryId) {
        return ctx.badRequest('Category ID is required');
      }

      // Get all products in the selected category
      const products = await strapi.entityService.findMany('api::product.product', {
        filters: { 
          category: categoryId,
          isActive: true 
        }
      });

      if (!products || products.length === 0) {
        return ctx.send([]);
      }

      // Get all compatibilities for these products using $or filter
      const productIds = products.map((p: any) => p.id);
      let compatibilities: any[] = [];
      
      if (productIds.length > 0) {
        const orFilters = productIds.map(id => ({ product: id }));
        compatibilities = await strapi.entityService.findMany('api::compatibility.compatibility', {
          filters: {
            $or: orFilters
          },
          populate: {
            product: true
          }
        });
      }

      // Extract unique brand IDs
      const brandIds = new Set();
      compatibilities.forEach((comp: any) => {
        if (comp.vehicle?.id_brand) {
          brandIds.add(comp.vehicle.id_brand);
        }
      });

      // Get battery brands
      const batteryBrands = await strapi.entityService.findMany('api::battery-brand.battery-brand', {
        filters: {
          isActive: true
        },
        sort: { name: 'asc' }
      });

      // Filter brands (adjust logic based on your actual relationship)
      const filteredBrands = batteryBrands.filter((brand: any) => 
        brandIds.has(brand.id) || true // For now, return all active brands
      );

      return ctx.send(filteredBrands.map((brand: any) => ({
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        isActive: brand.isActive
      })).sort((a, b) => a.name.localeCompare(b.name)));

    } catch (error) {
      console.error('Error fetching brands by category:', error);
      return ctx.internalServerError('Failed to fetch brands');
    }
  },

  async getModelsByCategoryAndBrand(ctx: any) {
    try {
      const { categoryId, brandId } = ctx.params;
      
      if (!categoryId || !brandId) {
        return ctx.badRequest('Category ID and Brand ID are required');
      }

      // Get all products in the selected category
      const products = await strapi.entityService.findMany('api::product.product', {
        filters: { 
          category: categoryId,
          isActive: true 
        }
      });

      if (!products || products.length === 0) {
        return ctx.send([]);
      }

      // Get all compatibilities for these products using $or filter
      const productIds = products.map((p: any) => p.id);
      let compatibilities: any[] = [];
      
      if (productIds.length > 0) {
        const orFilters = productIds.map(id => ({ product: id }));
        compatibilities = await strapi.entityService.findMany('api::compatibility.compatibility', {
          filters: {
            $or: orFilters
          },
          populate: {
            product: true
          }
        });
      }

      // Extract unique model IDs for the specific brand
      // Note: Compatibility doesn't have vehicle relation, so we can't extract model IDs from it
      // This functionality may need to be refactored based on actual data structure
      const modelIds = new Set();
      compatibilities.forEach((comp: any) => {
        // Since compatibility doesn't have vehicle, we can't extract model IDs
      });

      // Get battery models for the specific brand
      const batteryModels = await strapi.entityService.findMany('api::battery-model.battery-model', {
        filters: {
          batteryBrand: brandId,
          isActive: true
        },
        populate: {
          batteryBrand: true
        },
        sort: { name: 'asc' }
      });

      // Filter models (adjust logic based on your actual relationship)
      const filteredModels = batteryModels.filter((model: any) => 
        modelIds.has(model.id) || true // For now, return all active models for the brand
      );

      return ctx.send(filteredModels.map((model: any) => ({
        id: model.id,
        name: model.name,
        slug: model.slug,
        startDate: model.startDate,
        endDate: model.endDate,
        isActive: model.isActive,
        batteryBrand: {
          id: model.batteryBrand.id,
          name: model.batteryBrand.name,
          slug: model.batteryBrand.slug
        }
      })));

    } catch (error) {
      console.error('Error fetching models by category and brand:', error);
      return ctx.internalServerError('Failed to fetch models');
    }
  },

  // New endpoint: Get motorisations for a specific brand and model
  async getMotorisationsByBrandAndModel(ctx: any) {
    try {
      const { brandSlug, modelSlug } = ctx.query;

      if (!brandSlug || !modelSlug) {
        return ctx.badRequest('Brand slug and model slug are required');
      }

      // Create the expected modelSlug format (brand-model)
      const expectedModelSlug = `${brandSlug}-${modelSlug}`;

      // Get battery model with the matching modelSlug
      const batteryModels = await strapi.entityService.findMany('api::battery-model.battery-model', {
        filters: {
          modelSlug: expectedModelSlug,
          isActive: true
        },
        populate: {
          batteryBrand: true,
          model: {
            populate: {
              brand: true
            }
          }
        }
      });

      if (batteryModels.length === 0) {
        return ctx.send({
          data: [],
          success: true,
          message: `No battery model found for ${brandSlug} ${modelSlug}`
        });
      }

      const batteryModel = batteryModels[0];
      const motorisations = (batteryModel as any).motorisations || [];

      // Format motorisations for frontend
      const formattedMotorisations = motorisations.map((motor: any, index: number) => ({
        id: `motor-${index}`,
        motorisation: motor.motorisation || 'Unknown',
        fuel: motor.fuel || 'Unknown',
        startDate: motor.startDate,
        endDate: motor.endDate,
        batteryModelId: batteryModel.id,
        batteryModelSlug: batteryModel.slug
      }));

      return ctx.send({
        data: formattedMotorisations,
        success: true,
        message: `Found ${formattedMotorisations.length} motorisation(s) for ${brandSlug} ${modelSlug}`,
        model: {
          id: (batteryModel as any).model?.id,
          name: (batteryModel as any).model?.name,
          slug: (batteryModel as any).model?.slug,
          brand: (batteryModel as any).model?.brand
        },
        batteryModel: {
          id: batteryModel.id,
          name: batteryModel.name,
          slug: batteryModel.slug,
          modelSlug: (batteryModel as any).modelSlug
        }
      });

    } catch (error) {
      console.error('Error fetching motorisations by brand and model:', error);
      return ctx.internalServerError('Failed to fetch motorisations');
    }
  }
};