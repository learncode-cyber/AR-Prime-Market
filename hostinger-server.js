/**
 * hostinger-server.js
 * ---------------------------------------------------------------------------
 * Lightweight Node bridge for Hostinger Shared Node.js hosting (Passenger /
 * Phusion). Serves the static SPA bundle produced by `npm run build:hostinger`
 * and falls back to index.html for client-side routes.
 *
 * Dynamic actions (Raiyan AI, Telegram Webhook, CJ Sync, etc.) are NOT
 * handled here — they live on Supabase Edge Functions and are called directly
 * from the browser. Keeping this process pure static keeps it well under the
 * shared-tier CPU / memory thresholds.
 *
 * Hostinger control panel → "Application Entry File" = hostinger-server.js
 * ---------------------------------------------------------------------------
 */

import express from "express";
import compression from "compression";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the static asset directory. `vite build --outDir dist` writes here;
// the full Nitro/SSR build pipeline (npm run build:node) writes to
// `.output/public` instead. Try both so the same shim works regardless of
// which build ran.
const CANDIDATE_DIRS = [path.join(__dirname, "dist"), path.join(__dirname, ".output", "public")];

const STATIC_DIR = CANDIDATE_DIRS.find((dir) => fs.existsSync(path.join(dir, "index.html")));

if (!STATIC_DIR) {
  console.error("[hostinger-server] No build output found. Run `npm run build:hostinger` first.");
  process.exit(1);
}

const INDEX_HTML = path.join(STATIC_DIR, "index.html");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();

app.disable("x-powered-by");
app.use(compression());

// Long-cache hashed assets, no-cache for HTML.
app.use(
  express.static(STATIC_DIR, {
    index: false,
    maxAge: "1y",
    etag: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
    },
  }),
);

// Minimal health check for uptime monitors.
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// SPA fallback: every non-asset GET returns the built index.html so the
// TanStack Router can hydrate the route on the client.
app.get(/^\/(?!.*\.[a-zA-Z0-9]+$).*/, (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, must-revalidate");
  res.sendFile(INDEX_HTML);
});

app.listen(PORT, HOST, () => {
  console.log(`[hostinger-server] serving ${STATIC_DIR} on http://${HOST}:${PORT}`);
});
