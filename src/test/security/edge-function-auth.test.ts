import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CONFIG_PATH = join(process.cwd(), "supabase", "config.toml");
const FUNCTIONS_DIR = join(process.cwd(), "supabase", "functions");

/**
 * Functions that are intentionally callable without a Supabase JWT.
 * Adding a new entry here requires explicit justification — it widens
 * the public attack surface.
 */
const PUBLIC_FUNCTIONS_ALLOWLIST = new Set<string>([
  "send-email", // invoked from server fns via service role only
  "cart-recovery", // public cron trigger
  "translate-content", // public translation cache
  "webhook-dispatcher", // outbound webhook delivery
  "bkash-pay", // payment gateway callback
  "binance-pay-gateway", // payment gateway callback
  "process-order", // payment gateway success callback

  // --- Added 2026-07 security audit (all verified to self-enforce auth) ---
  "cj-webhook", // external supplier webhook; verifies x-cj-signature HMAC in code
  "get-user-geo", // read-only IP→geo lookup, no PII/business data, needed pre-auth on storefront
  "meta-capi", // layered auth in code: internal CRON_SECRET OR admin JWT OR browser event
  "meta-insights", // calls requireAdmin(req) internally — self-enforced, not gateway-enforced
  "telegram-notify", // verifies x-cron-secret (CRON_SECRET) in code
  "telegram-webhook", // verifies Telegram's own secret token (TELEGRAM_WEBHOOK_SECRET) in code
  "ai-support-chat", // intentionally public customer-facing chat widget (anonymous shoppers)
  "daily-ceo-report", // verifies x-cron-secret (CRON_SECRET) in code
  "ad-performance-monitor", // verifies x-cron-secret (CRON_SECRET) in code
  "ai-learning-engine", // verifies x-cron-secret (CRON_SECRET) in code
  "agent-research-loop", // verifies x-cron-secret (CRON_SECRET) in code
]);

/**
 * Functions that MUST stay JWT-protected. Removing one from this list
 * is a security regression and requires a separate audit.
 */
const REQUIRED_PROTECTED = [
  "supplier-sync",
  "test-credentials",
  "import-product",
  "chro-orchestrator",
];

type FnConfig = { name: string; verifyJwt: boolean };

function parseFunctions(toml: string): FnConfig[] {
  const out: FnConfig[] = [];
  const blockRe = /\[functions\.([a-zA-Z0-9_-]+)\]\s*\n([\s\S]*?)(?=\n\[|$)/g;
  for (const m of toml.matchAll(blockRe)) {
    const name = m[1];
    const body = m[2];
    const verifyMatch = body.match(/verify_jwt\s*=\s*(true|false)/);
    out.push({ name, verifyJwt: verifyMatch ? verifyMatch[1] === "true" : true });
  }
  return out;
}

function listFunctionDirs(): string[] {
  return readdirSync(FUNCTIONS_DIR).filter((entry) => {
    if (entry.startsWith("_")) return false;
    return statSync(join(FUNCTIONS_DIR, entry)).isDirectory();
  });
}

describe("Edge function auth-gate regression guard", () => {
  const toml = readFileSync(CONFIG_PATH, "utf8");
  const configured = parseFunctions(toml);
  const configuredByName = new Map(configured.map((f) => [f.name, f]));

  it("no edge function disables verify_jwt without explicit allow-listing", () => {
    const offenders = configured
      .filter((f) => !f.verifyJwt && !PUBLIC_FUNCTIONS_ALLOWLIST.has(f.name))
      .map((f) => f.name);

    expect(
      offenders,
      `These functions set verify_jwt=false but are NOT in PUBLIC_FUNCTIONS_ALLOWLIST: ${offenders.join(", ")}. ` +
        `Either re-enable verify_jwt or add the function to the allow-list in this test with a security justification.`,
    ).toEqual([]);
  });

  it.each(REQUIRED_PROTECTED)("%s keeps verify_jwt = true", (name) => {
    const cfg = configuredByName.get(name);
    expect(cfg, `Missing [functions.${name}] block in supabase/config.toml`).toBeDefined();
    expect(cfg!.verifyJwt, `${name} must keep verify_jwt = true`).toBe(true);
  });

  it("every edge function directory is registered in config.toml", () => {
    const unregistered = listFunctionDirs().filter((dir) => !configuredByName.has(dir));
    expect(
      unregistered,
      `Edge functions missing a [functions.<name>] block in supabase/config.toml: ${unregistered.join(", ")}. ` +
        `Unregistered functions silently default to verify_jwt = true but should be declared explicitly.`,
    ).toEqual([]);
  });
});
