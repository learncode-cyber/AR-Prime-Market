import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  KeyRound,
  Sparkles,
  Save,
  Trash2,
  ShieldCheck,
  AlertCircle,
  Wand2,
  Code2,
  Gauge,
  FileText,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { generateSeoBlogPost } from "@/lib/blog-ai.functions";
import { architectGenerate } from "@/lib/ai-architect.functions";
import {
  EditModeProvider,
  EditModeToggle,
  EditModeFieldset,
  useEditMode,
} from "@/components/admin/EditModeShell";

/* ───────────────────────────── Tab 1: Pixels ───────────────────────────── */

type TrackerRow = { provider: string; tracker_id: string; script_code: string; is_active: boolean };

const TRACKERS: {
  key: string;
  label: string;
  hint: string;
  placeholder: string;
  showScript?: boolean;
  scriptOnly?: boolean;
}[] = [
  {
    key: "facebook_pixel",
    label: "Facebook Pixel",
    hint: "Meta Pixel ID",
    placeholder: "1234567890",
  },
  {
    key: "tiktok_pixel",
    label: "TikTok Pixel",
    hint: "TikTok Pixel ID",
    placeholder: "CXXXXXXXXXXXXXX",
  },
  {
    key: "google_analytics",
    label: "Google Analytics (GA4)",
    hint: "Measurement ID",
    placeholder: "G-XXXXXXXXXX",
  },
  {
    key: "google_ads",
    label: "Google Ads Conversion",
    hint: "AW conversion ID",
    placeholder: "AW-XXXXXXXXX",
  },
  { key: "gtm", label: "Google Tag Manager", hint: "GTM container ID", placeholder: "GTM-XXXXXXX" },
  { key: "snap_pixel", label: "Snap Pixel", hint: "Snap Pixel ID", placeholder: "xxxxxxxx-xxxx" },
  {
    key: "custom_head",
    label: "Custom <head> Script",
    hint: "Raw HTML injected in <head>",
    placeholder: "",
    showScript: true,
    scriptOnly: true,
  },
  {
    key: "custom_body",
    label: "Custom <body> Script",
    hint: "Raw HTML injected before </body>",
    placeholder: "",
    showScript: true,
    scriptOnly: true,
  },
];

export function PixelsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["marketing-trackers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_trackers")
        .select("provider, tracker_id, script_code, is_active");
      return data ?? [];
    },
  });

  const rows = useMemo<Record<string, TrackerRow>>(() => {
    const map: Record<string, TrackerRow> = {};
    TRACKERS.forEach((t) => {
      const found = data?.find((d) => d.provider === t.key);
      map[t.key] = {
        provider: t.key,
        tracker_id: found?.tracker_id ?? "",
        script_code: found?.script_code ?? "",
        is_active: found?.is_active ?? true,
      };
    });
    return map;
  }, [data]);

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3 text-sm">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <p className="text-muted-foreground">
            Save any tracker ID below — active rows are injected site-wide instantly via{" "}
            <code className="bg-secondary px-1 rounded text-xs">MarketingTrackers</code>. No
            redeploy required.
          </p>
        </CardContent>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Loading trackers…</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {TRACKERS.map((p) => (
          <TrackerCard
            key={p.key}
            providerKey={p.key}
            label={p.label}
            hint={p.hint}
            placeholder={p.placeholder}
            showScript={p.showScript}
            scriptOnly={p.scriptOnly}
            initial={rows[p.key]}
            onSaved={() => qc.invalidateQueries({ queryKey: ["marketing-trackers"] })}
          />
        ))}
      </div>
    </div>
  );
}

function TrackerCard(props: {
  providerKey: string;
  label: string;
  hint: string;
  placeholder: string;
  showScript?: boolean;
  scriptOnly?: boolean;
  initial: TrackerRow;
  onSaved: () => void;
}) {
  return (
    <EditModeProvider>
      <TrackerCardInner {...props} />
    </EditModeProvider>
  );
}

