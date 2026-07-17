/**
 * Strapi mirror of the frontend-repo scripts already applied to SQLite:
 * fix_client_feedback_batch1.cjs, fix_fiat_doblo_split.cjs,
 * fix_vw_beetle_caddy.cjs, fix_renault_to_dacia.cjs, plus the VW/Dacia
 * model deactivations from the client-feedback plan.
 *
 * Strapi has no flat brand/model columns on wipers_products/lights_products
 * (association is purely via *_model_lnk join tables), and every row exists
 * as a draft+published pair -- so "merge" here means: repoint the loser's
 * *_model_lnk rows to the winner model id (matched by draft/pub state),
 * merge battery_products' flat columns, then delete the loser model rows.
 *
 * Usage: node scripts/mirror-client-feedback-final-batch.cjs [--dry-run]
 */
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');

function getModelRows(db, brandSlug, slug) {
  return db.prepare(`
    SELECT m.id, m.name, m.slug, m.published_at
    FROM models m
    JOIN models_brand_lnk lnk ON lnk.model_id = m.id
    JOIN brands b ON b.id = lnk.brand_id
    WHERE b.slug = ? AND m.slug = ?
  `).all(brandSlug, slug);
}

function matchByPub(rows, ref) {
  return rows.find(r => (r.published_at === null) === (ref.published_at === null)) || rows[0];
}

function repointLnk(db, lnkTable, idCol, loserModelId, winnerModelId) {
  const rows = db.prepare(`SELECT id, ${idCol} AS product_id FROM ${lnkTable} WHERE model_id=?`).all(loserModelId);
  for (const r of rows) {
    const exists = db.prepare(`SELECT id FROM ${lnkTable} WHERE model_id=? AND ${idCol}=?`).get(winnerModelId, r.product_id);
    if (exists) db.prepare(`DELETE FROM ${lnkTable} WHERE id=?`).run(r.id);
    else db.prepare(`UPDATE ${lnkTable} SET model_id=? WHERE id=?`).run(winnerModelId, r.id);
  }
  return rows.length;
}

function mergeBattery(db, brandSlug, winnerSlug, winnerName, loserSlug) {
  const winners = db.prepare(`SELECT id, motorisations, published_at FROM battery_products WHERE brand_slug=? AND model_slug=?`).all(brandSlug, winnerSlug);
  const losers = db.prepare(`SELECT id, motorisations, published_at FROM battery_products WHERE brand_slug=? AND model_slug=?`).all(brandSlug, loserSlug);
  for (const lRow of losers) {
    const wRow = winners.find(w => (w.published_at === null) === (lRow.published_at === null));
    if (wRow) {
      const merged = [...JSON.parse(wRow.motorisations || '[]'), ...JSON.parse(lRow.motorisations || '[]')];
      db.prepare(`UPDATE battery_products SET motorisations=? WHERE id=?`).run(JSON.stringify(merged), wRow.id);
      db.prepare(`DELETE FROM battery_products WHERE id=?`).run(lRow.id);
    } else {
      db.prepare(`UPDATE battery_products SET brand_slug=?, model_slug=?, model_name=? WHERE id=?`).run(brandSlug, winnerSlug, winnerName, lRow.id);
    }
  }
}

function mergeModel(db, brandSlug, winnerSlug, loserSlug, opts = {}) {
  const winners = getModelRows(db, brandSlug, winnerSlug);
  const losers = getModelRows(db, brandSlug, loserSlug);
  if (!winners.length || !losers.length) {
    console.log(`  MERGE skip (${brandSlug}/${loserSlug} -> ${winnerSlug}): winner=${winners.length} loser=${losers.length}`);
    return;
  }
  if (opts.renameWinnerTo) {
    for (const w of winners) db.prepare(`UPDATE models SET name=?, display_name=? WHERE id=?`).run(opts.renameWinnerTo, opts.renameWinnerTo, w.id);
  }
  const winnerName = opts.renameWinnerTo || winners[0].name;
  mergeBattery(db, brandSlug, winnerSlug, winnerName, loserSlug);
  for (const lRow of losers) {
    const wRow = matchByPub(winners, lRow);
    repointLnk(db, 'wipers_products_model_lnk', 'wipers_product_id', lRow.id, wRow.id);
    repointLnk(db, 'lights_products_model_lnk', 'lights_product_id', lRow.id, wRow.id);
    repointLnk(db, 'filter_compatibilities_model_lnk', 'filter_compatibility_id', lRow.id, wRow.id);
    db.prepare(`DELETE FROM models_brand_lnk WHERE model_id=?`).run(lRow.id);
    db.prepare(`DELETE FROM models WHERE id=?`).run(lRow.id);
  }
  console.log(`  MERGE: ${brandSlug}/${loserSlug} (${losers.length} row) -> ${winnerSlug}${opts.renameWinnerTo ? ` (renamed to "${opts.renameWinnerTo}")` : ''}`);
}

