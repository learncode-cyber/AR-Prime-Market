import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Activity,
  AlertCircle,
  Plus,
  Play,
  Pause,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/kali_master/cron-jobs")({
  component: CronJobsPage,
});

type RunDetail = {
  runid: number;
  status: string;
  return_message: string | null;
  start_time: string;
  end_time: string | null;
};

type CronJobRow = {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command: string;
  last_run: RunDetail | null;
  history: RunDetail[] | null;
  stats_24h: { success: number; failed: number; total: number } | null;
};

const SCHEDULE_PRESETS: { label: string; value: string }[] = [
  { label: "Every 1 minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 2 hours", value: "0 */2 * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Daily (midnight UTC)", value: "0 0 * * *" },
  { label: "Daily at 9 AM UTC", value: "0 9 * * *" },
  { label: "Weekly (Sun midnight)", value: "0 0 * * 0" },
  { label: "Custom", value: "custom" },
];

function buildHttpCommand(url: string, body: string) {
  const safeUrl = url.trim().replace(/'/g, "''");
  const safeBody = (body || "{}").trim().replace(/'/g, "''");
  return `select net.http_post(
    url:='${safeUrl}',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='${safeBody}'::jsonb
  ) as request_id;`;
}

function nextRunEstimate(schedule: string, from: Date = new Date()): Date | null {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, mon, dow] = parts;
  const next = new Date(from.getTime());
  next.setSeconds(0, 0);

  if (min === "*" && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    next.setMinutes(next.getMinutes() + 1);
    return next;
  }
  const everyN = min.match(/^\*\/(\d+)$/);
  if (everyN && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    const n = parseInt(everyN[1], 10);
    const cur = next.getMinutes();
    const add = n - (cur % n);
    next.setMinutes(cur + add);
    return next;
  }
  if (min === "0" && hour === "*") {
    next.setHours(next.getHours() + 1);
    next.setMinutes(0);
    return next;
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === "*" && mon === "*" && dow === "*") {
    next.setHours(parseInt(hour, 10), parseInt(min, 10), 0, 0);
    if (next <= from) next.setDate(next.getDate() + 1);
    return next;
  }
  return null;
}

function StatusBadge({ status }: { status: string | undefined }) {
  if (!status) return <Badge variant="outline">No runs yet</Badge>;
  if (status === "succeeded") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Success
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30">
        <XCircle className="w-3 h-3 mr-1" /> Failed
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}

function fmt(ts: string | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function relative(ts: string | null | undefined) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const m = Math.floor(abs / 60000);
  if (m < 1) return future ? "in <1m" : "just now";
  if (m < 60) return future ? `in ${m}m` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return future ? `in ${h}h` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return future ? `in ${d}d` : `${d}d ago`;
}

type JobFormState = {
  jobname: string;
  presetKey: string;
  schedule: string;
  mode: "url" | "sql";
  url: string;
  body: string;
  command: string;
};

function emptyForm(): JobFormState {
  return {
    jobname: "",
    presetKey: "0 * * * *",
    schedule: "0 * * * *",
    mode: "url",
    url: "",
    body: "{}",
    command: "",
  };
}

function JobDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isSaving,
  title,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: JobFormState;
  onSubmit: (form: JobFormState) => void;
  isSaving: boolean;
  title: string;
}) {
  const [form, setForm] = useState<JobFormState>(initial);

  // reset form when dialog opens with new initial values
  useMemo(() => {
    if (open) setForm(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const update = <K extends keyof JobFormState>(k: K, v: JobFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-xs">
            Schedules run on the Supabase pg_cron server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="jobname">Job Name</Label>
            <Input
              id="jobname"
              placeholder="e.g. ad-performance-monitor-2h"
              value={form.jobname}
              onChange={(e) => update("jobname", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Schedule Preset</Label>
            <Select
              value={form.presetKey}
              onValueChange={(v) => {
                update("presetKey", v);
                if (v !== "custom") update("schedule", v);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}{" "}
                    {p.value !== "custom" && (
                      <span className="text-xs text-muted-foreground ml-2 font-mono">
                        {p.value}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="schedule">Cron Expression</Label>
            <Input
              id="schedule"
              className="font-mono"
              placeholder="0 0 * * *"
              value={form.schedule}
              onChange={(e) => update("schedule", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Standard 5-field cron syntax (UTC).</p>
          </div>

          <div className="space-y-1.5">
            <Label>Action Target</Label>
            <Select value={form.mode} onValueChange={(v) => update("mode", v as "url" | "sql")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="url">HTTP POST (edge function / API endpoint)</SelectItem>
                <SelectItem value="sql">Custom SQL command</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.mode === "url" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="url">Endpoint URL</Label>
                <Input
                  id="url"
                  placeholder="https://arprimemarket.shop/api/public/cron/your-task"
                  value={form.url}
                  onChange={(e) => update("url", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="body">Request Body (JSON)</Label>
                <Textarea
                  id="body"
                  rows={3}
                  className="font-mono text-xs"
                  value={form.body}
                  onChange={(e) => update("body", e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="command">SQL Command</Label>
              <Textarea
                id="command"
                rows={5}
                className="font-mono text-xs"
                placeholder="select your_function();"
                value={form.command}
                onChange={(e) => update("command", e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(form)} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save Job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CronJobsPage() {
  const qc = useQueryClient();
  const projectRef = "vwnxnpgujxtomkxdxuvg";
  const supabaseLogsBase = `https://supabase.com/dashboard/project/${projectRef}`;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["cron-jobs-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cron_jobs_status" as never);
      if (error) throw error;
      return (data as unknown as CronJobRow[]) ?? [];
    },
    refetchInterval: 30000,
  });

  const summary = useMemo(() => {
    const jobs = data ?? [];
    let success = 0,
      failed = 0,
      total = 0;
    for (const j of jobs) {
      success += j.stats_24h?.success ?? 0;
      failed += j.stats_24h?.failed ?? 0;
      total += j.stats_24h?.total ?? 0;
    }
    return { jobs: jobs.length, success, failed, total };
  }, [data]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editJob, setEditJob] = useState<CronJobRow | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["cron-jobs-status"] });

  const upsertMut = useMutation({
    mutationFn: async (f: JobFormState) => {
      if (!f.jobname.trim()) throw new Error("Job name required");
      if (!f.schedule.trim()) throw new Error("Schedule required");
      const command = f.mode === "url" ? buildHttpCommand(f.url, f.body) : f.command;
      if (!command.trim()) throw new Error("Command required");
      const { data, error } = await supabase.rpc(
        "admin_upsert_cron_job" as never,
        {
          p_jobname: f.jobname.trim(),
          p_schedule: f.schedule.trim(),
          p_command: command,
        } as never,
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Job saved");
      setCreateOpen(false);
      setEditJob(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (jobname: string) => {
      const { error } = await supabase.rpc(
        "admin_delete_cron_job" as never,
        {
          p_jobname: jobname,
        } as never,
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ jobname, active }: { jobname: string; active: boolean }) => {
      const { error } = await supabase.rpc(
        "admin_set_cron_job_active" as never,
        {
          p_jobname: jobname,
          p_active: active,
        } as never,
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.active ? "Resumed" : "Paused");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const triggerMut = useMutation({
    mutationFn: async (jobname: string) => {
      const { error } = await supabase.rpc(
        "admin_trigger_cron_job" as never,
        {
          p_jobname: jobname,
        } as never,
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Triggered — check logs in a few seconds");
      setTimeout(invalidate, 2000);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(job: CronJobRow) {
    const preset = SCHEDULE_PRESETS.find((p) => p.value === job.schedule);
    setEditJob(job);
    void preset;
  }

  function editInitial(job: CronJobRow): JobFormState {
    const preset = SCHEDULE_PRESETS.find((p) => p.value === job.schedule);
    return {
      jobname: job.jobname,
      presetKey: preset ? preset.value : "custom",
      schedule: job.schedule,
      mode: "sql",
      url: "",
      body: "{}",
      command: job.command,
    };
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" /> Cron Jobs Monitor
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage scheduled jobs, trigger runs manually, and inspect history.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" /> Add New Cron Job
              </Button>
            </DialogTrigger>
            {createOpen && (
              <JobDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                initial={emptyForm()}
                onSubmit={(f) => upsertMut.mutate(f)}
                isSaving={upsertMut.isPending}
                title="Add New Cron Job"
              />
            )}
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total Jobs</div>
            <div className="text-2xl font-bold">{summary.jobs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Runs (24h)</div>
            <div className="text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Succeeded (24h)</div>
            <div className="text-2xl font-bold text-emerald-600">{summary.success}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Failed (24h)</div>
            <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 flex items-start gap-2 text-destructive">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <div className="font-medium">Failed to load cron status</div>
              <div className="text-sm">{(error as Error).message}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <div className="text-muted-foreground">Loading…</div>}

      <div className="space-y-4">
        {(data ?? []).map((job) => {
          const next = job.active ? nextRunEstimate(job.schedule) : null;
          const busy =
            (toggleMut.isPending && toggleMut.variables?.jobname === job.jobname) ||
            (triggerMut.isPending && triggerMut.variables === job.jobname) ||
            (deleteMut.isPending && deleteMut.variables === job.jobname);

          return (
            <Card key={job.jobid}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-mono">{job.jobname}</CardTitle>
                    {job.active ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-500/40">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Paused
                      </Badge>
                    )}
                  </div>
                  <StatusBadge status={job.last_run?.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Schedule (cron)</div>
                    <div className="font-mono">{job.schedule}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Last Run
                    </div>
                    <div>
                      {fmt(job.last_run?.start_time)}{" "}
                      <span className="text-muted-foreground">
                        ({relative(job.last_run?.start_time)})
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Next Run (est.)
                    </div>
                    <div>
                      {next ? `${fmt(next.toISOString())} (${relative(next.toISOString())})` : "—"}
                    </div>
                  </div>
                </div>

                {job.stats_24h && (
                  <div className="flex gap-4 text-xs">
                    <span className="text-emerald-600">✓ {job.stats_24h.success} success</span>
                    <span className="text-red-600">✗ {job.stats_24h.failed} failed</span>
                    <span className="text-muted-foreground">total {job.stats_24h.total} (24h)</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => triggerMut.mutate(job.jobname)}
                    disabled={busy}
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5" /> Trigger Now
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleMut.mutate({ jobname: job.jobname, active: !job.active })}
                    disabled={busy}
                  >
                    {job.active ? (
                      <>
                        <Pause className="w-3.5 h-3.5 mr-1.5" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 mr-1.5" /> Resume
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(job)}
                    disabled={busy}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => {
                      if (confirm(`Delete cron job "${job.jobname}"?`))
                        deleteMut.mutate(job.jobname);
                    }}
                    disabled={busy}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                  </Button>
                  <a
                    href={`${supabaseLogsBase}/logs/pgcron-logs`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" /> Historical logs
                  </a>
                </div>

                {job.last_run?.status === "failed" && job.last_run.return_message && (
                  <div className="text-xs bg-red-500/10 border border-red-500/20 rounded p-2 text-red-700 dark:text-red-400 font-mono whitespace-pre-wrap break-all max-h-32 overflow-auto">
                    {job.last_run.return_message}
                  </div>
                )}

                {job.history && job.history.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Recent runs ({job.history.length})
                    </summary>
                    <div className="mt-2 space-y-1">
                      {job.history.map((h) => (
                        <div key={h.runid} className="flex items-center gap-2 font-mono">
                          {h.status === "succeeded" ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-600 shrink-0" />
                          )}
                          <span className="text-muted-foreground">{fmt(h.start_time)}</span>
                          <span className="truncate text-muted-foreground">
                            {h.return_message ?? ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Command
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto whitespace-pre-wrap break-all">
                    {job.command}
                  </pre>
                </details>
              </CardContent>
            </Card>
          );
        })}

        {!isLoading && (data ?? []).length === 0 && !error && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No cron jobs scheduled.
            </CardContent>
          </Card>
        )}
      </div>

      {editJob && (
        <JobDialog
          open={!!editJob}
          onOpenChange={(o) => !o && setEditJob(null)}
          initial={editInitial(editJob)}
          onSubmit={(f) => upsertMut.mutate(f)}
          isSaving={upsertMut.isPending}
          title={`Edit: ${editJob.jobname}`}
        />
      )}
    </div>
  );
}