function TrackerCardInner({
  providerKey,
  label,
  hint,
  placeholder,
  showScript,
  scriptOnly,
  initial,
  onSaved,
}: {
  providerKey: string;
  label: string;
  hint: string;
  placeholder: string;
  showScript?: boolean;
  scriptOnly?: boolean;
  initial: TrackerRow;
  onSaved: () => void;
}) {
  const { lock } = useEditMode();
  const [row, setRow] = useState<TrackerRow>(initial);
  useEffect(() => setRow(initial), [initial]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("marketing_trackers").upsert(
      {
        provider: row.provider,
        tracker_id: row.tracker_id || null,
        script_code: row.script_code || null,
        is_active: row.is_active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider" },
    );
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`${label} saved`);
      onSaved();
      lock();
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 gap-2">
        <div className="min-w-0">
          <CardTitle className="text-base">{label}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <EditModeToggle />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <EditModeFieldset>
          <div className="space-y-3">
            <div className="flex items-center justify-end gap-2">
              <Label htmlFor={`active-${providerKey}`} className="text-xs text-muted-foreground">
                Active
              </Label>
              <Switch
                id={`active-${providerKey}`}
                checked={row.is_active}
                onCheckedChange={(v) => setRow({ ...row, is_active: v })}
              />
            </div>
            {!scriptOnly && (
              <div>
                <Label className="text-xs">Tracker ID</Label>
                <Input
                  className="mt-1"
                  placeholder={placeholder}
                  value={row.tracker_id}
                  onChange={(e) => setRow({ ...row, tracker_id: e.target.value })}
                />
              </div>
            )}
            {(showScript || scriptOnly) && (
              <div>
                <Label className="text-xs">Raw script (optional)</Label>
                <Textarea
                  className="mt-1 font-mono text-xs min-h-[110px]"
                  placeholder="<script>...</script>"
                  value={row.script_code}
                  onChange={(e) => setRow({ ...row, script_code: e.target.value })}
                />
              </div>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={save} disabled={saving}>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {saving ? "Saving…" : "সেভ করুন"}
              </Button>
            </div>
          </div>
        </EditModeFieldset>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────────── Tab 2: SEO + Blog ───────────────────────────── */

type SeoProviderKey = "semrush" | "ahrefs" | "dataforseo" | "serpapi" | "cron";
const SEO_PROVIDERS: {
  key: SeoProviderKey;
  label: string;
  description: string;
  placeholder: string;
  helpUrl?: string;
}[] = [
  {
    key: "semrush",
    label: "Semrush",
    description: "Keyword research & competitor data",
    placeholder: "Your Semrush API key",
    helpUrl: "https://www.semrush.com/api-documentation/",
  },
  {
    key: "ahrefs",
    label: "Ahrefs",
    description: "Backlinks & keyword difficulty",
    placeholder: "Your Ahrefs API token",
    helpUrl: "https://ahrefs.com/api",
  },
  {
    key: "dataforseo",
    label: "DataForSEO",
    description: "Affordable SERP & rank data",
    placeholder: "login:password (base64)",
    helpUrl: "https://dataforseo.com/apis",
  },
  {
    key: "serpapi",
    label: "SerpAPI",
    description: "Real-time Google SERP scraping",
    placeholder: "Your SerpAPI key",
    helpUrl: "https://serpapi.com/manage-api-key",
  },
  {
    key: "cron",
    label: "Cron Secret (4:00 AM blog automation)",
    description: "Shared secret sent in x-cron-secret header. Rotate any time.",
    placeholder: "Long random string (32+ chars)",
  },
];

export function SeoTab() {
  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3 text-sm">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <p className="text-muted-foreground">
            All keys are stored server-only in{" "}
            <code className="bg-secondary px-1 rounded text-xs">integration_secrets</code> via the
            <code className="bg-secondary px-1 rounded text-xs ml-1">
              set_integration_secret
            </code>{" "}
            RPC — no client ever reads them back.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">SEO providers & cron secret</h2>
        <div className="grid gap-4">
          {SEO_PROVIDERS.map((p) => (
            <SecretCard
              key={p.key}
              providerKey={p.key}
              label={p.label}
              description={p.description}
              placeholder={p.placeholder}
              helpUrl={p.helpUrl}
            />
          ))}
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Live SEO Score Analyzer</h2>
        <p className="text-xs text-muted-foreground">
          Paste a draft (title, meta description, content). The widget scores 0–100 on keyword
          density, heading hierarchy, meta length and image alt coverage — in real time.
        </p>
        <SeoScoreWidget />
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Automated blog engine</h2>
        <AutomationToggleCard />
        <BlogQuickActions />
      </section>
    </div>
  );
}

function SecretCard({
  providerKey,
  label,
  description,
  placeholder,
  helpUrl,
}: {
  providerKey: SeoProviderKey;
  label: string;
  description: string;
  placeholder: string;
  helpUrl?: string;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [activate, setActivate] = useState(true);

  const { data: row } = useQuery({
    queryKey: ["integration-settings", providerKey],
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_settings")
        .select("provider, is_active, updated_at")
        .eq("provider", providerKey)
        .maybeSingle();
      return data;
    },
  });
  const hasKey = !!row;
  const isActive = !!row?.is_active;

  const save = useMutation({
    mutationFn: async () => {
      const t = value.trim();
      if (t.length < 8) throw new Error("Key looks too short (min 8 chars).");
      const { error } = await supabase.rpc("set_integration_secret", {
        p_provider: providerKey,
        p_api_key: t,
        p_extra_config: {},
        p_activate: activate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${label} saved`);
      setValue("");
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("integration_settings")
        .update({ is_active: next })
        .eq("provider", providerKey);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration-settings"] }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_integration_secret", {
        p_provider: providerKey,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${label} removed`);
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
    },
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1 min-w-0">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <KeyRound className="w-4 h-4 text-primary" />
            <span className="truncate">{label}</span>
            {hasKey ? (
              <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">
                {isActive ? "Active" : "Saved"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Not set
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
        {hasKey && (
          <div className="flex items-center gap-2 shrink-0">
            <Label className="text-xs text-muted-foreground">Enabled</Label>
            <Switch
              checked={isActive}
              onCheckedChange={(v) => toggle.mutate(v)}
              disabled={toggle.isPending}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
          <PasswordInput
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={save.isPending}
          />
          <div className="flex items-center gap-2 px-3 border border-border rounded-md">
            <Switch checked={activate} onCheckedChange={setActivate} />
            <Label className="text-xs whitespace-nowrap">Activate on save</Label>
          </div>
          <Button onClick={() => save.mutate()} disabled={!value.trim() || save.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {row?.updated_at && <span>Updated {new Date(row.updated_at).toLocaleString()}</span>}
            {helpUrl && (
              <a
                href={helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Get API key →
              </a>
            )}
          </div>
          {hasKey && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Remove
            </Button>
          )}
        </div>
        {providerKey === "cron" && (
          <div className="flex items-start gap-2 text-xs bg-amber-500/10 border border-amber-500/20 rounded-md p-2 text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              The 4:00 AM cron sends this in the{" "}
              <code className="bg-secondary px-1 rounded">x-cron-secret</code> header. After
              rotating, update the pg_cron schedule with the new value.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SeoScoreWidget() {
  const [title, setTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [keyword, setKeyword] = useState("");
  const [content, setContent] = useState("");

  const analysis = useMemo(() => {
    const words = content.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const kw = keyword.trim().toLowerCase();
    const lowerContent = content.toLowerCase();
    const occurrences = kw
      ? (
          lowerContent.match(
            new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"),
          ) || []
        ).length
      : 0;
    const density = wordCount && kw ? (occurrences / wordCount) * 100 : 0;

    const h1 = (content.match(/^#\s|<h1[\s>]/gim) || []).length;
    const h2 = (content.match(/^##\s|<h2[\s>]/gim) || []).length;
    const h3 = (content.match(/^###\s|<h3[\s>]/gim) || []).length;

    const imgTotal = (content.match(/<img[^>]*>|!\[[^\]]*\]\([^)]+\)/g) || []).length;
    const imgWithAlt =
      (content.match(/<img[^>]*\salt=["'][^"']+["'][^>]*>/g) || []).length +
      (content.match(/!\[[^\]]+\]\([^)]+\)/g) || []).length;
    const altCoverage = imgTotal === 0 ? 100 : Math.round((imgWithAlt / imgTotal) * 100);

    let score = 0;
    const tips: { label: string; ok: boolean; detail: string }[] = [];

    const titleLen = title.length;
    const titleOk = titleLen >= 30 && titleLen <= 60;
    if (titleOk) score += 15;
    tips.push({
      label: "Meta title length",
      ok: titleOk,
      detail: `${titleLen}/60 chars (sweet spot 30-60)`,
    });

    const metaLen = metaDesc.length;
    const metaOk = metaLen >= 70 && metaLen <= 160;
    if (metaOk) score += 15;
    tips.push({
      label: "Meta description length",
      ok: metaOk,
      detail: `${metaLen}/160 chars (sweet spot 70-160)`,
    });

    const densityOk = density >= 0.5 && density <= 2.5;
    if (densityOk) score += 20;
    tips.push({
      label: "Keyword density",
      ok: densityOk,
      detail: kw
        ? `${density.toFixed(2)}% (${occurrences}× in ${wordCount} words) — target 0.5-2.5%`
        : "Add a focus keyword",
    });

    const headingsOk = h1 === 1 && h2 >= 2;
    if (headingsOk) score += 20;
    tips.push({
      label: "Heading hierarchy",
      ok: headingsOk,
      detail: `H1: ${h1} (need 1) · H2: ${h2} (need 2+) · H3: ${h3}`,
    });

    const lenOk = wordCount >= 600;
    if (lenOk) score += 15;
    tips.push({ label: "Content length", ok: lenOk, detail: `${wordCount} words (target 600+)` });

    const altOk = altCoverage === 100;
    if (altOk) score += 15;
    tips.push({
      label: "Image alt text",
      ok: altOk,
      detail: imgTotal === 0 ? "No images" : `${imgWithAlt}/${imgTotal} have alt`,
    });

    return { score, tips, wordCount, density, occurrences, h1, h2, h3, altCoverage, imgTotal };
  }, [title, metaDesc, keyword, content]);

  const tone =
    analysis.score >= 80
      ? "text-emerald-500"
      : analysis.score >= 50
        ? "text-amber-500"
        : "text-destructive";

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-4">
        <div className="grid lg:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Meta title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title users see in Google"
            />
            <p className="text-[11px] text-muted-foreground">{title.length}/60</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Focus keyword</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="best noise cancelling earbuds"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Meta description</Label>
          <Textarea
            rows={2}
            value={metaDesc}
            onChange={(e) => setMetaDesc(e.target.value)}
            placeholder="Snippet shown in search results"
          />
          <p className="text-[11px] text-muted-foreground">{metaDesc.length}/160</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Article content (Markdown or HTML)</Label>
          <Textarea
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="# Heading\nParagraphs, ![alt](image.jpg), <h2>Section</h2>…"
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-2 rounded-lg border border-border/60 bg-secondary/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">SEO score</span>
            </div>
            <span className={`text-2xl font-bold ${tone}`}>
              {analysis.score}
              <span className="text-xs text-muted-foreground">/100</span>
            </span>
          </div>
          <Progress value={analysis.score} />
          <ul className="grid sm:grid-cols-2 gap-1.5 mt-2">
            {analysis.tips.map((t) => (
              <li key={t.label} className="flex items-start gap-2 text-xs">
                <span
                  className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${t.ok ? "bg-emerald-500" : "bg-destructive"}`}
                />
                <div>
                  <p className="font-medium text-foreground">{t.label}</p>
                  <p className="text-muted-foreground">{t.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function AutomationToggleCard() {
  const qc = useQueryClient();
  const { data: row } = useQuery({
    queryKey: ["integration-settings", "sitemap_ping"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_settings")
        .select("provider, is_active, extra_config")
        .eq("provider", "sitemap_ping")
        .maybeSingle();
      return data;
    },
  });
  const enabled = !!row?.is_active;

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase.rpc("set_integration_secret", {
        p_provider: "sitemap_ping",
        p_api_key: "enabled",
        p_extra_config: { auto_ping: next },
        p_activate: next,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sitemap auto-ping updated");
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">XML sitemap auto-ping</p>
          <p className="text-xs text-muted-foreground mt-1">
            When a new automated blog publishes (4:00 AM cron), ping Google & Bing so the sitemap is
            reindexed faster. OG meta tags + JSON-LD{" "}
            <code className="bg-secondary px-1 rounded">BlogPosting</code> schema are emitted on
            every post page by default.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">{enabled ? "Enabled" : "Disabled"}</Label>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => toggle.mutate(v)}
            disabled={toggle.isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function BlogQuickActions() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const generate = useServerFn(generateSeoBlogPost);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const { data: posts } = useQuery({
    queryKey: ["admin-blog-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id,title,is_published,created_at,featured_image_url,author_name")
        .order("created_at", { ascending: false })
        .limit(6);
      return data || [];
    },
  });

  const run = async (prompt?: string) => {
    setBusy(true);
    try {
      const res: any = await generate({ data: { autoPublish: false, customPrompt: prompt } });
      toast.success(`Draft created: ${res?.post?.title ?? "post"}`);
      qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      setOpen(false);
      setCustomPrompt("");
      if (res?.post?.id) navigate({ to: "/kali_master/blog/$id", params: { id: res.post.id } });
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Manual blog drafts
          </CardTitle>
          <CardDescription className="text-xs">
            Trigger the same AI engine used by the 4:00 AM cron. Drafts include AI-written content +
            matching cover image.
          </CardDescription>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => run()} disabled={busy}>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            {busy ? "Generating…" : "Quick AI Draft"}
          </Button>
          <Button size="sm" onClick={() => setOpen(true)} disabled={busy}>
            <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Custom Prompt
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {posts?.map((p: any) => (
            <Link
              key={p.id}
              to="/kali_master/blog/$id"
              params={{ id: p.id }}
              className="flex items-center gap-2 p-2 border border-border/50 rounded-lg hover:bg-secondary/40 text-xs"
            >
              {p.featured_image_url ? (
                <img src={p.featured_image_url} alt="" className="w-10 h-10 rounded object-cover" />
              ) : (
                <div className="w-10 h-10 rounded bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{p.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {p.is_published ? "Published" : "Draft"} ·{" "}
                  {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
              <Pencil className="w-3 h-3 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
        <div className="mt-3 text-xs">
          <Link to="/kali_master/blog" className="text-primary hover:underline">
            All blog posts →
          </Link>
          <span className="mx-2 text-muted-foreground">·</span>
          <Link to="/kali_master/blog-logs" className="text-primary hover:underline">
            Generation logs →
          </Link>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate blog from your prompt</DialogTitle>
            <DialogDescription>
              Describe the article — topic, angle, audience, tone. AI writes the post + matching
              cover image and saves as a draft for review.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={8}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Example: Buying guide for the top 5 noise-cancelling earbuds for travelers in 2026…"
            disabled={busy}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => run(customPrompt)}
              disabled={busy || customPrompt.trim().length < 10}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {busy ? "Generating…" : "Generate Draft + Image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ───────────────────────────── Tab 3: Claude Architect ───────────────────────────── */

export function ArchitectTab() {
  return (
    <div className="space-y-5">
      <ClaudeKeyCard />
      <ArchitectChatCard />
      <SettingsListCard />
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3 text-sm">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1 text-amber-800 dark:text-amber-200">
            <p className="font-medium">Safety guardrail</p>
            <p className="text-xs">
              The Architect only stores Tailwind classes and structured JSON data. Arbitrary
              JavaScript is <strong>never executed</strong> on your live site, even if the model
              returns it — preventing XSS via prompt injection.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ClaudeKeyCard() {
  const qc = useQueryClient();
  const [value, setValue] = useState("");

  const { data: hasKey } = useQuery({
    queryKey: ["integration-settings", "anthropic"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_settings")
        .select("provider")
        .eq("provider", "anthropic")
        .maybeSingle();
      return !!data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const t = value.trim();
      if (!t.startsWith("sk-ant-")) throw new Error("Anthropic keys start with sk-ant-");
      const { error } = await supabase.rpc("set_integration_secret", {
        p_provider: "anthropic",
        p_api_key: t,
        p_extra_config: {},
        p_activate: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Claude API key saved");
      setValue("");
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_integration_secret", {
        p_provider: "anthropic",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Claude key removed");
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
    },
  });

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          Anthropic Claude API Key
          {hasKey ? (
            <Badge className="text-[10px]">Active</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              Not set
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Stored server-only in <code>integration_secrets</code>. If unset, the Architect falls back
          to Gemini.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
          <PasswordInput
            autoComplete="off"
            placeholder="sk-ant-api03-…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={save.isPending}
          />
          <Button onClick={() => save.mutate()} disabled={!value.trim() || save.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          {hasKey && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Get a key at{" "}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            console.anthropic.com
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}

function ArchitectChatCard() {
  const fn = useServerFn(architectGenerate);
  const qc = useQueryClient();
  const [componentName, setComponentName] = useState("home.hero");
  const [prompt, setPrompt] = useState("");
  const [apply, setApply] = useState(true);
  const [lastResult, setLastResult] = useState<null | {
    summary: string | null;
    css_classes: string;
    json_data: unknown;
    providerUsed: string;
  }>(null);

  const generate = useMutation({
    mutationFn: async () =>
      fn({
        data: {
          prompt: prompt.trim(),
          componentName: componentName.trim(),
          applyImmediately: apply,
        },
      }),
    onSuccess: (r) => {
      setLastResult({
        summary: r.summary,
        css_classes: r.css_classes,
        json_data: r.json_data,
        providerUsed: r.providerUsed,
      });
      if (apply) {
        toast.success("Applied live to the site");
        qc.invalidateQueries({ queryKey: ["dynamic-ui-settings"] });
      } else toast.success("Preview ready — toggle 'Apply live' to publish");
    },
    onError: (e: any) => toast.error(e?.message || "Generation failed"),
  });

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" /> Design request
        </CardTitle>
        <CardDescription className="text-xs">
          Reference any component your codebase calls <code>useDynamicUI("component.name")</code> on
          (e.g. <code>home.hero</code>, <code>nav.cta</code>).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-[200px_1fr] gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Component</Label>
            <Input
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              placeholder="home.hero"
              disabled={generate.isPending}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Request</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g. "Make the hero darker with a gold accent CTA"'
              rows={4}
              disabled={generate.isPending}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch checked={apply} onCheckedChange={setApply} />
            <Label className="text-xs">Apply live (publish to site)</Label>
          </div>
          <Button
            onClick={() => generate.mutate()}
            disabled={!prompt.trim() || !componentName.trim() || generate.isPending}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {generate.isPending ? "Thinking…" : "Generate with Claude"}
          </Button>
        </div>
        {lastResult && (
          <div className="mt-3 space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Code2 className="w-3.5 h-3.5" /> Provider:{" "}
              <Badge variant="secondary" className="text-[10px]">
                {lastResult.providerUsed}
              </Badge>
            </div>
            {lastResult.summary && <p className="text-sm">{lastResult.summary}</p>}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Tailwind classes</p>
              <pre className="text-xs bg-background border border-border rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
                {lastResult.css_classes || "(none)"}
              </pre>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">JSON data</p>
              <pre className="text-xs bg-background border border-border rounded p-2 overflow-x-auto">
                {JSON.stringify(lastResult.json_data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsListCard() {
  const qc = useQueryClient();
  const { data: rows, isLoading } = useQuery({
    queryKey: ["dynamic-ui-settings", "all"],
    queryFn: async () => {
      const { data, error } = await (
        supabase.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: unknown }>
      )("get_dynamic_ui_settings_admin");
      if (error) throw error;
      return (
        (data as Array<{
          id: string;
          component_name: string;
          css_classes: string | null;
          json_data: unknown;
          prompt: string | null;
          is_active: boolean;
          updated_at: string;
        }>) ?? []
      );
    },
  });

  const toggle = useMutation({
    mutationFn: async (vars: { id: string; next: boolean }) => {
      const { error } = await supabase
        .from("dynamic_ui_settings")
        .update({ is_active: vars.next })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dynamic-ui-settings"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dynamic_ui_settings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Override removed");
      qc.invalidateQueries({ queryKey: ["dynamic-ui-settings"] });
    },
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Active overrides</CardTitle>
          <CardDescription className="text-xs">
            Every row broadcasts in realtime — toggling Active flips the site instantly.
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["dynamic-ui-settings"] })}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (!rows || rows.length === 0) && (
          <p className="text-sm text-muted-foreground">No overrides yet — generate one above.</p>
        )}
        {rows?.map((row) => (
          <div key={row.id} className="border border-border/60 rounded-lg p-3 space-y-2 bg-card">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold truncate">{row.component_name}</p>
                {row.prompt && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{row.prompt}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={!!row.is_active}
                  onCheckedChange={(v) => toggle.mutate({ id: row.id, next: v })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive h-8 w-8"
                  onClick={() => remove.mutate(row.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            {row.css_classes && (
              <pre className="text-[11px] bg-secondary/40 border border-border/40 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-words">
                {row.css_classes}
              </pre>
            )}
            <p className="text-[10px] text-muted-foreground">
              Updated {new Date(row.updated_at).toLocaleString()}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
