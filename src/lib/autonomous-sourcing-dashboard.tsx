import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  runAutonomousSourcing,
  approvePending,
  rejectPending,
} from "@/lib/autonomous-sourcing.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Bot, Sparkles, CheckCircle2, XCircle, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";

type PendingRow = {
  id: string;
  source_provider: string;
  source_product_id: string;
  source_url: string | null;
  preview: any;
  audit: any;
  brief: any;
  suggested_markup_pct: number;
  status: "pending" | "approved" | "rejected" | "failed";
  telegram_chat_id: string | null;
  telegram_message_id: number | null;
  approved_product_id: string | null;
  error_message: string | null;
  created_at: string;
};

export function AutonomousSourcingDashboard() {
  const [niche, setNiche] = useState("");
  const [count, setCount] = useState(3);
  const [running, setRunning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const runFn = useServerFn(runAutonomousSourcing);
  const approveFn = useServerFn(approvePending);
  const rejectFn = useServerFn(rejectPending);

  const {
    data: pending,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["pending-product-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_product_approvals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data || []) as PendingRow[];
    },
    refetchInterval: 15000,
  });

  // Realtime: refresh on any change to the queue
  useEffect(() => {
    const channel = supabase
      .channel("pending-approvals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_product_approvals" },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const runPipeline = async () => {
    setRunning(true);
    try {
      toast.loading("Trend Hunter brainstorming…", { id: "auto-src" });
      const res = await runFn({ data: { niche: niche.trim() || undefined, count } });
      toast.success(
        `Queued ${res.queued.length}/${res.briefs_count} · ${res.errors.length} skipped`,
        { id: "auto-src" },
      );
      if (res.errors.length) {
        console.warn("[autonomous-sourcing] skipped", res.errors);
      }
      refetch();
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Pipeline failed", {
        id: "auto-src",
      });
    }
    setRunning(false);
  };

  const onApprove = async (id: string) => {
    setBusyId(id);
    try {
      const r = await approveFn({ data: { id } });
      toast.success(r.already ? "Already approved" : `Imported → /${r.slug}`);
      refetch();
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Approve failed");
    }
    setBusyId(null);
  };

  const onReject = async (id: string) => {
    setBusyId(id);
    try {
      await rejectFn({ data: { id } });
      toast.success("Rejected");
      refetch();
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Reject failed");
    }
    setBusyId(null);
  };

  const pendingOnly = (pending || []).filter((r) => r.status === "pending");
  const history = (pending || []).filter((r) => r.status !== "pending").slice(0, 12);

  return (
    <div className="space-y-4">
      <Card className="border-2 border-violet-500/40 bg-gradient-to-br from-violet-50/40 to-indigo-50/40 dark:from-violet-950/20 dark:to-indigo-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="w-5 h-5 text-violet-600" /> Autonomous Sourcing Pipeline
            <Badge variant="outline" className="ml-auto text-[10px]">
              Trend Hunter → CJ → Auditor → Approval Queue
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2">
            <div>
              <Label className="text-xs">Niche focus (optional)</Label>
              <Input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. eco/energy, TikTok viral, daily problem solvers"
                className="h-10 bg-background"
                disabled={running}
              />
            </div>
            <div>
              <Label className="text-xs">Briefs</Label>
              <Input
                type="number"
                min={1}
                max={6}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(6, +e.target.value || 1)))}
                className="h-10 bg-background"
                disabled={running}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={runPipeline}
                disabled={running}
                className="h-10 w-full md:w-auto bg-violet-600 hover:bg-violet-700 text-white font-semibold"
              >
                {running ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running pipeline…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" /> Run Autonomous Sourcing
                  </>
                )}
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Agent 1 generates winning briefs → Agent 2 searches CJ, audits suppliers, polishes copy
            and drops the result into the
            <b> Pending Crew Approval</b> queue below. A summary card with <b>Approve</b> /{" "}
            <b>Reject</b> buttons is also sent to Telegram.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Pending Crew Approval
            <Badge variant="secondary">{pendingOnly.length}</Badge>
            {isFetching && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {!pendingOnly.length ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Queue is empty. Run the pipeline above to source new products.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {pendingOnly.map((row) => (
                <PendingCard
                  key={row.id}
                  row={row}
                  busy={busyId === row.id}
                  onApprove={() => onApprove(row.id)}
                  onReject={() => onReject(row.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Recent decisions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {history.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-2 text-xs py-1 border-b border-border/40 last:border-0"
              >
                <StatusBadge status={row.status} />
                <span className="truncate flex-1">
                  {
                    (row.audit?.polished_title ||
                      row.preview?.title ||
                      row.source_product_id) as string
                  }
                </span>
                {row.approved_product_id && (
                  <Badge variant="outline" className="text-[9px]">
                    imported
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: PendingRow["status"] }) {
  if (status === "approved")
    return (
      <Badge className="bg-emerald-600 text-white">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        approved
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge variant="outline">
        <XCircle className="w-3 h-3 mr-1" />
        rejected
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge variant="destructive">
        <AlertTriangle className="w-3 h-3 mr-1" />
        failed
      </Badge>
    );
  return <Badge variant="secondary">pending</Badge>;
}

function PendingCard({
  row,
  busy,
  onApprove,
  onReject,
}: {
  row: PendingRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const a = row.audit || {};
  const p = row.preview || {};
  const title = a.polished_title || p.title || "—";
  const cost = Number(p.price) || 0;
  const markup = Number(row.suggested_markup_pct) || 80;
  const retail = +(cost * (1 + markup / 100)).toFixed(2);
  const score = Number(a.supplier_score) || 0;
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex gap-3">
        {p.images?.[0] && (
          <img
            src={p.images[0]}
            alt=""
            className="w-20 h-20 rounded-lg object-cover border border-border flex-shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold line-clamp-2">{title}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="outline" className="text-[9px]">
              ${cost.toFixed(2)} cost
            </Badge>
            <Badge className="text-[9px] bg-violet-600 text-white">${retail} retail</Badge>
            <Badge variant="secondary" className="text-[9px]">
              +{markup}%
            </Badge>
            <Badge variant={score >= 70 ? "default" : "outline"} className="text-[9px]">
              {score}/100
            </Badge>
          </div>
        </div>
      </div>
      {Array.isArray(a.warehouses) && a.warehouses.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          📦 {a.warehouses.join(", ")} · {a.shipping_notes || ""}
        </p>
      )}
      {Array.isArray(a.risk_flags) && a.risk_flags.length > 0 && (
        <Alert className="py-1.5 px-2">
          <AlertTriangle className="h-3 w-3" />
          <AlertDescription className="text-[10px]">{a.risk_flags.join(", ")}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Badge variant="outline" className="text-[9px]">
          {row.source_provider.toUpperCase()} {row.source_product_id}
        </Badge>
        {row.telegram_message_id && (
          <Badge variant="outline" className="text-[9px]">
            <Send className="w-2.5 h-2.5 mr-1" />
            telegram
          </Badge>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={busy}
          onClick={onApprove}
        >
          {busy ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
            </>
          )}
        </Button>
        <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={onReject}>
          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
        </Button>
      </div>
    </div>
  );
}
