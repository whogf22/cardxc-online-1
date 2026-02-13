#!/usr/bin/env node
/**
 * One-time bootstrap: add MCP push/sync scripts to package.json if missing.
 * Run on Replit (or any clone) when you see "Missing script: mcp:push":
 *   node scripts/bootstrap-mcp-scripts.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pkgPath = join(root, 'package.json');

const MCP_SCRIPTS = {
  'mcp': 'node mcp-server/index.js',
  'mcp:http': 'node mcp-server/http-server.js',
  'mcp:sync': 'node scripts/mcp-sync-agent.js',
  'mcp:snapshot': 'node scripts/snapshot-rollback.js create',
  'mcp:rollback': 'node scripts/snapshot-rollback.js rollback',
  'mcp:push-homepage': 'node scripts/mcp-push-homepage-and-db.js',
  'mcp:push-all': 'node scripts/mcp-push-all.js',
  'mcp:push-all:recovery': 'node scripts/mcp-push-all-recovery.js',
  'mcp:push': 'npm run mcp:push-all || npm run mcp:push-all:recovery',
  'mcp:bootstrap': 'node scripts/bootstrap-mcp-scripts.js',
};

try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const scripts = pkg.scripts || {};
  let added = 0;
  for (const [name, cmd] of Object.entries(MCP_SCRIPTS)) {
    if (scripts[name] !== cmd) {
      scripts[name] = cmd;
      added++;
    }
  }
  if (added === 0) {
    console.log('All MCP scripts already present in package.json.');
    process.exit(0);
  }
  pkg.scripts = scripts;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('Added/updated', added, 'MCP script(s) in package.json. You can run: npm run mcp:push');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
