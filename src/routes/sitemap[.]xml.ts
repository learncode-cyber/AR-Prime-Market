import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "https://arprimemarket.shop";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date().toISOString().split("T")[0];
        const sitemaps = ["pages", "categories", "products"];
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...sitemaps.map(
            (s) =>
              `  <sitemap>\n    <loc>${BASE_URL}/sitemap-${s}.xml</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`,
          ),
          `</sitemapindex>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
