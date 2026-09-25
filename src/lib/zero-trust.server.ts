// Server-side zero-trust helpers — log events and run the periodic scan
// that turns log signals into queued proposals in the unified
// public.agent_proposals queue (agent_slug = 'sec').

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Severity = "low" | "medium" | "high" | "critical";
type EventKind =
  | "session_integrity"
  | "parameter_tampering"
  | "file_magic_byte_mismatch"
  | "api_token_misuse"
  | "rate_anomaly"
  | "rls_bypass_attempt"
  | "webhook_signature_failure"
  | "auth_brute_force";

export type LogEventInput = {
  kind: EventKind;
  severity?: Severity;
  source: string;
  endpoint?: string | null;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
};

/** Append a zero-trust event. Never throws — security logging must never break the caller. */
export async function logSecurityEvent(input: LogEventInput): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc("log_security_event", {
      p_kind: input.kind,
      p_severity: input.severity ?? "medium",
      p_source: input.source,
      p_endpoint: input.endpoint ?? undefined,
      p_user_id: input.userId ?? undefined,
      p_ip: input.ip ?? undefined,
      p_user_agent: input.userAgent ?? undefined,
      p_details: (input.details ?? {}) as never,
    });

    if (error) {
      console.error("[zero-trust] log failed", error.message);
      return null;
    }
    return (data as string) ?? null;
  } catch (e) {
    console.error("[zero-trust] log threw", e);
    return null;
  }
}

type ScanSummary = {
  events_detected: number;
  patches_queued: number;
  breakdown: Record<string, number>;
  duration_ms: number;
};

const PATCH_THRESHOLDS: Record<
  EventKind,
  { count: number; window_min: number; severity: Severity }
> = {
  auth_brute_force: { count: 8, window_min: 15, severity: "high" },
  rate_anomaly: { count: 100, window_min: 15, severity: "high" },
  api_token_misuse: { count: 5, window_min: 60, severity: "critical" },
  rls_bypass_attempt: { count: 1, window_min: 60, severity: "critical" },
  webhook_signature_failure: { count: 3, window_min: 60, severity: "high" },
  file_magic_byte_mismatch: { count: 3, window_min: 60, severity: "high" },
  parameter_tampering: { count: 2, window_min: 60, severity: "high" },
  session_integrity: { count: 5, window_min: 30, severity: "high" },
};

/**
 * Zero-trust scan. Pulls recent signals from api_call_logs +
 * security_events, applies thresholds, and queues security patch proposals
 * into the unified public.agent_proposals table (agent_slug='sec',
 * payload_kind='security_patch'). Idempotent within a rolling 6-hour window
 * per (module, source).
 */
export async function runZeroTrustScan(trigger: string): Promise<ScanSummary> {
  const started = Date.now();
  const summary: ScanSummary = {
    events_detected: 0,
    patches_queued: 0,
    breakdown: {},
    duration_ms: 0,
  };

  // 1. Derive rate_anomaly events from api_call_logs (HTTP 401/403/429 bursts per IP/key).
  try {
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: calls } = await supabaseAdmin
      .from("api_call_logs")
      .select("ip_address, key_id, status_code, endpoint")
      .gte("created_at", since)
      .in("status_code", [401, 403, 429])
      .limit(2000);
    const buckets = new Map<
      string,
      { count: number; endpoint: string; ip: string | null; key: string | null }
    >();
    for (const c of calls ?? []) {
      const key = `${c.ip_address ?? "-"}|${c.key_id ?? "-"}|${c.endpoint ?? "-"}`;
      const cur = buckets.get(key) ?? {
        count: 0,
        endpoint: c.endpoint ?? "",
        ip: c.ip_address,
        key: c.key_id,
      };
      cur.count += 1;
      buckets.set(key, cur);
    }
    for (const [, b] of buckets) {
      if (b.count >= 25) {
        await logSecurityEvent({
          kind: "rate_anomaly",
          severity: b.count >= 100 ? "high" : "medium",
          source: "api_call_logs.scan",
          endpoint: b.endpoint,
          ip: b.ip,
          details: { failed_calls: b.count, key_id: b.key, window_min: 15 },
        });
        summary.events_detected += 1;
        summary.breakdown.rate_anomaly = (summary.breakdown.rate_anomaly ?? 0) + 1;
      }
    }
  } catch (e) {
    console.error("[zero-trust] api_call_logs scan failed", e);
  }

  // 2. Threshold-cross detection on security_events → queue agent_proposals.
  try {
    const earliest = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: events } = await supabaseAdmin
      .from("security_events")
      .select("id, kind, source, endpoint, severity, created_at, details")
      .gte("created_at", earliest)
      .is("patch_proposal_id", null)
      .limit(2000);

    const grouped = new Map<
      string,
      { kind: EventKind; source: string; endpoint: string | null; ids: string[] }
    >();
    for (const e of events ?? []) {
      const k = `${e.kind}|${e.source}|${e.endpoint ?? "-"}`;
      const cur = grouped.get(k) ?? {
        kind: e.kind as EventKind,
        source: e.source,
        endpoint: e.endpoint,
        ids: [],
      };
      cur.ids.push(e.id);
      grouped.set(k, cur);
    }

    for (const [, g] of grouped) {
      const t = PATCH_THRESHOLDS[g.kind];
      if (!t || g.ids.length < t.count) continue;

      const moduleLabel = `${g.kind} @ ${g.source}`;
      const vulnerability = humanizeKind(g.kind);
      const taskTitle = `${vulnerability} on ${moduleLabel}`;

      // Skip if a recent pending/approved sec proposal already exists for same module.
      const dupSince = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabaseAdmin
        .from("agent_proposals")
        .select("id")
        .eq("agent_slug", "sec")
        .eq("payload_kind", "security_patch")
        .eq("task", taskTitle)
        .gte("created_at", dupSince)
        .in("status", ["pending", "approved"])
        .maybeSingle();
      if (existing) continue;

      const patchMarkdown = suggestedPatchFor(g.kind, g.source, g.endpoint, g.ids.length);
      const { data: proposal, error: insErr } = await supabaseAdmin
        .from("agent_proposals")
        .insert({
          agent_slug: "sec",
          source: "zero_trust_monitor",
          requested_by: "zero_trust_monitor",
          task: taskTitle,
          plan_summary: patchMarkdown,
          payload_kind: "security_patch",
          status: "pending",
          payload: {
            module: moduleLabel,
            file_path: g.endpoint,
            vulnerability_type: vulnerability,
            threat_level: t.severity,
            root_cause: `${g.ids.length} matching events in last ${t.window_min} min on ${g.source}${g.endpoint ? ` (endpoint ${g.endpoint})` : ""}.`,
            impact: impactFor(g.kind),
            patch_language: "markdown",
            patch_code: patchMarkdown,
          },
        })
        .select("id")
        .single();
      if (insErr || !proposal) continue;

      summary.patches_queued += 1;
      await supabaseAdmin
        .from("security_events")
        .update({ patch_proposal_id: proposal.id })
        .in("id", g.ids);
    }
  } catch (e) {
    console.error("[zero-trust] patch queue failed", e);
  }

  summary.duration_ms = Date.now() - started;

  try {
    await supabaseAdmin.from("security_scan_runs").insert({
      trigger,
      events_detected: summary.events_detected,
      patches_queued: summary.patches_queued,
      summary,
      duration_ms: summary.duration_ms,
    });
  } catch (e) {
    console.error("[zero-trust] scan run insert failed", e);
  }

  return summary;
}

