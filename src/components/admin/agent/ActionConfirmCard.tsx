import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { executeAgentAction } from "@/lib/agent-actions.functions";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export type AgentAction = {
  type: string;
  label: string;
  reasoning: string;
  payload: Record<string, unknown>;
};

export function ActionConfirmCard({ action }: { action: AgentAction }) {
  const run = useServerFn(executeAgentAction);
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "done"; ok: boolean; message: string }
  >({ kind: "idle" });

  const decide = async (decision: "confirm" | "deny") => {
    setState({ kind: "loading" });
    try {
      const res = await run({
        data: {
          action_type: action.type as never,
          label: action.label,
          reasoning: action.reasoning,
          payload: action.payload,
          decision,
        },
      });
      setState({ kind: "done", ok: res.ok, message: res.result_message });
      if (res.ok) toast.success(res.result_message);
      else toast.warning(res.result_message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setState({ kind: "done", ok: false, message: msg });
      toast.error(msg);
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-border bg-card p-3 space-y-2 w-full">
      <div className="flex items-start gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">
          {action.type.replaceAll("_", " ")}
        </div>
      </div>
      <div className="text-sm font-medium">{action.label}</div>
      <div className="text-xs text-muted-foreground">{action.reasoning}</div>
      {Object.keys(action.payload).length > 0 && (
        <pre className="text-[10px] bg-muted rounded p-2 overflow-x-auto max-h-32">
          {JSON.stringify(action.payload, null, 2)}
        </pre>
      )}

      {state.kind === "done" ? (
        <div
          className={`flex items-center gap-2 text-xs font-medium ${
            state.ok ? "text-green-600" : "text-destructive"
          }`}
        >
          {state.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {state.message}
        </div>
      ) : (
        <div className="flex gap-2 justify-end pt-1">
          <Button
            size="sm"
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={state.kind === "loading"}
            onClick={() => decide("deny")}
          >
            বাতিল
          </Button>
          <Button size="sm" disabled={state.kind === "loading"} onClick={() => decide("confirm")}>
            {state.kind === "loading" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              "নিশ্চিত করো"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
