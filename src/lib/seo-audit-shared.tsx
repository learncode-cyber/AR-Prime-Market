import { CheckCircle2, AlertTriangle, XCircle, Clock, RotateCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const sevIcon = (s: string) => {
  if (s === "pass") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (s === "warn") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <XCircle className="w-4 h-4 text-destructive" />;
};

export function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const w = 160,
    h = 40;
  const max = 100,
    min = 0;
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="text-primary">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function parseIntervalHours(cron: string | undefined): number {
  if (!cron) return 6;
  const m = cron.trim().match(/^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
  if (m) return Math.max(1, parseInt(m[1], 10));
  return 6;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export type SeoRun = {
  id: string;
  started_at: string;
  score: number | null;
  trigger: string;
  pass_count: number;
  warn_count: number;
  fail_count: number;
};

export function CronStatusCard({
  runs,
  scheduleCron,
  onTrigger,
  isTriggering,
  lastTriggerResult,
}: {
  runs: SeoRun[];
  scheduleCron: string | undefined;
  onTrigger: () => void;
  isTriggering: boolean;
  lastTriggerResult: { ok: boolean; message: string; at: string } | null;
}) {
  const intervalH = parseIntervalHours(scheduleCron);
  const lastCron = runs.find((r) => r.trigger === "cron");

  let dotClass = "bg-muted-foreground";
  let label = "Not yet triggered";
  let labelClass = "bg-muted text-muted-foreground border-border";

  if (lastCron) {
    const ageMs = Date.now() - new Date(lastCron.started_at).getTime();
    const stale = ageMs > 2 * intervalH * 60 * 60 * 1000;
    const failed = lastCron.fail_count > 0;
    if (stale || failed) {
      dotClass = "bg-destructive animate-pulse";
      label = failed ? "Error" : "Stale";
      labelClass = "bg-destructive/10 text-destructive border-destructive/30";
    } else {
      dotClass = "bg-emerald-500";
      label = "Active / Healthy";
      labelClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Clock className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base">System Cron Status</h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${labelClass}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                {label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Background SEO scan via <code>/api/public/seo/cron</code> · expected every {intervalH}
              h
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {lastCron && (
            <div className="text-right text-xs">
              <div className="font-semibold text-foreground">
                Last run: {timeAgo(lastCron.started_at)}
              </div>
              <div className="text-muted-foreground">
                {new Date(lastCron.started_at).toLocaleString()}
              </div>
              <div className="mt-1 flex justify-end gap-3">
                <span className="text-emerald-500">✓ {lastCron.pass_count}</span>
                <span className="text-amber-500">! {lastCron.warn_count}</span>
                <span className="text-destructive">✗ {lastCron.fail_count}</span>
                {lastCron.score !== null && (
                  <span className="font-bold text-foreground">{lastCron.score}</span>
                )}
              </div>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={onTrigger} disabled={isTriggering}>
            <RotateCw className={`w-3.5 h-3.5 mr-2 ${isTriggering ? "animate-spin" : ""}`} />
            {isTriggering ? "Triggering cron…" : "Trigger cron now"}
          </Button>
        </div>
      </div>
      {lastTriggerResult && (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-xs ${lastTriggerResult.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-destructive/30 bg-destructive/10 text-destructive"}`}
        >
          <span className="font-semibold">
            Manual cron · {new Date(lastTriggerResult.at).toLocaleTimeString()}:
          </span>{" "}
          {lastTriggerResult.message}
        </div>
      )}
    </Card>
  );
}
