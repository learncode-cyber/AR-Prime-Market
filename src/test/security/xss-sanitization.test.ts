import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { sanitizeInput } from "@/lib/validation";

const SRC_DIR = join(process.cwd(), "src");
const SKIP_DIRS = new Set(["node_modules", "test", "__tests__"]);
const SKIP_FILE_SUFFIXES = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !SKIP_FILE_SUFFIXES.some((s) => entry.endsWith(s))) {
      out.push(full);
    }
  }
  return out;
}

describe("XSS sanitization regression guard", () => {
  it("every dangerouslySetInnerHTML in src/ flows through DOMPurify.sanitize", () => {
    const files = walk(SRC_DIR);
    const offenders: string[] = [];
    const pattern = /dangerouslySetInnerHTML\s*=\s*\{\{[^}]*\}\}/g;

    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const matches = text.match(pattern);
      if (!matches) continue;
      for (const m of matches) {
        // Two recognized-safe patterns:
        //  - DOMPurify.sanitize(...) for real HTML content
        //  - toSafeJsonLdString(...) for JSON-LD <script type="application/ld+json">
        //    blocks (DOMPurify sanitizes HTML, not JSON, and is the wrong
        //    tool for that case — see src/lib/jsonLdScript.ts)
        const isSanitized = m.includes("DOMPurify.sanitize(") || m.includes("toSafeJsonLdString(");
        if (!isSanitized) {
          const line = text.slice(0, text.indexOf(m)).split("\n").length;
          offenders.push(`${relative(process.cwd(), file)}:${line} -> ${m}`);
        }
      }
    }

    expect(
      offenders,
      `Unsanitized dangerouslySetInnerHTML found. Wrap the __html value in DOMPurify.sanitize(...) :\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  describe("sanitizeInput()", () => {
    const cases: Array<[string, string, string]> = [
      ["strips <script> tags", "<script>alert(1)</script>hi", "hi"],
      ["strips inline event handlers", '<img src=x onerror="alert(1)">', ""],
      ["strips javascript: urls", "click javascript:alert(1) here", "click alert(1) here"],
      ["strips arbitrary tags", "<b>bold</b>", "bold"],
      ["trims whitespace", "  ok  ", "ok"],
    ];

    for (const [name, input, expected] of cases) {
      it(name, () => {
        expect(sanitizeInput(input)).toBe(expected);
      });
    }
  });
});
