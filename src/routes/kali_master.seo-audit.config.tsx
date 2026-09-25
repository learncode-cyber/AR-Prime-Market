import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getScanConfig, updateScanConfig } from "@/lib/seo-scan.functions";

export const Route = createFileRoute("/kali_master/seo-audit/config")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: ConfigTab,
});

function ConfigTab() {
  const configFn = useServerFn(getScanConfig);
  const updateConfigFn = useServerFn(updateScanConfig);
  const config = useQuery({ queryKey: ["seo-config"], queryFn: () => configFn() });

  const [cfg, setCfg] = useState<{
    auto_rescan_enabled: boolean;
    schedule_cron: string;
    target_urls: string;
    pagespeed_enabled: boolean;
    base_url: string;
  } | null>(null);

  useEffect(() => {
    const c = config.data?.config as
      | {
          auto_rescan_enabled?: boolean;
          schedule_cron?: string;
          target_urls?: string[];
          pagespeed_enabled?: boolean;
          base_url?: string;
        }
      | undefined;
    if (c && !cfg) {
      setCfg({
        auto_rescan_enabled: c.auto_rescan_enabled ?? true,
        schedule_cron: c.schedule_cron ?? "0 */6 * * *",
        target_urls: (c.target_urls ?? []).join("\n"),
        pagespeed_enabled: c.pagespeed_enabled ?? false,
        base_url: c.base_url ?? "https://arprimemarket.shop",
      });
    }
  }, [config.data, cfg]);

  const saveConfig = async () => {
    if (!cfg) return;
    try {
      await updateConfigFn({
        data: {
          auto_rescan_enabled: cfg.auto_rescan_enabled,
          schedule_cron: cfg.schedule_cron,
          target_urls: cfg.target_urls
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          pagespeed_enabled: cfg.pagespeed_enabled,
          base_url: cfg.base_url,
        },
      });
      toast.success("Configuration saved");
      config.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!cfg) {
    return <Card className="p-6 text-sm text-muted-foreground">Loading configuration…</Card>;
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="font-semibold">Auto-rescan enabled</Label>
          <p className="text-xs text-muted-foreground">
            Run after each deploy and on the cron schedule.
          </p>
        </div>
        <Switch
          checked={cfg.auto_rescan_enabled}
          onCheckedChange={(v) => setCfg({ ...cfg, auto_rescan_enabled: v })}
        />
      </div>
      <div className="space-y-2">
        <Label>Base URL</Label>
        <Input
          value={cfg.base_url}
          onChange={(e) => setCfg({ ...cfg, base_url: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Schedule (cron)</Label>
        <Input
          value={cfg.schedule_cron}
          onChange={(e) => setCfg({ ...cfg, schedule_cron: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Default: every 6 hours (<code>0 */6 * * *</code>)
        </p>
      </div>
      <div className="space-y-2">
        <Label>Target URLs (one path per line)</Label>
        <Textarea
          rows={6}
          value={cfg.target_urls}
          onChange={(e) => setCfg({ ...cfg, target_urls: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          One active product and one published blog post are auto-included.
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label className="font-semibold">PageSpeed Insights</Label>
          <p className="text-xs text-muted-foreground">Reuse PAGESPEED_API_KEY (slower scans).</p>
        </div>
        <Switch
          checked={cfg.pagespeed_enabled}
          onCheckedChange={(v) => setCfg({ ...cfg, pagespeed_enabled: v })}
        />
      </div>
      <Button onClick={saveConfig}>Save settings</Button>
    </Card>
  );
}
