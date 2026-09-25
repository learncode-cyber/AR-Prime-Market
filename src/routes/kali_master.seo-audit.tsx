import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RotateCw, Sparkles, Rocket } from "lucide-react";
import {
  runSeoScan,
  triggerSeoCron,
  getLatestScan,
  listScanHistory,
  getScanConfig,
} from "@/lib/seo-scan.functions";
import { generateSeoBlogPost } from "@/lib/blog-ai.functions";
import { CronStatusCard, type SeoRun } from "@/lib/seo-audit-shared";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kali_master/seo-audit")({
  component: SeoAuditLayout,
  head: () => ({
    meta: [{ title: "SEO Audit — AR Prime Admin" }, { name: "robots", content: "noindex" }],
  }),
});

const tabs = [
  { to: "/kali_master/seo-audit/findings", label: "Findings" },
  { to: "/kali_master/seo-audit/history", label: "History" },
  { to: "/kali_master/seo-audit/config", label: "Settings" },
  { to: "/kali_master/seo-audit/webhook", label: "Post-deploy webhook" },
] as const;

function SeoAuditLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const runFn = useServerFn(runSeoScan);
  const cronFn = useServerFn(triggerSeoCron);
  const latestFn = useServerFn(getLatestScan);
  const historyFn = useServerFn(listScanHistory);
  const configFn = useServerFn(getScanConfig);
  const blogFn = useServerFn(generateSeoBlogPost);

  const latest = useQuery({ queryKey: ["seo-latest"], queryFn: () => latestFn() });
  const history = useQuery({ queryKey: ["seo-history"], queryFn: () => historyFn() });
  const config = useQuery({ queryKey: ["seo-config"], queryFn: () => configFn() });

  const blogMutation = useMutation({
    mutationFn: () => blogFn({ data: { autoPublish: true } }),
    onSuccess: (r: any) => {
      const slug = r?.post?.slug;
      toast.success(`Blog published: ${r?.post?.title ?? "post"}`, {
        action: slug
          ? { label: "View", onClick: () => window.open(`/blog/${slug}`, "_blank") }
          : undefined,
      });
    },
    onError: (e: Error) => toast.error(`Blog engine failed: ${e.message}`),
  });

  const runMutation = useMutation({
    mutationFn: () => runFn(),
    onSuccess: (r) => {
      toast.success(
        `Scan complete — score ${r.score} (pass ${r.pass}, warn ${r.warn}, fail ${r.fail})`,
      );
      latest.refetch();
      history.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [lastCronResult, setLastCronResult] = useState<{
    ok: boolean;
    message: string;
    at: string;
  } | null>(null);
  const cronMutation = useMutation({
    mutationFn: () => cronFn(),
    onSuccess: (r) => {
      const msg = `score ${r.score} · pass ${r.pass} · warn ${r.warn} · fail ${r.fail}`;
      setLastCronResult({ ok: true, message: msg, at: new Date().toISOString() });
      toast.success(`Cron run complete — ${msg}`);
      latest.refetch();
      history.refetch();
    },
    onError: (e: Error) => {
      setLastCronResult({ ok: false, message: e.message, at: new Date().toISOString() });
      toast.error(e.message);
    },
  });

  const run = latest.data?.run as
    | {
        score: number | null;
        pass_count: number;
        warn_count: number;
        fail_count: number;
        started_at: string;
        trigger: string;
      }
    | null
    | undefined;
  const runs = (history.data?.runs ?? []) as SeoRun[];
  const cfg = config.data?.config as { schedule_cron?: string } | undefined;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> SEO Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automatic re-tests of meta, structured data, crawlability & LLM-readiness after every
            deploy.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              latest.refetch();
              history.refetch();
            }}
          >
            Refresh
          </Button>
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
            <RotateCw className={`w-4 h-4 mr-2 ${runMutation.isPending ? "animate-spin" : ""}`} />
            {runMutation.isPending ? "Scanning…" : "Run scan now"}
          </Button>
          <Button
            onClick={() => blogMutation.mutate()}
            disabled={blogMutation.isPending}
            className="bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700"
          >
            <Rocket className={`w-4 h-4 mr-2 ${blogMutation.isPending ? "animate-pulse" : ""}`} />
            {blogMutation.isPending ? "Generating & publishing…" : "Run AI Blog Engine Now"}
          </Button>
        </div>
      </div>

      <CronStatusCard
        runs={runs}
        scheduleCron={cfg?.schedule_cron}
        onTrigger={() => cronMutation.mutate()}
        isTriggering={cronMutation.isPending}
        lastTriggerResult={lastCronResult}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Latest score</div>
          <div className="text-3xl font-bold mt-1">{run?.score ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-2">
            {run ? new Date(run.started_at).toLocaleString() : "No scans yet"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pass</div>
          <div className="text-3xl font-bold mt-1 text-emerald-500">{run?.pass_count ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Warnings</div>
          <div className="text-3xl font-bold mt-1 text-amber-500">{run?.warn_count ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Failures</div>
          <div className="text-3xl font-bold mt-1 text-destructive">{run?.fail_count ?? 0}</div>
        </Card>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => {
          const active = pathname === t.to || pathname.startsWith(t.to + "/");
          return (
            <Link
              key={t.to}
              to={t.to}
              preload="intent"
              className={cn(
                "px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
