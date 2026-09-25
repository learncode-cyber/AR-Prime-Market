import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { listScanHistory } from "@/lib/seo-scan.functions";
import { Sparkline, type SeoRun } from "@/lib/seo-audit-shared";

export const Route = createFileRoute("/kali_master/seo-audit/history")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: HistoryTab,
});

function HistoryTab() {
  const historyFn = useServerFn(listScanHistory);
  const history = useQuery({ queryKey: ["seo-history"], queryFn: () => historyFn() });
  const runs = (history.data?.runs ?? []) as SeoRun[];
  const sparkValues = [...runs].reverse().map((r) => r.score ?? 0);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Score trend (last 30 runs)</h3>
        <Sparkline values={sparkValues} />
      </div>
      <div className="divide-y divide-border">
        {runs.map((r) => (
          <div key={r.id} className="flex items-center gap-3 py-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">{new Date(r.started_at).toLocaleString()}</div>
            <Badge variant="outline" className="capitalize">
              {r.trigger}
            </Badge>
            <span className="text-emerald-500">{r.pass_count}</span>
            <span className="text-amber-500">{r.warn_count}</span>
            <span className="text-destructive">{r.fail_count}</span>
            <span className="font-bold w-10 text-right">{r.score ?? "—"}</span>
          </div>
        ))}
        {runs.length === 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">No runs yet.</div>
        )}
      </div>
    </Card>
  );
}
