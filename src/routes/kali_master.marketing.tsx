import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Megaphone, Facebook } from "lucide-react";

export const Route = createFileRoute("/kali_master/marketing")({
  component: AdminMarketing,
});

type Provider = {
  key: string;
  label: string;
  hint: string;
  idPlaceholder: string;
  showScript?: boolean;
  scriptOnly?: boolean;
};

const PROVIDERS: Provider[] = [
  {
    key: "facebook_pixel",
    label: "Facebook Pixel",
    hint: "Meta Pixel ID (e.g. 1234567890)",
    idPlaceholder: "1234567890",
  },
  {
    key: "gtm",
    label: "Google Tag Manager",
    hint: "GTM container ID",
    idPlaceholder: "GTM-XXXXXXX",
  },
  {
    key: "google_analytics",
    label: "Google Analytics (GA4)",
    hint: "Measurement ID",
    idPlaceholder: "G-XXXXXXXXXX",
  },
  {
    key: "google_ads",
    label: "Google Ads",
    hint: "Conversion / AW ID",
    idPlaceholder: "AW-XXXXXXXXX",
  },
  {
    key: "tiktok_pixel",
    label: "TikTok Pixel",
    hint: "TikTok Pixel ID",
    idPlaceholder: "CXXXXXXXXXXXXXX",
  },
  { key: "snap_pixel", label: "Snap Pixel", hint: "Snap Pixel ID", idPlaceholder: "xxxxxxxx-xxxx" },
  {
    key: "custom_head",
    label: "Custom <head> Script",
    hint: "Raw HTML/script injected in <head>",
    idPlaceholder: "",
    showScript: true,
    scriptOnly: true,
  },
  {
    key: "custom_body",
    label: "Custom <body> Script",
    hint: "Raw HTML/script injected before </body>",
    idPlaceholder: "",
    showScript: true,
    scriptOnly: true,
  },
];

type Row = { provider: string; tracker_id: string; script_code: string; is_active: boolean };

function AdminMarketing() {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("marketing_trackers")
        .select("provider, tracker_id, script_code, is_active");
      const map: Record<string, Row> = {};
      PROVIDERS.forEach((p) => {
        const found = data?.find((d) => d.provider === p.key);
        map[p.key] = {
          provider: p.key,
          tracker_id: found?.tracker_id ?? "",
          script_code: found?.script_code ?? "",
          is_active: found?.is_active ?? true,
        };
      });
      setRows(map);
      setLoading(false);
    })();
  }, []);

  const update = (key: string, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [key]: { ...r[key], ...patch } }));

  const save = async (key: string) => {
    setSaving(key);
    const row = rows[key];
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
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success(`${PROVIDERS.find((p) => p.key === key)?.label} saved`);
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const pixelRow = rows["facebook_pixel"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketing Configuration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Paste your tracker IDs or full scripts. Active items inject automatically site-wide.
          </p>
        </div>
      </div>

      {/* Global Meta Pixels Control — premium card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
              <Facebook className="w-5 h-5 text-[#1877F2]" />
            </div>
            <div>
              <CardTitle className="text-base">Global Meta Pixels Control</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dynamic Meta (Facebook) Pixel ID. Loads on every public page automatically and never
                fires inside /kali_master.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 flex flex-col flex-1">
          <div>
            <Label className="text-xs">Meta Pixel ID</Label>
            <Input
              className="mt-1 font-mono"
              placeholder="2382736205496567"
              value={pixelRow?.tracker_id ?? ""}
              onChange={(e) =>
                update("facebook_pixel", { tracker_id: e.target.value, is_active: true })
              }
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Changes propagate to the storefront on the next page load. Use only digits.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-auto pt-2">
            <div className="flex items-center gap-2">
              <Switch
                id="pixel-active"
                checked={pixelRow?.is_active ?? true}
                onCheckedChange={(v) => update("facebook_pixel", { is_active: v })}
              />
              <Label htmlFor="pixel-active" className="text-xs text-muted-foreground">
                Pixel active site-wide
              </Label>
            </div>
            <Button
              className="w-full sm:w-auto"
              onClick={() => save("facebook_pixel")}
              disabled={saving === "facebook_pixel"}
            >
              {saving === "facebook_pixel" ? "Saving…" : "Save Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {PROVIDERS.map((p) => {
          const row = rows[p.key];
          return (
            <Card key={p.key} className="border-border/60 flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 p-4 sm:p-6">
                <div className="min-w-0">
                  <CardTitle className="text-base">{p.label}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{p.hint}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Label
                    htmlFor={`active-${p.key}`}
                    className="text-xs text-muted-foreground hidden sm:inline"
                  >
                    Active
                  </Label>
                  <Switch
                    id={`active-${p.key}`}
                    checked={row.is_active}
                    onCheckedChange={(v) => update(p.key, { is_active: v })}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 flex flex-col flex-1 p-4 sm:p-6 pt-0">
                {!p.scriptOnly && (
                  <div>
                    <Label className="text-xs">Tracker ID</Label>
                    <Input
                      className="mt-1"
                      placeholder={p.idPlaceholder}
                      value={row.tracker_id}
                      onChange={(e) => update(p.key, { tracker_id: e.target.value })}
                    />
                  </div>
                )}
                {(p.showScript || p.scriptOnly) && (
                  <div>
                    <Label className="text-xs">Raw Script (optional)</Label>
                    <Textarea
                      className="mt-1 font-mono text-xs min-h-[120px]"
                      placeholder="<script>...</script>"
                      value={row.script_code}
                      onChange={(e) => update(p.key, { script_code: e.target.value })}
                    />
                  </div>
                )}
                <div className="flex justify-end mt-auto pt-2">
                  <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => save(p.key)}
                    disabled={saving === p.key}
                  >
                    {saving === p.key ? "Saving…" : "Save"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
