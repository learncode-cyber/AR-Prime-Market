import { createFileRoute } from "@tanstack/react-router";
import { getSitemapClient, renderUrlset, type SitemapEntry } from "@/lib/sitemap-utils";

export const Route = createFileRoute("/sitemap-products.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [];
        const admin = getSitemapClient();
        if (admin) {
          try {
            const { data } = await admin
              .from("products")
              .select("slug, updated_at")
              .eq("is_active", true)
              .order("created_at", { ascending: false })
              .limit(50000);
            for (const p of data || []) {
              if (p.slug) {
                entries.push({
                  path: `/products/${p.slug}`,
                  lastmod: p.updated_at
                    ? new Date(p.updated_at).toISOString().split("T")[0]
                    : undefined,
                  changefreq: "daily",
                  priority: "0.8",
                });
              }
            }
          } catch (e) {
            console.warn("[sitemap-products]", e);
          }
        }
        return renderUrlset(entries);
      },
    },
  },
});
