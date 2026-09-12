/**
 * ARQ Master OS core (Module 6).
 *
 * Formalizes the existing `kali_master` admin console + `chro-orchestrator`
 * agent network into a real control plane — starting with the biggest
 * concrete gap found: `chro-orchestrator` (see supabase/functions/
 * chro-orchestrator/index.ts) creates rows in `agent_proposals` with
 * status="pending" for its 4 sub-agents (Security, Dev, Marketing, Growth),
 * but NOTHING in the codebase ever read, approved, or rejected them — no
 * admin UI, no other function. The propose → approve → apply workflow the
 * schema was clearly designed for (status: pending/approved/applied/
 * rejected) was only ever half-built.
 *
 * This module builds the "approve/reject" half. It deliberately does NOT
 * build "apply" — see the module doc (docs/architecture/ARQ_MASTER_OS_CORE.md)
 * for why auto-applying a proposal's payload (which can contain full file
 * contents for a "dev" proposal) is out of scope here: that's a
 * code-execution capability with a large blast radius and needs its own
 * careful, separately-approved design, not a rider on this module.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export async function requireAnyRole(
  supabase: unknown,
  userId: string,
  roles: string[],
): Promise<void> {
  const client = supabase as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await client.rpc("get_user_roles", { p_user: userId });
  const userRoles = !error && Array.isArray(data) ? (data as string[]) : [];
  const allowed = roles.some((r) => userRoles.includes(r));
  if (!allowed) {
    throw new Error(`Forbidden: one of these roles is required: ${roles.join(", ")}`);
  }
}

// ---------------------------------------------------------------------------
// Sub-agents (read-only registry view: admin or moderator)
// ---------------------------------------------------------------------------

export const listSubAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAnyRole(supabase, userId, ["admin", "moderator"]);

    const { data, error } = await supabase
      .from("sub_agents")
      .select(
        "id, slug, display_name, role_title, payload_kind, capabilities, is_active, success_count, failure_count, last_invoked_at, last_error, updated_at",
      )
      .order("display_name", { ascending: true });
    if (error) throw new Error(error.message);
    return { agents: data ?? [] };
  });

// ---------------------------------------------------------------------------
// Agent proposals (read: admin or moderator; decide: admin only)
// ---------------------------------------------------------------------------

const ListProposalsInput = z.object({
  status: z.enum(["pending", "approved", "applied", "rejected", "all"]).default("pending"),
  limit: z.number().int().min(1).max(200).default(50),
});

export const listAgentProposals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListProposalsInput.parse(input ?? {}))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    await requireAnyRole(supabase, userId, ["admin", "moderator"]);

    let q = supabase
      .from("agent_proposals")
      .select(
        "id, agent_slug, source, requested_by, task, plan_summary, payload, payload_kind, status, decision_note, decided_at, applied_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(input.limit);
    if (input.status !== "all") q = q.eq("status", input.status);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { proposals: data ?? [] };
  });

const DecideProposalInput = z.object({
  proposalId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(2000).optional(),
});

/**
 * Records an admin decision on a proposal. This ONLY updates the
 * proposal's status/decision metadata — it does not execute, apply, or
 * write anything from the proposal's `payload`. "Approved" means "an admin
 * has reviewed and greenlit this plan," not "this has been carried out."
 * Actually applying a payload (writing files, running SQL, launching a
 * marketing campaign) remains a manual step until a dedicated, carefully
 * scoped "apply" module is built and approved.
 */
export const decideAgentProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DecideProposalInput.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    // Deciding (unlike viewing) is admin-only — moderators can see the
    // queue but not approve/reject business-impacting agent actions.
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      p_user: userId,
      p_role: "admin",
    });
    if (roleErr || !isAdmin) throw new Error("Forbidden: admin role required");

    const { data: existing, error: fetchErr } = await supabase
      .from("agent_proposals")
      .select("id, status")
      .eq("id", input.proposalId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing) throw new Error("Proposal not found");
    if (existing.status !== "pending") {
      throw new Error(`Cannot decide on a proposal that is already "${existing.status}"`);
    }

    const { error } = await supabase
      .from("agent_proposals")
      .update({
        status: input.decision,
        decision_note: input.note ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", input.proposalId);
    if (error) throw new Error(error.message);

    return { ok: true, proposalId: input.proposalId, decision: input.decision };
  });
