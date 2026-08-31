#!/usr/bin/env bash
# Idempotent local .env bootstrap.
#
# Creates .env when it is absent, and BACKFILLS any required key that a
# pre-existing .env is missing. Existing values are never overwritten.
#
# The backfill exists because making MCP_SECRET mandatory (and distinct from
# SESSION_SECRET) otherwise breaks every environment provisioned before that
# change: `npm run mcp:http` hard-crashes at boot on resolveMcpSecret.
#
# Every secret is generated here with `openssl rand -hex 32` — the same
# mechanism already used for SESSION_SECRET. No secret is ever hardcoded.
#
# Covered by scripts/__tests__/ensureEnv.test.ts.
set -euo pipefail

# Generated secrets must not land in a world-readable file.
umask 077

ENV_FILE="${ENV_FILE:-.env}"

gen_secret() {
  openssl rand -hex 32
}

# Is KEY present in the env file with a non-empty value?
has_value() {
  local key="$1"
  [ -f "$ENV_FILE" ] || return 1
  grep -qE "^${key}=.+" "$ENV_FILE"
}

# Append `KEY=value` only when KEY has no value yet. Never overwrites.
ensure_key() {
  local key="$1"
  local value="$2"
  if has_value "$key"; then
    return 0
  fi
  # Drop a present-but-empty assignment so we do not end up with two lines.
  if [ -f "$ENV_FILE" ] && grep -qE "^${key}=" "$ENV_FILE"; then
    grep -vE "^${key}=" "$ENV_FILE" > "${ENV_FILE}.tmp"
    mv "${ENV_FILE}.tmp" "$ENV_FILE"
  fi
  printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
}

if [ ! -f "$ENV_FILE" ]; then
  echo "[env] Creating $ENV_FILE with generated local dev secrets..."
  cat > "$ENV_FILE" <<EOF
# Auto-generated local development environment (git-ignored).
NODE_ENV=development
PORT=5001
DATABASE_URL=postgresql://cardxc:cardxc@localhost:5432/cardxc?sslmode=disable
DATABASE_SSL=false
SESSION_SECRET=$(gen_secret)
JWT_SECRET=$(gen_secret)
EOF
else
  echo "[env] $ENV_FILE present; backfilling only missing keys."
fi

# --- MCP administrative server ---------------------------------------------
# Both are REQUIRED: the server refuses to start without them. MCP_SECRET is
# generated independently of SESSION_SECRET so the two can never coincide —
# sharing them would let any ordinary end-user auth_token authenticate as an
# MCP client.
MCP_SECRET_VALUE="$(gen_secret)"

# Independent 32-byte draws colliding is not a practical concern, but the
# invariant is load-bearing enough to assert rather than assume.
if [ -f "$ENV_FILE" ]; then
  EXISTING_SESSION="$(grep -E '^SESSION_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
  while [ -n "$EXISTING_SESSION" ] && [ "$MCP_SECRET_VALUE" = "$EXISTING_SESSION" ]; do
    MCP_SECRET_VALUE="$(gen_secret)"
  done
fi

ensure_key "MCP_SECRET" "$MCP_SECRET_VALUE"
ensure_key "MCP_API_KEY" "$(gen_secret)"

# Administrative surface: filesystem read plus optional read-only SQL. Keep it
# bound to loopback, and keep raw SQL off, unless an operator opts in.
ensure_key "MCP_BIND_HOST" "127.0.0.1"
ensure_key "MCP_ENABLE_RAW_SQL" "false"

chmod 600 "$ENV_FILE" 2>/dev/null || true

echo "[env] $ENV_FILE ready."
