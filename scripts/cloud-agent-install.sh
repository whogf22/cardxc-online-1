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

echo "[install] Ensuring local .env exists..."
if [ ! -f .env ]; then
  cat > .env <<EOF
# Auto-generated local development environment (git-ignored).
NODE_ENV=development
PORT=5001
DATABASE_URL=postgresql://cardxc:cardxc@localhost:5432/cardxc?sslmode=disable
DATABASE_SSL=false
SESSION_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
EOF
  echo "[install] Created .env with generated local dev secrets."
else
  echo "[install] .env already present; leaving it untouched."
fi

echo "[install] Done."
