// Server-only SEO scanner — no native deps, runs in Cloudflare Worker.
// Fetches public URLs and validates meta, structured data, crawlability.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Severity = "pass" | "warn" | "fail";

export type Finding = {
  url: string;
  category: string;
  severity: Severity;
  check_id: string;
  message: string;
  fix_hint?: string;
  raw?: Record<string, unknown>;
};

const HTML_HEADERS = {
  "User-Agent": "ARPrimeSEO-Auditor/1.0 (+https://arprimemarket.shop)",
  Accept: "text/html,application/xhtml+xml",
};

function pickAttr(html: string, tag: string, attr: string, match: string): string | null {
  // crude but worker-safe: regex over <tag ...>
  const re = new RegExp(`<${tag}\\b[^>]*${attr}=["']${match}["'][^>]*>`, "gi");
  const m = re.exec(html);
  if (!m) return null;
  const contentRe = /content=["']([^"']*)["']/i;
  const c = contentRe.exec(m[0]);
  return c ? c[1] : null;
}

function pickMetaName(html: string, name: string): string | null {
  return pickAttr(html, "meta", "name", name);
}
function pickMetaProperty(html: string, prop: string): string | null {
  return pickAttr(html, "meta", "property", prop);
}

function extractTitle(html: string): string | null {
  const m = /<title>([^<]*)<\/title>/i.exec(html);
  return m ? m[1].trim() : null;
}

function extractCanonical(html: string): string | null {
  const m = /<link\b[^>]*rel=["']canonical["'][^>]*>/i.exec(html);
  if (!m) return null;
  const h = /href=["']([^"']+)["']/i.exec(m[0]);
  return h ? h[1] : null;
}

function countH1(html: string): number {
  const m = html.match(/<h1\b[^>]*>/gi);
  return m ? m.length : 0;
}

function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1].trim()));
    } catch {
      blocks.push({ __invalid: true, raw: m[1].slice(0, 200) });
    }
  }
  return blocks;
}

function jsonLdTypes(blocks: unknown[]): string[] {
  const types: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    const t = o["@type"];
    if (typeof t === "string") types.push(t);
    if (Array.isArray(t)) for (const x of t) if (typeof x === "string") types.push(x);
    if (Array.isArray(o["@graph"])) for (const g of o["@graph"]) walk(g);
  };
  for (const b of blocks) walk(b);
  return types;
}

async function fetchText(url: string): Promise<{ status: number; body: string } | null> {
  try {
    const res = await fetch(url, { headers: HTML_HEADERS });
    return { status: res.status, body: await res.text() };
  } catch (e) {
    console.error("seo-scan fetch error", url, e);
    return null;
  }
}

