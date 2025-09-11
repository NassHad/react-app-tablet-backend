export default {
  async importModels(ctx: any) {
    try {
      const fs = require('fs');
      const path = require('path');

      // Basic slugify function
      function slugify(str: string) {
        return String(str)
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/&/g, " and ")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "");
      }

      // Parse date from DD/MM/YYYY format
      function parseDate(dateStr: string) {
        if (!dateStr) return null;
        const [day, month, year] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      const inputPath = path.join(process.cwd(), "scripts", "models.json");
      
      if (!fs.existsSync(inputPath)) {
        return ctx.badRequest('Models file not found');
      }

      const rows = JSON.parse(fs.readFileSync(inputPath, "utf8"));
      console.log(`📄 Loaded ${rows.length} models from file`);

      // Pre-dedupe by slug
      const seen = new Set();
      const items = [];
      for (const row of rows) {
        const name = String(row?.name || "").trim();
        if (!name) continue;
        const slug = slugify(name);
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        
        const brandSlug = String(row?.brandSlug || "").trim();
        if (!brandSlug) continue;

        items.push({
          slug,
          name,
          brandSlug,
          startDate: parseDate(row.startDate),
          endDate: parseDate(row.endDate),
          isActive: true,
        });
      }

      console.log(`📊 Found ${items.length} unique model(s) to import`);

      let created = 0;
      let skipped = 0;
      let errors = 0;

      for (const item of items) {
        try {
          // Check if model already exists
          const exists = await strapi.entityService.count('api::battery-model.battery-model', {
            filters: { slug: item.slug },
          });

          if (exists > 0) {
            skipped++;
            continue;
          }

          // Find the brand by slug
          const brands = await strapi.entityService.findMany('api::battery-brand.battery-brand', {
            filters: { slug: item.brandSlug },
            limit: 1,
          });

          if (!brands || brands.length === 0) {
            errors++;
            continue;
          }

          const brand = brands[0];

          const data = {
            slug: item.slug,
            name: item.name,
            brand: brand.id,
            startDate: item.startDate,
            endDate: item.endDate,
            isActive: item.isActive,
            publishedAt: new Date(),
          };

          await strapi.entityService.create('api::battery-model.battery-model', { data });
          created++;
        } catch (err) {
          console.error(`Error creating model "${item.name}":`, err);
          errors++;
        }
      }

      const result = {
        message: 'Import completed',
        created,
        skipped,
        errors,
        total: items.length
      };

      console.log('🎉 Import completed!', result);
      return ctx.send(result);
    } catch (err) {
      console.error('Import error:', err);
      return ctx.internalServerError('Import failed: ' + err.message);
    }
  },
};
