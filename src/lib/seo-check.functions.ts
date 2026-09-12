import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * PageSpeed Insights check.
 * API key is read from process.env at call time so it can be rotated
 * without code changes (set as an environment variable on the host).
 */
export const runPageSpeedCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        url: z.string().url().max(2048),
        strategy: z.enum(["mobile", "desktop"]).default("mobile"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Admin-only
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) {
      return { ok: false, error: "Forbidden", scores: null };
    }

    const key = process.env.PAGESPEED_API_KEY;
    if (!key) {
      return {
        ok: false,
        error: "PAGESPEED_API_KEY not configured. Add it in project secrets.",
        scores: null,
      };
    }

    const params = new URLSearchParams({
      url: data.url,
      key,
      strategy: data.strategy,
    });
    ["performance", "accessibility", "best-practices", "seo"].forEach((c) =>
      params.append("category", c),
    );

    try {
      const res = await fetch(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
        { method: "GET" },
      );
      if (!res.ok) {
        const txt = await res.text();
        return {
          ok: false,
          error: `PageSpeed API error ${res.status}: ${txt.slice(0, 200)}`,
          scores: null,
        };
      }
      const json: any = await res.json();
      const cats = json?.lighthouseResult?.categories || {};
      const scores = {
        performance: Math.round((cats.performance?.score ?? 0) * 100),
        accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
        bestPractices: Math.round((cats["best-practices"]?.score ?? 0) * 100),
        seo: Math.round((cats.seo?.score ?? 0) * 100),
      };
      const audits = json?.lighthouseResult?.audits || {};
      return {
        ok: true,
        error: null,
        scores,
        metrics: {
          lcp: audits["largest-contentful-paint"]?.displayValue ?? null,
          fcp: audits["first-contentful-paint"]?.displayValue ?? null,
          cls: audits["cumulative-layout-shift"]?.displayValue ?? null,
          tbt: audits["total-blocking-time"]?.displayValue ?? null,
        },
        fetchedUrl: json?.id ?? data.url,
      };
    } catch (e: unknown) {
      return {
        ok: false,
        error: (e instanceof Error ? e.message : String(e)) || "Request failed",
        scores: null,
      };
    }
  });
