#!/usr/bin/env node
/**
 * Full static prerender for Hostinger deployment.
 *
 * Purpose:
 *   - Generates ONE static .html file per public URL so Google, ChatGPT,
 *     Perplexity, and other crawlers (including no-JS ones) see the full
 *     product / category / blog content directly in the HTML — not a blank
 *     SPA shell.
 *
 * Pipeline:
 *   1. `DEPLOY_TARGET=node vite build`  → .output/public (assets) + .output/server/index.mjs (Nitro Node SSR)
 *   2. Boot the Nitro SSR server on a random localhost port.
 *   3. Collect URLs:
 *        - Static routes (home, about, faq, contact, products, blog index, categories index, ...)
 *        - Dynamic slugs from Supabase (products, categories, blog posts)
 *        - Programmatic SEO collections
 *   4. For each URL, fetch the SSR-rendered HTML and write it to
 *        dist/<path>/index.html      (so Apache serves it for /path/)
 *        dist/index.html              (for /)
 *   5. Copy .output/public/* into dist/ (assets, robots, sitemap, icons, .htaccess).
 *   6. Kill the SSR server.
 *
 * Result: dist/ is a fully static tree — every product / category / blog URL
 * is a real .html file with the JSON-LD, meta tags, and body content already
 * rendered. Upload to Hostinger public_html and every URL is crawlable.
 */
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, ".output");
const publicDir = path.join(outputDir, "public");
const serverEntry = path.join(outputDir, "server", "index.mjs");
const distDir = path.join(root, "dist");

// Load .env so Supabase creds are available for slug fetches.
if (fs.existsSync(path.join(root, ".env"))) {
  for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const log = (m) => console.log(`[prerender] ${m}`);

// --- 1. Build Node SSR bundle ------------------------------------------------
if (process.env.SKIP_BUILD !== "1") {
  log("running node SSR build (DEPLOY_TARGET=node vite build)…");
  execSync("cross-env DEPLOY_TARGET=node vite build", { cwd: root, stdio: "inherit", shell: true });
}
if (!fs.existsSync(serverEntry)) {
  console.error(`[prerender] Missing ${serverEntry} — build failed?`);
  process.exit(1);
}

// --- 2. Boot Nitro SSR server ------------------------------------------------
const PORT = 43117 + Math.floor(Math.random() * 100);
log(`booting SSR server on http://127.0.0.1:${PORT}`);
const server = spawn(process.execPath, [serverEntry], {
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: "127.0.0.1",
    NITRO_PORT: String(PORT),
    NITRO_HOST: "127.0.0.1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (b) => process.stdout.write(`  ssr> ${b}`));
server.stderr.on("data", (b) => process.stderr.write(`  ssr! ${b}`));

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { method: "GET" });
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("SSR server never became ready");
}

// --- 3. Collect URLs ---------------------------------------------------------
async function collectUrls() {
  const urls = new Set([
    "/",
    "/products",
    "/blog",
    "/about",
    "/contact",
    "/faq",
    "/careers",
    "/press",
    "/support",
    "/track-order",
    "/terms",
    "/privacy-policy",
    "/refund-policy",
    "/cookie-policy",
    "/health",
  ]);

  if (SUPABASE_URL && SUPABASE_KEY) {
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
    const pull = async (table, cols, filter = "") => {
      try {
        const url = `${SUPABASE_URL}/rest/v1/${table}?select=${cols}${filter}&limit=5000`;
        const r = await fetch(url, { headers });
        if (!r.ok) {
          log(`  ! ${table} fetch ${r.status}`);
          return [];
        }
        return await r.json();
      } catch (e) {
        log(`  ! ${table} error: ${e.message}`);
        return [];
      }
    };
    const products = await pull("products", "slug", "&is_active=eq.true");
    for (const p of products) if (p.slug) urls.add(`/products/${p.slug}`);
    log(`  + ${products.length} products`);
    const cats = await pull("categories", "slug");
    for (const c of cats) if (c.slug) urls.add(`/categories/${c.slug}`);
    log(`  + ${cats.length} categories`);
    const posts = await pull("blog_posts", "slug", "&status=eq.published");
    for (const b of posts) if (b.slug) urls.add(`/blog/${b.slug}`);
    log(`  + ${posts.length} blog posts`);
  } else {
    log("  (no Supabase creds — skipping dynamic slugs)");
  }

  // Programmatic SEO collections
  try {
    const mod = await import(path.join(root, "src/lib/collectionSeo.ts")).catch(() => null);
    if (mod?.PROGRAMMATIC_COLLECTIONS) {
      for (const slug of mod.PROGRAMMATIC_COLLECTIONS) urls.add(`/collections/${slug}`);
    }
  } catch {}

  return [...urls];
}

// --- 4. Render each URL ------------------------------------------------------
function urlToFile(u) {
  if (u === "/") return path.join(distDir, "index.html");
  return path.join(distDir, u.replace(/^\/+/, ""), "index.html");
}

async function renderAll(urls, base) {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  let ok = 0,
    fail = 0;
  const CONCURRENCY = 6;
  let idx = 0;
  async function worker() {
    while (idx < urls.length) {
      const u = urls[idx++];
      try {
        const r = await fetch(`${base}${u}`, {
          headers: { "user-agent": "hostinger-prerender/1.0" },
        });
        const html = await r.text();
        if (!r.ok || html.length < 200) throw new Error(`status=${r.status} len=${html.length}`);
        const out = urlToFile(u);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, html);
        ok++;
        if (ok % 25 === 0) log(`  rendered ${ok}/${urls.length}`);
      } catch (e) {
        fail++;
        console.warn(`  ✗ ${u} — ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  log(`rendered ${ok} pages, ${fail} failed`);
  return { ok, fail };
}

// --- 5. Copy static assets ---------------------------------------------------
function copyAssets() {
  log(`copying static assets from .output/public → dist/`);
  const walk = (src, dest) => {
    for (const name of fs.readdirSync(src)) {
      const s = path.join(src, name);
      const d = path.join(dest, name);
      const stat = fs.statSync(s);
      if (stat.isDirectory()) {
        fs.mkdirSync(d, { recursive: true });
        walk(s, d);
      } else {
        // Do not overwrite prerendered index.html files
        if (name === "index.html" && fs.existsSync(d)) continue;
        fs.copyFileSync(s, d);
      }
    }
  };
  if (fs.existsSync(publicDir)) walk(publicDir, distDir);
}

// --- Main --------------------------------------------------------------------
try {
  await waitForServer(`http://127.0.0.1:${PORT}/`);
  log("SSR server ready");
  const urls = await collectUrls();
  log(`total URLs to prerender: ${urls.length}`);
  const { ok } = await renderAll(urls, `http://127.0.0.1:${PORT}`);
  copyAssets();

  // Ensure .htaccess is present for SPA fallback on unknown URLs
  const htaccessSrc = path.join(root, "public", ".htaccess");
  const htaccessDest = path.join(distDir, ".htaccess");
  if (fs.existsSync(htaccessSrc) && !fs.existsSync(htaccessDest)) {
    fs.copyFileSync(htaccessSrc, htaccessDest);
  }

  log(`✓ prerender complete — ${ok} static HTML pages in dist/`);
  log("upload dist/ contents to Hostinger public_html.");
} catch (e) {
  console.error("[prerender] FAILED:", e);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  setTimeout(() => server.kill("SIGKILL"), 2000).unref();
}
