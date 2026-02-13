#!/usr/bin/env node
/**
 * One-time: Push homepage files to Replit + refresh database.
 * Run: npm run mcp:push-homepage
 */

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Load .env.mcp-sync
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

async function collectFiles(dir, base = PROJECT_ROOT) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).replace(/\\/g, "/");
    if (e.isDirectory()) {
      if (!["node_modules", ".git"].includes(e.name)) {
        files.push(...(await collectFiles(full, base)));
      }
    } else {
      files.push({ absolute: full, relative: rel });
    }
  }
  return files;
}

async function main() {
  if (!REPLIT_MCP_URL || REPLIT_MCP_URL.includes("YOUR-REPLIT")) {
    console.error("Set REPLIT_MCP_URL in .env.mcp-sync to your Replit MCP URL.");
    process.exit(1);
  }

  const homeDir = path.join(PROJECT_ROOT, "src", "pages", "home");
  const homeFiles = fsSync.existsSync(homeDir) ? await collectFiles(homeDir) : [];
  const unique = [...new Map(homeFiles.map((f) => [f.relative, f])).values()];

  console.log("Pushing homepage files to Replit...");
  for (const { absolute, relative } of unique) {
    try {
      const content = await fs.readFile(absolute, "utf-8");
      await callReplitTool("write_file", { path: relative, content });
      console.log("  ✓", relative);
    } catch (e) {
      console.error("  ✗", relative, e.message);
    }
  }

  console.log("\nRefreshing database on Replit (npm run db:schema)...");
  try {
    const result = await callReplitTool("run_command", {
      command: "npm run db:schema",
    });
    console.log("  ✓", typeof result === "string" ? result.slice(0, 200) : "Done");
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

  console.log("\nHomepage sync + DB refresh complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
