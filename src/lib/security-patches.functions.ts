// Security patch proposals — backed by the unified public.agent_proposals queue
// (agent_slug='sec', payload_kind='security_patch'). The admin UI's Patch
// shape is preserved by projecting agent_proposals rows back into the legacy
// security_patch_proposal shape from payload fields.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ThreatLevel = z.enum(["low", "medium", "high", "critical"]);
const PatchStatus = z.enum(["pending", "approved", "rejected", "applied"]);

type PatchRow = {
  id: string;
  module: string;
  file_path: string | null;
  vulnerability_type: string;
  threat_level: "low" | "medium" | "high" | "critical";
  root_cause: string;
  impact: string;
  patch_language: string;
  patch_code: string;
  status: "pending" | "approved" | "rejected" | "applied";
  proposed_by: string;
  approval_channel: string | null;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  applied_at: string | null;
};

type AgentProposalRow = {
  id: string;
  status: string;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  applied_at: string | null;
  source: string | null;
  task: string;
  plan_summary: string | null;
  payload: Record<string, unknown> | null;
};

function projectToPatch(row: AgentProposalRow): PatchRow {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    module: String(p.module ?? row.task ?? ""),
    file_path: (p.file_path as string | null) ?? null,
    vulnerability_type: String(p.vulnerability_type ?? row.task ?? "security_finding"),
    threat_level: (p.threat_level as PatchRow["threat_level"]) ?? "medium",
    root_cause: String(p.root_cause ?? ""),
    impact: String(p.impact ?? ""),
    patch_language: String(p.patch_language ?? "markdown"),
    patch_code: String(p.patch_code ?? row.plan_summary ?? ""),
    status: (row.status as PatchRow["status"]) ?? "pending",
    proposed_by: row.source ?? "cyber_security_subagent",
    approval_channel: (p.approval_channel as string | null) ?? null,
    decision_note: row.decision_note,
    created_at: row.created_at,
    decided_at: row.decided_at,
    applied_at: row.applied_at,
  };
}

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listSecurityPatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: PatchStatus.optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<PatchRow[]> => {
    await assertAdmin(context.userId);
    let q = supabaseAdmin
      .from("agent_proposals")
      .select(
        "id, status, decision_note, created_at, decided_at, applied_at, source, task, plan_summary, payload",
      )
      .eq("agent_slug", "sec")
      .eq("payload_kind", "security_patch")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => projectToPatch(r as unknown as AgentProposalRow));
  });

export const proposeSecurityPatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        module: z.string().min(1).max(200),
        file_path: z.string().max(500).optional().nullable(),
        vulnerability_type: z.string().min(1).max(200),
        threat_level: ThreatLevel.default("medium"),
        root_cause: z.string().min(1).max(2000),
        impact: z.string().min(1).max(2000),
        patch_language: z.string().max(40).default("typescript"),
        patch_code: z.string().min(1).max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<PatchRow> => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("agent_proposals")
      .insert({
        agent_slug: "sec",
        source: "cyber_security_subagent",
        requested_by: "cyber_security_subagent",
        task: `${data.vulnerability_type} on ${data.module}`,
        plan_summary: data.patch_code,
        payload_kind: "security_patch",
        status: "pending",
        payload: data,
      })
      .select(
        "id, status, decision_note, created_at, decided_at, applied_at, source, task, plan_summary, payload",
      )
      .single();
    if (error) throw new Error(error.message);
    return projectToPatch(row as unknown as AgentProposalRow);
  });

export const decideSecurityPatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "applied"]),
        note: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<PatchRow> => {
    await assertAdmin(context.userId);
    const nowIso = new Date().toISOString();
    const patch = {
      status: data.decision,
      decision_note: data.note ?? null,
      decided_at: data.decision === "applied" ? null : nowIso,
      applied_at: data.decision === "applied" ? nowIso : null,
    };
    const { data: row, error } = await supabaseAdmin
      .from("agent_proposals")
      .update(patch)
      .eq("id", data.id)
      .eq("agent_slug", "sec")
      .select(
        "id, status, decision_note, created_at, decided_at, applied_at, source, task, plan_summary, payload",
      )
      .single();
    if (error) throw new Error(error.message);
    return projectToPatch(row as unknown as AgentProposalRow);
  });
