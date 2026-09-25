import { useRef, useState } from "react";
import { Upload, Loader2, AlertTriangle, RotateCw, HardDrive, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { uploadImage } from "@/lib/image-upload.functions";
import { prepareImageForUpload } from "@/lib/image-prepare";

type Bucket = "avatars" | "return-images" | "blog-images" | "product-images" | "category-images";

interface Props {
  value: string;
  onChange: (url: string) => void;
  bucket: Bucket;
  pathPrefix?: string; // e.g. "categories"
  placeholder?: string;
  className?: string;
  preview?: boolean;
}

type UploadError = {
  message: string;
  reason?: string; // timeout | http | network | parse | unknown
  canRetry: boolean;
  canFallback: boolean;
};

export function ImageUploadField({
  value,
  onChange,
  bucket,
  pathPrefix = "",
  placeholder = "https://… or upload",
  className,
  preview = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "optimizing" | "uploading">("idle");
  const busy = phase !== "idle";
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<UploadError | null>(null);
  const upload = useServerFn(uploadImage);
  const [previewFailed, setPreviewFailed] = useState(false);

  const runUpload = async (file: File, opts: { forceFallback?: boolean } = {}) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image too large (max 15 MB)");
      return;
    }
    setPhase("optimizing");
    setError(null);
    try {
      const prepared = await prepareImageForUpload(file);
      setPhase("uploading");
      const ext = (prepared.filename.split(".").pop() || "jpg").toLowerCase();
      const safePrefix = pathPrefix ? `${pathPrefix.replace(/\/+$/, "")}/` : "";
      const path = `${safePrefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const res = await upload({
        data: {
          base64: prepared.base64,
          filename: prepared.filename,
          contentType: prepared.contentType,
          fallbackBucket: bucket,
          fallbackPath: path,
          forceFallback: opts.forceFallback,
        },
      });
      setPreviewFailed(false);
      onChange(res.url);
      setPendingFile(null);

      if (res.provider === "r2") {
        toast.success("Uploaded to Cloudflare R2");
      } else if (res.provider === "supabase") {
        toast.success("Uploaded to Supabase Storage (R2 not configured)");
      } else {
        toast.success("Uploaded");
      }
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : String(e)) || "Upload failed";
      const isTimeout = /timeout|did not respond|aborted/i.test(msg);
      const isImgbb = /imgbb/i.test(msg);
      toast.error(msg);
      setPendingFile(file);
      setError({
        message: msg,
        reason: isTimeout ? "timeout" : isImgbb ? "http" : "unknown",
        canRetry: true,
        canFallback: isImgbb || isTimeout,
      });
    } finally {
      setPhase("idle");
    }
  };

  const handleRetry = () => {
    if (pendingFile) runUpload(pendingFile);
  };
  const handleFallback = () => {
    if (pendingFile) runUpload(pendingFile, { forceFallback: true });
  };
  const dismissError = () => {
    setError(null);
    setPendingFile(null);
  };

  return (
    <div className={className}>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => {
            setPreviewFailed(false);
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          <span className="ml-1">
            {phase === "optimizing"
              ? "Optimizing…"
              : phase === "uploading"
                ? "Uploading…"
                : "Upload"}
          </span>
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) runUpload(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
          <div className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 break-words">
              <p className="font-medium">
                {error.reason === "timeout"
                  ? "Upload timed out"
                  : error.reason === "http"
                    ? "ImgBB rejected the request"
                    : error.reason === "network"
                      ? "Network error reaching ImgBB"
                      : "Upload failed"}
              </p>
              <p className="opacity-90">{error.message}</p>
            </div>
            <button
              type="button"
              onClick={dismissError}
              className="text-destructive/70 hover:text-destructive"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {(error.canRetry || error.canFallback) && pendingFile && (
            <div className="flex flex-wrap gap-2 mt-2 pl-6">
              {error.canRetry && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRetry}
                  disabled={busy}
                  className="h-7 text-xs"
                >
                  {busy ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <RotateCw className="w-3 h-3 mr-1" />
                  )}
                  Retry
                </Button>
              )}
              {error.canFallback && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleFallback}
                  disabled={busy}
                  className="h-7 text-xs"
                >
                  <HardDrive className="w-3 h-3 mr-1" />
                  Use Supabase Storage
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {preview && value && /^https?:\/\//.test(value) && (
        <div className="mt-2 max-h-32 w-fit overflow-hidden rounded border border-border/50 bg-muted">
          {previewFailed ? (
            <div className="flex h-24 w-32 items-center justify-center px-2 text-center text-xs text-muted-foreground">
              Preview unavailable
            </div>
          ) : (
            <img
              key={value}
              src={value}
              alt="preview"
              className="max-h-32 object-cover"
              referrerPolicy="no-referrer"
              onLoad={() => setPreviewFailed(false)}
              onError={() => setPreviewFailed(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}
