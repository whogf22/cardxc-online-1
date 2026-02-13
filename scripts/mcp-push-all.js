#!/usr/bin/env node
/**
 * Push ALL project files to Replit + refresh database + build.
 * Same scope as mcp:sync watcher: src/, server/, mcp-server/, public/, package.json
 * Run: npm run mcp:push-all
 */

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

const BLOCKED = [".env", "secrets", "credentials", "node_modules", ".git", "tmp", "build", "dist"];

let cachedToken = null;

async function getAuthHeader() {
  if (REPLIT_MCP_AUTH?.trim()) {
    const v = REPLIT_MCP_AUTH.trim();
    return v.startsWith("Bearer ") ? v : `Bearer ${v}`;
  }
  if (cachedToken) return `Bearer ${cachedToken}`;
  const url = `${REPLIT_MCP_URL.replace(/\/$/, "")}/auth/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: MCP_API_KEY, username: MCP_USERNAME }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.token;
  return `Bearer ${cachedToken}`;
}

async function callReplitTool(toolName, args) {
  const auth = await getAuthHeader();
  const res = await fetch(`${REPLIT_MCP_URL.replace(/\/$/, "")}/execute`, {
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

async function main() {
  if (!REPLIT_MCP_URL || REPLIT_MCP_URL.includes("YOUR-REPLIT")) {
    console.error("Set REPLIT_MCP_URL in .env.mcp-sync.");
    process.exit(1);
  }

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

  console.log(`Pushing ${unique.length} files to Replit...`);
  let ok = 0;
  for (const { absolute, relative } of unique) {
    try {
      const content = await fs.readFile(absolute, "utf-8");
      await callReplitTool("write_file", { path: relative, content });
      ok++;
      console.log("  ✓", relative);
    } catch (e) {
      console.error("  ✗", relative, e.message);
    }
  }

  console.log(`\nPushed ${ok}/${unique.length} files.`);
  console.log("\nRefreshing database on Replit (npm run db:schema)...");
  try {
    const result = await callReplitTool("run_command", { command: "npm run db:schema" });
    console.log("  ✓", typeof result === "string" ? result.slice(0, 150) : "Done");
  } catch (e) {
    console.error("  ✗", e.message);
  }

  console.log("\nBuilding on Replit...");
  try {
    await callReplitTool("run_command", { command: "npm run build 2>&1 || true" });
    console.log("  ✓ Done");
  } catch (e) {
    console.error("  ✗", e.message);
  }

  if (ok === 0) {
    console.error("\nNo files pushed - MCP may be unreachable. Try: npm run mcp:push-all:recovery");
    process.exit(1);
  }
  console.log("\nAll files updated on Replit.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
