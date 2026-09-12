import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withGateway } from "@/lib/gateway";

// Hourly cron: refreshes stock_quantity for products imported from a
// dropshipping provider. Authenticated via CRON_SECRET (preferred) or
// the admin-rotated secret in integration_secrets (provider='cron').
// Migrated to the API Gateway (Module 2) — see docs/architecture/API_GATEWAY.md.
export const Route = createFileRoute("/api/public/cron/sync-stock")({
  server: {
    handlers: {
      POST: withGateway({ routeName: "cron.sync-stock", auth: "cron" }, async () => {
        const { data: products } = await supabaseAdmin
          .from("products")
          .select("id, stock_quantity, source_provider, source_product_id, source_url")
          .not("source_provider", "is", null)
          .limit(200);

        let ok = 0;
        let failed = 0;
        for (const p of products || []) {
          try {
            // Defer to scraping for the cron path to keep it dependency-free.
            const url =
              p.source_url ||
              (p.source_provider === "cj"
                ? `https://www.cjdropshipping.com/product/${p.source_product_id}.html`
                : p.source_provider === "aliexpress"
                  ? `https://www.aliexpress.com/item/${p.source_product_id}.html`
                  : "");
            if (!url) {
              failed++;
              continue;
            }
            const r = await fetch(url, {
              headers: { "User-Agent": "Mozilla/5.0 (ARPrimeCron/1.0)" },
            });
            const html = await r.text();
            const stockMatch =
              html.match(/"availableQuantity"\s*:\s*"?(\d+)"?/) ||
              html.match(/"totalInventory"\s*:\s*"?(\d+)"?/) ||
              html.match(/"stock"\s*:\s*"?(\d+)"?/);
            const stock = stockMatch ? parseInt(stockMatch[1], 10) : p.stock_quantity;
            await supabaseAdmin
              .from("products")
              .update({ stock_quantity: stock, last_stock_sync: new Date().toISOString() })
              .eq("id", p.id);
            await supabaseAdmin.from("stock_sync_logs").insert({
              product_id: p.id,
              provider: p.source_provider,
              old_stock: p.stock_quantity,
              new_stock: stock,
              status: "ok",
            });
            ok++;
          } catch (e: unknown) {
            failed++;
            await supabaseAdmin.from("stock_sync_logs").insert({
              product_id: p.id,
              provider: p.source_provider,
              old_stock: p.stock_quantity,
              status: "error",
              error_message: e instanceof Error ? e.message : String(e),
            });
          }
        }

        return new Response(JSON.stringify({ ok, failed, total: products?.length || 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    },
  },
});
