#!/usr/bin/env node
/**
 * Production validation: run after deploy to verify backend health.
 * Usage: node scripts/validate-production.js [BASE_URL]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function appBaseFromMcpUrl(url) {
  if (!url || typeof url !== 'string') return null;
  return url.trim().replace(/:8080\/?$/, '') || null;
}
function getReplitAppBaseFromMcpSync() {
  const envPath = path.join(__dirname, '..', '.env.mcp-sync');
  if (!fs.existsSync(envPath)) return null;
  const content = fs.readFileSync(envPath, 'utf8');
  const m = content.match(/REPLIT_MCP_URL\s*=\s*(https?:\/\/[^\s#]+)/);
  if (!m) return null;
  return appBaseFromMcpUrl(m[1]);
}
const baseFromEnv = appBaseFromMcpUrl(process.env.REPLIT_MCP_URL);
const baseFromFile = getReplitAppBaseFromMcpSync();
const defaultBase = baseFromEnv || baseFromFile || 'http://localhost:3001';
const BASE = process.argv[2] || defaultBase;
async function fetchJson(route, options = {}) {
  const url = `${BASE.replace(/\/$/, '')}${route}`;
  const res = await fetch(url, { ...options, headers: { Accept: 'application/json', ...options.headers } });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  return { ok: res.ok, status: res.status, data, text: text.slice(0, 200) };
}
async function main() {
  console.log('--- Production validation ---');
  console.log('Base URL:', BASE);
  let failed = 0;
  const health = await fetchJson('/api/health');
  if (!health.ok) { console.log('FAIL /api/health', health.status); failed++; } else { console.log('OK   /api/health', health.data?.status ?? 'unknown'); }
  const detailed = await fetchJson('/api/health/detailed');
  if (!detailed.ok) { failed++; } else { const db = detailed.data?.checks?.database; console.log('OK   /api/health/detailed', 'database:', db?.status ?? 'unknown'); }
  const ready = await fetchJson('/api/health/ready');
  if (!ready.ok) { failed++; } else { console.log('OK   /api/health/ready', ready.data?.ready === true ? 'ready' : 'not ready'); }
  const live = await fetchJson('/api/health/live');
  if (!live.ok) { failed++; } else { console.log('OK   /api/health/live', live.data?.live === true ? 'live' : ''); }
  console.log('');
  if (failed > 0) { console.log('Validation failed:', failed, 'check(s)'); process.exit(1); }
  console.log('All checks passed. Backend is production-ready.');
}
main().catch((err) => { console.error('Validation error:', err.message); process.exit(1); });
