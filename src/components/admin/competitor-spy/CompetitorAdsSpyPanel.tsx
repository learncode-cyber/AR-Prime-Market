import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExternalLink,
  Eye,
  Flame,
  Loader2,
  Radar,
  Sparkles,
  ThumbsUp,
  Repeat2,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  runCompetitorSpyScan,
  listCompetitorIntel,
  listViralAlerts,
} from "@/lib/competitor-spy.functions";

const ENGAGE_STYLE: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  high: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  viral: "bg-pink-500/15 text-pink-600 border-pink-500/40",
};

const PLATFORM_STYLE: Record<string, string> = {
  meta: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  tiktok: "bg-pink-500/15 text-pink-600 border-pink-500/30",
};

export function CompetitorAdsSpyPanel() {
  const [platform, setPlatform] = useState<"all" | "meta" | "tiktok">("all");
  const [onlyViral, setOnlyViral] = useState(false);

  const scanFn = useServerFn(runCompetitorSpyScan);
  const intelFn = useServerFn(listCompetitorIntel);
  const alertsFn = useServerFn(listViralAlerts);

  const intelQ = useQuery({
    queryKey: ["competitor-intel", platform, onlyViral],
    queryFn: () =>
      intelFn({ data: { platform: platform === "all" ? undefined : platform, onlyViral } }),
  });
  const alertsQ = useQuery({
    queryKey: ["viral-alerts"],
    queryFn: () => alertsFn({ data: { limit: 10 } }),
  });

  const scan = useMutation({
    mutationFn: () => scanFn({ data: {} }),
    onSuccess: (r) => {
      toast.success(r.message);
      intelQ.refetch();
      alertsQ.refetch();
    },
    onError: (e: any) => toast.error(e?.message || "Spy scan failed"),
  });

  const rows = intelQ.data || [];
  const alerts = alertsQ.data || [];

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-auto">
            <Radar className="w-5 h-5 text-primary" />
            <div>
              <p className="font-semibold text-sm">Competitor Ads Spy Agent</p>
              <p className="text-[11px] text-muted-foreground">
                Scrape simulation of Meta Ad Library + TikTok Creative Center for the Crew Hunting
                List.
              </p>
            </div>
          </div>
          <Select value={platform} onValueChange={(v) => setPlatform(v as any)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              <SelectItem value="meta">Meta only</SelectItem>
              <SelectItem value="tiktok">TikTok only</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={onlyViral} onCheckedChange={setOnlyViral} />
            Viral only
          </label>
          <Button size="sm" onClick={() => scan.mutate()} disabled={scan.isPending}>
            {scan.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1" />
            )}
            Run Spy Scan
          </Button>
        </CardContent>
      </Card>

      {alerts.length > 0 && (
        <Card className="border-pink-500/30 bg-pink-500/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4 text-pink-600" /> Viral Alerts ({alerts.length})
            </div>
            <ul className="space-y-1.5">
              {alerts.slice(0, 5).map((a: any) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <Flame className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                  <span className="text-foreground">{a.message}</span>
                  {a.auto_suggested && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                    >
                      Auto-suggested to Approval Queue
                    </Badge>
                  )}
                  {a.pending_approval_id && (
                    <Link
                      to="/kali_master/products/import/cj"
                      className="text-primary underline text-[10px]"
                    >
                      View →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {intelQ.isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-12">Loading intel…</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12 border border-dashed rounded-lg">
          No spy intel yet. Hit <strong>Run Spy Scan</strong> above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((r: any) => {
            const m = (r.metrics || {}) as any;
            return (
              <Card key={r.id} className="border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`uppercase text-[10px] ${PLATFORM_STYLE[r.platform]}`}
                    >
                      {r.platform}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`capitalize text-[10px] ${ENGAGE_STYLE[r.engagement_level]}`}
                    >
                      {r.engagement_level}
                    </Badge>
                    {r.is_viral && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-pink-500/15 text-pink-600 border-pink-500/40 gap-1"
                      >
                        <Flame className="w-2.5 h-2.5" /> Viral
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium text-sm leading-snug line-clamp-2">{r.product_title}</p>
                  <blockquote className="text-xs italic text-muted-foreground border-l-2 border-primary/40 pl-2 line-clamp-3">
                    "{r.hook_text}"
                  </blockquote>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {r.ad_angle}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Hook rate</span>
                      <span className="font-semibold text-foreground">{r.hook_rate}%</span>
                    </div>
                    <Progress value={Number(r.hook_rate)} className="h-1.5" />
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3" />
                      {shortNum(m.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat2 className="w-3 h-3" />
                      {shortNum(m.shares)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {shortNum(m.views)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {m.days_running ?? "—"}d
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-[11px]"
                    onClick={() => {
                      if (r.cta_url) window.open(r.cta_url, "_blank");
                      else toast.info("Demo creative — connect Meta/TikTok API for live videos");
                    }}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" /> 🔗 View Competitor Creative Video
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function shortNum(n: any): string {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return "—";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "k";
  return String(v);
}
