#!/usr/bin/env bash
# This script starts the CardXC frontend/API and the MCP server in a Replit-safe way.
# It kills any stray processes from previous runs, defines ports for the app and MCP,
# starts both services in the background, waits for them to boot, and performs
# health‑checks. If either service fails to start it prints a helpful message.

set -e

# 1️⃣ Kill any previous processes that may conflict with our ports
pkill -f vite || true
pkill -f "npm run dev" || true
pkill -f "node mcp-server" || true
pkill -f tsx || true

# 2️⃣ Define correct ports. Replit exposes $PORT automatically.
APP_PORT="${PORT:-3000}"
MCP_PORT=8080

echo "Starting CardXC on APP_PORT=$APP_PORT and MCP_PORT=$MCP_PORT"

# 3️⃣ Start the CardXC frontend/API (Vite + Express).  
#     We redirect logs into /tmp/app.log so that we can inspect them later if needed.
PORT=$APP_PORT npm run dev > /tmp/app.log 2>&1 &
APP_PID=$!

echo "CardXC frontend/API (vite + express) started with PID $APP_PID"

# 4️⃣ Start the MCP server in the background.  
node mcp-server/index.js > /tmp/mcp.log 2>&1 &
MCP_PID=$!

echo "MCP server started with PID $MCP_PID"

# 5️⃣ Give both services time to boot
sleep 10

# 6️⃣ Perform health checks
APP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${APP_PORT}") || APP_CODE=000
MCP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${MCP_PORT}/health") || MCP_CODE=000

echo "App status: $APP_CODE | MCP status: $MCP_CODE"

if [[ "$APP_CODE" == "200" ]] && [[ "$MCP_CODE" == "200" ]]; then
  echo "✅ CardXC is running successfully!"
  echo "🌍 Browse your app at https://${REPL_SLUG}.${REPL_OWNER}.repl.co"
  echo "🧠 MCP health endpoint at http://localhost:${MCP_PORT}/health"
else
  echo "❌ One or both services failed to start. Check logs below."
  echo "---- app log ----"
  tail -n 50 /tmp/app.log || true
  echo "---- MCP log ----"
  tail -n 50 /tmp/mcp.log || true
fi

# Wait for either process to exit to prevent the script from exiting immediately
# This keeps the script running so Replit knows the repl is running
wait -n $APP_PID $MCP_PID
