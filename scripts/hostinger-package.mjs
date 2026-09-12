#!/usr/bin/env node
/**
 * Builds the Hostinger bundle and produces a ready-to-upload ZIP.
 *
 * Steps:
 *   1. Run `npm run build:hostinger` (vite build → dist/ + postbuild mirror).
 *   2. Stage required files into a temp dir:
 *        - dist/                (static client bundle)
 *        - hostinger-server.js  (Express entry point)
 *        - package.json         (with the "start" script)
 *        - package-lock.json / bun.lockb (whichever exists)
 *        - .htaccess / web.config (if present at repo root)
 *   3. Zip the staged tree to dist-hostinger/arprimemarket-hostinger-<timestamp>.zip
 *
 * Usage:
 *   node scripts/hostinger-package.mjs
 *   npm run package:hostinger        (if wired into package.json)
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiverPkg from "archiver";
const archiver = archiverPkg.default ?? archiverPkg;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "dist-hostinger");
const stageDir = path.join(outDir, "stage");

function log(msg) {
  console.log(`[hostinger-package] ${msg}`);
}

function run(cmd) {
  log(`$ ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit", shell: true });
}

// 1. Build (npm works on Windows/macOS/Linux via shell:true)
run("npm run build:hostinger");

const distDir = path.join(root, "dist");
if (!fs.existsSync(path.join(distDir, "index.html"))) {
  console.error("[hostinger-package] dist/index.html missing after build.");
  process.exit(1);
}

// 2. Stage
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });

log("staging dist/");
fs.cpSync(distDir, path.join(stageDir, "dist"), { recursive: true });

const copyIfExists = (rel) => {
  const src = path.join(root, rel);
  if (fs.existsSync(src)) {
    fs.cpSync(src, path.join(stageDir, rel), { recursive: true });
    log(`included ${rel}`);
  }
};

["hostinger-server.js", "package.json", "package-lock.json", ".htaccess", "web.config"].forEach(
  copyIfExists,
);

// Trim package.json to production-relevant fields so Hostinger's npm install
// doesn't try to pull dev tooling (vite, tanstack, etc.).
const pkgPath = path.join(stageDir, "package.json");
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const slimmed = {
    name: pkg.name,
    version: pkg.version,
    private: true,
    type: pkg.type ?? "module",
    scripts: { start: pkg.scripts?.start ?? "node hostinger-server.js" },
    dependencies: {
      express: pkg.dependencies?.express ?? pkg.devDependencies?.express ?? "^4.19.2",
      compression: pkg.dependencies?.compression ?? pkg.devDependencies?.compression ?? "^1.7.4",
    },
    engines: pkg.engines ?? { node: ">=20" },
  };
  fs.writeFileSync(pkgPath, JSON.stringify(slimmed, null, 2));
  log("slimmed package.json to runtime-only deps");
}

// Write a short README inside the bundle
fs.writeFileSync(
  path.join(stageDir, "README-HOSTINGER.txt"),
  [
    "AR Prime Market — Hostinger Node.js bundle",
    "==========================================",
    "",
    "1. Upload and extract this ZIP into your Hostinger app root.",
    "2. In hPanel → Node.js app:",
    "     Application Entry File:  hostinger-server.js",
    "     Startup command:         npm start",
    "     Node version:            20.x or newer",
    "3. Run `npm install` from the Hostinger panel (or via SSH).",
    "4. Start / restart the app.",
    "",
    "The Node process only serves dist/ as static files + SPA fallback.",
    "All dynamic logic (Raiyan AI, Telegram webhook, CJ sync, etc.) runs",
    "on Supabase Edge Functions and is called directly from the browser.",
  ].join("\n"),
);

// 2b. Preflight: assert stage contains ONLY the allowed entries.
const ALLOWED_TOP = new Set([
  "dist",
  "hostinger-server.js",
  "package.json",
  "README-HOSTINGER.txt",
]);
const OPTIONAL_TOP = new Set(["package-lock.json", "bun.lockb", ".htaccess", "web.config"]);
const REQUIRED_TOP = ["dist", "hostinger-server.js", "package.json"];

const present = fs.readdirSync(stageDir);
const unexpected = present.filter((n) => !ALLOWED_TOP.has(n) && !OPTIONAL_TOP.has(n));
const missing = REQUIRED_TOP.filter((n) => !present.includes(n));

if (unexpected.length || missing.length) {
  console.error("[hostinger-package] preflight FAILED");
  if (missing.length) console.error("  missing required:", missing.join(", "));
  if (unexpected.length) console.error("  unexpected entries:", unexpected.join(", "));
  process.exit(1);
}

// Validate slimmed package.json shape
const slim = JSON.parse(fs.readFileSync(path.join(stageDir, "package.json"), "utf8"));
const forbiddenKeys = ["devDependencies", "peerDependencies", "optionalDependencies"];
const leaked = forbiddenKeys.filter((k) => slim[k]);
const allowedDeps = new Set(["express", "compression"]);
const extraDeps = Object.keys(slim.dependencies ?? {}).filter((d) => !allowedDeps.has(d));
if (leaked.length || extraDeps.length || slim.scripts?.start !== "node hostinger-server.js") {
  console.error("[hostinger-package] package.json preflight FAILED");
  if (leaked.length) console.error("  leaked dep buckets:", leaked.join(", "));
  if (extraDeps.length) console.error("  extra runtime deps:", extraDeps.join(", "));
  if (slim.scripts?.start !== "node hostinger-server.js")
    console.error("  start script mismatch:", slim.scripts?.start);
  process.exit(1);
}
log("preflight ok — stage contains only required Hostinger files");

// 3. Zip
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const zipName = `arprimemarket-hostinger-${stamp}.zip`;
const zipPath = path.join(outDir, zipName);

log(`creating ${zipName}`);
// Cross-platform zip via archiver (no system `zip` dependency — works on Windows).
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
log("Upload this ZIP via Hostinger File Manager and extract in the app root.");