function humanizeKind(k: EventKind): string {
  return {
    session_integrity: "Session integrity violation",
    parameter_tampering: "Client parameter tampering",
    file_magic_byte_mismatch: "File upload magic-byte mismatch",
    api_token_misuse: "Third-party API token misuse",
    rate_anomaly: "Rate / brute-force anomaly",
    rls_bypass_attempt: "RLS bypass attempt",
    webhook_signature_failure: "Webhook signature failure",
    auth_brute_force: "Auth brute-force pattern",
  }[k];
}

function impactFor(k: EventKind): string {
  return {
    session_integrity: "Authenticated requests may be replayed or hijacked.",
    parameter_tampering: "Order totals, prices or IDs may be manipulated by the client.",
    file_magic_byte_mismatch: "Disguised executable / polyglot uploads can bypass MIME checks.",
    api_token_misuse: "Leaked or misused 3rd-party API key — potential financial impact.",
    rate_anomaly: "Brute-force, scraping, or denial-of-service attempt against the API.",
    rls_bypass_attempt: "Possible direct RLS bypass — sensitive data at risk.",
    webhook_signature_failure: "Spoofed webhook traffic, possibly fraudulent payment events.",
    auth_brute_force: "Credential stuffing / password spraying against user accounts.",
  }[k];
}

function suggestedPatchFor(
  kind: EventKind,
  source: string,
  endpoint: string | null,
  count: number,
): string {
  const where = endpoint ? `endpoint \`${endpoint}\`` : `source \`${source}\``;
  return [
    `Detected **${count}** \`${kind}\` events on ${where} within the rolling window.`,
    "",
    "Suggested defense actions (require CEO approval):",
    "",
    suggestionList(kind)
      .map((s) => `- ${s}`)
      .join("\n"),
    "",
    "_Auto-queued by zero-trust monitor. Apply via the Security Alerts dashboard or Telegram `/approve <id>`._",
  ].join("\n");
}

function suggestionList(kind: EventKind): string[] {
  switch (kind) {
    case "auth_brute_force":
    case "rate_anomaly":
      return [
        "Add per-IP and per-account rate limiting at the affected endpoint.",
        "Force MFA on the targeted accounts until activity normalizes.",
        "Temporarily block offending IPs at the edge.",
      ];
    case "api_token_misuse":
      return [
        "Rotate the affected third-party API key (Meta / Google Ads / bKash / Binance / CJ / Resend / R2).",
        "Audit recent api_call_logs for that key_id and revoke if leak confirmed.",
        "Restrict the key's allowed origins / IP allowlist where supported.",
      ];
    case "file_magic_byte_mismatch":
      return [
        "Reject any upload whose detected magic bytes differ from claimed MIME.",
        "Enforce verifyFileMagicBytes() server-side on every upload endpoint.",
        "Quarantine recently uploaded files matching the mismatched signature.",
      ];
    case "parameter_tampering":
      return [
        "Re-derive critical values (price, totals, resource_id) server-side instead of trusting the client.",
        "Sign sensitive parameters via signParams() and reject on verifyParams() failure.",
      ];
    case "rls_bypass_attempt":
      return [
        "Review the affected table's RLS policies — ensure every read/write path is scoped to auth.uid().",
        "Audit usage of supabaseAdmin / service_role and confirm callers are server-only.",
      ];
    case "webhook_signature_failure":
      return [
        "Enforce HMAC verification with timing-safe compare on the webhook route.",
        "Rotate the webhook signing secret with the provider.",
      ];
    case "session_integrity":
      return [
        "Invalidate sessions failing verifySessionClaims (exp / iss / aud mismatch).",
        "Force re-authentication for the affected users.",
      ];
    default:
      return ["Investigate the affected source and tighten zero-trust checks."];
  }
}
