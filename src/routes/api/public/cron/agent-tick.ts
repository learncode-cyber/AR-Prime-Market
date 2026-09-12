import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { executeAgentActionInternal, type AgentActionType } from "@/lib/agent-executor.server";
import { withGateway } from "@/lib/gateway";

// Runs every minute via pg_cron. Picks up scheduled agent_tasks
// whose scheduled_at <= now() and executes them.
// Migrated to the API Gateway (Module 2) — see docs/architecture/API_GATEWAY.md.
export const Route = createFileRoute("/api/public/cron/agent-tick")({
  server: {
    handlers: {
      POST: withGateway({ routeName: "cron.agent-tick", auth: "cron" }, async () => {
        const nowIso = new Date().toISOString();
        const { data: due } = await supabaseAdmin
          .from("agent_tasks")
          .select("id, task_type, payload, attempts")
          .eq("status", "scheduled")
          .lte("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: true })
          .limit(25);

        interface DueAgentTask {
          id: string;
          task_type: string;
          payload: unknown;
          attempts: number | null;
        }
        const results: Array<{ id: string; ok: boolean; message: string }> = [];
        for (const t of (due ?? []) as DueAgentTask[]) {
          try {
            const msg = await executeAgentActionInternal(
              t.task_type as AgentActionType,
              (t.payload as Record<string, unknown>) ?? {},
            );
            await supabaseAdmin
              .from("agent_tasks")
              .update({
                status: "completed",
                executed_at: new Date().toISOString(),
                result: { decision: "scheduled", message: msg },
              } as never)
              .eq("id", t.id);
            results.push({ id: t.id, ok: true, message: msg });
          } catch (err: unknown) {
            const attempts = (t.attempts ?? 0) + 1;
            const failed = attempts >= 3;
            await supabaseAdmin
              .from("agent_tasks")
              .update({
                status: failed ? "failed" : "scheduled",
                attempts,
                last_error: err instanceof Error ? err.message : String(err),
                scheduled_at: failed ? null : new Date(Date.now() + 5 * 60_000).toISOString(),
              } as never)
              .eq("id", t.id);
            results.push({
              id: t.id,
              ok: false,
              message: err instanceof Error ? err.message : String(err),
            });
          }
        }

        return new Response(JSON.stringify({ processed: results.length, results }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    },
  },
});
