#!/usr/bin/env node
/**
 * MCP Recovery & Push Agent
 * Waits for Replit MCP, verifies auth, pushes all files, DB refresh, build.
 * Retries on transient errors. No user intervention.
 */

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const MCP_BASE = (process.env.REPLIT_MCP_URL || "https://cardxc-online.janeway.replit.dev:8080").replace(/\/$/, "");
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 24;
const MAX_PUSH_RETRIES = 3;

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

const REPLIT_MCP_AUTH = process.env.REPLIT_MCP_AUTH || "";
const MCP_API_KEY = process.env.MCP_API_KEY || "cardxc-mcp-dev-key";
const MCP_USERNAME = process.env.MCP_SYNC_USERNAME || "mcp-sync-agent";

const BLOCKED = [".env", "secrets", "credentials", "node_modules", ".git", "tmp", "build", "dist"];
let cachedToken = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function checkMcpReachable() {
  for (const ep of ["/health", "/tools"]) {
    try {
      const res = await fetch(`${MCP_BASE}${ep}`, { method: "GET" });
      if (res.status === 200) return true;
    } catch (_) {}
  }
  return false;
}

async function waitForMcp() {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    process.stderr.write(`[${i + 1}/${MAX_POLL_ATTEMPTS}] Checking MCP... `);
    if (await checkMcpReachable()) {
      process.stderr.write("OK\n");
      return true;
    }
    process.stderr.write("waiting 5s\n");
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

async function getAuthHeader() {
  if (REPLIT_MCP_AUTH?.trim()) {
    const v = REPLIT_MCP_AUTH.trim();
    return v.startsWith("Bearer ") ? v : `Bearer ${v}`;
  }
  if (cachedToken) return `Bearer ${cachedToken}`;
  const res = await fetch(`${MCP_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: MCP_API_KEY, username: MCP_USERNAME }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  if (!data.token) throw new Error("No token in auth response");
  cachedToken = data.token;
  return `Bearer ${cachedToken}`;
}

async function verifyAuth() {
  const auth = await getAuthHeader();
  const res = await fetch(`${MCP_BASE}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ tool: "healthCheck", arguments: {} }),
  });
  const data = await res.json();
  if (!res.ok || (data.success === false && data.error)) {
    throw new Error("Authorization invalid");
  }
  return true;
}

async function callTool(toolName, args) {
  const auth = await getAuthHeader();
  const res = await fetch(`${MCP_BASE}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ tool: toolName, arguments: args }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
  return data.result;
}

function isBlocked(rel) {
  const n = rel.replace(/\\/g, "/").toLowerCase();
  return BLOCKED.some((b) => n.includes(b));
}

async function collectFiles(dir, base = PROJECT_ROOT) {
  if (!fsSync.existsSync(dir)) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).replace(/\\/g, "/");
    if (isBlocked(rel)) continue;
    if (e.isDirectory()) {
      files.push(...(await collectFiles(full, base)));
    } else {
      files.push({ absolute: full, relative: rel });
    }
  }
  return files;
}

function isBinary(rel) {
  const ext = path.extname(rel).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".gif", ".ico", ".webp", ".woff", ".woff2"].includes(ext);
}

async function runPush() {
  const dirs = [
    path.join(PROJECT_ROOT, "src"),
    path.join(PROJECT_ROOT, "server"),
    path.join(PROJECT_ROOT, "mcp-server"),
    path.join(PROJECT_ROOT, "public"),
  ];
  let all = [];
  for (const d of dirs) {
    all.push(...(await collectFiles(d)));
  }
  if (fsSync.existsSync(path.join(PROJECT_ROOT, "package.json"))) {
    all.push({ absolute: path.join(PROJECT_ROOT, "package.json"), relative: "package.json" });
  }
  const unique = [...new Map(all.map((f) => [f.relative, f])).values()];

  const textOnly = unique.filter((f) => !isBinary(f.relative));
  let pushed = 0;
  for (const { absolute, relative } of textOnly) {
    const content = await fs.readFile(absolute, "utf-8");
    await callTool("write_file", { path: relative, content });
    pushed++;
  }

  const schemaRes = await callTool("run_command", { command: "npm run db:schema" });
  const buildRes = await callTool("run_command", { command: "npm run build 2>&1 || true" });
  const buildOk = typeof buildRes === "string" && !buildRes.includes("error TS");

  return { pushed, total: textOnly.length, schemaOk: !!schemaRes, buildOk };
}

async function main() {
  const startTime = new Date().toISOString();

  if (!(await waitForMcp())) {
    console.error("MCP PUSH: FAILED - MCP unreachable after 24 attempts (2 min)");
    process.exit(1);
  }

  try {
    await verifyAuth();
  } catch (e) {
    console.error("MCP PUSH: FAILED - Authorization invalid");
    process.exit(1);
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_PUSH_RETRIES; attempt++) {
    try {
      const result = await runPush();
      const timestamp = new Date().toISOString();
      console.log("\n---");
      console.log("MCP PUSH: SUCCESS");
      console.log("Files pushed:", result.pushed + "/" + result.total);
      console.log("Build status:", result.buildOk ? "OK" : "WARN (check Replit logs)");
      console.log("Timestamp:", timestamp);
      process.exit(0);
    } catch (e) {
      lastError = e;
      const transient =
        e.message?.includes("fetch") ||
        e.message?.includes("ECONNREFUSED") ||
        e.message?.includes("ETIMEDOUT") ||
        e.message?.includes("network") ||
        e.code === "ECONNREFUSED" ||
        e.code === "ETIMEDOUT";
      if (attempt < MAX_PUSH_RETRIES && transient) {
        process.stderr.write(`Push attempt ${attempt} failed, retrying in 5s...\n`);
        await sleep(5000);
      } else {
        break;
      }
    }
  }

  console.error("MCP PUSH: FAILED -", lastError?.message || "Unknown error");
  process.exit(1);
}

main();
