import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiAgentSubnav } from "@/components/admin/agent/AiAgentSubnav";
import { runAgentBrain } from "@/lib/agent-brain.functions";

export const Route = createFileRoute("/kali_master/ai-agent/")({
  component: AiAgentBrainPage,
});

function AiAgentBrainPage() {
  const brainFn = useServerFn(runAgentBrain);
  const [lastRun, setLastRun] = useState<Awaited<ReturnType<typeof runAgentBrain>> | null>(null);

  const brain = useMutation({
    mutationFn: () => brainFn(),
    onSuccess: (r) => {
      setLastRun(r);
      toast.success(
        `Brain run: ${r.total} tasks — ${r.auto_executed} auto, ${r.queued} approval-এর জন্য queued`,
      );
    },
    onError: (e: Error) => toast.error(`Brain run failed: ${e.message}`),
  });

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">AI Marketing Agent</h1>
          <p className="text-sm text-muted-foreground">
            AR Prime Market-এর autonomous Marketing Head — confirm করার আগে কিছু execute হবে না।
          </p>
        </div>
        <Button
          onClick={() => brain.mutate()}
          disabled={brain.isPending}
          className="bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:from-purple-700 hover:to-fuchsia-700"
        >
          {brain.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Brain className="w-4 h-4 mr-2" />
          )}
          {brain.isPending ? "Store state analyse করছে…" : "🧠 Run Agent Brain"}
        </Button>
      </div>

      <AiAgentSubnav />

      {lastRun ? (
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <Badge variant="outline" className="font-mono">
              Total: {lastRun.total}
            </Badge>
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
              ✓ Auto-executed: {lastRun.auto_executed}
            </Badge>
            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">
              ⏳ Approval queue: {lastRun.queued}
            </Badge>
            {lastRun.failed > 0 && <Badge variant="destructive">✗ Failed: {lastRun.failed}</Badge>}
          </div>
          <ul className="space-y-1.5 text-sm">
            {lastRun.tasks.map((t, i) => (
              <li key={i} className="flex items-start gap-2 border-l-2 border-border pl-2 py-1">
                <span
                  className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                    t.status === "completed"
                      ? "bg-emerald-500/15 text-emerald-600"
                      : t.status === "proposed"
                        ? "bg-amber-500/15 text-amber-600"
                        : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {t.priority}
                </span>
                <div className="flex-1">
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.task_type} · {t.status}
                    {t.result ? ` — ${t.result}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="p-6 text-sm text-muted-foreground">
          "Run Agent Brain" click করুন — store state analyse করে tasks propose হবে। সাইডবার থেকে
          Push / Email / Schedule / Chat tab গুলো access করুন।
        </Card>
      )}
    </div>
  );
}
