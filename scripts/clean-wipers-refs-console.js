// Script à coller dans la console Strapi (npm run console)
// Nettoie les annotations de connecteur dans wipersPositions :
// ex: "VS 70 (Y)" → "VS 70", "VS 77 (P+Y)" → "VS 77", "VS 32 (*,,)" → "VS 32"

async function cleanWipersRefs() {
  const REF_ANNOTATION = /\s*\([^)]+\)$/;

  function cleanRef(ref) {
    if (!ref || typeof ref !== 'string') return ref;
    return ref.replace(REF_ANNOTATION, '').trim() || null;
  }

  let page = 1;
  const pageSize = 100;
  let totalFixed = 0;
  let totalProducts = 0;
  let totalErrors = 0;

  console.log('🚀 Nettoyage des annotations de connecteur dans wipersPositions...');

  while (true) {
    const products = await strapi.entityService.findMany(
      'api::wipers-product.wipers-product',
      { pagination: { page, pageSize }, fields: ['id', 'wipersPositions'] }
    );

    if (!products || products.length === 0) break;
    totalProducts += products.length;

    for (const product of products) {
      try {
        const positions = product.wipersPositions;
        if (!Array.isArray(positions) || positions.length === 0) continue;

        let changed = false;
        const cleaned = positions.map(pos => {
          const newRef = cleanRef(pos.ref);
          if (newRef !== pos.ref) changed = true;
          return { ...pos, ref: newRef };
        });

        if (changed) {
          await strapi.entityService.update(
            'api::wipers-product.wipers-product',
            product.id,
            { data: { wipersPositions: cleaned } }
          );
          totalFixed++;
        }
      } catch (err) {
        console.error(`❌ Erreur produit ${product.id}:`, err.message);
        totalErrors++;
      }
    }

    console.log(`  Page ${page} — ${products.length} produits traités`);
    if (products.length < pageSize) break;
    page++;
  }

  console.log(`\n✅ Terminé : ${totalProducts} produits parcourus, ${totalFixed} mis à jour, ${totalErrors} erreurs`);
}

await cleanWipersRefs();