function auditHtml(
  url: string,
  html: string,
  opts: { kind: "home" | "product" | "category" | "faq" | "blog" | "other" },
): Finding[] {
  const findings: Finding[] = [];
  const push = (f: Finding) => findings.push(f);

  // Title
  const title = extractTitle(html);
  if (!title) {
    push({
      url,
      category: "Meta",
      severity: "fail",
      check_id: "title.missing",
      message: "No <title> tag",
    });
  } else if (title.length < 10 || title.length > 70) {
    push({
      url,
      category: "Meta",
      severity: "warn",
      check_id: "title.length",
      message: `Title length ${title.length} (recommend 10–60)`,
      raw: { title },
    });
  } else {
    push({
      url,
      category: "Meta",
      severity: "pass",
      check_id: "title.ok",
      message: `Title OK (${title.length} chars)`,
      raw: { title },
    });
  }

  // Description
  const desc = pickMetaName(html, "description");
  if (!desc) {
    push({
      url,
      category: "Meta",
      severity: "fail",
      check_id: "desc.missing",
      message: "No meta description",
    });
  } else if (desc.length < 50 || desc.length > 170) {
    push({
      url,
      category: "Meta",
      severity: "warn",
      check_id: "desc.length",
      message: `Description length ${desc.length} (recommend 50–160)`,
    });
  } else {
    push({
      url,
      category: "Meta",
      severity: "pass",
      check_id: "desc.ok",
      message: "Description OK",
    });
  }

  // H1
  const h1 = countH1(html);
  if (h1 === 0)
    push({
      url,
      category: "Meta",
      severity: "fail",
      check_id: "h1.missing",
      message: "No <h1> found",
    });
  else if (h1 > 1)
    push({
      url,
      category: "Meta",
      severity: "warn",
      check_id: "h1.multiple",
      message: `${h1} <h1> tags (use 1)`,
    });
  else
    push({
      url,
      category: "Meta",
      severity: "pass",
      check_id: "h1.ok",
      message: "Single H1 present",
    });

  // Canonical
  const canonical = extractCanonical(html);
  if (!canonical)
    push({
      url,
      category: "Meta",
      severity: "warn",
      check_id: "canonical.missing",
      message: "No canonical link",
    });
  else
    push({
      url,
      category: "Meta",
      severity: "pass",
      check_id: "canonical.ok",
      message: `Canonical: ${canonical}`,
    });

  // OG
  const ogTitle = pickMetaProperty(html, "og:title");
  const ogDesc = pickMetaProperty(html, "og:description");
  const ogUrl = pickMetaProperty(html, "og:url");
  if (!ogTitle || !ogDesc || !ogUrl) {
    push({
      url,
      category: "Meta",
      severity: "warn",
      check_id: "og.partial",
      message: `OG tags incomplete (title:${!!ogTitle} desc:${!!ogDesc} url:${!!ogUrl})`,
    });
  } else {
    push({
      url,
      category: "Meta",
      severity: "pass",
      check_id: "og.ok",
      message: "OG tags complete",
    });
  }

  // JSON-LD
  const blocks = extractJsonLd(html);
  if (blocks.length === 0) {
    push({
      url,
      category: "Structured Data",
      severity: "warn",
      check_id: "jsonld.none",
      message: "No JSON-LD found",
    });
  } else {
    const types = jsonLdTypes(blocks);
    push({
      url,
      category: "Structured Data",
      severity: "pass",
      check_id: "jsonld.present",
      message: `JSON-LD types: ${types.join(", ") || "(unknown)"}`,
      raw: { types },
    });
    if (opts.kind === "product" && !types.includes("Product")) {
      push({
        url,
        category: "Structured Data",
        severity: "fail",
        check_id: "jsonld.product.missing",
        message: "Product page missing Product schema",
        fix_hint: "Add JSON-LD with @type=Product + Offer",
      });
    }
    if (opts.kind === "faq" && !types.includes("FAQPage")) {
      push({
        url,
        category: "Structured Data",
        severity: "warn",
        check_id: "jsonld.faq.missing",
        message: "FAQ page missing FAQPage schema",
      });
    }
    if (opts.kind === "blog" && !types.includes("Article") && !types.includes("BlogPosting")) {
      push({
        url,
        category: "Structured Data",
        severity: "warn",
        check_id: "jsonld.article.missing",
        message: "Blog post missing Article schema",
      });
    }
  }

  // Product microdata
  if (opts.kind === "product") {
    const hasMicrodata = /itemtype=["']https?:\/\/schema\.org\/Product["']/i.test(html);
    if (hasMicrodata)
      push({
        url,
        category: "Structured Data",
        severity: "pass",
        check_id: "microdata.product",
        message: "schema.org/Product microdata present",
      });
    else
      push({
        url,
        category: "Structured Data",
        severity: "warn",
        check_id: "microdata.product.missing",
        message: "No schema.org/Product microdata",
      });

    // Currency check (USD)
    if (
      /priceCurrency["']?\s*:\s*["']USD["']/i.test(html) ||
      /priceCurrency=["']USD["']/i.test(html)
    ) {
      push({
        url,
        category: "Structured Data",
        severity: "pass",
        check_id: "currency.usd",
        message: "USD currency confirmed",
      });
    } else {
      push({
        url,
        category: "Structured Data",
        severity: "warn",
        check_id: "currency.usd.missing",
        message: "USD not explicitly declared in Offer",
      });
    }
  }

  return findings;
}

async function auditRobots(baseUrl: string): Promise<Finding[]> {
  const url = `${baseUrl}/robots.txt`;
  const r = await fetchText(url);
  if (!r || r.status >= 400) {
    return [
      {
        url,
        category: "Crawlability",
        severity: "fail",
        check_id: "robots.missing",
        message: `robots.txt unreachable (status ${r?.status ?? "n/a"})`,
      },
    ];
  }
  const findings: Finding[] = [
    {
      url,
      category: "Crawlability",
      severity: "pass",
      check_id: "robots.present",
      message: "robots.txt reachable",
    },
  ];
  if (/sitemap:/i.test(r.body)) {
    findings.push({
      url,
      category: "Crawlability",
      severity: "pass",
      check_id: "robots.sitemap",
      message: "Sitemap directive present",
    });
  } else {
    findings.push({
      url,
      category: "Crawlability",
      severity: "warn",
      check_id: "robots.sitemap.missing",
      message: "No Sitemap: directive in robots.txt",
    });
  }
  return findings;
}

async function auditSitemap(baseUrl: string): Promise<Finding[]> {
  const url = `${baseUrl}/sitemap.xml`;
  const r = await fetchText(url);
  if (!r || r.status >= 400) {
    return [
      {
        url,
        category: "Crawlability",
        severity: "fail",
        check_id: "sitemap.missing",
        message: `sitemap.xml unreachable (status ${r?.status ?? "n/a"})`,
      },
    ];
  }
  const isXml = /<urlset|<sitemapindex/i.test(r.body);
  return [
    isXml
      ? {
          url,
          category: "Crawlability",
          severity: "pass",
          check_id: "sitemap.valid",
          message: "sitemap.xml valid",
        }
      : {
          url,
          category: "Crawlability",
          severity: "fail",
          check_id: "sitemap.invalid",
          message: "sitemap.xml does not look like valid XML",
        },
  ];
}

async function auditLlmsTxt(baseUrl: string): Promise<Finding[]> {
  const url = `${baseUrl}/llms.txt`;
  const r = await fetchText(url);
  if (!r || r.status >= 400) {
    return [
      {
        url,
        category: "LLM-Readiness",
        severity: "warn",
        check_id: "llms.missing",
        message: "llms.txt not found",
      },
    ];
  }
  const body = r.body.toLowerCase();
  const findings: Finding[] = [
    {
      url,
      category: "LLM-Readiness",
      severity: "pass",
      check_id: "llms.present",
      message: "llms.txt reachable",
    },
  ];
  for (const key of ["electronics", "beauty", "fashion", "home", "gadgets"]) {
    if (!body.includes(key)) {
      findings.push({
        url,
        category: "LLM-Readiness",
        severity: "warn",
        check_id: `llms.category.${key}`,
        message: `llms.txt missing category mention: ${key}`,
      });
    }
  }
  if (!body.includes("usd")) {
    findings.push({
      url,
      category: "LLM-Readiness",
      severity: "warn",
      check_id: "llms.currency",
      message: "llms.txt does not mention USD",
    });
  }
  if (!/(shipping|delivery)/i.test(r.body)) {
    findings.push({
      url,
      category: "LLM-Readiness",
      severity: "warn",
      check_id: "llms.shipping",
      message: "llms.txt missing shipping/delivery info",
    });
  }
  return findings;
}

function kindForPath(path: string): "home" | "product" | "category" | "faq" | "blog" | "other" {
  if (path === "/" || path === "") return "home";
  if (path.startsWith("/products/")) return "product";
  if (path.startsWith("/categories/")) return "category";
  if (path === "/faq" || path.startsWith("/faq")) return "faq";
  if (path.startsWith("/blog/")) return "blog";
  return "other";
}

export type RunOptions = {
  trigger: "manual" | "deploy" | "cron";
  deployId?: string | null;
};

export async function runSeoScanCore(
  opts: RunOptions,
): Promise<{ runId: string; pass: number; warn: number; fail: number; score: number }> {
  // Load config
  const { data: cfg } = await supabaseAdmin
    .from("seo_scan_config")
    .select("*")
    .limit(1)
    .maybeSingle();
  const baseUrl: string = (cfg?.base_url as string | undefined) ?? "https://arprimemarket.shop";
  const targetPaths: string[] = Array.isArray(cfg?.target_urls)
    ? (cfg!.target_urls as string[])
    : ["/", "/faq"];

  // Auto-discover one product + one blog post if not in targets
  const enrichedPaths = new Set(targetPaths);
  try {
    const { data: prod } = await supabaseAdmin
      .from("products")
      .select("slug")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (prod?.slug) enrichedPaths.add(`/products/${prod.slug}`);
    const { data: post } = await supabaseAdmin
      .from("blog_posts")
      .select("slug")
      .eq("is_published", true)
      .limit(1)
      .maybeSingle();
    if (post?.slug) enrichedPaths.add(`/blog/${post.slug}`);
  } catch (e) {
    console.error("seo-scan enrich error", e);
  }

  // Create run row
  const { data: runRow, error: runErr } = await supabaseAdmin
    .from("seo_scan_runs")
    .insert({ trigger: opts.trigger, deploy_id: opts.deployId ?? null })
    .select("id")
    .single();
  if (runErr || !runRow) throw new Error(runErr?.message ?? "Failed to create scan run");
  const runId = runRow.id as string;

  const allFindings: Finding[] = [];

  // Crawlability + LLM checks
  allFindings.push(...(await auditRobots(baseUrl)));
  allFindings.push(...(await auditSitemap(baseUrl)));
  allFindings.push(...(await auditLlmsTxt(baseUrl)));

  // Per-URL checks
  for (const p of enrichedPaths) {
    const url = baseUrl.replace(/\/$/, "") + p;
    const r = await fetchText(url);
    if (!r || r.status >= 400) {
      allFindings.push({
        url,
        category: "Meta",
        severity: "fail",
        check_id: "page.unreachable",
        message: `Page unreachable (status ${r?.status ?? "n/a"})`,
      });
      continue;
    }
    allFindings.push(...auditHtml(url, r.body, { kind: kindForPath(p) }));
  }

  // Persist findings
  if (allFindings.length > 0) {
    const rows = allFindings.map((f) => ({
      run_id: runId,
      url: f.url,
      category: f.category,
      severity: f.severity,
      check_id: f.check_id,
      message: f.message,
      fix_hint: f.fix_hint ?? null,
      raw: (f.raw ?? null) as never,
    }));
    const { error: insErr } = await supabaseAdmin.from("seo_scan_findings").insert(rows);
    if (insErr) console.error("seo-scan finding insert error", insErr);
  }

  const pass = allFindings.filter((f) => f.severity === "pass").length;
  const warn = allFindings.filter((f) => f.severity === "warn").length;
  const fail = allFindings.filter((f) => f.severity === "fail").length;
  const total = pass + warn + fail || 1;
  const score = Math.round(((pass + warn * 0.5) / total) * 100);

  await supabaseAdmin
    .from("seo_scan_runs")
    .update({
      finished_at: new Date().toISOString(),
      score,
      pass_count: pass,
      warn_count: warn,
      fail_count: fail,
    })
    .eq("id", runId);

  return { runId, pass, warn, fail, score };
}
