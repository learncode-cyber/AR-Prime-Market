/**
 * Safe JSON-LD serialization for inline <script type="application/ld+json"> tags.
 *
 * Why this exists: `JSON.stringify()` alone is NOT safe to drop into
 * `dangerouslySetInnerHTML` inside a <script> tag. If any string field in the
 * structured-data object (e.g. a blog title, FAQ answer, or product
 * description sourced from the CMS/database) contains the literal substring
 * `</script>`, it terminates the script tag early and whatever follows is
 * parsed as raw HTML — a stored-XSS vector.
 *
 * DOMPurify.sanitize() is NOT the right tool here: it sanitizes *HTML*, and
 * running it over a JSON payload can corrupt legitimate structured data
 * (stripping characters it mistakes for tags). The correct, industry-standard
 * mitigation for JSON-in-<script> is escaping the handful of characters that
 * can break out of the script context, which is what this helper does.
 *
 * Use this for any JSON-LD that is rendered via `dangerouslySetInnerHTML`
 * directly in component JSX (i.e. NOT going through TanStack Start's
 * `head({ scripts: [...] })`, which is already framework-serialized safely).
 *
 * @see src/test/security/xss-sanitization.test.ts — this helper is the
 *      recognized-safe pattern for JSON-LD script blocks in that regression
 *      guard.
 */
export function toSafeJsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
