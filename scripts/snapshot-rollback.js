#!/usr/bin/env node
/**
 * Snapshot & Rollback for MCP Sync
 * Creates snapshots (file list + hashes) and enables one-command rollback.
 */

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SNAPSHOT_DIR = path.join(PROJECT_ROOT, "tmp", "mcp-snapshots");
const SNAPSHOT_MANIFEST = path.join(SNAPSHOT_DIR, "manifest.json");

const SYNC_DIRS = ["src", "server", "mcp-server", "public"];
const IGNORE = new Set([".git", "node_modules", "build", "dist", ".cache", "coverage", "tmp"]);

async function hashFile(filePath) {
  try {
    const buf = await fs.readFile(filePath);
    return createHash("sha256").update(buf).digest("hex");
  } catch {
    return null;
  }
}

async function collectFiles(dir, base = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full);
    if (IGNORE.has(e.name)) continue;
    if (e.isDirectory()) {
      files.push(...(await collectFiles(full, base)));
    } else {
      files.push(rel.replace(/\\/g, "/"));
    }
  }
  return files;
}

export async function createSnapshot() {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotId = `snap_${timestamp}`;
  const snapshotPath = path.join(SNAPSHOT_DIR, `${snapshotId}.json`);

  const allFiles = [];
  for (const d of SYNC_DIRS) {
    const dirPath = path.join(PROJECT_ROOT, d);
    if (fsSync.existsSync(dirPath)) {
      allFiles.push(...(await collectFiles(dirPath, PROJECT_ROOT)));
    }
  }
  if (fsSync.existsSync(path.join(PROJECT_ROOT, "package.json"))) {
    allFiles.push("package.json");
  }

  const entries = [];
  const fileContents = [];
  for (const rel of allFiles) {
    const full = path.join(PROJECT_ROOT, rel);
    try {
      const content = await fs.readFile(full, "utf-8");
      const h = createHash("sha256").update(content).digest("hex");
      entries.push({ path: rel, hash: h });
      fileContents.push({ path: rel, hash: h, content });
    } catch (_) {}
  }

  const snapshot = {
    id: snapshotId,
    timestamp: new Date().toISOString(),
    entries,
  };
  await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
  const dataPath = path.join(SNAPSHOT_DIR, `${snapshotId}.data`);
  await fs.writeFile(dataPath, JSON.stringify({ files: fileContents }), "utf-8");

  let manifest = { current: null, snapshots: [] };
  try {
    manifest = JSON.parse(await fs.readFile(SNAPSHOT_MANIFEST, "utf-8"));
  } catch (_) {}
  manifest.current = snapshotId;
  manifest.lastTimestamp = snapshot.timestamp;
  if (!manifest.snapshots.includes(snapshotId)) {
    manifest.snapshots.unshift(snapshotId);
    manifest.snapshots = manifest.snapshots.slice(0, 10);
  }
  await fs.writeFile(SNAPSHOT_MANIFEST, JSON.stringify(manifest, null, 2));

  return { snapshotId, timestamp: snapshot.timestamp, fileCount: entries.length };
}

export async function rollbackToSnapshot(snapshotId) {
  let target = snapshotId;
  if (!target) {
    const manifest = JSON.parse(await fs.readFile(SNAPSHOT_MANIFEST, "utf-8"));
    target = manifest.current;
  }
  const snapshotPath = path.join(SNAPSHOT_DIR, `${target}.json`);
  if (!fsSync.existsSync(snapshotPath)) {
    throw new Error(`Snapshot not found: ${target}`);
  }
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf-8"));
  const snapshotDataPath = path.join(SNAPSHOT_DIR, `${target}.data`);
  if (!fsSync.existsSync(snapshotDataPath)) {
    throw new Error(`Snapshot data not found. Rollback requires snapshot with stored content.`);
  }
  const data = JSON.parse(await fs.readFile(snapshotDataPath, "utf-8"));
  for (const { path: rel, content } of data.files) {
    const full = path.join(PROJECT_ROOT, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf-8");
  }
  return { snapshotId: target, restored: data.files.length };
}

export async function getLastSnapshot() {
  try {
    const manifest = JSON.parse(await fs.readFile(SNAPSHOT_MANIFEST, "utf-8"));
    return { id: manifest.current, timestamp: manifest.lastTimestamp };
  } catch {
    return null;
  }
}

// CLI (only when run directly)
const isMain = process.argv[1]?.includes("snapshot-rollback");
const cmd = process.argv[2];
if (isMain && cmd === "create") {
  createSnapshot().then((r) => {
    console.log(`Snapshot created: ${r.snapshotId} (${r.fileCount} files)`);
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else if (isMain && (cmd === "rollback" || cmd === "restore")) {
  rollbackToSnapshot(process.argv[3]).then((r) => {
    console.log(`Rollback complete: ${r.restored} files restored from ${r.snapshotId}`);
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else if (isMain && cmd === "last") {
  getLastSnapshot().then((r) => {
    console.log(r ? `${r.id} @ ${r.timestamp}` : "No snapshot");
  });
} else if (isMain) {
  console.log("Usage: node snapshot-rollback.js create | rollback [snapshotId] | last");
}