function reparentModel(db, brandSlug, targetBrandSlug, slug) {
  const rows = getModelRows(db, brandSlug, slug);
  if (!rows.length) { console.log(`  REPARENT skip (${brandSlug}/${slug}): not found`); return; }
  const targetBrands = db.prepare(`SELECT id, published_at FROM brands WHERE slug=?`).all(targetBrandSlug);
  for (const m of rows) {
    const tBrand = matchByPub(targetBrands, m);
    db.prepare(`UPDATE models_brand_lnk SET brand_id=? WHERE model_id=?`).run(tBrand.id, m.id);
  }
  db.prepare(`UPDATE battery_products SET brand_slug=?, brand_name=? WHERE brand_slug=? AND model_slug=?`)
    .run(targetBrandSlug, targetBrandSlug.toUpperCase(), brandSlug, slug);
  console.log(`  REPARENT: ${brandSlug}/${slug} -> ${targetBrandSlug} (${rows.length} row)`);
}

function renameModel(db, brandSlug, slug, newName) {
  const rows = getModelRows(db, brandSlug, slug);
  if (!rows.length) { console.log(`  RENAME skip (${brandSlug}/${slug}): not found`); return; }
  for (const m of rows) db.prepare(`UPDATE models SET name=?, display_name=? WHERE id=?`).run(newName, newName, m.id);
  db.prepare(`UPDATE battery_products SET model_name=? WHERE brand_slug=? AND model_slug=?`).run(newName, brandSlug, slug);
  console.log(`  RENAME: ${brandSlug}/${slug} -> "${newName}" (${rows.length} row)`);
}

function deactivateModel(db, brandSlug, slug) {
  const rows = getModelRows(db, brandSlug, slug);
  if (!rows.length) { console.log(`  DEACTIVATE skip (${brandSlug}/${slug}): not found`); return; }
  for (const m of rows) db.prepare(`UPDATE models SET is_active=0 WHERE id=?`).run(m.id);
  console.log(`  DEACTIVATE: ${brandSlug}/${slug} (${rows.length} row)`);
}

