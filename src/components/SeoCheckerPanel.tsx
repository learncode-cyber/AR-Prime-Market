import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gauge, Loader2, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { runPageSpeedCheck } from "@/lib/seo-check.functions";

type Props = {
  title: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  content: string;
  featuredImage?: string;
  seoKeywords?: string[];
  publicUrl?: string;
};

// Google's practical SERP-display limits
const META_TITLE_MIN = 30;
const META_TITLE_MAX = 60;
const META_DESC_MIN = 70;
const META_DESC_MAX = 160;
const SLUG_MAX = 75;

function rangeState(len: number, min: number, max: number) {
  if (len === 0) return { color: "destructive" as const, label: "Missing" };
  if (len < min) return { color: "secondary" as const, label: "Too short" };
  if (len > max) return { color: "destructive" as const, label: "Too long" };
  return { color: "default" as const, label: "Good" };
}

function CountBar({
  label,
  value,
  min,
  max,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
}) {
  const state = rangeState(value, min, max);
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {value} / {max} chars
          <Badge variant={state.color} className="ml-2 text-[10px] px-1.5 py-0">
            {state.label}
          </Badge>
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <div className="text-[10px] text-muted-foreground">
        Recommended: {min}–{max}
      </div>
    </div>
  );
}

function ScoreDot({ label, score }: { label: string; score: number }) {
  const color = score >= 90 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-red-500";
  return (
    <div className="flex flex-col items-center justify-center rounded border border-border/50 p-3">
      <div className={`text-2xl font-bold ${color}`}>{score}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

export function SeoCheckerPanel({
  title,
  metaTitle,
  metaDescription,
  slug,
  content,
  featuredImage,
  seoKeywords = [],
  publicUrl,
}: Props) {
  const runCheck = useServerFn(runPageSpeedCheck);
  const [busy, setBusy] = useState(false);
  const [strategy, setStrategy] = useState<"mobile" | "desktop">("mobile");
  const [result, setResult] = useState<{
    scores: {
      performance: number;
      accessibility: number;
      bestPractices: number;
      seo: number;
    } | null;
    metrics?: { lcp: string | null; fcp: string | null; cls: string | null; tbt: string | null };
    error?: string | null;
    fetchedUrl?: string;
  } | null>(null);

  const effectiveMetaTitle = metaTitle || title;
  const wordCount = useMemo(
    () =>
      (content || "")
        .replace(/<[^>]+>/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length,
    [content],
  );

  // Quick internal SEO score (heuristic, runs live)
  const internalScore = useMemo(() => {
    let s = 0;
    let max = 0;
    const checks: { label: string; pass: boolean }[] = [];

    const add = (label: string, pass: boolean, weight = 1) => {
      checks.push({ label, pass });
      max += weight;
      if (pass) s += weight;
    };

    add(
      "Meta title length 30–60",
      effectiveMetaTitle.length >= META_TITLE_MIN && effectiveMetaTitle.length <= META_TITLE_MAX,
      2,
    );
    add(
      "Meta description 70–160",
      metaDescription.length >= META_DESC_MIN && metaDescription.length <= META_DESC_MAX,
      2,
    );
    add("Slug present & short", !!slug && slug.length <= SLUG_MAX, 1);
    add("Content ≥ 600 words", wordCount >= 600, 2);
    add("Has featured image", !!featuredImage, 1);
    add("Has at least one H2", /<h2[\s>]/i.test(content), 1);
    add("Has SEO keywords", seoKeywords.length > 0, 1);
    if (seoKeywords[0]) {
      const k = seoKeywords[0].toLowerCase();
      add(
        `Primary keyword in title ("${seoKeywords[0]}")`,
        effectiveMetaTitle.toLowerCase().includes(k),
        1,
      );
      add("Primary keyword in body", content.toLowerCase().includes(k), 1);
    }

    return { score: Math.round((s / Math.max(1, max)) * 100), checks };
  }, [effectiveMetaTitle, metaDescription, slug, wordCount, featuredImage, content, seoKeywords]);

  const handleRunPageSpeed = async () => {
    if (!publicUrl) {
      toast.error("Publish the post first to test the live URL with PageSpeed.");
      return;
    }
    setBusy(true);
    try {
      const res: any = await runCheck({ data: { url: publicUrl, strategy } });
      if (!res?.ok) {
        toast.error(res?.error || "PageSpeed check failed");
      } else {
        toast.success("PageSpeed check complete");
      }
      setResult(res);
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadPdf = () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;
      let y = margin;

      const ensureSpace = (needed: number) => {
        if (y + needed > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      };
      const wrap = (text: string, maxWidth: number, size: number) => {
        doc.setFontSize(size);
        return doc.splitTextToSize(text || "", maxWidth) as string[];
      };
      const drawLine = () => {
        doc.setDrawColor(220);
        doc.line(margin, y, pageW - margin, y);
        y += 10;
      };
      const sectionTitle = (t: string) => {
        ensureSpace(28);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(20);
        doc.text(t, margin, y);
        y += 16;
        drawLine();
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40);
      };
      const kv = (label: string, value: string) => {
        const lines = wrap(value || "—", pageW - margin * 2 - 110, 10);
        ensureSpace(14 * lines.length + 4);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(90);
        doc.text(label, margin, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(20);
        doc.text(lines, margin + 110, y);
        y += 14 * lines.length + 2;
      };

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(15);
      doc.text("SEO Audit Report", margin, y);
      y += 22;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(110);
      doc.text(`Generated ${new Date().toLocaleString()}`, margin, y);
      y += 14;
      doc.text("AR Prime Market — Blog SEO Checker", margin, y);
      y += 16;
      drawLine();

      // Overview
      sectionTitle("Overview");
      kv("Title", title || "—");
      kv("Slug", `/${slug || "—"}`);
      kv("Public URL", publicUrl || "Not published");
      kv("Internal score", `${internalScore.score} / 100`);
      kv("Word count", `${wordCount}`);
      kv("Featured image", featuredImage ? "Yes" : "No");
      kv("SEO keywords", seoKeywords.length ? seoKeywords.join(", ") : "—");

      // Meta
      sectionTitle("Meta tags");
      const mtState = rangeState(effectiveMetaTitle.length, META_TITLE_MIN, META_TITLE_MAX);
      const mdState = rangeState(metaDescription.length, META_DESC_MIN, META_DESC_MAX);
      kv("Meta title", effectiveMetaTitle || "—");
      kv(
        "  ↳ length",
        `${effectiveMetaTitle.length} chars (recommended ${META_TITLE_MIN}-${META_TITLE_MAX}) — ${mtState.label}`,
      );
      kv("Meta description", metaDescription || "—");
      kv(
        "  ↳ length",
        `${metaDescription.length} chars (recommended ${META_DESC_MIN}-${META_DESC_MAX}) — ${mdState.label}`,
      );

      // SERP preview
      sectionTitle("Google SERP preview");
      ensureSpace(80);
      doc.setDrawColor(220);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(margin, y, pageW - margin * 2, 70, 4, 4, "FD");
      doc.setFontSize(9);
      doc.setTextColor(20, 120, 60);
      doc.text(
        publicUrl || `https://arprimemarket.shop/blog/${slug || "your-slug"}`,
        margin + 10,
        y + 16,
      );
      doc.setFontSize(13);
      doc.setTextColor(30, 80, 200);
      const titleLines = wrap(effectiveMetaTitle || "Your meta title", pageW - margin * 2 - 20, 13);
      doc.text(titleLines.slice(0, 1), margin + 10, y + 34);
      doc.setFontSize(10);
      doc.setTextColor(70);
      const descLines = wrap(
        metaDescription || "Your meta description will appear here.",
        pageW - margin * 2 - 20,
        10,
      );
      doc.text(descLines.slice(0, 2), margin + 10, y + 52);
      y += 80;

      // Checks
      sectionTitle("On-page checks");
      doc.setFontSize(10);
      internalScore.checks.forEach((c) => {
        ensureSpace(14);
        doc.setTextColor(c.pass ? 20 : 150);
        doc.text(`${c.pass ? "✓" : "○"}  ${c.label}`, margin, y);
        y += 14;
      });

      // PageSpeed
      sectionTitle("Google PageSpeed Insights");
      if (!result?.scores) {
        doc.setFontSize(10);
        doc.setTextColor(110);
        ensureSpace(14);
        doc.text(
          result?.error
            ? `Not available: ${result.error}`
            : "Not run yet — click 'Run PageSpeed test' in the editor first.",
          margin,
          y,
        );
        y += 14;
      } else {
        kv("Strategy", strategy);
        kv("Performance", `${result.scores.performance} / 100`);
        kv("Accessibility", `${result.scores.accessibility} / 100`);
        kv("Best Practices", `${result.scores.bestPractices} / 100`);
        kv("SEO", `${result.scores.seo} / 100`);
        if (result.metrics) {
          kv("LCP", result.metrics.lcp ?? "—");
          kv("FCP", result.metrics.fcp ?? "—");
          kv("CLS", result.metrics.cls ?? "—");
          kv("TBT", result.metrics.tbt ?? "—");
        }
      }

      // Footer
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 20, { align: "right" });
        doc.text("AR Prime Market — SEO Audit", margin, pageH - 20);
      }

      const safeSlug = (slug || "post").replace(/[^a-z0-9-]/gi, "-").slice(0, 50);
      doc.save(`seo-audit-${safeSlug}.pdf`);
      toast.success("PDF downloaded");
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "PDF generation failed");
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-2">
          <Gauge className="w-4 h-4" /> SEO Checker
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Score: <span className="ml-1 font-bold">{internalScore.score}/100</span>
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={handleDownloadPdf}
          >
            <Download className="w-3 h-3 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <CountBar
          label="Meta title"
          value={effectiveMetaTitle.length}
          min={META_TITLE_MIN}
          max={META_TITLE_MAX}
        />
        <CountBar
          label="Meta description"
          value={metaDescription.length}
          min={META_DESC_MIN}
          max={META_DESC_MAX}
        />
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Content</span>
          <span className="text-muted-foreground">
            {wordCount} words
            <Badge
              variant={wordCount >= 600 ? "default" : "secondary"}
              className="ml-2 text-[10px] px-1.5 py-0"
            >
              {wordCount >= 600 ? "Good" : "Aim 600+"}
            </Badge>
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Slug</span>
          <span className="text-muted-foreground truncate max-w-[60%]">/{slug || "—"}</span>
        </div>
      </div>

      <div className="border-t border-border/50 pt-3 space-y-1">
        {internalScore.checks.map((c) => (
          <div key={c.label} className="flex items-center gap-2 text-xs">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                c.pass ? "bg-emerald-500" : "bg-muted-foreground/40"
              }`}
            />
            <span className={c.pass ? "" : "text-muted-foreground"}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Google PageSpeed */}
      <div className="border-t border-border/50 pt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold">Google PageSpeed Insights</div>
          <div className="flex items-center gap-1">
            <Button
              variant={strategy === "mobile" ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setStrategy("mobile")}
            >
              Mobile
            </Button>
            <Button
              variant={strategy === "desktop" ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setStrategy("desktop")}
            >
              Desktop
            </Button>
          </div>
        </div>
        <Button
          onClick={handleRunPageSpeed}
          disabled={busy || !publicUrl}
          size="sm"
          className="w-full"
        >
          {busy ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analysing…
            </>
          ) : (
            <>
              <RefreshCw className="w-3 h-3 mr-1" /> {result ? "Re-run" : "Run"} PageSpeed test
            </>
          )}
        </Button>
        {!publicUrl && (
          <p className="text-[10px] text-muted-foreground">
            Publish the post to enable live PageSpeed testing on the public URL.
          </p>
        )}
        {result?.error && <p className="text-xs text-destructive">{result.error}</p>}
        {result?.scores && (
          <>
            <div className="grid grid-cols-4 gap-2">
              <ScoreDot label="Perf" score={result.scores.performance} />
              <ScoreDot label="A11y" score={result.scores.accessibility} />
              <ScoreDot label="Best" score={result.scores.bestPractices} />
              <ScoreDot label="SEO" score={result.scores.seo} />
            </div>
            {result.metrics && (
              <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground pt-1">
                <div>
                  LCP: <span className="text-foreground">{result.metrics.lcp ?? "—"}</span>
                </div>
                <div>
                  FCP: <span className="text-foreground">{result.metrics.fcp ?? "—"}</span>
                </div>
                <div>
                  CLS: <span className="text-foreground">{result.metrics.cls ?? "—"}</span>
                </div>
                <div>
                  TBT: <span className="text-foreground">{result.metrics.tbt ?? "—"}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* SERP preview */}
      <div className="border-t border-border/50 pt-3 space-y-1">
        <div className="text-xs font-semibold">Google SERP preview</div>
        <div className="rounded border border-border/50 p-3 bg-background">
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 truncate">
            {publicUrl || `https://arprimemarket.shop/blog/${slug || "your-slug"}`}
          </div>
          <div className="text-base text-blue-700 dark:text-blue-400 leading-tight truncate">
            {effectiveMetaTitle || "Your meta title"}
          </div>
          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {metaDescription || "Your meta description will appear here in search results."}
          </div>
        </div>
      </div>
    </Card>
  );
}
