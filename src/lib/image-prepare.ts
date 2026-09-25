// Client-side image preparation: optional WebP conversion + downscale before
// sending to the uploadImage server function. Zero deps for the JPEG/PNG path
// (uses the browser Canvas API). HEIC/HEIF is handled via a dynamically
// imported decoder so iPhone uploads work without bloating the main bundle.
// EXIF orientation is read and respected so portrait phone photos stay upright.

import { fileToBase64 } from "@/lib/file-utils";
import {
  DEFAULT_IMAGE_OPT_SETTINGS,
  getImageOptimizationSettings,
  type ImageOptimizationSettings,
} from "@/lib/image-optimization.functions";

export type PreparedImage = {
  base64: string;
  filename: string;
  contentType: string;
  originalSize: number;
  finalSize: number;
  converted: boolean;
  skippedReason?: string;
};

export type PrepareProgress = (phase: "decoding-heic" | "reading-exif" | "encoding-webp") => void;

let cached: { value: ImageOptimizationSettings; at: number } | null = null;
const TTL = 60_000;

export function invalidateImageOptCache() {
  cached = null;
}

async function loadSettings(): Promise<ImageOptimizationSettings> {
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  try {
    const value = await getImageOptimizationSettings();
    cached = { value, at: Date.now() };
    return value;
  } catch {
    return DEFAULT_IMAGE_OPT_SETTINGS;
  }
}

const CONVERTIBLE = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/bmp"]);
const SKIP_FORMATS = new Set([
  "image/gif",
  "image/svg+xml",
  "image/avif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

function replaceExt(name: string, ext: string) {
  return name.replace(/\.[a-z0-9]+$/i, "") + "." + ext;
}

function isHeic(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (
    t === "image/heic" ||
    t === "image/heif" ||
    t === "image/heic-sequence" ||
    t === "image/heif-sequence"
  )
    return true;
  // Safari/iOS sometimes reports an empty type — fall back to extension.
  const name = (file.name || "").toLowerCase();
  return /\.(heic|heif)$/.test(name);
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = url;
  });
}

async function fileToDataUrl(file: Blob): Promise<string> {
  return await fileToBase64(file as File);
}

/**
 * Read EXIF orientation (1–8) from a JPEG. Returns 1 (no rotation) if not
 * found or unreadable. Implementation reads the first 128 KB only — that's
 * where the EXIF APP1 segment always lives.
 */
async function readExifOrientation(file: Blob): Promise<number> {
  try {
    const slice = file.slice(0, Math.min(file.size, 128 * 1024));
    const buf = await slice.arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 4) return 1;
    if (view.getUint16(0) !== 0xffd8) return 1; // not JPEG

    let offset = 2;
    const len = view.byteLength;
    while (offset + 4 < len) {
      const marker = view.getUint16(offset);
      offset += 2;
      if (marker === 0xffe1) {
        // APP1 — EXIF
        offset += 2; // skip segment length
        // "Exif\0\0"
        if (view.getUint32(offset) !== 0x45786966) return 1;
        offset += 6;
        const tiffStart = offset;
        const little = view.getUint16(tiffStart) === 0x4949;
        const get16 = (o: number) => view.getUint16(o, little);
        const get32 = (o: number) => view.getUint32(o, little);
        if (get16(tiffStart + 2) !== 0x002a) return 1;
        const ifd0 = tiffStart + get32(tiffStart + 4);
        const entries = get16(ifd0);
        for (let i = 0; i < entries; i++) {
          const entry = ifd0 + 2 + i * 12;
          if (get16(entry) === 0x0112) {
            return get16(entry + 8) || 1;
          }
        }
        return 1;
      } else if ((marker & 0xff00) !== 0xff00) {
        return 1;
      } else {
        offset += view.getUint16(offset);
      }
    }
  } catch {
    /* ignore */
  }
  return 1;
}

/** Apply an EXIF orientation transform to a canvas context (canvas already sized). */
function applyOrientationTransform(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number,
) {
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, width);
      break;
    default:
      break; // 1 — identity
  }
}

