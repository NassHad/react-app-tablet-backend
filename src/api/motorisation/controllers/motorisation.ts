export default {
  async getMotorisationsByModel(ctx: any) {
    try {
      const { modelId } = ctx.params;
      
      if (!modelId) {
        return ctx.badRequest('Model ID is required');
      }

      // Get the specific model first
      const model = await strapi.entityService.findOne('api::battery-model.battery-model', modelId, {
        populate: {
          batteryBrand: true
        }
      }) as any;

      if (!model) {
        return ctx.send([]);
      }

      // Get all motorisations for this model (same name and brand)
      const motorisations = await strapi.entityService.findMany('api::battery-model.battery-model', {
        filters: {
          name: model.name,
          batteryBrand: model.batteryBrand.id,
          isActive: true
        },
        populate: {
          batteryBrand: true
        },
        sort: { motorisation: 'asc' }
      });

      // Format the response
      const motorisationList = motorisations.map((motor: any) => ({
        id: motor.id,
        motorisation: motor.motorisation,
        fuel: motor.fuel,
        startDate: motor.startDate,
        endDate: motor.endDate,
        slug: motor.slug
      }));

      return ctx.send({
        model: {
          id: model.id,
          name: model.name,
          slug: model.slug,
          batteryBrand: {
            id: (model as any).batteryBrand.id,
            name: (model as any).batteryBrand.name,
            slug: (model as any).batteryBrand.slug
          }
        },
        motorisations: motorisationList
      });

    } catch (error) {
      console.error('Error fetching motorisations by model:', error);
      return ctx.internalServerError('Failed to fetch motorisations');
    }
  },

  async getMotorisationsByModelAndBrand(ctx: any) {
    try {
      const { brandId, modelName } = ctx.params;
      
      if (!brandId || !modelName) {
        return ctx.badRequest('Brand ID and Model Name are required');
      }

      // Get all motorisations for this model and brand
      const motorisations = await strapi.entityService.findMany('api::battery-model.battery-model', {
        filters: {
          name: modelName,
          batteryBrand: {
            id: brandId
          },
          isActive: true
        },
        populate: {
          batteryBrand: true
        },
        sort: { motorisation: 'asc' }
      });

      // Format the response
      const motorisationList = motorisations.map((motor: any) => ({
        id: motor.id,
        motorisation: motor.motorisation,
        fuel: motor.fuel,
        startDate: motor.startDate,
        endDate: motor.endDate,
        slug: motor.slug
      }));

      return ctx.send({
        model: {
          name: modelName,
          batteryBrand: {
            id: (motorisations[0] as any)?.batteryBrand?.id,
            name: (motorisations[0] as any)?.batteryBrand?.name,
            slug: (motorisations[0] as any)?.batteryBrand?.slug
          }
        },
        motorisations: motorisationList
      });

    } catch (error) {
      console.error('Error fetching motorisations by model and brand:', error);
      return ctx.internalServerError('Failed to fetch motorisations');
    }
  }
};
