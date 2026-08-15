#!/usr/bin/env bash
# Cloud Agent start phase for CardXC.
# Brings up PostgreSQL, ensures the dev database/role/schema/seed exist, then
# runs the backend (port 5001) and Vite frontend (port 5000) via `npm run dev`.
# The Vite dev server stays attached in the foreground.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[start] Starting PostgreSQL..."
sudo pg_ctlcluster 16 main start 2>/dev/null || true

echo "[start] Waiting for PostgreSQL to accept connections..."
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q 2>/dev/null; then
    break
  fi
  sleep 1
done

echo "[start] Ensuring database role and database exist..."
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='cardxc'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE cardxc LOGIN PASSWORD 'cardxc';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='cardxc'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE cardxc OWNER cardxc;"

echo "[start] Applying schema and seeding dev users (idempotent)..."
npm run db:schema
npm run db:seed

echo "[start] Launching backend (5001) + frontend (5000)..."
exec npm run dev
