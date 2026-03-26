#!/bin/bash
# CardXC Quick Live Script
# Fixes 502 error by getting the app running immediately

set -e

PROJECT_DIR="/root/cardxc"
echo "🚀 Getting CardXC LIVE now..."

cd "$PROJECT_DIR"

# 1. Pull latest code
echo "📥 Pulling latest code..."
git fetch origin
git reset --hard origin/main

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install --omit=dev

# 3. Build
echo "🏗️ Building project..."
npm run build

# 4. Start/Restart PM2
echo "🔄 Restarting app..."
if pm2 list | grep -q "cardxc"; then
    pm2 restart cardxc
else
    pm2 start dist/server/index.js --name "cardxc"
fi

pm2 save

echo "✅ SUCCESS! CardXC should be live at https://cardxc.online"
echo "Check status with: pm2 list"
echo "Check logs with: pm2 logs cardxc"
