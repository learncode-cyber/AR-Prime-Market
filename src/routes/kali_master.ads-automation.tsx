import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Zap, Pause, TrendingUp, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/kali_master/ads-automation")({
  component: AdsAutomationPage,
});

type Settings = {
  id: string;
  platform: "meta" | "google";
  enabled: boolean;
  min_roas: number;
  max_cpa: number;
  scale_roas: number;
  scale_pct: number;
  max_daily_budget: number;
  monitor_window_hours: number;
  ad_account_id: string | null;
};

type Log = {
  id: string;
  platform: string;
  action: string;
  campaign_name: string | null;
  reason: string | null;
  metrics: Record<string, unknown>;
  success: boolean;
  created_at: string;
};

function AdsAutomationPage() {
  const [settings, setSettings] = useState<Settings[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: l }] = await Promise.all([
      supabase.from("ad_automation_settings").select("*").order("platform"),
      supabase
        .from("ad_automation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setSettings((s as Settings[]) || []);
    setLogs((l as Log[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(s: Settings) {
    const { error } = await supabase
      .from("ad_automation_settings")
      .update({
        enabled: s.enabled,
        min_roas: s.min_roas,
        max_cpa: s.max_cpa,
        scale_roas: s.scale_roas,
        scale_pct: s.scale_pct,
        max_daily_budget: s.max_daily_budget,
        monitor_window_hours: s.monitor_window_hours,
        ad_account_id: s.ad_account_id,
      })
      .eq("id", s.id);
    if (error) toast.error(error.message);
    else toast.success(`${s.platform.toUpperCase()} settings saved`);
  }

  async function runNow() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ad-performance-monitor", {
        body: {},
      });
      if (error) throw error;
      toast.success(`Sweep done — ${(data as any)?.decisions?.length || 0} actions`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setRunning(false);
    }
  }

  if (loading)
    return (
      <div className="p-8">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="text-primary" /> Ads Automation
          </h1>
          <p className="text-muted-foreground">
            AI auto-pause underperformers & scale winners on Meta + Google Ads.
          </p>
        </div>
        <Button onClick={runNow} disabled={running}>
          {running ? (
            <Loader2 className="animate-spin mr-2 h-4 w-4" />
          ) : (
            <Zap className="mr-2 h-4 w-4" />
          )}
          Run sweep now
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {settings.map((s) => (
          <Card key={s.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="capitalize">{s.platform} Ads</CardTitle>
              <Switch
                checked={s.enabled}
                onCheckedChange={(v) =>
                  setSettings((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: v } : x)))
                }
              />
            </CardHeader>
            <CardContent className="space-y-3">
              <Field
                label="Min ROAS (pause below)"
                value={s.min_roas}
                onChange={(v) =>
                  setSettings((p) => p.map((x) => (x.id === s.id ? { ...x, min_roas: v } : x)))
                }
              />
              <Field
                label="Max CPA (USD)"
                value={s.max_cpa}
                onChange={(v) =>
                  setSettings((p) => p.map((x) => (x.id === s.id ? { ...x, max_cpa: v } : x)))
                }
              />
              <Field
                label="Scale ROAS (scale up above)"
                value={s.scale_roas}
                onChange={(v) =>
                  setSettings((p) => p.map((x) => (x.id === s.id ? { ...x, scale_roas: v } : x)))
                }
              />
              <Field
                label="Scale % per day"
                value={s.scale_pct}
                onChange={(v) =>
                  setSettings((p) => p.map((x) => (x.id === s.id ? { ...x, scale_pct: v } : x)))
                }
              />
              <Field
                label="Max daily budget (USD)"
                value={s.max_daily_budget}
                onChange={(v) =>
                  setSettings((p) =>
                    p.map((x) => (x.id === s.id ? { ...x, max_daily_budget: v } : x)),
                  )
                }
              />
              <Button onClick={() => save(s)} className="w-full">
                Save {s.platform}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No activity yet. Run a sweep to see decisions here.
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <ActionIcon action={l.action} success={l.success} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="capitalize">
                        {l.platform}
                      </Badge>
                      <Badge variant={l.success ? "default" : "destructive"} className="capitalize">
                        {l.action}
                      </Badge>
                      {l.campaign_name && (
                        <span className="text-sm font-medium truncate">{l.campaign_name}</span>
                      )}
                    </div>
                    {l.reason && <p className="text-sm text-muted-foreground mt-1">{l.reason}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(l.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function ActionIcon({ action, success }: { action: string; success: boolean }) {
  if (!success) return <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />;
  if (action === "pause") return <Pause className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />;
  if (action === "scale") return <TrendingUp className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />;
  return <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />;
}
