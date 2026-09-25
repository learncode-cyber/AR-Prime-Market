import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  previewDropshipProduct,
  importDropshipProduct,
  importDropshipCSV,
} from "@/lib/dropship.functions";
import { runSourcingAuditor, type SourcingAudit } from "@/lib/agents-dropship.functions";
import { MultiAgentControlCenter, AuditResultCard } from "@/lib/multi-agent-center";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2,
  Upload,
  Link as LinkIcon,
  ShoppingBag,
  AlertTriangle,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

export type Provider = "cj" | "aliexpress" | "spocket" | "url";
type Preview = Awaited<ReturnType<typeof previewDropshipProduct>>;

export function SingleImport({ provider, hint }: { provider: Provider; hint: string }) {
  const [identifier, setIdentifier] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [audit, setAudit] = useState<SourcingAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [quickImporting, setQuickImporting] = useState(false);
  const [lastError, setLastError] = useState<{ stage: string; message: string } | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [markup, setMarkup] = useState(30);
  const previewFn = useServerFn(previewDropshipProduct);
  const importFn = useServerFn(importDropshipProduct);
  const auditFn = useServerFn(runSourcingAuditor);

  const { data: categories, refetch: refetchCategories } = useQuery({
    queryKey: ["import-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").order("name");
      return data || [];
    },
  });

  const classifyError = (raw: string): { stage: string; message: string } => {
    const m = raw || "Unknown error";
    if (m.includes("[cj-proxy network]")) return { stage: "cj-proxy network", message: m };
    if (m.includes("[CJ API]")) return { stage: "CJ API", message: m };
    if (/vault|CJ_API_KEY/i.test(m)) return { stage: "Supabase Vault / CJ key", message: m };
    if (/R2|cloudflare|bucket|S3/i.test(m)) return { stage: "Cloudflare R2 upload", message: m };
    if (/Forbidden|admin/i.test(m)) return { stage: "Auth / Admin role", message: m };
    if (/Unauthorized|401/i.test(m)) return { stage: "Auth bearer token", message: m };
    if (/duplicate|unique|conflict/i.test(m))
      return { stage: "Supabase product insert", message: m };
    return { stage: "Server function", message: m };
  };

  const runAudit = async (p: Preview) => {
    try {
      const a = await auditFn({ data: { preview: p } });
      setAudit(a);
      if (a.verdict === "reject")
        toast.warning(`Auditor flagged: ${a.risk_flags.join(", ") || "low score"}`);
      else if (a.verdict === "approve")
        toast.success(`Auditor approved · score ${a.supplier_score}/100`);
    } catch (e: unknown) {
      // Non-fatal: import can still proceed without audit
      console.warn("[auditor]", e instanceof Error ? e.message : String(e));
    }
  };

  const applyAudit = () => {
    if (!audit || !preview) return;
    setPreview({
      ...preview,
      title: audit.polished_title,
      description: audit.polished_description,
    });
    setMarkup(audit.suggested_markup_pct);
    toast.success("Audit applied to preview");
  };

  const onPreview = async () => {
    if (!identifier.trim()) return toast.error("Enter a product ID or URL");
    setLoading(true);
    setPreview(null);
    setAudit(null);
    setLastError(null);
    try {
      const p = await previewFn({ data: { provider, identifier: identifier.trim() } });
      setPreview(p);
      toast.success("Preview loaded · running audit…");
      runAudit(p);
    } catch (e: unknown) {
      const err = classifyError((e instanceof Error ? e.message : String(e)) || String(e));
      setLastError(err);
      toast.error(`${err.stage}: ${err.message}`);
    }
    setLoading(false);
  };

  const onQuickImport = async () => {
    const value = identifier.trim();
    if (!value) return toast.error("Paste a CJ product SKU or URL");
    setQuickImporting(true);
    setLastError(null);
    try {
      toast.loading("Fetching from CJ…", { id: "quick-import" });
      const p = await previewFn({ data: { provider, identifier: value } });
      toast.loading("Uploading images to R2 & saving…", { id: "quick-import" });
      const r = await importFn({
        data: { preview: p, category_id: categoryId, price_markup_pct: markup },
      });
      toast.success(`Imported! /${r.slug}`, { id: "quick-import" });
      setIdentifier("");
      setPreview(null);
      refetchCategories();
    } catch (e: unknown) {
      const err = classifyError((e instanceof Error ? e.message : String(e)) || String(e));
      setLastError(err);
      toast.error(`${err.stage}: ${err.message}`, { id: "quick-import" });
    }
    setQuickImporting(false);
  };

  const onImport = async () => {
    if (!preview) return;
    setImporting(true);
    setLastError(null);
    try {
      const r = await importFn({
        data: { preview, category_id: categoryId, price_markup_pct: markup },
      });
      toast.success(`Imported! /${r.slug}`);
      setPreview(null);
      setIdentifier("");
    } catch (e: unknown) {
      const err = classifyError((e instanceof Error ? e.message : String(e)) || String(e));
      setLastError(err);
      toast.error(`${err.stage}: ${err.message}`);
    }
    setImporting(false);
  };

  return (
    <Card className="border-border/50 mt-4">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingBag className="w-4 h-4" /> Import from {provider.toUpperCase()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border-2 border-pink-500/40 bg-pink-50/40 dark:bg-pink-950/10 p-3">
          <Label className="text-sm font-semibold text-pink-700 dark:text-pink-300">
            {provider === "cj" ? "Enter CJ Product SKU" : hint}
          </Label>
          <div className="flex flex-wrap gap-2 mt-2">
            <Input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={
                provider === "cj"
                  ? "Paste CJ SKU here (e.g., CJFU241984203CX)"
                  : "e.g. 2408130947412345678 or https://..."
              }
              className="flex-1 min-w-[240px] h-11 text-base bg-background border-2 border-pink-300 focus-visible:ring-pink-500"
              disabled={quickImporting || importing}
              autoFocus
            />
            <Button
              onClick={onPreview}
              disabled={loading || quickImporting}
              variant="outline"
              className="h-11"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Preview"}
            </Button>
            <Button
              onClick={onQuickImport}
              disabled={quickImporting || loading || !identifier.trim()}
              className="h-11 bg-pink-600 hover:bg-pink-700 text-white font-semibold px-6"
            >
              {quickImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing…
                </>
              ) : (
                "Import"
              )}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Click <b>Import</b> for one-click fetch + save (images auto-mirrored to Cloudflare R2
            CDN). Use <b>Preview</b> to review before saving.
          </p>
        </div>

        {lastError && (
          <Alert variant="destructive" className="border-destructive/60">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              Import failed
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {lastError.stage}
              </Badge>
            </AlertTitle>
            <AlertDescription className="text-xs font-mono whitespace-pre-wrap break-words mt-1">
              {lastError.message}
            </AlertDescription>
          </Alert>
        )}

        {provider === "cj" && (
          <MultiAgentControlCenter
            onUseBrief={(b) => {
              toast.info(
                `Searching CJ for "${b.search_terms?.[0] || b.product_name}" — paste the matching SKU below`,
              );
            }}
          />
        )}

        {provider === "cj" && <CrewSopPanel />}

        {audit && preview && <AuditResultCard audit={audit} onApply={applyAudit} />}

        {preview && (
          <div className="rounded-xl border border-border p-4 space-y-3 bg-secondary/20">
            <div className="flex gap-4">
              {preview.images[0] && (
                <img
                  src={preview.images[0]}
                  alt=""
                  className="w-28 h-28 rounded-lg object-cover border border-border"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{preview.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {preview.currency} {preview.price.toFixed(2)} · Stock:{" "}
                  <Badge variant="secondary">{preview.stock_quantity}</Badge>
                </p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {preview.description}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {preview.images.length} image(s) · SKU {preview.sku || "—"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Category</Label>
                <Select
                  value={categoryId ?? "none"}
                  onValueChange={(v) => setCategoryId(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Price markup %</Label>
                <Input
                  type="number"
                  value={markup}
                  onChange={(e) => setMarkup(Math.max(0, Math.min(1000, +e.target.value || 0)))}
                />
              </div>
            </div>

            <Button onClick={onImport} disabled={importing} className="w-full">
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing…
                </>
              ) : (
                "Import to Store"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CsvOrUrlImport() {
  const [urlInput, setUrlInput] = useState("");
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [csvErrors, setCsvErrors] = useState<{ row: number; title: string; message: string }[]>([]);
  const previewFn = useServerFn(previewDropshipProduct);
  const importFn = useServerFn(importDropshipProduct);
  const csvFn = useServerFn(importDropshipCSV);

  const importFromUrl = async () => {
    if (!urlInput.trim()) return toast.error("Paste a URL");
    setBusy(true);
    try {
      const p = await previewFn({ data: { provider: "url", identifier: urlInput.trim() } });
      const r = await importFn({ data: { preview: p, category_id: null, price_markup_pct: 30 } });
      toast.success(`Imported! /${r.slug}`);
      setUrlInput("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  const importCsv = async () => {
    if (!csvText.trim()) return toast.error("Paste CSV content");
    setBusy(true);
    setCsvErrors([]);
    try {
      const lines = csvText.trim().split(/\r?\n/);
      const header = lines
        .shift()!
        .split(",")
        .map((h) => h.trim().toLowerCase());
      const rows = lines.map((ln) => {
        const cols = ln.split(",").map((c) => c.trim());
        const get = (k: string) => cols[header.indexOf(k)] || "";
        return {
          title: get("title"),
          price: Number(get("price")) || 0,
          stock: Number(get("stock")) || 0,
          description: get("description"),
          images: get("images") ? get("images").split("|").filter(Boolean) : [],
          sku: get("sku") || undefined,
        };
      });
      const r = await csvFn({ data: { rows } });
      if (r.failed > 0) {
        toast.warning(`${r.imported} imported, ${r.failed} failed — see details below`);
        setCsvErrors(r.errors);
      } else {
        toast.success(`${r.imported} products imported`);
        setCsvText("");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="w-4 h-4" /> Single URL
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="text-xs">Any product page URL (Shopify, Amazon, etc.)</Label>
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
            />
            <Button onClick={importFromUrl} disabled={busy} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Scrape & Import"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4" /> Bulk CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="text-xs">
              Columns: title,price,stock,description,images,sku (images separated by |)
            </Label>
            <Textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="title,price,stock,description,images,sku&#10;Phone Case,250,50,Premium case,https://img1|https://img2,SKU-1"
              className="font-mono text-xs"
            />
            <Button onClick={importCsv} disabled={busy} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import CSV"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {csvErrors.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-sm text-destructive">
              {csvErrors.length} row(s) failed to import
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs space-y-1 max-h-64 overflow-y-auto">
              {csvErrors.map((err, i) => (
                <li key={i} className="flex gap-2 border-b border-border/40 pb-1">
                  <span className="font-mono text-muted-foreground">L{err.row}</span>
                  <span className="font-medium truncate max-w-[200px]">
                    {err.title || "(no title)"}
                  </span>
                  <span className="text-destructive flex-1 truncate">{err.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function StockSyncStatus() {
  const { data } = useQuery({
    queryKey: ["stock-sync-status"],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .not("source_provider", "is", null);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { count: recent } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .not("source_provider", "is", null)
        .gte("last_stock_sync", twoHoursAgo);
      const { data: lastLog } = await supabase
        .from("stock_sync_logs")
        .select("created_at, status")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { total: total || 0, recent: recent || 0, lastLog };
    },
    refetchInterval: 60_000,
  });

  if (!data || data.total === 0) return null;

  const healthy = data.recent > 0;
  const lastRun = data.lastLog?.created_at
    ? new Date(data.lastLog.created_at).toLocaleString()
    : "never";

  return (
    <Card
      className={`border ${healthy ? "border-green-500/40 bg-green-500/5" : "border-amber-500/40 bg-amber-500/5"}`}
    >
      <CardContent className="py-3 px-4 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${healthy ? "bg-green-500 animate-pulse" : "bg-amber-500"}`}
          />
          <span className="font-medium">Hourly stock sync: {healthy ? "running" : "stalled"}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {data.recent}/{data.total} synced in last 2h · last run: {lastRun}
        </div>
      </CardContent>
    </Card>
  );
}

function CrewSopPanel() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-sm hover:bg-secondary/50 transition"
        >
          <span className="flex items-center gap-2 font-medium">
            <BookOpen className="w-4 h-4 text-pink-500" />
            Crew SOP — CJ Import Workflow & Troubleshooting
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="rounded-lg border border-border/60 bg-background p-4 space-y-4 text-xs leading-relaxed">
          <section>
            <h4 className="font-semibold text-sm mb-1">1. Standard Import Workflow</h4>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>
                Copy the <b>CJ Product SKU</b> (e.g. <code>CJFU241984203CX</code>) or numeric{" "}
                <b>pid</b> from CJ Dropshipping.
              </li>
              <li>Paste into the input above.</li>
              <li>
                Click <b>Preview</b> to verify title/price/stock, OR click <b>Import</b> for
                one-click fetch + save.
              </li>
              <li>(Optional) Pick a category and adjust price markup % before final save.</li>
              <li>
                Confirm success toast — product appears under <code>/kali_master/products</code>.
              </li>
            </ol>
          </section>
          <section>
            <h4 className="font-semibold text-sm mb-1">2. Data Pipeline</h4>
            <pre className="text-[11px] bg-secondary/40 rounded p-2 overflow-x-auto">
              {`UI input  →  previewDropshipProduct (server fn)
         →  supabase.functions.invoke('cj-proxy')
               · Vault: get_cj_api_key()
               · cj_tokens cache (auto-refresh)
               · CJ API /product/query
         →  importDropshipProduct
               →  mirrorImagesToR2()  (R2 bucket)
               →  supabaseAdmin.products.insert()`}
            </pre>
          </section>
          <section>
            <h4 className="font-semibold text-sm mb-1">3. Common Errors & Fixes</h4>
            <ul className="space-y-1.5 text-muted-foreground">
              <li>
                <b className="text-foreground">[cj-proxy network]</b> — Edge function down or
                unauthorised. Redeploy <code>cj-proxy</code>; confirm you are signed in as admin.
              </li>
              <li>
                <b className="text-foreground">[CJ API] CJ_API_KEY not configured</b> — Set the key
                via <code>/kali_master/integrations/cj</code> (runs <code>set_cj_api_key</code>{" "}
                Vault RPC).
              </li>
              <li>
                <b className="text-foreground">[CJ API] auth failed</b> — API key revoked or out of
                points. Check CJ console for daily Remaining Points.
              </li>
              <li>
                <b className="text-foreground">[CJ API] No product returned</b> — Wrong SKU/pid
                format. SKU must be alphanumeric like <code>CJFU…</code>; pid must be ≥6 digits.
              </li>
              <li>
                <b className="text-foreground">Cloudflare R2 upload</b> — Check{" "}
                <code>R2_ACCOUNT_ID</code>, <code>R2_ACCESS_KEY_ID</code>,{" "}
                <code>R2_SECRET_ACCESS_KEY</code>, <code>R2_BUCKET_NAME</code>,{" "}
                <code>R2_PUBLIC_CUSTOM_DOMAIN</code> secrets. If R2 fails, the import keeps the
                original CJ URL (non-blocking).
              </li>
              <li>
                <b className="text-foreground">Supabase product insert — duplicate</b> — Slug
                collision. Re-run; slug auto-randomises a suffix.
              </li>
              <li>
                <b className="text-foreground">Forbidden: admin only</b> — Your user lacks the{" "}
                <code>admin</code> role in <code>user_roles</code>.
              </li>
            </ul>
          </section>
          <section>
            <h4 className="font-semibold text-sm mb-1">4. R2 Media Sync</h4>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>
                Every imported product image is downloaded and re-uploaded to R2 under{" "}
                <code>products/cj/{`{pid}`}/…</code>.
              </li>
              <li>Existing R2 URLs are skipped (idempotent).</li>
              <li>
                Failed mirrors fall back to the source URL — visible in the product gallery; re-run
                import to retry.
              </li>
            </ul>
          </section>
          <section className="border-t border-border/40 pt-2">
            <h4 className="font-semibold text-sm mb-1">5. Sub-Agent Checklist</h4>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>
                Verify CJ key + token status at <code>/kali_master/integrations/cj</code>.
              </li>
              <li>Run a Preview before bulk to confirm the proxy is alive.</li>
              <li>
                If errors appear, screenshot the red Alert above — the <i>stage</i> badge tells
                which subsystem failed.
              </li>
              <li>Escalate to CEO only after Vault + R2 secrets confirmed present.</li>
            </ol>
          </section>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
