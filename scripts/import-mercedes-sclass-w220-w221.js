/**
 * One-off import: Mercedes S-Class W220 (10/98-08/05) and W221 (09/05-12/13)
 * light bulb data, sourced from "Guide d'application 2024-2025_FR_IT.pdf"
 * (OSRAM), to fill a catalog gap (only W140 and post-2015 Convertible existed).
 *
 * Column -> category mapping verified empirically against the already-imported
 * W140 record's lightPositions JSON (see plan for details). "-" and "**" both
 * mean "no distinct bulb for this position" and are omitted from the output.
 *
 * Usage: node scripts/import-mercedes-sclass-w220-w221.js
 */

const STRAPI_URL = 'http://localhost:1338';

const POSITION_COLUMNS = [
  { category: 'feu_croisement', position: 'Feu de croisement' },
  { category: 'feu_route', position: 'Feu de route' },
  { category: 'eclairage_jour', position: 'Éclairage jour' },
  { category: 'feu_position', position: 'Feu de position' },
  { category: 'feu_antibrouillard', position: 'Feu antibrouillard' },
  { category: 'clignotant_avant_voiture', position: 'Clignotant avant' },
  { category: 'clignotant_arriere_voiture', position: 'Clignotant arrière' },
  { category: 'feu_arriere', position: 'Feux arrières' },
  { category: 'feu_stop', position: 'Feu de stop' },
  { category: 'feu_plaque_immatriculation', position: 'Éclairage plaque' },
  { category: 'eclairage_interieur', position: 'Éclairage intérieur' },
  { category: 'eclairage_coffre', position: 'Éclairage coffre' },
];

function buildLightPositions(refs) {
  return refs
    .map((ref, i) => ({ ref, ...POSITION_COLUMNS[i] }))
    .filter((entry) => entry.ref && entry.ref !== '-' && entry.ref !== '**')
    .map(({ ref, position, category }) => ({ ref, position, category }));
}

const ENTRIES = [
  {
    typeConception: 'Halogen',
    constructionYearStart: '10/98',
    constructionYearEnd: '08/05',
    refs: ['H7', 'H7', '-', 'W5W', 'H1', 'PY21W', 'PY21W', 'R5W', 'LED', 'C5W', 'C5W', '-'],
  },
  {
    typeConception: 'Xenon',
    constructionYearStart: '10/98',
    constructionYearEnd: '08/05',
    refs: ['D2R', 'H7', '-', 'W5W', 'H1', 'PY21W', 'PY21W', 'R5W', 'LED', 'C5W', 'C5W', '-'],
  },
  {
    typeConception: 'Bi-Xenon',
    constructionYearStart: '10/98',
    constructionYearEnd: '08/05',
    refs: ['D2S', 'D2S', '-', 'W5W', 'H7', 'PY21W', 'PY21W', 'R5W', 'LED', 'C5W', 'C5W', '-'],
  },
  {
    typeConception: 'Halogen',
    constructionYearStart: '09/05',
    constructionYearEnd: '12/13',
    refs: ['H7', 'H9', 'LED', 'W5W', 'H11', '**', '**', '**', '**', 'W5W', '**', 'W5W'],
  },
  {
    typeConception: 'Bi-Xenon',
    constructionYearStart: '09/05',
    constructionYearEnd: '12/13',
    refs: ['D1S', 'H7', 'LED', 'W5W', 'H11', '**', '**', '**', '**', 'W5W', '**', 'W5W'],
  },
];

async function main() {
  // status=published: Strapi v5 draft/publish gives brand/model distinct numeric
  // ids per state sharing one documentId. Existing lights-products relations
  // resolve to the *published* id (verified against record "MERCEDES S-CLASS" /
  // W140), so look those up explicitly rather than using the (draft) default.
  const brandRes = await fetch(`${STRAPI_URL}/api/brands?filters[slug][$eq]=mercedes&status=published`);
  const brands = await brandRes.json();
  const brand = brands[0];
  if (!brand) throw new Error('Brand "mercedes" not found');

  const modelRes = await fetch(
    `${STRAPI_URL}/api/models?filters[slug][$eq]=s-class&filters[brand][slug][$eq]=mercedes&status=published`
  );
  const models = await modelRes.json();
  const model = models[0];
  if (!model) throw new Error('Model "s-class" under brand "mercedes" not found');

  console.log(`Brand: ${brand.name} (id=${brand.id}), Model: ${model.name} (id=${model.id})`);

  const existingRes = await fetch(
    `${STRAPI_URL}/api/lights-products?filters[model][id][$eq]=${model.id}`
  );
  const existing = await existingRes.json();
  const existingStarts = new Set((existing.data || []).map((p) => p.constructionYearStart));
  console.log('Existing constructionYearStart values for this model:', [...existingStarts]);

  for (const entry of ENTRIES) {
    if (existingStarts.has(entry.constructionYearStart)) {
      console.log(
        `Skip (already exists): ${entry.typeConception} ${entry.constructionYearStart}-${entry.constructionYearEnd}`
      );
      continue;
    }

    const lightPositions = buildLightPositions(entry.refs);
    const payload = {
      data: {
        name: 'MERCEDES S-CLASS',
        ref: 'Multiple',
        description: `S-Class ${entry.typeConception} ${entry.constructionYearStart}-${entry.constructionYearEnd}`,
        brand: brand.id,
        model: model.id,
        lightPositions,
        constructionYearStart: entry.constructionYearStart,
        constructionYearEnd: entry.constructionYearEnd,
        typeConception: entry.typeConception,
        source: "OSRAM Guide d'application 2024-2025",
        category: 'multiple',
        isActive: true,
        publishedAt: new Date().toISOString(),
      },
    };

    const res = await fetch(`${STRAPI_URL}/api/lights-products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const created = await res.json();
      console.log(
        `Created: ${entry.typeConception} ${entry.constructionYearStart}-${entry.constructionYearEnd} (id=${created.data?.id})`
      );
    } else {
      const errBody = await res.text();
      console.error(
        `Failed: ${entry.typeConception} ${entry.constructionYearStart}-${entry.constructionYearEnd} -> ${res.status} ${errBody}`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
