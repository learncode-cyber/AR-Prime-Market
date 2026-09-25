// Browser-safe zero-trust primitives.
// Used by both client-side validators and server-side scanners.

/**
 * Magic-byte file signature validator. Accepts the first few bytes of an
 * uploaded file and verifies them against the claimed MIME type. Returns
 * { ok, detected } so callers can log mismatches.
 */
export type MagicByteResult = { ok: boolean; detected: string | null };

const MAGIC: Array<{ mime: string; sig: number[]; offset?: number }> = [
  { mime: "image/jpeg", sig: [0xff, 0xd8, 0xff] },
  { mime: "image/png", sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/gif", sig: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp", sig: [0x52, 0x49, 0x46, 0x46] }, // RIFF + WEBP at offset 8
  { mime: "image/bmp", sig: [0x42, 0x4d] },
  { mime: "application/pdf", sig: [0x25, 0x50, 0x44, 0x46] },
  { mime: "application/zip", sig: [0x50, 0x4b, 0x03, 0x04] },
];

export function detectMimeFromBytes(bytes: Uint8Array): string | null {
  for (const m of MAGIC) {
    const off = m.offset ?? 0;
    if (bytes.length < off + m.sig.length) continue;
    let match = true;
    for (let i = 0; i < m.sig.length; i++) {
      if (bytes[off + i] !== m.sig[i]) {
        match = false;
        break;
      }
    }
    if (match) return m.mime;
  }
  return null;
}

export function verifyFileMagicBytes(bytes: Uint8Array, claimedMime: string): MagicByteResult {
  const detected = detectMimeFromBytes(bytes);
  if (!detected) return { ok: false, detected: null };
  // image/jpg ↔ image/jpeg tolerance
  const claim = claimedMime.toLowerCase().replace("image/jpg", "image/jpeg");
  return { ok: detected === claim, detected };
}

/**
 * Parameter integrity HMAC. Sign critical params (e.g. price, quantity,
 * resource_id) so a tampered client request can be rejected server-side.
 */
export async function signParams(
  params: Record<string, string | number>,
  secret: string,
): Promise<string> {
  const ordered = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(ordered));
  return bufToHex(new Uint8Array(sig));
}

export async function verifyParams(
  params: Record<string, string | number>,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await signParams(params, secret);
  if (expected.length !== signature.length) return false;
  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

function bufToHex(buf: Uint8Array): string {
  let out = "";
  for (let i = 0; i < buf.length; i++) out += buf[i].toString(16).padStart(2, "0");
  return out;
}

/**
 * Session integrity check. Verifies that a Supabase JWT claim set matches
 * minimum trust signals (not expired, expected issuer, optional aud).
 * Pure function — callers pass already-decoded claims.
 */
export type SessionClaims = { exp?: number; iss?: string; aud?: string | string[]; sub?: string };
export type SessionVerdict = { ok: boolean; reasons: string[] };

export function verifySessionClaims(
  claims: SessionClaims | null,
  opts: { expectedIssuer?: string; expectedAud?: string; now?: number } = {},
): SessionVerdict {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const reasons: string[] = [];
  if (!claims) return { ok: false, reasons: ["no_claims"] };
  if (!claims.sub) reasons.push("missing_sub");
  if (typeof claims.exp !== "number") reasons.push("missing_exp");
  else if (claims.exp < now) reasons.push("expired");
  if (opts.expectedIssuer && claims.iss && claims.iss !== opts.expectedIssuer)
    reasons.push("issuer_mismatch");
  if (opts.expectedAud) {
    const aud = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
    if (aud.length && !aud.includes(opts.expectedAud)) reasons.push("aud_mismatch");
  }
  return { ok: reasons.length === 0, reasons };
}
