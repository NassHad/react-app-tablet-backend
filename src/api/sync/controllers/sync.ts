export default {
  async index(ctx: any) {
    const { tabletId } = ctx.params;
    const token = ctx.request.headers['x-api-key']; // si API Token
    // TODO: valider le token si nécessaire

    // Récupérer la tablette (pour filtrer)
    const tablet = await strapi.entityService.findMany('api::tablet.tablet', {
      filters: { id: tabletId },
      limit: 1,
    });
    if (!tablet?.length) {
      ctx.status = 404;
      return (ctx.body = { error: 'Unknown tablet' });
    }
    const t = tablet[0];

    // Exemple de filtre: isActive = true, et éventuellement par "groups"
    const [categories, products, vehicles, compatibilities, questions] = await Promise.all([
      strapi.entityService.findMany('api::category.category', { filters: { isActive: true }, populate: '*' }),
      strapi.entityService.findMany('api::product.product',  { filters: { isActive: true }, populate: { category: true } }),
      strapi.entityService.findMany('api::vehicle.vehicle',  { populate: { vehicle_type: true } }),
      strapi.entityService.findMany('api::compatibility.compatibility', { populate: { vehicle: true, product: true } }),
      strapi.entityService.findMany('api::specific-question.specific-question', { populate: { compatibility: true } }),
    ]);

    const version = new Date().toISOString();

    ctx.set('ETag', version);
    ctx.body = {
      version,
      tabletId,
      categories,
      products,
      vehicles,
      compatibilities,
      questions,
    };
  },
};
