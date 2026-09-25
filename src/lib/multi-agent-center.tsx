import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  runTrendHunter,
  runSourcingAuditor,
  type WinningProductBrief,
  type SourcingAudit,
} from "@/lib/agents-dropship.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Sparkles,
  ShieldCheck,
  Search,
  Copy,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type Props = {
  onUseBrief?: (brief: WinningProductBrief) => void;
};

export function MultiAgentControlCenter({ onUseBrief }: Props) {
  return (
    <Card className="border-2 border-violet-500/40 bg-gradient-to-br from-violet-500/5 to-pink-500/5 mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" />
          Multi-Agent AI Control Center
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide ml-1">
            live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="trend">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="trend" className="gap-1">
              <Search className="w-3.5 h-3.5" /> Agent 1 · Trend Hunter
            </TabsTrigger>
            <TabsTrigger value="auditor" className="gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Agent 2 · Sourcing Auditor
            </TabsTrigger>
          </TabsList>
          <TabsContent value="trend" className="mt-3">
            <TrendHunterPanel onUseBrief={onUseBrief} />
          </TabsContent>
          <TabsContent value="auditor" className="mt-3">
            <AuditorInfo />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function TrendHunterPanel({ onUseBrief }: { onUseBrief?: (b: WinningProductBrief) => void }) {
  const [niche, setNiche] = useState("");
  const [briefs, setBriefs] = useState<WinningProductBrief[]>([]);
  const [busy, setBusy] = useState(false);
  const fn = useServerFn(runTrendHunter);

  const run = async () => {
    setBusy(true);
    try {
      const r = await fn({ data: { niche: niche || undefined, count: 4 } });
      setBriefs(r.briefs);
      if (!r.briefs.length) toast.warning("No briefs returned — try a different niche");
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Trend Hunter failed");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="Niche (optional) — e.g. compact beauty devices, energy-saving plugs"
          className="h-10"
        />
        <Button
          onClick={run}
          disabled={busy}
          className="h-10 bg-violet-600 hover:bg-violet-700 text-white"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Hunting…
            </>
          ) : (
            "Generate Briefs"
          )}
        </Button>
      </div>
      {briefs.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {briefs.map((b, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-background p-3 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm">{b.product_name}</p>
                <Badge variant="secondary" className="text-[10px]">
                  {b.category}
                </Badge>
              </div>
              <p className="text-muted-foreground">{b.why_winning}</p>
              <div>
                <span className="font-medium">Audience:</span>{" "}
                <span className="text-muted-foreground">{b.target_audience}</span>
              </div>
              <div>
                <span className="font-medium">Viral angles:</span>
                <ul className="list-disc pl-4 text-muted-foreground">
                  {b.viral_angles?.map((a, j) => (
                    <li key={j}>{a}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-1">
                {b.search_terms?.map((t, j) => (
                  <Badge
                    key={j}
                    variant="outline"
                    className="text-[10px] cursor-pointer hover:bg-pink-500/10"
                    onClick={() => {
                      navigator.clipboard.writeText(t);
                      toast.success(`Copied: ${t}`);
                    }}
                  >
                    <Copy className="w-2.5 h-2.5 mr-1" />
                    {t}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <span className="text-[11px] text-muted-foreground">
                  Suggested: <b>${b.suggested_price_usd}</b> · {b.suggested_margin_pct}% margin
                </span>
                {onUseBrief && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => onUseBrief(b)}
                  >
                    Use brief →
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditorInfo() {
  return (
    <div className="rounded-lg border border-border bg-background p-3 text-xs leading-relaxed space-y-2">
      <p className="font-semibold flex items-center gap-1 text-sm">
        <ShieldCheck className="w-4 h-4 text-emerald-500" /> Auto-runs on every Preview
      </p>
      <p className="text-muted-foreground">
        When you click <b>Preview</b> or <b>Import</b>, Agent 2 intercepts the CJ payload and runs:
      </p>
      <ol className="list-decimal pl-5 text-muted-foreground space-y-0.5">
        <li>Warehouse & shipping audit (CN/US/EU lines, fastest ETA).</li>
        <li>Supplier reliability scoring (stock, images, copy quality, risk flags).</li>
        <li>
          Auto-polish: broken-English title → benefit-led title, raw description → conversion copy.
        </li>
        <li>Strategic markup recommendation aligned to your USD price ladder.</li>
      </ol>
      <p className="text-muted-foreground">
        The audit appears inline above the Preview card. Click <b>Apply audit</b> to overwrite
        title/description/markup before saving.
      </p>
    </div>
  );
}

// ---------- Inline audit card (used inside SingleImport preview) ----------

export function AuditResultCard({ audit, onApply }: { audit: SourcingAudit; onApply: () => void }) {
  const verdictColor =
    audit.verdict === "approve"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : audit.verdict === "reject"
        ? "border-destructive/50 bg-destructive/5"
        : "border-amber-500/40 bg-amber-500/5";
  const Icon =
    audit.verdict === "approve"
      ? CheckCircle2
      : audit.verdict === "reject"
        ? XCircle
        : AlertTriangle;
  const iconColor =
    audit.verdict === "approve"
      ? "text-emerald-500"
      : audit.verdict === "reject"
        ? "text-destructive"
        : "text-amber-500";

  return (
    <div className={`rounded-xl border-2 p-4 space-y-3 ${verdictColor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <span className="font-semibold text-sm">
            Sourcing Auditor verdict: <span className="uppercase">{audit.verdict}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Score {audit.supplier_score}/100
          </Badge>
          <Badge variant="outline" className="text-xs">
            Markup {audit.suggested_markup_pct}%
          </Badge>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <p className="font-medium">Polished title</p>
          <p className="text-muted-foreground">{audit.polished_title}</p>
        </div>
        <div className="space-y-1">
          <p className="font-medium">Warehouses & shipping</p>
          <div className="flex flex-wrap gap-1">
            {audit.warehouses.map((w) => (
              <Badge key={w} variant="secondary" className="text-[10px]">
                {w}
              </Badge>
            ))}
          </div>
          <p className="text-muted-foreground text-[11px]">{audit.shipping_notes}</p>
        </div>
      </div>

      <div className="text-xs">
        <p className="font-medium mb-1">Polished description</p>
        <p className="text-muted-foreground whitespace-pre-wrap line-clamp-6">
          {audit.polished_description}
        </p>
      </div>

      {audit.risk_flags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {audit.risk_flags.map((f) => (
            <Badge key={f} variant="destructive" className="text-[10px]">
              ⚠ {f}
            </Badge>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground italic">{audit.reasoning}</p>

      <Button
        onClick={onApply}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
        size="sm"
      >
        Apply audit (overwrite title, description & markup)
      </Button>
    </div>
  );
}