// --- Citroën C25/C35: repoint combined wipers row's model-lnk to C25,
// duplicate the product row (new document_id) and link the duplicate to C35.
function splitC25C35(db) {
  const combined = getModelRows(db, 'citroen', 'c22-c25-c32-c35');
  const c25 = getModelRows(db, 'citroen', 'c25');
  const c35 = getModelRows(db, 'citroen', 'c35');
  if (!combined.length || !c25.length || !c35.length) {
    console.log(`  C25/C35 skip: combined=${combined.length} c25=${c25.length} c35=${c35.length}`);
    return;
  }
  for (const cRow of combined) {
    const c25Row = matchByPub(c25, cRow);
    const c35Row = matchByPub(c35, cRow);
    const lnkRows = db.prepare(`SELECT id, wipers_product_id FROM wipers_products_model_lnk WHERE model_id=?`).all(cRow.id);
    for (const lnk of lnkRows) {
      const product = db.prepare(`SELECT * FROM wipers_products WHERE id=?`).get(lnk.wipers_product_id);
      // repoint original -> C25
      db.prepare(`UPDATE wipers_products_model_lnk SET model_id=? WHERE id=?`).run(c25Row.id, lnk.id);
      db.prepare(`UPDATE wipers_products SET name=?, description=? WHERE id=?`)
        .run('CITROËN C25', 'Wipers for CITROËN C25', product.id);
      // duplicate -> C35
      const newDocId = `${product.document_id}-c35`;
      const info = db.prepare(`
        INSERT INTO wipers_products (document_id, name, ref, description, wipers_positions, slug, construction_year_start, construction_year_end, direction, category, is_active, created_at, updated_at, published_at, locale, wiper_brand, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newDocId, 'CITROËN C35', product.ref, 'Wipers for CITROËN C35', product.wipers_positions, `${product.slug}-c35`, product.construction_year_start, product.construction_year_end, product.direction, product.category, product.is_active, product.created_at, product.updated_at, product.published_at, product.locale, product.wiper_brand, product.source);
      db.prepare(`INSERT INTO wipers_products_model_lnk (wipers_product_id, model_id) VALUES (?, ?)`).run(info.lastInsertRowid, c35Row.id);
    }
  }
  for (const cRow of combined) db.prepare(`UPDATE models SET is_active=0 WHERE id=?`).run(cRow.id);
  console.log('  C25/C35: repointed combined wiper rows to C25, duplicated for C35, deactivated combined model');
}

function run(db) {
  console.log('--- Citroën C25/C35 ---');
  splitC25C35(db);

  console.log('--- Citroën Nemo ---');
  mergeModel(db, 'citroen', 'nemo', 'nemo-box-bodympv');
  renameModel(db, 'citroen', 'nemo-mpv', 'Nemo Combi');

  console.log('--- Fiat ---');
  renameModel(db, 'fiat', 'qubo', 'Qubo');
  mergeModel(db, 'fiat', '500x', '500-x');
  mergeModel(db, 'fiat', 'doblo-box-body-estate', 'doblo-box-bodympv');

  console.log('--- Volkswagen ---');
  mergeModel(db, 'volkswagen', 'beetle', 'beetle-beetle-cabriolet-5c');
  mergeModel(db, 'volkswagen', 'new-beetle-convertible', 'new-beetle-cabriolet-convertible');
  mergeModel(db, 'volkswagen', 'caddy', 'caddy-life');
  mergeModel(db, 'volkswagen', 'caddy', 'caddy-life-cargo', { renameWinnerTo: 'Caddy Life/Cargo' });

  console.log('--- Renault -> Dacia merges ---');
  const MERGES = [
    ['renault-dokker', 'dacia-dokker'],
    ['renault-duster', 'dacia-duster'],
    ['renault-duster-i', 'dacia-duster-i'],
    ['renault-duster-ii', 'dacia-duster-ii'],
    ['renault-logan-express', 'dacia-logan-express'],
    ['logan-i', 'dacia-logan'],
    ['renault-logan-ii', 'logan-ii'],
    ['sandero-i', 'dacia-sandero'],
    ['renault-sandero', 'dacia-sandero'],
  ];
  for (const [renaultSlug, daciaSlug] of MERGES) {
    // cross-brand merge: winner is under dacia, loser under renault
    const winners = getModelRows(db, 'dacia', daciaSlug);
    const losers = getModelRows(db, 'renault', renaultSlug);
    if (!winners.length || !losers.length) {
      console.log(`  MERGE skip (renault/${renaultSlug} -> dacia/${daciaSlug}): winner=${winners.length} loser=${losers.length}`);
      continue;
    }
    mergeBatteryCrossBrand(db, 'dacia', daciaSlug, winners[0].name, 'renault', renaultSlug);
    for (const lRow of losers) {
      const wRow = matchByPub(winners, lRow);
      repointLnk(db, 'wipers_products_model_lnk', 'wipers_product_id', lRow.id, wRow.id);
      repointLnk(db, 'lights_products_model_lnk', 'lights_product_id', lRow.id, wRow.id);
      repointLnk(db, 'filter_compatibilities_model_lnk', 'filter_compatibility_id', lRow.id, wRow.id);
      db.prepare(`DELETE FROM models_brand_lnk WHERE model_id=?`).run(lRow.id);
      db.prepare(`DELETE FROM models WHERE id=?`).run(lRow.id);
    }
    console.log(`  MERGE: renault/${renaultSlug} (${losers.length} row) -> dacia/${daciaSlug}`);
  }

  console.log('--- Renault -> Dacia reparents ---');
  const REPARENT_ONLY = [
    'dokker--dokker', 'logan-i-estate', 'logan-ii-estate', 'logan-stepway-ii',
    'renault-logan', 'renault-logan-mcv', 'logan-stepway', 'logan-mcv-stepway',
    'logan--stepway', 'sandero-sandero-stepway-ii', 'sanderostepway-i',
    'sandero-stepway-ii', 'renault-sandero-sandero-stepway',
  ];
  for (const slug of REPARENT_ONLY) reparentModel(db, 'renault', 'dacia', slug);

  console.log('--- Renault R5 rename ---');
  renameModel(db, 'renault', 'r5-super-5', 'R5');

  console.log('--- VW / Dacia model deactivations ---');
  for (const slug of ['routan', 'taos', 'teramont', 'vento', 'voyage']) deactivateModel(db, 'volkswagen', slug);
  for (const slug of ['solenza', 'supernova', 'nova-nova-type-524', '1000-serie']) deactivateModel(db, 'dacia', slug);
}

// mergeBattery for renault->dacia cross-brand needs the loser's own brand_slug
function mergeBatteryCrossBrand(db, winnerBrandSlug, winnerSlug, winnerName, loserBrandSlug, loserSlug) {
  const winners = db.prepare(`SELECT id, motorisations, published_at FROM battery_products WHERE brand_slug=? AND model_slug=?`).all(winnerBrandSlug, winnerSlug);
  const losers = db.prepare(`SELECT id, motorisations, published_at FROM battery_products WHERE brand_slug=? AND model_slug=?`).all(loserBrandSlug, loserSlug);
  for (const lRow of losers) {
    const wRow = winners.find(w => (w.published_at === null) === (lRow.published_at === null));
    if (wRow) {
      const merged = [...JSON.parse(wRow.motorisations || '[]'), ...JSON.parse(lRow.motorisations || '[]')];
      db.prepare(`UPDATE battery_products SET motorisations=? WHERE id=?`).run(JSON.stringify(merged), wRow.id);
      db.prepare(`DELETE FROM battery_products WHERE id=?`).run(lRow.id);
    } else {
      db.prepare(`UPDATE battery_products SET brand_slug=?, model_slug=?, model_name=? WHERE id=?`).run(winnerBrandSlug, winnerSlug, winnerName, lRow.id);
    }
  }
}

const db = new Database(DB_PATH, { readonly: DRY_RUN });
if (DRY_RUN) {
  console.log('[DRY RUN] no changes will be written; see checks above for row existence.');
  db.close();
  process.exit(0);
}
const txn = db.transaction(() => run(db));
txn();
db.close();
console.log('Applied.');
