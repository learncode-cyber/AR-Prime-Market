import { createFileRoute } from "@tanstack/react-router";
import { getSitemapClient, renderUrlset, type SitemapEntry } from "@/lib/sitemap-utils";

export const Route = createFileRoute("/sitemap-categories.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [];
        const admin = getSitemapClient();
        if (admin) {
          try {
            const { data } = await admin.from("categories").select("slug").order("name");
            for (const c of data || []) {
              if (c.slug) {
                entries.push({
                  path: `/categories/${c.slug}`,
                  changefreq: "weekly",
                  priority: "0.85",
                });
              }
            }
          } catch (e) {
            console.warn("[sitemap-categories]", e);
          }
        }
        return renderUrlset(entries);
      },
    },
  },
});
