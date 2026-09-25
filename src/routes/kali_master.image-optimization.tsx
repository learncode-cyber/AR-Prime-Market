import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DEFAULT_IMAGE_OPT_SETTINGS,
  getImageOptimizationSettings,
  saveImageOptimizationSettings,
  type ImageOptimizationSettings,
} from "@/lib/image-optimization.functions";
import {
  invalidateImageOptCache,
  prepareImageForUpload,
  type PreparedImage,
} from "@/lib/image-prepare";
import { Image as ImageIcon, Loader2, Save, Upload, Sparkles } from "lucide-react";

export const Route = createFileRoute("/kali_master/image-optimization")({
  component: ImageOptimizationPage,
});

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function ImageOptimizationPage() {
  const load = useServerFn(getImageOptimizationSettings);
  const save = useServerFn(saveImageOptimizationSettings);

  const [settings, setSettings] = useState<ImageOptimizationSettings>(DEFAULT_IMAGE_OPT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await load();
        setSettings(s);
      } catch (e: unknown) {
        toast.error((e instanceof Error ? e.message : String(e)) || "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await save({
        data: {
          enabled: settings.enabled,
          quality: settings.quality,
          max_width: settings.max_width,
          skip_animated: settings.skip_animated,
        },
      });
      invalidateImageOptCache();
      toast.success("Settings saved — applies to all new uploads immediately");
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ImageIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Image Optimization</h1>
          <p className="text-sm text-muted-foreground">
            Auto-convert every uploaded image to WebP. Free, runs in the browser — no API key
            needed.
          </p>
        </div>
      </div>

      <Card className="p-6 space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Enable WebP conversion</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  When on, every new image is converted to WebP before reaching ImgBB or Supabase
                  Storage.
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>
                  Quality: <span className="font-mono">{settings.quality}</span>
                </Label>
                <Badge variant="outline" className="text-xs">
                  {settings.quality >= 90
                    ? "Near-lossless"
                    : settings.quality >= 75
                      ? "Recommended"
                      : "Aggressive"}
                </Badge>
              </div>
              <Slider
                value={[settings.quality]}
                min={40}
                max={100}
                step={1}
                onValueChange={(v) => setSettings((s) => ({ ...s, quality: v[0] }))}
                disabled={!settings.enabled}
              />
              <p className="text-xs text-muted-foreground">
                Lower = smaller files. 82 is a good balance for product photos.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Max width (px) — 0 means no resize</Label>
              <Input
                type="number"
                min={0}
                max={10000}
                value={settings.max_width}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, max_width: parseInt(e.target.value || "0", 10) }))
                }
                disabled={!settings.enabled}
              />
              <p className="text-xs text-muted-foreground">
                Large product photos get downscaled to this width while keeping aspect ratio.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Skip animated images (GIF / animated WebP)</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  GIFs are always skipped to preserve animation. AVIF / HEIC also pass through
                  untouched.
                </p>
              </div>
              <Switch
                checked={settings.skip_animated}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, skip_animated: v }))}
              />
            </div>

            <div className="pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save settings
              </Button>
            </div>
          </>
        )}
      </Card>

      <TestPanel settings={settings} />

      <Card className="p-4 bg-muted/30 text-xs space-y-1">
        <p className="font-semibold">How it works</p>
        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
          <li>Conversion runs in the user's browser — no server cost, no API key.</li>
          <li>Original is kept if WebP comes out larger (rare on tiny icons).</li>
          <li>
            Settings apply instantly to every upload site-wide: products, blog, avatars, returns,
            categories.
          </li>
          <li>Old images are not re-encoded. They stay JPG/PNG until re-uploaded.</li>
        </ul>
      </Card>
    </div>
  );
}

function TestPanel({ settings }: { settings: ImageOptimizationSettings }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PreparedImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Force the test to use current (possibly unsaved) settings by bypassing cache.
  // We'll just invalidate before running.
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  async function handleFile(file: File) {
    setRunning(true);
    setResult(null);
    setPreviewUrl(null);
    try {
      invalidateImageOptCache(); // pick up newest saved settings
      const r = await prepareImageForUpload(file);
      setResult(r);
      if (r.converted) {
        // base64 → object URL preview
        const res = await fetch(r.base64);
        const blob = await res.blob();
        setPreviewUrl(URL.createObjectURL(blob));
      } else {
        setPreviewUrl(URL.createObjectURL(file));
      }
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Test failed");
    } finally {
      setRunning(false);
    }
  }

  const savings =
    result && result.originalSize > 0
      ? Math.round((1 - result.finalSize / result.originalSize) * 100)
      : 0;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="font-semibold">Test conversion</h2>
        <Badge variant="outline" className="ml-auto text-xs">
          {settings.enabled ? `WebP @ ${settings.quality}` : "Disabled"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Pick a JPG or PNG to see how it would be processed with the current settings. Save settings
        first to test the saved values.
      </p>

      <div>
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={running}>
          {running ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          {running ? "Optimizing image…" : "Choose image"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Stat label="Original" value={formatBytes(result.originalSize)} />
            <Stat label="After" value={formatBytes(result.finalSize)} />
            <Stat
              label="Saved"
              value={result.converted ? `${savings}%` : "—"}
              highlight={result.converted && savings > 0}
            />
            <Stat label="Format" value={result.contentType.replace("image/", "")} />
          </div>
          {!result.converted && (
            <p className="text-xs text-muted-foreground">
              Skipped: <span className="font-mono">{result.skippedReason}</span> — original passed
              through.
            </p>
          )}
          {previewUrl && (
            <img
              src={previewUrl}
              alt="preview"
              className="max-h-64 rounded border border-border/50 object-contain"
            />
          )}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md border border-border/50 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-mono mt-1 ${highlight ? "text-primary font-semibold" : ""}`}>
        {value}
      </div>
    </div>
  );
}
