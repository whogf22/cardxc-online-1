#!/usr/bin/env node
/**
 * Fintech-Grade MCP Sync Agent
 * ALWAYS-ON auto-sync from local Cursor workspace to connected Replit via MCP.
 * Pipeline: Pre-Sync Safety Validator (blocking) → Safe Auto-Sync → Post-Sync Verification
 *
 * Usage: REPLIT_MCP_URL=https://YOUR-REPL.janeway.replit.dev:8080 node scripts/mcp-sync-agent.js
 * Or: npm run mcp:sync
 */

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { createSnapshot, rollbackToSnapshot, getLastSnapshot } from "./snapshot-rollback.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

try {
  const envPath = path.join(PROJECT_ROOT, ".env.mcp-sync");
  if (fsSync.existsSync(envPath)) {
    const buf = fsSync.readFileSync(envPath, "utf-8");
    for (const line of buf.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
} catch (_) {}

const REPLIT_MCP_URL = process.env.REPLIT_MCP_URL || "";
const REPLIT_MCP_AUTH = process.env.REPLIT_MCP_AUTH || "";
const MCP_API_KEY = process.env.MCP_API_KEY || "cardxc-mcp-key";
const MCP_USERNAME = process.env.MCP_SYNC_USERNAME || "mcp-sync-agent";
const LOG_FILE = path.join(PROJECT_ROOT, "tmp", "mcp-sync.log");
const DEBOUNCE_MS = 1500;
const MCP_RETRY_MS = 5000;
const MCP_RETRY_ATTEMPTS = 5;

const BLOCKED_PATTERNS = [
  /\.env$/i,
  /\.env\./i,
  /\.env[a-z0-9_]*$/i,
  /secrets?/i,
  /credentials?/i,
  /\.pem$/i,
  /\.key$/i,
  /config\/secrets/i,
  /server\/routes\/(auth|payments|cardCheckout|transactions)\.ts$/i,
  /server\/.*(payment|auth|wallet|settlement|withdrawal)/i,
  /server\/db\/.*(migration|seed)/i,
];

const BLOCKED_SUBSTRINGS = [
  ".env",
  "secrets",
  "credentials",
  "node_modules",
  ".git/",
  "tmp/",
  "build/",
  "dist/",
];

const DANGEROUS_SQL = /\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+)/i;

async function ensureLogDir() {
  const dir = path.dirname(LOG_FILE);
  await fs.mkdir(dir, { recursive: true });
}

function ts() {
  return new Date().toISOString();
}

async function log(level, message, data = null) {
  const line = `[${ts()}] [${level}] ${message}${data ? " " + JSON.stringify(data) : ""}\n`;
  process.stdout.write(line);
  try {
    await ensureLogDir();
    await fs.appendFile(LOG_FILE, line);
  } catch (e) {
  }
}

function isPathBlocked(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  for (const sub of BLOCKED_SUBSTRINGS) {
    if (normalized.includes(sub)) return { blocked: true, reason: `Contains blocked substring: ${sub}` };
  }
  for (const re of BLOCKED_PATTERNS) {
    if (re.test(normalized)) return { blocked: true, reason: `Matches blocked pattern: ${re}` };
  }
  return { blocked: false };
}

async function checkDangerousMigration(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    if (DANGEROUS_SQL.test(content)) {
      return { blocked: true, reason: "Migration contains DROP or TRUNCATE" };
    }
  } catch (e) {
    return { blocked: true, reason: "Cannot read file for migration check" };
  }
  return { blocked: false };
}

function runStaticChecks() {
  return new Promise((resolve) => {
    // spawn: shell:false, hardcoded binary and args - no user input
    const child = spawn("npm", ["run", "type-check"], { cwd: PROJECT_ROOT, timeout: 60000, shell: false });
    let stderr = "";
    let stdout = "";
    child.stdout.on("data", d => { stdout += d; });
    child.stderr.on("data", d => { stderr += d; });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true });
      } else {
        resolve({ ok: false, message: stderr || stdout || "type-check failed" });
      }
    });
    child.on("error", (e) => {
      resolve({ ok: false, message: e.message });
    });
  });
}

