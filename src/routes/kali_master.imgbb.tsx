import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Trash2,
  Image as ImageIcon,
  Upload,
  Copy,
  Check,
  HardDrive,
  RotateCw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/image-upload.functions";
import { fileToBase64 } from "@/lib/file-utils";

export const Route = createFileRoute("/kali_master/imgbb")({
  component: ImgbbSettingsPage,
});

type Status = {
  hasKey: boolean;
  isActive: boolean;
  updatedAt: string | null;
};

type TestUpload = {
  url: string;
  provider: "imgbb" | "supabase" | "r2";
  imgbbError?: { reason: string; message: string };
  filename: string;
  size: number;
};

function ImgbbSettingsPage() {
  const [status, setStatus] = useState<Status>({
    hasKey: false,
    isActive: false,
    updatedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const [activate, setActivate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [connTestLoading, setConnTestLoading] = useState(false);
  const [connTestResult, setConnTestResult] = useState<{
    ok: boolean;
    message: string;
    url?: string;
  } | null>(null);

  // Sample image upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sampleUploading, setSampleUploading] = useState(false);
  const [sampleResult, setSampleResult] = useState<TestUpload | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const callUpload = useServerFn(uploadImage);

  async function loadStatus() {
    setLoading(true);
    const { data, error } = await supabase
      .from("integration_settings")
      .select("is_active, updated_at, extra_config")
      .eq("provider", "imgbb")
      .maybeSingle();
    if (error) {
      toast.error(`Failed to load status: ${error.message}`);
    }
    setStatus({
      hasKey: !!data,
      isActive: !!data?.is_active,
      updatedAt: (data?.updated_at as string | null) ?? null,
    });
    if (data?.is_active != null) setActivate(!!data.is_active);
    setLoading(false);
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleSave() {
    const key = apiKey.trim();
    if (key.length < 8) {
      toast.error("Please paste a valid ImgBB API key");
      return;
    }
    setSaving(true);
    setConnTestResult(null);
    const { error } = await supabase.rpc("set_integration_secret", {
      p_provider: "imgbb",
      p_api_key: key,
      p_extra_config: {},
      p_activate: activate,
    });
    setSaving(false);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    toast.success("ImgBB API key saved");
    setApiKey("");
    await loadStatus();
  }

  async function handleRemove() {
    if (!confirm("Remove the saved ImgBB API key? Uploads will fall back to Supabase Storage.")) {
      return;
    }
    setRemoving(true);
    const { error } = await supabase.rpc("delete_integration_secret", {
      p_provider: "imgbb",
    });
    setRemoving(false);
    if (error) {
      toast.error(`Remove failed: ${error.message}`);
      return;
    }
    toast.success("ImgBB key removed");
    setConnTestResult(null);
    setSampleResult(null);
    await loadStatus();
  }

  async function handleConnectionTest() {
    setConnTestLoading(true);
    setConnTestResult(null);
    try {
      const res = await callUpload({
        data: {
          base64: await fileToBase64(
            new File(
              [
                Buffer.from(
                  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
                  "base64",
                ),
              ],
              "test.png",
              { type: "image/png" },
            ),
          ),
          filename: `imgbb-ping-${Date.now()}.png`,
          contentType: "image/png",
          fallbackBucket: "blog-images",
          fallbackPath: `imgbb-test/${Date.now()}.png`,
        },
      });
      if (res.provider === "r2") {
        setConnTestResult({
          ok: true,
          message: "Uploaded to Cloudflare R2 — primary CDN is healthy.",
          url: res.url,
        });
        toast.success("R2 upload OK");
      } else {
        setConnTestResult({
          ok: false,
          message:
            "Uploaded via Supabase Storage fallback — Cloudflare R2 is not configured on the server.",
          url: res.url,
        });
        toast.warning("R2 not configured — used Supabase fallback");
      }
    } catch (e: unknown) {
      setConnTestResult({
        ok: false,
        message: (e instanceof Error ? e.message : String(e)) || "Test upload failed",
      });
      toast.error("Test failed");
    } finally {
      setConnTestLoading(false);
    }
  }

  async function handleSampleUpload(forceFallback = false) {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (selectedFile.size > 15 * 1024 * 1024) {
      toast.error("Image too large (max 15 MB)");
      return;
    }
    setSampleUploading(true);
    setSampleResult(null);
    setSampleError(null);
    try {
      const base64 = await fileToBase64(selectedFile);
      const ext = (selectedFile.name.split(".").pop() || "jpg").toLowerCase();
      const path = `imgbb-test/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const res = await callUpload({
        data: {
          base64,
          filename: selectedFile.name,
          contentType: selectedFile.type,
          fallbackBucket: "blog-images",
          fallbackPath: path,
          forceFallback,
        },
      });
      setSampleResult({
        url: res.url,
        provider: res.provider,
        imgbbError: undefined,
        filename: selectedFile.name,
        size: selectedFile.size,
      });
      if (res.provider === "r2") {
        toast.success("Sample uploaded to Cloudflare R2");
      } else {
        toast.success("Sample uploaded to Supabase Storage (R2 not configured)");
      }
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : String(e)) || "Upload failed";
      toast.error(msg);
      setSampleError(msg);
    } finally {
      setSampleUploading(false);
    }
  }

  async function copyUrl() {
    if (!sampleResult?.url) return;
    try {
      await navigator.clipboard.writeText(sampleResult.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  const updatedLabel = status.updatedAt ? new Date(status.updatedAt).toLocaleString() : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-primary" />
          ImgBB API Key
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Securely store your ImgBB key so all in-app image uploads (avatars, return photos, blog &
          product images) are hosted on ImgBB and only the direct URL is saved in the database. When
          no key is set, uploads fall back to Supabase Storage automatically.
        </p>
      </div>

      {/* Key management */}
      <Card className="border-border/50">
        <CardHeader className="space-y-1">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Connection</CardTitle>
            {loading ? (
              <Badge variant="secondary">Loading…</Badge>
            ) : status.isActive ? (
              <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
            ) : status.hasKey ? (
              <Badge variant="secondary">Saved · Inactive</Badge>
            ) : (
              <Badge variant="outline">Not configured</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Get your key from{" "}
            <a
              href="https://api.imgbb.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              api.imgbb.com <ExternalLink className="w-3 h-3" />
            </a>{" "}
            (sign in → About → API).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="imgbb-key" className="text-xs">
              API Key
            </Label>
            <div className="relative">
              <Input
                id="imgbb-key"
                type={reveal ? "text" : "password"}
                value={apiKey}
                placeholder={
                  status.hasKey
                    ? "•••••••••••••••••••••••• (paste new key to replace)"
                    : "Your ImgBB API key (32+ chars)"
                }
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-9 font-mono text-sm"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                aria-label={reveal ? "Hide" : "Show"}
                onClick={() => setReveal((r) => !r)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Stored server-side in{" "}
              <code className="bg-muted px-1 rounded">integration_secrets</code>. Never exposed to
              the browser after save.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="imgbb-activate" checked={activate} onCheckedChange={setActivate} />
            <Label htmlFor="imgbb-activate" className="text-sm cursor-pointer">
              Activate on save (route uploads through ImgBB)
            </Label>
          </div>

          {updatedLabel && (
            <p className="text-[11px] text-muted-foreground">Last updated: {updatedLabel}</p>
          )}

          {connTestResult && (
            <div
              className={`flex items-start gap-2 text-xs rounded-md p-2 ${
                connTestResult.ok
                  ? "bg-green-500/10 text-green-700 dark:text-green-400"
                  : "bg-red-500/10 text-red-700 dark:text-red-400"
              }`}
            >
              {connTestResult.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 break-words">
                <p>{connTestResult.message}</p>
                {connTestResult.url && (
                  <a
                    href={connTestResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    Open uploaded file <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              onClick={handleSave}
              disabled={saving || apiKey.trim().length < 8}
              className="flex-1"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
                </>
              ) : status.hasKey ? (
                "Update Key"
              ) : (
                "Save Key"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleConnectionTest}
              disabled={connTestLoading || !status.hasKey}
              title={!status.hasKey ? "Save a key first" : "Upload a tiny test image"}
              className="flex-1"
            >
              {connTestLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing…
                </>
              ) : (
                "Connection Test"
              )}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removing || !status.hasKey}
              className="sm:w-auto"
            >
              {removing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span className="ml-2 sm:hidden">Remove</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sample image upload */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Test ImgBB Upload
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pick any image from your computer, upload it through the same flow used across the app,
            and inspect the returned URL and provider.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop / select area */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) {
                setSelectedFile(f);
                setSampleResult(null);
                setSampleError(null);
              }
            }}
            className="cursor-pointer rounded-lg border-2 border-dashed border-border/70 bg-muted/40 hover:bg-muted/70 transition-colors p-6 text-center"
          >
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {selectedFile ? selectedFile.name : "Click or drag an image here"}
            </p>
            {selectedFile && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {formatBytes(selectedFile.size)} · {selectedFile.type}
              </p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setSelectedFile(f);
                  setSampleResult(null);
                  setSampleError(null);
                }
              }}
            />
          </div>

          {selectedFile && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleSampleUpload()}
                disabled={sampleUploading}
                className="flex-1"
              >
                {sampleUploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload via ImgBB
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSampleUpload(true)}
                disabled={sampleUploading}
                className="flex-1"
                title="Skip ImgBB and upload directly to Supabase Storage"
              >
                <HardDrive className="w-4 h-4 mr-2" />
                Direct to Supabase
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedFile(null);
                  setSampleResult(null);
                  setSampleError(null);
                }}
                disabled={sampleUploading}
              >
                Clear
              </Button>
            </div>
          )}

          {/* Error */}
          {sampleError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{sampleError}</span>
            </div>
          )}

          {/* Result */}
          {sampleResult && (
            <div className="rounded-md border border-green-600/20 bg-green-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant={sampleResult.provider === "imgbb" ? "default" : "secondary"}
                  className={
                    sampleResult.provider === "imgbb"
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : ""
                  }
                >
                  {sampleResult.provider === "imgbb" ? "ImgBB" : "Supabase Storage"}
                </Badge>
                {sampleResult.imgbbError && (
                  <Badge variant="outline" className="text-amber-600 border-amber-600/30">
                    ImgBB fallback
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {formatBytes(sampleResult.size)}
                </span>
              </div>

              {/* Preview */}
              <img
                src={sampleResult.url}
                alt="Uploaded preview"
                className="max-h-40 rounded border border-border/50 object-cover"
              />

              {/* URL with copy */}
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] bg-muted px-2 py-1 rounded break-all text-muted-foreground">
                  {sampleResult.url}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyUrl}
                  className="h-7 text-xs shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 mr-1" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" asChild className="h-7 text-xs shrink-0">
                  <a href={sampleResult.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3 mr-1" /> Open
                  </a>
                </Button>
              </div>

              {sampleResult.imgbbError && (
                <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded p-2">
                  ImgBB error: {sampleResult.imgbbError.message}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
