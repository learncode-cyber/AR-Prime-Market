#!/usr/bin/env node
/**
 * Builds the FULL Node/Nitro server bundle and produces a ready-to-upload
 * ZIP for Hostinger's "Node.js App" feature (hPanel → Node.js, not the
 * plain static-file hosting).
 *
 * This is "Mode B" from docs/devops/HOSTINGER_NODE_DEPLOYMENT.md — the
 * deployment target required for every server-side route built in Modules
 * 2-9 (the API Gateway, /api/public/cron/*, /api/public/seo/*, the ARQ Master
 * OS admin control-plane createServerFns, the health check, etc.) to
 * actually run in production. The pre-existing `package:hostinger` script
 * (Mode A) produces a pure static SPA shell + a plain Express static file
 * server — none of the routes above exist in that build at all. Both
 * scripts are kept; see the docs for when you'd ever want Mode A instead
 * (you generally don't, once you've deployed Mode B once — it's a lighter
 * fallback for storefront-only hosting, not a recommended default).
 *
 * Steps:
 *   1. Run `npm run build:node` (Vite + Nitro node-server preset →
 *      .output/server + .output/public).
 *   2. Stage required files into a temp dir:
 *        - .output/          (Nitro server bundle + static assets)
 *        - package.json      (full production dependency tree — see the
 *          note below on why this is NOT slimmed the way Mode A's is)
 *        - package-lock.json / bun.lockb (whichever exists)
 *   3. Zip the staged tree to
 *      dist-hostinger/arprimemarket-hostinger-node-<timestamp>.zip
 *
 * Usage:
 *   node scripts/hostinger-package-node.mjs
 *   npm run package:hostinger-node
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiverPkg from "archiver";
const archiver = archiverPkg.default ?? archiverPkg;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "dist-hostinger");
const stageDir = path.join(outDir, "stage-node");

function log(msg) {
  console.log(`[hostinger-package-node] ${msg}`);
}

function run(cmd) {
  log(`$ ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit", shell: true });
}

// 1. Build
run("npm run build:node");

const nitroOutputDir = path.join(root, ".output");
const serverEntry = path.join(nitroOutputDir, "server", "index.mjs");
if (!fs.existsSync(serverEntry)) {
  console.error(
    "[hostinger-package-node] .output/server/index.mjs missing after build. " +
      "The Nitro node-server preset's entry filename can change between " +
      "versions — check .output/server/ contents and update this script's " +
      "expected path if the framework's output layout has changed.",
  );
  process.exit(1);
}

// 2. Stage (only clean our own stage subfolder — dist-hostinger/ is shared
// with Mode A's package:hostinger output and must not be wiped here).
fs.rmSync(stageDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });

log("staging .output/");
fs.cpSync(nitroOutputDir, path.join(stageDir, ".output"), { recursive: true });

const copyIfExists = (rel) => {
  const src = path.join(root, rel);
  if (fs.existsSync(src)) {
    fs.cpSync(src, path.join(stageDir, rel), { recursive: true });
    log(`included ${rel}`);
  }
};
["package-lock.json", "bun.lockb", "start-server.mjs"].forEach(copyIfExists);

// Unlike Mode A's hand-picked express/compression-only dependency list,
// this build runs the actual TanStack Start server (React SSR, the AI SDK,
// Supabase client, zod, etc.) — Nitro's node-server preset bundles most of
// this into .output/server/, but not necessarily ALL native/binary
// dependencies. Being conservative: ship the full production
// `dependencies` block (devDependencies excluded) rather than guessing
// which subset Nitro actually needs. This makes the upload larger than
// Mode A's, which is expected and correct for a real SSR server — verify
// against your actual `.output/server/` output if you want to trim this
// further later.
const pkgPath = path.join(stageDir, "package.json");
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const slimmed = {
  name: rootPkg.name,
  version: rootPkg.version,
  private: true,
  type: rootPkg.type ?? "module",
  scripts: { start: "node start-server.mjs" },
  dependencies: rootPkg.dependencies ?? {},
  engines: rootPkg.engines ?? { node: ">=20" },
};
fs.writeFileSync(pkgPath, JSON.stringify(slimmed, null, 2));
log("wrote package.json with start -> start-server.mjs");

fs.writeFileSync(
  path.join(stageDir, "README-HOSTINGER-NODE.txt"),
  [
    "AR Prime Market — Hostinger Node.js bundle (Mode B: full server)",
    "==================================================================",
    "",
    "This bundle runs the FULL TanStack Start / Nitro SSR server, including",
    "every /api/* route (the API Gateway, cron endpoints, chat/shopping-agent,",
    "the ARQ Master OS admin control plane, and the health check).",
    "",
    "1. Upload and extract this ZIP into your Hostinger app root.",
    "2. In hPanel -> Node.js app:",
    "     Application Entry File:  start-server.mjs",
    "     Startup command:         npm start",
    "     Node version:            20.x or newer",
    "   (start-server.mjs wraps the Nitro server with static-asset caching",
    "    and a lightweight /healthz endpoint; falls back gracefully if this",
    "    Nitro build self-listens instead of exporting a handler.)",
    "3. Set required environment variables (see docs/devops/ENVIRONMENT.md",
    "   and docs/devops/HOSTINGER_NODE_DEPLOYMENT.md) -- at minimum:",
    "     SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_PROJECT_ID,",
    "     VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID,",
    "     CRON_SECRET (must match the integration_secrets(provider='cron') row",
    "     used by supabase/migrations/20260723090000_*.sql and *090100_*.sql)",
    "4. Run `npm install` from the Hostinger panel (or via SSH -- SSH access",
    "   is available on Business Plan via hPanel -> Advanced -> SSH Access).",
    "5. Start / restart the app.",
    "",
    "Verify after deploy: GET https://arprimemarket.shop/api/public/health",
    'should return 200 {"status":"ok","db":"ok",...}. If it 404s, the',
    "Node.js App is not actually running this server (check the entry file",
    "path in hPanel matches exactly).",
  ].join("\n"),
);

// 3. Zip
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const zipName = `arprimemarket-hostinger-node-${stamp}.zip`;
const zipPath = path.join(outDir, zipName);

log(`creating ${zipName}`);
await new Promise((resolve, reject) => {
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });
  output.on("close", resolve);
  output.on("error", reject);
  archive.on("error", reject);
  archive.pipe(output);
  archive.directory(stageDir, false);
  archive.finalize();
});

fs.rmSync(stageDir, { recursive: true, force: true });

const sizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
log(`✓ ready: ${path.relative(root, zipPath)} (${sizeMb} MB)`);
log(
  "Upload this ZIP via Hostinger's Node.js App file manager / zip upload and extract in the app root.",
);