async function validateBeforeSync(changedFiles) {
  const blocked = [];
  const safe = [];

  for (const f of changedFiles) {
    const rel = path.relative(PROJECT_ROOT, f);
    const pathCheck = isPathBlocked(rel);
    if (pathCheck.blocked) {
      blocked.push({ file: rel, reason: pathCheck.reason });
      continue;
    }
    const ext = path.extname(f).toLowerCase();
    if ([".sql", ".ts", ".js"].includes(ext) && rel.toLowerCase().includes("migration")) {
      const migCheck = await checkDangerousMigration(f);
      if (migCheck.blocked) {
        blocked.push({ file: rel, reason: migCheck.reason });
        continue;
      }
    }
    safe.push({ absolute: f, relative: rel });
  }

  if (blocked.length > 0) {
    return { pass: false, blocked, safe: [] };
  }

  if (safe.length > 0) {
    const staticResult = await runStaticChecks();
    if (!staticResult.ok) {
      return {
        pass: false,
        blocked: [{ file: "static checks", reason: staticResult.message }],
        safe: [],
      };
    }
  }

  return { pass: true, blocked: [], safe };
}

let cachedToken = null;
let tokenExpiry = 0;

async function getAuthHeader() {
  if (REPLIT_MCP_AUTH && REPLIT_MCP_AUTH.trim()) {
    const v = REPLIT_MCP_AUTH.trim();
    return v.startsWith("Bearer ") ? v : `Bearer ${v}`;
  }
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return `Bearer ${cachedToken}`;
  }
  const url = `${REPLIT_MCP_URL.replace(/\/$/, "")}/auth/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: MCP_API_KEY, username: MCP_USERNAME }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Replit auth failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  cachedToken = data.token;
  tokenExpiry = Date.now() + 8 * 60 * 60 * 1000;
  return `Bearer ${cachedToken}`;
}

async function callReplitToolWithRetry(toolName, args, attempt = 1) {
  const authHeader = await getAuthHeader();
  const url = `${REPLIT_MCP_URL.replace(/\/$/, "")}/execute`;
  try {
    const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ tool: toolName, arguments: args }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Replit execute failed: ${res.status} ${JSON.stringify(data)}`);
  }
  if (!data.success && data.error) {
    throw new Error(data.error);
  }
  return data.result;
  } catch (e) {
    const isRetryable = e.code === "ECONNREFUSED" || e.code === "ETIMEDOUT" || e.cause?.code === "ECONNREFUSED" || e.name === "TypeError";
    if (attempt < MCP_RETRY_ATTEMPTS && isRetryable) {
      await log("WARN", "MCP disconnect - retrying", { attempt, max: MCP_RETRY_ATTEMPTS });
      await new Promise((r) => setTimeout(r, MCP_RETRY_MS));
      return callReplitToolWithRetry(toolName, args, attempt + 1);
    }
    throw e;
  }
}

async function callReplitTool(toolName, args) {
  return callReplitToolWithRetry(toolName, args);
}

async function syncFileToReplit(localPath, relativePath) {
  const content = await fs.readFile(localPath, "utf-8");
  await callReplitTool("write_file", {
    path: relativePath.replace(/\\/g, "/"),
    content,
  });
}

async function softRestartReplit() {
  try {
    const result = await callReplitTool("run_command", {
      command: "npm run build 2>&1",
    });
    if (typeof result === "string" && result.includes("error TS")) {
      throw new Error("Build failed: " + result.slice(0, 200));
    }
    return true;
  } catch (e) {
    await log("WARN", "Replit build verification failed", { error: e.message });
    return false;
  }
}

async function verifyReplitMcp() {
  try {
    const url = `${REPLIT_MCP_URL.replace(/\/$/, "")}/health`;
    const res = await fetch(url, { method: "GET" });
    const data = await res.json();
    if (data.status === "ok") return true;
  } catch (e) {
    await log("WARN", "MCP health check failed", { error: e.message });
  }
  return false;
}

let pendingFiles = new Set();
let debounceTimer = null;

