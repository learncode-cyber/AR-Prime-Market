import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getBlogGenerationLogs } from "@/lib/blog-logs.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, CheckCircle2, XCircle, Clock, Zap, FileText } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

export const Route = createFileRoute("/kali_master/blog-logs")({
  component: BlogLogsPage,
});

type Log = {
  id: string;
  status: "success" | "failed";
  triggered_by: "cron" | "manual";
  keyword: string | null;
  post_id: string | null;
  post_title: string | null;
  post_slug: string | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
};

function BlogLogsPage() {
  const fetchLogs = useServerFn(getBlogGenerationLogs);
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [selected, setSelected] = useState<Log | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["blog-generation-logs", statusFilter],
    queryFn: () => fetchLogs({ data: { limit: 100, status: statusFilter } }),
    refetchInterval: 30000,
  });

  const logs = (data?.logs ?? []) as Log[];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const todayLogs = logs.filter((l) => new Date(l.created_at) >= today);
  const weekLogs = logs.filter((l) => new Date(l.created_at) >= weekAgo);
  const weekSuccess = weekLogs.filter((l) => l.status === "success").length;
  const successRate = weekLogs.length ? Math.round((weekSuccess / weekLogs.length) * 100) : 0;
  const last = logs[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Blog AI Generation Logs</h1>
          <p className="text-sm text-muted-foreground">Daily 4 AM auto-generation & manual runs</p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Today's runs</div>
          <div className="text-2xl font-bold mt-1">{todayLogs.length}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {todayLogs.filter((l) => l.status === "success").length} success ·{" "}
            {todayLogs.filter((l) => l.status === "failed").length} failed
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">7-day success rate</div>
          <div className="text-2xl font-bold mt-1">{successRate}%</div>
          <div className="text-xs text-muted-foreground mt-1">{weekLogs.length} total runs</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Last run</div>
          <div className="text-2xl font-bold mt-1">
            {last ? formatDistanceToNow(new Date(last.created_at), { addSuffix: true }) : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {last ? `${last.status} · ${last.triggered_by}` : "No runs yet"}
          </div>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "success", "failed"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Trigger</th>
                <th className="text-left px-4 py-3">Keyword</th>
                <th className="text-left px-4 py-3">Result</th>
                <th className="text-left px-4 py-3">Duration</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    No logs yet
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>{format(new Date(l.created_at), "MMM d, HH:mm")}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {l.status === "success" ? (
                        <Badge className="bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Success
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/20">
                          <XCircle className="w-3 h-3 mr-1" /> Failed
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-normal">
                        {l.triggered_by === "cron" ? (
                          <>
                            <Clock className="w-3 h-3 mr-1" />
                            Cron 4AM
                          </>
                        ) : (
                          <>
                            <Zap className="w-3 h-3 mr-1" />
                            Manual
                          </>
                        )}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{l.keyword || "—"}</td>
                    <td className="px-4 py-3 max-w-[300px]">
                      {l.status === "success" && l.post_id ? (
                        <div className="flex items-center gap-2">
                          {l.post_slug && (
                            <Link
                              to="/blog/$slug"
                              params={{ slug: l.post_slug }}
                              target="_blank"
                              className="text-primary hover:underline inline-flex items-center gap-1 min-w-0"
                            >
                              <FileText className="w-3 h-3 shrink-0" />
                              <span className="truncate">{l.post_title}</span>
                            </Link>
                          )}
                          <Link
                            to="/kali_master/blog/$id"
                            params={{ id: l.post_id }}
                            className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                          >
                            Edit
                          </Link>
                        </div>
                      ) : (
                        <span className="text-red-600 text-xs line-clamp-1">{l.error_message}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {l.duration_ms ? `${(l.duration_ms / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(l)}>
                        Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Run details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Time" value={format(new Date(selected.created_at), "PPpp")} />
                <Field label="Status" value={selected.status} />
                <Field label="Trigger" value={selected.triggered_by} />
                <Field
                  label="Duration"
                  value={
                    selected.duration_ms ? `${(selected.duration_ms / 1000).toFixed(2)}s` : "—"
                  }
                />
                <Field label="Keyword" value={selected.keyword || "—"} />
                <Field label="Post ID" value={selected.post_id || "—"} />
              </div>
              {selected.status === "success" ? (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Generated post</div>
                  <div className="p-3 rounded-md bg-muted/50">
                    <div className="font-medium">{selected.post_title}</div>
                    {selected.post_slug && (
                      <Link
                        to="/blog/$slug"
                        params={{ slug: selected.post_slug }}
                        target="_blank"
                        className="text-primary hover:underline text-xs"
                      >
                        /blog/{selected.post_slug}
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Error</div>
                  <pre className="p-3 rounded-md bg-red-500/10 text-red-700 text-xs whitespace-pre-wrap break-all">
                    {selected.error_message}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium break-all">{value}</div>
    </div>
  );
}
