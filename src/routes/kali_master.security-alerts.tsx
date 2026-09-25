import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  PlayCircle,
  RefreshCw,
  Activity,
  Radar,
} from "lucide-react";
import { toast } from "sonner";
import { listSecurityPatches, decideSecurityPatch } from "@/lib/security-patches.functions";
import {
  listSecurityEvents,
  listSecurityScanRuns,
  triggerSecurityScan,
  resolveSecurityEvent,
} from "@/lib/security-monitor.functions";

export const Route = createFileRoute("/kali_master/security-alerts")({
  component: SecurityAlertsPage,
  head: () => ({
    meta: [{ title: "Security Alerts — AR Prime Admin" }, { name: "robots", content: "noindex" }],
  }),
});

type Patch = {
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

const threatColor: Record<Patch["threat_level"], string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-blue-500 text-white",
};

const statusColor: Record<Patch["status"], string> = {
  pending: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  approved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  applied: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  rejected: "bg-red-500/15 text-red-700 border-red-500/30",
};

function SecurityAlertsPage() {
  const list = useServerFn(listSecurityPatches);
  const decide = useServerFn(decideSecurityPatch);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "applied" | "rejected" | "all">(
    "pending",
  );

  const query = useQuery({
    queryKey: ["security-patches", tab],
    queryFn: () =>
      list({ data: tab === "all" ? { limit: 100 } : { status: tab, limit: 100 } }) as Promise<
        Patch[]
      >,
  });

  const mutate = useMutation({
    mutationFn: (vars: {
      id: string;
      decision: "approved" | "rejected" | "applied";
      note?: string;
    }) => decide({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(`Patch ${vars.decision}`);
      qc.invalidateQueries({ queryKey: ["security-patches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const rows = query.data ?? [];
    return rows.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [query.data]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-red-500" />
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">Security Alerts</h1>
            <p className="text-sm text-muted-foreground">
              Cyber Security sub-agent queues patches here. CEO approval required before any change
              goes live.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <ZeroTrustMonitor />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="pending">
            Pending {counts.pending ? `(${counts.pending})` : ""}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="applied">Applied</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {query.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {query.isError && (
            <p className="text-sm text-red-500">Error: {(query.error as Error).message}</p>
          )}
          {!query.isLoading && (query.data?.length ?? 0) === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No alerts in this bucket. The Cyber Security sub-agent will queue any detected threats
              here.
            </Card>
          )}
          {(query.data ?? []).map((p) => (
            <PatchCard
              key={p.id}
              patch={p}
              onDecide={(decision, note) => mutate.mutate({ id: p.id, decision, note })}
              loading={mutate.isPending}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PatchCard({
  patch,
  onDecide,
  loading,
}: {
  patch: Patch;
  onDecide: (decision: "approved" | "rejected" | "applied", note?: string) => void;
  loading: boolean;
}) {
  const [note, setNote] = useState("");
  const canDecide = patch.status === "pending";
  const canMarkApplied = patch.status === "approved";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={threatColor[patch.threat_level]}>
              {patch.threat_level.toUpperCase()}
            </Badge>
            <Badge variant="outline" className={statusColor[patch.status]}>
              {patch.status}
            </Badge>
            <span className="text-sm font-medium">{patch.module}</span>
            {patch.file_path && (
              <code className="text-xs text-muted-foreground">{patch.file_path}</code>
            )}
          </div>
          <p className="text-sm">
            <span className="font-medium">{patch.vulnerability_type}</span> — {patch.root_cause}
          </p>
          <p className="text-xs text-muted-foreground">Impact: {patch.impact}</p>
        </div>
        <div className="text-xs text-muted-foreground text-right">
          <div>{new Date(patch.created_at).toLocaleString()}</div>
          <div>by {patch.proposed_by}</div>
        </div>
      </div>

      <details>
        <summary className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground">
          View proposed patch ({patch.patch_language})
        </summary>
        <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
          <code>{patch.patch_code}</code>
        </pre>
      </details>

      {patch.decision_note && (
        <p className="text-xs text-muted-foreground">
          Decision note: {patch.decision_note}
          {patch.approval_channel ? ` (via ${patch.approval_channel})` : ""}
        </p>
      )}

      {(canDecide || canMarkApplied) && (
        <div className="space-y-2 pt-2 border-t">
          <Textarea
            placeholder="Optional note (visible in audit trail)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-16 text-sm"
          />
          <div className="flex gap-2 flex-wrap">
            {canDecide && (
              <>
                <Button
                  size="sm"
                  disabled={loading}
                  onClick={() => onDecide("approved", note || undefined)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={loading}
                  onClick={() => onDecide("rejected", note || undefined)}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
              </>
            )}
            {canMarkApplied && (
              <Button
                size="sm"
                variant="secondary"
                disabled={loading}
                onClick={() => onDecide("applied", note || undefined)}
              >
                <PlayCircle className="h-4 w-4 mr-2" /> Mark applied
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

type Event = {
  id: string;
  kind: string;
  severity: "low" | "medium" | "high" | "critical";
  source: string;
  endpoint: string | null;
  ip_address: string | null;
  details: Record<string, unknown> | null;
  resolved: boolean;
  patch_proposal_id: string | null;
  created_at: string;
};

type ScanRun = {
  id: string;
  trigger: string;
  events_detected: number;
  patches_queued: number;
  duration_ms: number | null;
  created_at: string;
};

const eventThreatColor: Record<Event["severity"], string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-blue-500 text-white",
};

function ZeroTrustMonitor() {
  const listEvents = useServerFn(listSecurityEvents);
  const listRuns = useServerFn(listSecurityScanRuns);
  const trigger = useServerFn(triggerSecurityScan);
  const resolve = useServerFn(resolveSecurityEvent);
  const qc = useQueryClient();

  const events = useQuery({
    queryKey: ["zero-trust", "events"],
    queryFn: () => listEvents({ data: { limit: 30, unresolvedOnly: false } }) as Promise<Event[]>,
    refetchInterval: 30_000,
  });
  const runs = useQuery({
    queryKey: ["zero-trust", "runs"],
    queryFn: () => listRuns({ data: { limit: 5 } }) as Promise<ScanRun[]>,
    refetchInterval: 60_000,
  });

  const scan = useMutation({
    mutationFn: () => trigger({ data: undefined }),
    onSuccess: (s: { events_detected: number; patches_queued: number }) => {
      toast.success(
        `Scan complete: ${s.events_detected} events, ${s.patches_queued} patch(es) queued`,
      );
      qc.invalidateQueries({ queryKey: ["zero-trust"] });
      qc.invalidateQueries({ queryKey: ["security-patches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markResolved = useMutation({
    mutationFn: (id: string) => resolve({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["zero-trust", "events"] }),
  });

  const lastRun = runs.data?.[0];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-emerald-500" />
          <div>
            <h2 className="font-semibold">Zero-Trust Monitor</h2>
            <p className="text-xs text-muted-foreground">
              Real-time session, parameter tampering, magic-byte, and API-token signals.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastRun && (
            <span className="text-xs text-muted-foreground">
              Last scan {new Date(lastRun.created_at).toLocaleTimeString()} ·{" "}
              {lastRun.events_detected} ev · {lastRun.patches_queued} patches
            </span>
          )}
          <Button size="sm" disabled={scan.isPending} onClick={() => scan.mutate()}>
            <Activity className="h-4 w-4 mr-2" /> Run scan now
          </Button>
        </div>
      </div>

      <div className="rounded-md border divide-y max-h-72 overflow-auto">
        {events.isLoading && <p className="p-3 text-sm text-muted-foreground">Loading events…</p>}
        {!events.isLoading && (events.data?.length ?? 0) === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            No anomalies detected yet. The monitor watches sessions, uploads, params, and token
            usage continuously.
          </p>
        )}
        {(events.data ?? []).map((ev) => (
          <div key={ev.id} className="p-3 text-sm flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={eventThreatColor[ev.severity]}>{ev.severity}</Badge>
                <span className="font-medium">{ev.kind}</span>
                <code className="text-xs text-muted-foreground">{ev.source}</code>
                {ev.endpoint && (
                  <code className="text-xs text-muted-foreground">{ev.endpoint}</code>
                )}
                {ev.patch_proposal_id && (
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-700">
                    patch queued
                  </Badge>
                )}
                {ev.resolved && <Badge variant="outline">resolved</Badge>}
              </div>
              {ev.details && Object.keys(ev.details).length > 0 && (
                <code className="text-xs text-muted-foreground break-all">
                  {JSON.stringify(ev.details)}
                </code>
              )}
              <div className="text-xs text-muted-foreground">
                {new Date(ev.created_at).toLocaleString()}
                {ev.ip_address ? ` · ${ev.ip_address}` : ""}
              </div>
            </div>
            {!ev.resolved && (
              <Button
                size="sm"
                variant="ghost"
                disabled={markResolved.isPending}
                onClick={() => markResolved.mutate(ev.id)}
              >
                Mark resolved
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
