import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { uploadToR2 } from "@/lib/r2-upload.functions";
import { prepareImageForUpload } from "@/lib/image-prepare";
import { fileToBase64 } from "@/lib/file-utils";
import { supabase } from "@/integrations/supabase/client";

export type R2UploadResult = { url: string; key: string; provider: "r2" };

export type UseR2UploadOptions = {
  /** Folder prefix inside the bucket. */
  prefix?: string;
  /** If true (default for images), pre-optimize via WebP conversion. */
  optimizeImages?: boolean;
  /** Use the public multipart /api/r2-upload route instead of the RPC server fn. */
  useMultipartRoute?: boolean;
};

export function useR2Upload(defaults: UseR2UploadOptions = {}) {
  const upload = useServerFn(uploadToR2);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
    setError(null);
    setUrl(null);
  }, []);

  const uploadFile = useCallback(
    async (file: File, opts: UseR2UploadOptions = {}): Promise<R2UploadResult> => {
      const merged = { ...defaults, ...opts };
      setError(null);
      setUrl(null);
      setProgress(0);
      setIsUploading(true);
      try {
        const isImage = (file.type || "").startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
        const wantOptimize = merged.optimizeImages ?? isImage;

        let base64: string;
        let filename = file.name || "upload";
        let contentType = file.type || "application/octet-stream";

        if (wantOptimize && isImage) {
          const prepared = await prepareImageForUpload(file);
          base64 = prepared.base64;
          filename = prepared.filename;
          contentType = prepared.contentType;
        } else {
          base64 = await fileToBase64(file);
        }
        setProgress(40);

        // Multipart route path (uses XHR so we get real progress events).
        if (merged.useMultipartRoute) {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess.session?.access_token;
          if (!token) throw new Error("You must be signed in to upload");
          const form = new FormData();
          form.append("file", file);
          if (merged.prefix) form.append("prefix", merged.prefix);

          const result = await new Promise<R2UploadResult>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "/api/r2-upload");
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
            };
            xhr.onload = () => {
              try {
                const body = JSON.parse(xhr.responseText || "{}");
                if (xhr.status >= 200 && xhr.status < 300) resolve(body);
                else reject(new Error(body.error || `HTTP ${xhr.status}`));
              } catch (e: unknown) {
                reject(
                  new Error((e instanceof Error ? e.message : String(e)) || "Invalid response"),
                );
              }
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.send(form);
          });
          setProgress(100);
          setUrl(result.url);
          return result;
        }

        // Default: typed RPC server function path.
        const res = await upload({
          data: { base64, filename, contentType, prefix: merged.prefix },
        });
        setProgress(100);
        setUrl(res.url);
        return res;
      } catch (e: unknown) {
        const msg = (e instanceof Error ? e.message : String(e)) || "Upload failed";
        setError(msg);
        throw e;
      } finally {
        setIsUploading(false);
      }
    },
    [upload, defaults],
  );

  return { uploadFile, isUploading, progress, error, url, reset };
}