function scheduleSync(addedPath) {
  const rel = path.relative(PROJECT_ROOT, addedPath);
  if (!rel || rel.startsWith("..")) return;
  pendingFiles.add(path.resolve(PROJECT_ROOT, addedPath));

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const files = [...pendingFiles];
    pendingFiles.clear();
    debounceTimer = null;

    if (files.length === 0) return;

    const existing = [];
    for (const f of files) {
      try {
        await fs.access(f);
        existing.push(f);
      } catch (_) {
      }
    }
    if (existing.length === 0) return;

    const validation = await validateBeforeSync(existing);
    if (!validation.pass) {
      await log("BLOCKED", "Sync aborted - validation failed", {
        blocked: validation.blocked,
        count: validation.blocked.length,
      });
      return;
    }
    if (validation.safe.length === 0) return;

    const synced = [];
    for (const { absolute, relative } of validation.safe) {
      try {
        await syncFileToReplit(absolute, relative);
        synced.push(relative);
        await log("SYNC", "OK", { file: relative });
      } catch (e) {
        await log("SYNC", "FAIL", { file: relative, error: e.message });
      }
    }

    if (synced.length > 0) {
      const buildOk = await softRestartReplit();
      if (!buildOk) {
        const last = await getLastSnapshot();
        if (last?.id) {
          try {
            await rollbackToSnapshot(last.id);
            await log("ROLLBACK", "Replit build failed - restored local from snapshot", {
              snapshotId: last.id,
              syncedFiles: synced,
            });
          } catch (rbErr) {
            await log("ERROR", "Rollback failed", { error: rbErr.message });
          }
        }
      } else {
        try {
          const snap = await createSnapshot();
          await log("SNAPSHOT", "Created after successful sync", {
            snapshotId: snap.snapshotId,
            timestamp: snap.timestamp,
            fileCount: snap.fileCount,
          });
        } catch (_) {}
      }
      const mcpOk = await verifyReplitMcp();
      await log("POST-SYNC", mcpOk ? "MCP reachable" : "MCP verification warning", {
        synced,
        mcpReachable: mcpOk,
      });
    }
  }, DEBOUNCE_MS);
}

function watchDir(dir, label) {
  if (!fsSync.existsSync(dir)) return;
  const watcher = fsSync.watch(dir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    const full = path.join(dir, filename);
    if (eventType === "change" || eventType === "rename") scheduleSync(full);
  });
  return watcher;
}

function setupWatcher() {
  watchDir(path.join(PROJECT_ROOT, "src"), "src");
  watchDir(path.join(PROJECT_ROOT, "server"), "server");
  watchDir(path.join(PROJECT_ROOT, "mcp-server"), "mcp-server");
  watchDir(path.join(PROJECT_ROOT, "public"), "public");
  fsSync.watch(path.join(PROJECT_ROOT, "package.json"), (eventType) => {
    if (eventType === "change") scheduleSync(path.join(PROJECT_ROOT, "package.json"));
  });
}

function hasPlaceholders() {
  const url = (REPLIT_MCP_URL || "").toLowerCase();
  const auth = (REPLIT_MCP_AUTH || "").toLowerCase();
  if (url.includes("your-replit") || url.includes("your_replit") || url.includes("placeholder")) return true;
  if (auth.includes("your_token") || auth.includes("yourtoken")) return true;
  if (!url || url === "https://:8080") return true;
  return false;
}

async function main() {
  if (!REPLIT_MCP_URL || hasPlaceholders()) {
    console.error("REPLIT_MCP_URL is required and must be a real janeway.replit.dev:8080 URL.");
    console.error("Edit .env.mcp-sync: replace YOUR-REPLIT-MCP-URL and YOUR_TOKEN with real values.");
    console.error("Abort: placeholders detected.");
    process.exit(1);
  }

  await ensureLogDir();
  await log("INFO", "MCP Sync Agent starting", {
    replitUrl: REPLIT_MCP_URL.replace(/:[^/]+@/, ":****@"),
    projectRoot: PROJECT_ROOT,
  });

  try {
    const snap = await createSnapshot();
    await log("SNAPSHOT", "Initial baseline created", {
      snapshotId: snap.snapshotId,
      timestamp: snap.timestamp,
      fileCount: snap.fileCount,
    });
  } catch (e) {
    await log("WARN", "Initial snapshot failed (non-fatal)", { error: e.message });
  }

  const initialValidation = await validateBeforeSync([]);
  await log("VALIDATION", "Initial pass", { staticChecks: "skipped (no changes)" });

  setupWatcher();
  await log("INFO", "Auto-sync ACTIVE - watching src/, server/, mcp-server/, public/");

  process.on("SIGINT", () => {
    log("INFO", "MCP Sync Agent stopped by user");
    process.exit(0);
  });
}

main().catch(async (e) => {
  await log("ERROR", "Fatal", { message: e.message });
  process.exit(1);
});
