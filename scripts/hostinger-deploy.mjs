#!/usr/bin/env node
/**
 * One-click Hostinger deploy over FTP/FTPS.
 *
 * Usage:
 *   1. Copy .env.hostinger.example → .env.hostinger and fill credentials.
 *   2. Run: npm run deploy:hostinger
 *
 * What it does:
 *   - Runs `npm run build:hostinger` (unless SKIP_BUILD=1)
 *   - Connects to Hostinger via FTPS (implicit secure=true)
 *   - Optionally wipes the remote directory (HOSTINGER_CLEAN=1)
 *   - Uploads the entire dist/ folder to HOSTINGER_REMOTE_DIR (default: /public_html)
 *
 * ENV variables (.env.hostinger or shell):
 *   HOSTINGER_HOST         ftp host, e.g. ftp.yourdomain.com
 *   HOSTINGER_USER         ftp username
 *   HOSTINGER_PASSWORD     ftp password
 *   HOSTINGER_PORT         default 21
 *   HOSTINGER_SECURE       "true" | "false" (default true = FTPS)
 *   HOSTINGER_REMOTE_DIR   default "/public_html"
 *   HOSTINGER_CLEAN        "1" to wipe remote dir before upload
 *   SKIP_BUILD             "1" to skip build step
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "basic-ftp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const envFile = path.join(root, ".env.hostinger");

// Load .env.hostinger (simple KEY=VALUE parser)
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

const {
  HOSTINGER_HOST,
  HOSTINGER_USER,
  HOSTINGER_PASSWORD,
  HOSTINGER_PORT = "21",
  HOSTINGER_SECURE = "true",
  HOSTINGER_REMOTE_DIR = "/public_html",
  HOSTINGER_CLEAN = "0",
  SKIP_BUILD = "0",
} = process.env;

function log(msg) {
  console.log(`[hostinger-deploy] ${msg}`);
}

if (!HOSTINGER_HOST || !HOSTINGER_USER || !HOSTINGER_PASSWORD) {
  console.error("[hostinger-deploy] Missing HOSTINGER_HOST / HOSTINGER_USER / HOSTINGER_PASSWORD.");
  console.error("Create .env.hostinger (see .env.hostinger.example) or export them in your shell.");
  process.exit(1);
}

if (SKIP_BUILD !== "1") {
  log("building (npm run build:hostinger)…");
  execSync("npm run build:hostinger", { cwd: root, stdio: "inherit", shell: true });
} else {
  log("SKIP_BUILD=1 — using existing dist/");
}

if (!fs.existsSync(path.join(distDir, "index.html"))) {
  console.error("[hostinger-deploy] dist/index.html missing — build failed?");
  process.exit(1);
}

const client = new Client(30_000);
client.ftp.verbose = false;

try {
  log(
    `connecting ftps://${HOSTINGER_USER}@${HOSTINGER_HOST}:${HOSTINGER_PORT} (secure=${HOSTINGER_SECURE})`,
  );
  await client.access({
    host: HOSTINGER_HOST,
    user: HOSTINGER_USER,
    password: HOSTINGER_PASSWORD,
    port: Number(HOSTINGER_PORT),
    secure: HOSTINGER_SECURE === "true",
    secureOptions: { rejectUnauthorized: false },
  });

  await client.ensureDir(HOSTINGER_REMOTE_DIR);
  await client.cd(HOSTINGER_REMOTE_DIR);

  if (HOSTINGER_CLEAN === "1") {
    log(`cleaning remote ${HOSTINGER_REMOTE_DIR} …`);
    await client.clearWorkingDir();
  }

  client.trackProgress((info) => {
    if (info.name) process.stdout.write(`\r  ↑ ${info.name} (${info.bytes} bytes)          `);
  });

  log(`uploading dist/ → ${HOSTINGER_REMOTE_DIR}`);
  await client.uploadFromDir(distDir);
  client.trackProgress();
  console.log();
  log("✓ deploy complete — visit your domain to verify.");
} catch (err) {
  console.error("\n[hostinger-deploy] FAILED:", err.message);
  process.exit(1);
} finally {
  client.close();
}
