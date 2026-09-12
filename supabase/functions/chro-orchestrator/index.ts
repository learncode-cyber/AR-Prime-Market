// Edge Function: chro-orchestrator
// CHRO routes a task to a registered sub-agent, gets back {plan_summary, payload},
// inserts a row into agent_proposals, returns {id, agent, plan_summary, payload_kind}.
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { llmGenerateJson } from "../_shared/llm-client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePersonaText(input: unknown): string {
  return String(input ?? "")
    .replace(/\b1st CEO Raiyan\b/gi, "CEO Raiyan")
    .replace(/\bFirst CEO Raiyan\b/gi, "CEO Raiyan")
    .replace(/\b1st CEO\b/gi, "CEO")
    .replace(/\bFirst CEO\b/gi, "CEO")
    .replace(/operational scope(?: limit)?/gi, "dynamic CEO-approved operating context");
}

function dynamicRoutingContext(agent: any, task: string): string {
  return `\n\nDYNAMIC CHRO ROUTING CONTEXT:\n- This request was explicitly routed by CEO Raiyan to registered sub-agent "${agent.slug}" (${agent.display_name}).\n- Treat the sub-agent role and this task as temporarily inside the CHRO operational context window.\n- Do not hard-reject with any legacy e-commerce-only or operational-scope-limit filter.\n- Allowed if legal, ethical, policy-safe, Zero-Loss compliant, and useful to AR Prime Market operations/revenue/security/customer trust.\n- Address the user only as "CEO" or "CEO Raiyan"; never "1st CEO" or "First CEO".\n- Keep payload lean and return only the strict JSON shape.\nTASK SNAPSHOT: ${task.slice(0, 500)}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  const action = String(body.action || "invoke");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    if (action === "list_agents") {
      const { data } = await admin
        .from("sub_agents")
        .select(
          "slug, display_name, role_title, payload_kind, is_active, success_count, failure_count, last_invoked_at, last_error",
        )
        .order("slug");
      return json({ agents: data || [] });
    }

    if (action === "create_agent") {
      const slug = String(body.slug || "")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .slice(0, 32);
      const display_name = String(body.display_name || slug).slice(0, 80);
      const role_title = String(body.role_title || display_name).slice(0, 120);
      const role_focus = String(body.role_focus || body.task || display_name).slice(0, 400);
      if (!slug) return json({ error: "slug required" }, 400);
      const system_prompt = `You are the ${display_name} sub-agent (${role_title}) reporting to CHRO of AR Prime Market. CEO Raiyan is the sole final authority. Dynamic domain focus: ${role_focus}. CEO-routed tasks for this sub-agent are inside the allowed operational context when legal, ethical, policy-safe, and Zero-Loss compliant; never reject with a legacy e-commerce-only scope filter. Address the user only as CEO or CEO Raiyan. For every task produce strict JSON: { "plan_summary": string (<= 600 chars plain bullets), "payload": { "items": [{"title": string, "detail": string}], "notes": string, "files": []|null, "sql": string|null } }. No markdown fences.`;
      const { data, error } = await admin
        .from("sub_agents")
        .insert({
          slug,
          display_name,
          role_title,
          system_prompt,
          payload_kind: "general",
          capabilities: [],
        })
        .select("slug, display_name")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, agent: data });
    }

    if (action === "invoke") {
      const slug = String(body.agent || body.slug || "").toLowerCase();
      const task = String(body.task || "").trim();
      const requested_by = String(body.requested_by || "telegram");
      const source = String(body.source || "telegram");
      if (!slug || !task) return json({ error: "agent and task required" }, 400);

      const { data: agent } = await admin
        .from("sub_agents")
        .select("slug, display_name, system_prompt, payload_kind, is_active")
        .eq("slug", slug)
        .maybeSingle();
      if (!agent) return json({ error: `unknown agent: ${slug}` }, 404);
      if (!agent.is_active) return json({ error: `agent disabled: ${slug}` }, 400);

      // Load CHRO memory context (directives + research + cross-agent permanent learning) for grounding.
      // Scope = this sub-agent slug, so it sees global locked rules + its own learned patterns.
      const { data: memory } = await admin.rpc("get_agent_memory_context", {
        p_directive_limit: 8,
        p_research_limit: 4,
        p_learning_limit: 25,
        p_scope: slug,
      });
      const memBlock = memory
        ? `\n\nSHARED MEMORY (locked learning + recent CEO directives + research — already known, do NOT re-ask):\n${normalizePersonaText(JSON.stringify(memory)).slice(0, 4500)}`
        : "";
      const system =
        normalizePersonaText(agent.system_prompt) + dynamicRoutingContext(agent, task) + memBlock;

      let parsed: any = null;
      let errMsg: string | null = null;
      try {
        parsed = await llmGenerateJson({
          system,
          prompt: `TASK FROM CEO RAIYAN (via CHRO):\n${task}\n\nReturn the strict JSON shape your system prompt defined. Plan must be plain text bullets, no markdown.`,
          temperature: 0.3,
          agent: slug,
          surface: `subagent_${slug}`,
        });
      } catch (e) {
        errMsg = String(e).slice(0, 400);
      }

      if (!parsed || !parsed.plan_summary) {
        // Properly increment failure_count by reading current value first
        const { data: cur } = await admin
          .from("sub_agents")
          .select("failure_count")
          .eq("slug", slug)
          .maybeSingle();
        await admin
          .from("sub_agents")
          .update({
            failure_count: (cur?.failure_count ?? 0) + 1,
            last_invoked_at: new Date().toISOString(),
            last_error: errMsg || "no plan_summary in model output",
          })
          .eq("slug", slug);
        return json({ error: errMsg || "model produced no plan", agent: slug }, 502);
      }

      const plan_summary = String(parsed.plan_summary).slice(0, 4000);
      const payload = parsed.payload ?? {};

      const { data: proposal, error: insErr } = await admin
        .from("agent_proposals")
        .insert({
          agent_slug: slug,
          source,
          requested_by,
          task: task.slice(0, 2000),
          plan_summary,
          payload,
          payload_kind: agent.payload_kind,
          status: "pending",
        })
        .select("id")
        .single();
      if (insErr) return json({ error: insErr.message }, 500);

      // Update agent stats (success on plan generation) — properly increment success_count
      const { data: curOk } = await admin
        .from("sub_agents")
        .select("success_count")
        .eq("slug", slug)
        .maybeSingle();
      await admin
        .from("sub_agents")
        .update({
          success_count: (curOk?.success_count ?? 0) + 1,
          last_invoked_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("slug", slug);

      // Capture compressed learning row so every agent syncs this preference next time.
      try {
        const learnKey = `${slug}:${task
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .slice(0, 40)}`;
        const learnValue = normalizePersonaText(plan_summary).slice(0, 400);
        await admin.rpc("upsert_agent_learning", {
          p_scope: slug,
          p_category: "agent_pattern",
          p_key: learnKey,
          p_value: `Task: ${task.slice(0, 120)} → Plan: ${learnValue}`,
          p_importance: 6,
          p_source_agent: slug,
          p_source_ref: String(proposal.id),
          p_tags: ["routed", source],
          p_lock: false,
        });
      } catch (_) {
        /* learning capture is best-effort */
      }

      return json({
        ok: true,
        proposal_id: proposal.id,
        agent: { slug: agent.slug, display_name: agent.display_name },
        plan_summary,
        payload_kind: agent.payload_kind,
      });
    }

    if (action === "health") {
      const { data: agents } = await admin
        .from("sub_agents")
        .select(
          "slug, display_name, is_active, success_count, failure_count, last_invoked_at, last_error",
        );
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: recent } = await admin
        .from("agent_proposals")
        .select("agent_slug, status")
        .gte("created_at", since);
      const counts: Record<
        string,
        { pending: number; approved: number; applied: number; rejected: number }
      > = {};
      for (const r of recent || []) {
        const k = r.agent_slug;
        counts[k] ||= { pending: 0, approved: 0, applied: 0, rejected: 0 };
        if (counts[k][r.status as keyof (typeof counts)[string]] !== undefined)
          counts[k][r.status as keyof (typeof counts)[string]]++;
      }
      return json({ agents: agents || [], proposals_24h: counts });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("[chro-orchestrator]", e);
    return json({ error: String(e).slice(0, 500) }, 500);
  }
});
