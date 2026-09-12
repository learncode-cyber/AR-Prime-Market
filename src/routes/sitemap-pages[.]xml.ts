import { createFileRoute } from "@tanstack/react-router";
import { renderUrlset, type SitemapEntry } from "@/lib/sitemap-utils";

export const Route = createFileRoute("/sitemap-pages.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/products", changefreq: "daily", priority: "0.9" },
          { path: "/blog", changefreq: "weekly", priority: "0.7" },
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/contact", changefreq: "monthly", priority: "0.6" },
          { path: "/faq", changefreq: "monthly", priority: "0.5" },
          { path: "/terms", changefreq: "monthly", priority: "0.4" },
          { path: "/privacy-policy", changefreq: "monthly", priority: "0.4" },
          { path: "/refund-policy", changefreq: "monthly", priority: "0.4" },
          { path: "/careers", changefreq: "monthly", priority: "0.4" },
          { path: "/press", changefreq: "monthly", priority: "0.4" },
          { path: "/support", changefreq: "monthly", priority: "0.5" },
          { path: "/track-order", changefreq: "monthly", priority: "0.5" },
          { path: "/wishlist", changefreq: "monthly", priority: "0.3" },
        ];
        return renderUrlset(entries);
      },
    },
  },
});
