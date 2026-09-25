/**
 * start-server.mjs — Production entry point for Hostinger Node.js hosting.
 *
 * Architecture:
 *   1. `npm run build:node` runs Vite + Nitro with the `node-server` preset.
 *        → .output/public/   (static client bundle: HTML, JS, CSS, images)
 *        → .output/server/   (Node-compatible SSR handler + server functions)
 *   2. This file boots a single Express process that:
 *        - serves /.output/public as long-cached static assets
 *        - delegates every other request to the Nitro SSR/server-function
 *          handler (so /, /products/*, /api/*, server-fn RPCs all work)
 *
 * Environment variables (set these in Hostinger → Node.js app → Env vars):
 *   PORT                          (Hostinger injects this automatically)
 *   HOST                          (optional, defaults to 0.0.0.0)
 *   SUPABASE_URL                  (required)
 *   SUPABASE_PUBLISHABLE_KEY      (required)
 *   SUPABASE_SERVICE_ROLE_KEY     (required for admin server fns)
 *   GEMINI_API_KEY                (fallback; Gemini key is normally set via Admin Panel -> API Keys instead — see docs/architecture/AI_KEY_CONFIG.md)
 *   CJ_API_KEY                    (CJ Dropshipping)
 *   R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET
 *   VITE_SUPABASE_URL             (mirror of SUPABASE_URL, baked at build)
 *   VITE_SUPABASE_PUBLISHABLE_KEY (mirror of publishable key, baked at build)
 *
 * Hostinger Node.js panel:
 *   Application entry file:  start-server.mjs
 *   Startup command:         npm start
 *   Node version:            >= 20
 */
import express from "express";
import compression from "compression";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUTPUT_DIR = path.join(__dirname, ".output");
const PUBLIC_DIR = path.join(OUTPUT_DIR, "public");
const SERVER_ENTRY = path.join(OUTPUT_DIR, "server", "index.mjs");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

if (!fs.existsSync(SERVER_ENTRY) || !fs.existsSync(PUBLIC_DIR)) {
  console.error(
    "[server] Missing build output. Run `npm run build:node` before starting.\n" +
      `        expected: ${SERVER_ENTRY}\n` +
      `        expected: ${PUBLIC_DIR}`,
  );
  process.exit(1);
}

// Tell Nitro which port/host to bind when it self-listens, in case the
// embedded mode is unavailable on this nitro build.
process.env.NITRO_PORT = String(PORT);
process.env.NITRO_HOST = HOST;
process.env.PORT = String(PORT);
process.env.HOST = HOST;

// Dynamically import the Nitro Node bundle. For the `node-server` preset
// Nitro exports a Node-compatible request `handler` (and historically
// `listener`). When neither is exported the module auto-starts an HTTP
// listener on PORT — in that case we hand the whole port over to Nitro and
// skip the Express wrapper (Nitro already serves the public dir).
const nitroMod = await import(pathToFileURL(SERVER_ENTRY).href);
const nitroHandler =
  nitroMod.handler || nitroMod.listener || nitroMod.default?.handler || nitroMod.default;

if (typeof nitroHandler !== "function") {
  // Nitro is running its own HTTP server on PORT — nothing more to do.
  console.log(`[server] Nitro node-server self-listening on http://${HOST}:${PORT}`);
} else {
  const app = express();
  app.disable("x-powered-by");
  app.use(compression());

  // Long-cache hashed assets; never cache HTML.
  app.use(
    express.static(PUBLIC_DIR, {
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

  app.get("/healthz", (_req, res) => res.status(200).send("ok"));

  // All remaining requests → SSR / server functions / server routes.
  app.use((req, res, next) => {
    Promise.resolve(nitroHandler(req, res)).catch(next);
  });

  app.listen(PORT, HOST, () => {
    console.log(
      `[server] AR Prime Market SSR up at http://${HOST}:${PORT} (static: ${PUBLIC_DIR})`,
    );
  });
}
