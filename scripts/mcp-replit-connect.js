#!/usr/bin/env node
/**
 * Connect Cursor to Replit MCP: check reachability, fetch token, print config.
 * Run: npm run mcp:replit-connect
 *
 * Prerequisites:
 * 1. Replit app must be RUNNING (web app + MCP server on port 8080).
 * 2. .env.mcp-sync has REPLIT_MCP_URL (e.g. https://YOUR-REPL.janeway.replit.dev:8080).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Load .env.mcp-sync
const envPath = path.join(PROJECT_ROOT, ".env.mcp-sync");
if (fs.existsSync(envPath)) {
  const buf = fs.readFileSync(envPath, "utf-8");
  for (const line of buf.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const REPLIT_MCP_URL = (process.env.REPLIT_MCP_URL || "").replace(/\/$/, "");
const MCP_API_KEY = process.env.MCP_API_KEY || "cardxc-mcp-key";

if (!REPLIT_MCP_URL || REPLIT_MCP_URL.includes("YOUR-REPLIT")) {
  console.error("Set REPLIT_MCP_URL in .env.mcp-sync to your Replit MCP URL (e.g. https://YOUR-REPL.janeway.replit.dev:8080)");
  process.exit(1);
}

async function main() {
  console.log("Replit MCP URL:", REPLIT_MCP_URL);
  console.log("");

  // 1. Check reachability
  try {
    const healthRes = await fetch(`${REPLIT_MCP_URL}/health`, { method: "GET" });
    if (healthRes.ok) {
      const data = await healthRes.json().catch(() => ({}));
      console.log("Replit MCP reachable:", data.message || data.status || "OK");
    } else {
      console.log("Replit MCP /health returned", healthRes.status, "- is the Replit app running?");
    }
  } catch (e) {
    console.error("Cannot reach Replit MCP:", e.message);
    console.error("Ensure the Replit app is RUNNING and REPLIT_MCP_URL is correct.");
    process.exit(1);
  }

  // 2. Get token
  let token;
  try {
    const res = await fetch(`${REPLIT_MCP_URL}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: MCP_API_KEY, username: "cursor" }),
    });
    const data = await res.json();
    if (!res.ok || !data.token) {
      console.error("Auth failed:", data.error || res.status);
      process.exit(1);
    }
    token = data.token;
    console.log("Token obtained (expires in", data.expiresIn || "8h", ")");
  } catch (e) {
    if (e.message && e.message.includes("not valid JSON")) {
      console.error("Replit returned a web page instead of JSON. Start the Replit app so the MCP server on port 8080 is running.");
    } else {
      console.error("Auth request failed:", e.message);
    }
    process.exit(1);
  }

  // 3. Print Cursor config
  const mcpUrlStreamable = `${REPLIT_MCP_URL}/mcp`;
  console.log("");
  console.log("--- Add Replit MCP server in Cursor ---");
  console.log("1. Open Cursor → Settings (Cmd/Ctrl + ,) → search 'MCP'");
  console.log("2. Under MCP Servers, click '+ Add Server' or edit your config");
  console.log("3. Use:");
  console.log("   Name:  Replit (CardXC)");
  console.log("   Type:  http");
  console.log("   URL:   " + mcpUrlStreamable);
  console.log("   Header: Authorization = Bearer " + token);
  console.log("");
  console.log("Or add this to your MCP config (e.g. Cursor Settings → MCP → Edit in settings.json):");
  console.log(JSON.stringify({
    mcpServers: {
      "replit-cardxc": {
        type: "http",
        url: mcpUrlStreamable,
        headers: { Authorization: "Bearer " + token },
      },
    },
  }, null, 2));
  console.log("");
  console.log("After adding, Cursor will connect to Replit and you can use tools (read_file, write_file, etc.) on the Replit filesystem.");
}

main();
