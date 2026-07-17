// Tables actually queried by the tablet frontend (verified against
// react-app-tablet/src: every other Strapi content-type previously fetched
// here -- vehicles (no content-type, always []), vehicleTypes,
// batteryBrands, batteryModels, lightsPositions, lightsPositionData,
// compatibilities, specificQuestions, motorisations -- has zero matching
// `FROM <table>` query anywhere in the frontend, or no SQLite table
// counterpart at all. Dropped to shrink the payload and stop shipping dead
// data. `positions` (lights position metadata, 13 rows) is also excluded
// for now: its SQLite columns (icon, vehicle_type) don't cleanly map from
// lights-position's Strapi attributes (category, ref, sort, usageCount) --
// wiring it needs a deliberate field-mapping decision, not a guess, and
// it's small/static enough to stay manually maintained until that's done.
// Every one of these content-types has draftAndPublish: true (confirmed via
// each schema.json) but only `model` previously passed `status: 'published'`
// -- already flagged as a known gap (drafts leaking into what tablets
// receive) before this rework; fixed here across the board rather than
// deferred further, since this function was being rewritten anyway.
const SYNCED_CONTENT_TYPES = [
  { key: 'categories', uid: 'api::category.category', opts: { status: 'published', populate: '*', sort: 'order:asc' } },
  { key: 'products', uid: 'api::product.product', opts: { status: 'published', populate: '*', sort: 'id:asc' } },
  { key: 'brands', uid: 'api::brand.brand', opts: { status: 'published', populate: '*', sort: 'name:asc' } },
  {
    key: 'models', uid: 'api::model.model',
    opts: { status: 'published', populate: { brand: { fields: ['id', 'name', 'slug', 'isActive'] } }, sort: 'name:asc' },
  },
  { key: 'battery_products', uid: 'api::battery-product.battery-product', opts: { status: 'published', populate: { img: true }, sort: 'name:asc' } },
  { key: 'battery_data', uid: 'api::battery-data.battery-data', opts: { status: 'published', populate: { img: true, brandImg: true }, sort: 'id:asc' } },
  { key: 'lights_products', uid: 'api::lights-product.lights-product', opts: { status: 'published', populate: '*', sort: 'name:asc' } },
  { key: 'light_data', uid: 'api::light-data.light-data', opts: { status: 'published', populate: { img: true, brandImg: true }, sort: 'ref:asc' } },
  {
    key: 'wipers_products', uid: 'api::wipers-product.wipers-product',
    opts: { status: 'published', populate: { brand: { fields: ['id', 'name', 'slug'] }, model: { fields: ['id', 'name', 'slug'] } }, sort: 'name:asc' },
  },
  { key: 'wipers_data', uid: 'api::wiper-data.wiper-data', opts: { status: 'published', populate: { img: true, brandImg: true }, sort: 'id:asc' } },
  { key: 'filter_products', uid: 'api::filter-product.filter-product', opts: { status: 'published', populate: { img: true, brandImg: true }, sort: 'reference:asc' } },
  {
    key: 'filter_compatibilities', uid: 'api::filter-compatibility.filter-compatibility',
    opts: { status: 'published', populate: { brand: { fields: ['id', 'name', 'slug'] }, model: { fields: ['id', 'name', 'slug'] } }, sort: 'vehicleModel:asc' },
  },
];

function enrichModelsWithBrand(models: any[], brands: any[]) {
  const brandsMap = new Map();
  const brandsBySlug = new Map();
  brands.forEach((brand) => {
    brandsMap.set(brand.id, brand);
    if (brand.slug) brandsBySlug.set(brand.slug, brand);
  });

  return models.map((model) => {
    if (model.brand && typeof model.brand === 'object' && model.brand.slug) return model;

    let brandId = null;
    if (model.brand) {
      if (typeof model.brand === 'object' && model.brand.id) brandId = model.brand.id;
      else if (typeof model.brand === 'number') brandId = model.brand;
    }

    if (brandId && brandsMap.has(brandId)) {
      const brandData = brandsMap.get(brandId);
      model.brand = { id: brandData.id, name: brandData.name, slug: brandData.slug, isActive: brandData.isActive };
      return model;
    }

    if (!model.brand && model.slug) {
      const possibleBrandSlug = model.slug.split('-')[0];
      const inferredBrand = brandsBySlug.get(possibleBrandSlug);
      if (inferredBrand) {
        model.brand = { id: inferredBrand.id, name: inferredBrand.name, slug: inferredBrand.slug, isActive: inferredBrand.isActive };
      }
    }

    return model;
  });
}

async function getSyncData() {
  const results = await Promise.all(
    SYNCED_CONTENT_TYPES.map(({ uid, opts }) =>
      strapi.entityService.findMany(uid as any, opts as any).catch((error) => {
        strapi.log.error(`Sync: failed to fetch ${uid}:`, error);
        return [];
      }),
    ),
  );

  const data: Record<string, any[]> = {};
  SYNCED_CONTENT_TYPES.forEach(({ key }, i) => { data[key] = results[i] as any[]; });

  data.models = enrichModelsWithBrand(data.models, data.brands);

  return data;
}

// Real version instead of the previous hardcoded frozen timestamp: the max
// updatedAt across every row actually being shipped, so `If-None-Match`
// only short-circuits to 304 when nothing in the payload has changed since.
function computeVersion(data: Record<string, any[]>): string {
  let maxTs = 0;
  for (const rows of Object.values(data)) {
    for (const row of rows) {
      const ts = row && row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
      if (ts > maxTs) maxTs = ts;
    }
  }
  return String(maxTs || Date.now());
}

export default {
  async sync(ctx) {
    try {
      const { tabletId } = ctx.params;
      const { 'if-none-match': ifNoneMatch } = ctx.headers;

      const syncData = await getSyncData();
      const currentVersion = computeVersion(syncData);

      ctx.set('ETag', currentVersion);
      ctx.set('Cache-Control', 'no-cache');

      if (ifNoneMatch && ifNoneMatch === currentVersion) {
        ctx.status = 304;
        return;
      }

      if (ctx.method === 'HEAD') {
        ctx.status = 200;
        return;
      }

      ctx.set('Content-Type', 'application/json');
      ctx.body = {
        version: currentVersion,
        timestamp: new Date().toISOString(),
        tabletId,
        data: syncData,
      };
    } catch (error) {
      strapi.log.error('Sync error:', error);
      ctx.throw(500, 'Sync failed');
    }
  },
};
