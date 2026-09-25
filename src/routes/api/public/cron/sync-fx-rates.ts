import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withGateway } from "@/lib/gateway";

/**
 * Refreshes the server-side `fx_rates` table (used by the `create_order`
 * Postgres function — see migration 20260729080000_d4e8f1a7_*.sql) from
 * the same live FX API the browser's CurrencyContext already uses. Kept
 * as a separate cron-triggered sync rather than a live call inside
 * checkout itself, since checkout is a critical path that shouldn't
 * depend on a third-party API's latency/uptime.
 */
export const Route = createFileRoute("/api/public/cron/sync-fx-rates")({
  server: {
    handlers: {
      POST: withGateway({ routeName: "cron.sync-fx-rates", auth: "cron" }, async () => {
        const res = await fetch("https://open.er-api.com/v6/latest/USD", {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          return new Response(JSON.stringify({ ok: false, error: `Rate API HTTP ${res.status}` }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
        const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
        if (json.result !== "success" || !json.rates) {
          return new Response(JSON.stringify({ ok: false, error: "Invalid rate data" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Only the currencies this app actually supports (matches
        // src/context/CurrencyContext.tsx's defaultCurrencies) — no point
        // storing 150+ currencies the storefront never uses.
        const supported = [
          "USD",
          "AED",
          "SAR",
          "BDT",
          "INR",
          "EUR",
          "GBP",
          "JPY",
          "CNY",
          "KRW",
          "CAD",
          "AUD",
          "TRY",
          "BRL",
          "PKR",
          "RUB",
        ];

        const rows = supported
          .filter((code) => typeof json.rates![code] === "number")
          .map((code) => ({
            currency_code: code,
            rate_per_usd: json.rates![code],
            updated_at: new Date().toISOString(),
          }));

        const { error } = await supabaseAdmin
          .from("fx_rates")
          .upsert(rows, { onConflict: "currency_code" });

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ ok: true, updated: rows.length }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    },
  },
});
