import type { Core } from "@strapi/strapi";
import fs from "fs";
import path from "path";

function slugify(str: string) {
  return String(str)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default {
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const file = path.join(process.cwd(), "data", "brands.json");
    if (!fs.existsSync(file)) return;

    const raw = fs.readFileSync(file, "utf8");
    const rows: Array<{ name?: string; active?: boolean | number }> = JSON.parse(raw) as Array<{ name?: string; active?: boolean | number }>;

    const seen = new Set<string>();
    let created = 0, skipped = 0;

    for (const row of rows) {
      const name = (row?.name ?? "").trim();
      if (!name) continue;

      const slug = slugify(name);
      if (!slug || seen.has(slug)) continue; // dedupe inside file
      seen.add(slug);

      const exists = await strapi.entityService.count("api::brand.brand", { filters: { slug } }) as number;
      if (exists > 0) { skipped++; continue; }

      await strapi.entityService.create("api::brand.brand", {
        data: {
          slug,
          name,
          isActive: typeof row.active === "boolean" ? row.active : Boolean(row.active) as boolean,
          ...(process.env.PUBLISH === "true" ? { publishedAt: new Date() } : {}),
        },
      });
      created++;
    }

    strapi.log.info(`Brand seeding complete. Created: ${created}, Skipped: ${skipped}`);
  },
};