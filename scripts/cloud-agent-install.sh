#!/usr/bin/env bash
# Cloud Agent install phase for CardXC.
# Idempotent repository bootstrap: installs Node deps, ensures PostgreSQL is
# available, and creates a local .env if one is not already present.
# Runtime services (PostgreSQL, dev servers) are started by cloud-agent-start.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[install] Installing Node dependencies..."
npm install

echo "[install] Ensuring PostgreSQL is installed..."
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
else
  echo "[install] PostgreSQL already present."
fi

echo "[install] Ensuring local .env exists and is complete..."
# Creates .env when absent and backfills any missing required key (notably
# MCP_SECRET / MCP_API_KEY, without which `npm run mcp:http` refuses to start).
# Existing values are never overwritten. See scripts/ensure-env.sh.
bash scripts/ensure-env.sh

echo "[install] Done."