async function convertToWebp(
  source: Blob,
  filenameHint: string,
  settings: ImageOptimizationSettings,
  orientation: number,
  onProgress?: PrepareProgress,
): Promise<{ blob: Blob; contentType: string; filename: string } | null> {
  if (typeof document === "undefined") return null;
  const dataUrl = await fileToDataUrl(source);
  const img = await loadHtmlImage(dataUrl);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) return null;

  // Orientations 5–8 swap drawn width/height.
  const swap = orientation >= 5 && orientation <= 8;
  let drawW = width;
  let drawH = height;

  const max = settings.max_width;
  if (max > 0) {
    const longestEdge = swap ? height : width;
    if (longestEdge > max) {
      const ratio = max / longestEdge;
      drawW = Math.round(width * ratio);
      drawH = Math.round(height * ratio);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = swap ? drawH : drawW;
  canvas.height = swap ? drawW : drawH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  applyOrientationTransform(ctx, orientation, drawW, drawH);
  ctx.drawImage(img, 0, 0, drawW, drawH);

  onProgress?.("encoding-webp");
  const quality = settings.quality / 100;
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", quality),
  );
  if (!blob || blob.size === 0) return null;

  return {
    blob,
    contentType: "image/webp",
    filename: replaceExt(filenameHint || "image", "webp"),
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Decode HEIC/HEIF → JPEG Blob via dynamically imported heic2any. Returns
 * null on failure so the caller can passthrough.
 */
async function decodeHeic(file: File): Promise<{ blob: Blob; filename: string } | null> {
  try {
    const mod = await import("heic2any");
    const heic2any = (mod as any).default || mod;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const blob: Blob = Array.isArray(out) ? out[0] : out;
    if (!blob) return null;
    return { blob, filename: replaceExt(file.name || "image", "jpg") };
  } catch (e) {
    console.warn("[image-prepare] HEIC decode failed:", e);
    return null;
  }
}

/**
 * Prepare a file for upload: HEIC→JPEG (if needed), then EXIF-aware WebP
 * conversion + downscale based on admin settings. Falls back to passthrough
 * on any failure so uploads never break.
 */
export async function prepareImageForUpload(
  file: File,
  onProgress?: PrepareProgress,
): Promise<PreparedImage> {
  const originalSize = file.size;
  const passthrough = async (
    reason?: string,
    src: Blob = file,
    name = file.name,
    type = file.type,
  ): Promise<PreparedImage> => ({
    base64: await fileToDataUrl(src),
    filename: name,
    contentType: type || "application/octet-stream",
    originalSize,
    finalSize: src.size,
    converted: false,
    skippedReason: reason,
  });

  const looksLikeImage = (file.type || "").startsWith("image/") || isHeic(file);
  if (!looksLikeImage) return passthrough("not-an-image");

  let settings: ImageOptimizationSettings;
  try {
    settings = await loadSettings();
  } catch {
    settings = DEFAULT_IMAGE_OPT_SETTINGS;
  }

  // HEIC branch: always decode (browsers can't paint it). If optimization is
  // disabled we still need a usable JPEG, so passthrough the decoded blob.
  if (isHeic(file)) {
    onProgress?.("decoding-heic");
    const decoded = await decodeHeic(file);
    if (!decoded) return passthrough("heic-decode-failed");
    if (!settings.enabled) {
      return {
        base64: await blobToBase64(decoded.blob),
        filename: decoded.filename,
        contentType: "image/jpeg",
        originalSize,
        finalSize: decoded.blob.size,
        converted: true,
        skippedReason: "heic-only",
      };
    }
    onProgress?.("encoding-webp");
    try {
      // heic2any normalizes orientation, so we pass 1.
      const out = await convertToWebp(decoded.blob, decoded.filename, settings, 1, onProgress);
      if (!out) {
        return {
          base64: await blobToBase64(decoded.blob),
          filename: decoded.filename,
          contentType: "image/jpeg",
          originalSize,
          finalSize: decoded.blob.size,
          converted: true,
          skippedReason: "webp-encode-failed",
        };
      }
      const base64 = await blobToBase64(out.blob);
      return {
        base64,
        filename: out.filename,
        contentType: out.contentType,
        originalSize,
        finalSize: out.blob.size,
        converted: true,
      };
    } catch (e) {
      console.warn("[image-prepare] HEIC→WebP conversion failed:", e);
      return {
        base64: await blobToBase64(decoded.blob),
        filename: decoded.filename,
        contentType: "image/jpeg",
        originalSize,
        finalSize: decoded.blob.size,
        converted: true,
        skippedReason: "conversion-failed",
      };
    }
  }

  if (!settings.enabled) return passthrough("disabled");
  if (SKIP_FORMATS.has(file.type)) return passthrough("unsupported-format");
  if (!CONVERTIBLE.has(file.type)) return passthrough("unsupported-format");

  try {
    onProgress?.("reading-exif");
    const orientation =
      file.type === "image/jpeg" || file.type === "image/jpg" ? await readExifOrientation(file) : 1;
    const out = await convertToWebp(file, file.name, settings, orientation, onProgress);
    if (!out) return passthrough("conversion-returned-empty");
    // If WebP came out *larger* than the original AND no rotation was needed,
    // keep the original to avoid bloat. (If rotation was needed, we MUST keep
    // the rotated WebP — the original would still display sideways.)
    if (out.blob.size >= originalSize && orientation === 1) {
      return passthrough("webp-not-smaller");
    }
    const base64 = await blobToBase64(out.blob);
    return {
      base64,
      filename: out.filename,
      contentType: out.contentType,
      originalSize,
      finalSize: out.blob.size,
      converted: true,
    };
  } catch (e) {
    console.warn("[image-prepare] WebP conversion failed, sending original:", e);
    return passthrough("conversion-failed");
  }
}
