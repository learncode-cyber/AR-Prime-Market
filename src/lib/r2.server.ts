// Server-only Cloudflare R2 client (S3 API via aws4fetch).
// Reads credentials from env at call time so values are never bundled.

import { AwsClient } from "aws4fetch";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Fully qualified public base URL, e.g. https://cdn.example.com or https://pub-<hash>.r2.dev (no trailing slash). */
  publicBaseUrl: string;
  /** Hostname only, kept for backwards-compat checks (e.g. `cfg.publicDomain` includes match). */
  publicDomain: string;
};

/**
 * Resolve the public R2 base URL from any of the supported env vars.
 *
 * Accepted (in priority order):
 *  - R2_PUBLIC_BASE_URL      → full URL, may include protocol & path prefix
 *  - R2_PUBLIC_URL           → alias of R2_PUBLIC_BASE_URL
 *  - R2_PUBLIC_CUSTOM_DOMAIN → custom domain (with or without https://)
 *  - R2_PUBLIC_DEV_SUBDOMAIN / R2_ACCOUNT_HASH → r2.dev hash, expands to https://pub-<hash>.r2.dev
 *
 * Returns null if nothing usable is configured OR if the resolved domain looks
 * malformed (e.g. missing a dot — which would produce broken URLs like
 * `https://i4aCdgu_QuzzpHA/foo.jpg`).
 */
function resolvePublicBaseUrl(): string | null {
  const raw =
    process.env.R2_PUBLIC_BASE_URL ||
    process.env.R2_PUBLIC_URL ||
    process.env.R2_PUBLIC_CUSTOM_DOMAIN ||
    "";
  let candidate = raw.trim();

  // Fallback: r2.dev account hash → pub-<hash>.r2.dev
  if (!candidate) {
    const hash = (process.env.R2_PUBLIC_DEV_SUBDOMAIN || process.env.R2_ACCOUNT_HASH || "").trim();
    if (hash) {
      const clean = hash.replace(/^pub-/, "").replace(/\.r2\.dev.*$/, "");
      candidate = `https://pub-${clean}.r2.dev`;
    }
  }

  if (!candidate) return null;

  // Strip surrounding whitespace, ensure protocol, drop trailing slashes.
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  candidate = candidate.replace(/\/+$/, "");

  // Validate: must parse and host must be a real DNS hostname.
  try {
    const u = new URL(candidate);
    if (!u.hostname.includes(".")) {
      // Likely a raw account hash was pasted (e.g. "i4aCdgu_QuzzpHA").
      // Auto-recover by treating it as an r2.dev pub-<hash> subdomain.
      const clean = u.hostname.replace(/^pub-/, "");
      if (!isValidHostnameLabel(clean)) return null;
      const recovered = `https://pub-${clean}.r2.dev${u.pathname.replace(/\/+$/, "")}`;
      return recovered.replace(/\/+$/, "");
    }
    if (!isValidPublicHostname(u.hostname)) return null;
    return candidate;
  } catch {
    return null;
  }
}

function isValidHostnameLabel(label: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label);
}

function isValidPublicHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253 || hostname.includes("_")) return false;
  return hostname.split(".").every(isValidHostnameLabel);
}

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = resolvePublicBaseUrl();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }
  let publicDomain = publicBaseUrl;
  try {
    publicDomain = new URL(publicBaseUrl).host;
  } catch {
    /* keep as-is */
  }
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl,
    publicDomain,
  };
}

export function r2PublicUrl(cfg: R2Config, key: string): string {
  const safeKey = key.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
  return `${cfg.publicBaseUrl}/${safeKey}`;
}

export async function r2PutObject(
  cfg: R2Config,
  key: string,
  body: ArrayBuffer | Uint8Array | Buffer,
  contentType: string,
): Promise<string> {
  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const endpoint = `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const res = await client.fetch(endpoint, {
    method: "PUT",
    body: body as any,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 400);
    throw new Error(`R2 upload failed (${res.status}): ${text}`);
  }
  return r2PublicUrl(cfg, key);
}

export async function verifyR2PublicUrl(url: string, timeoutMs = 3500): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" },
    });

    if (res.ok) return true;
    if (res.status !== 405) return false;

    res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Range: "bytes=0-0", "Cache-Control": "no-cache" },
    });
    return res.ok || res.status === 206;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function buildR2Key(opts: { prefix?: string; filename: string }): string {
  const ext = (opts.filename.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const rand = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now();
  const safePrefix = (opts.prefix || "uploads").replace(/^\/+|\/+$/g, "");
  return `${safePrefix}/${stamp}-${rand}.${ext || "bin"}`;
}

/** Verify an object exists in R2 and return its size. Returns null if missing. */
export async function r2HeadObject(
  cfg: R2Config,
  key: string,
): Promise<{ size: number; contentType: string | null } | null> {
  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const endpoint = `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const res = await client.fetch(endpoint, { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 HEAD failed (${res.status})`);
  const size = Number(res.headers.get("content-length") || "0");
  const contentType = res.headers.get("content-type");
  return { size, contentType };
}
