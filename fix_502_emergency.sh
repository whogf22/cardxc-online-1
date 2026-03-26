#!/bin/bash
# CardXC Emergency 502 Bad Gateway Recovery Script
# This script diagnoses and fixes all possible causes of 502 errors

set -e

echo "🚨 CardXC Emergency Recovery Started..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_DIR="/root/cardxc"
PORT=5000
NGINX_CONFIG="/etc/nginx/sites-available/cardxc"

# ============================================
# STEP 1: Kill any stuck processes
# ============================================
echo -e "${YELLOW}[1/10] Cleaning up stuck processes...${NC}"
pkill -f "node" || true
pkill -f "cardxc" || true
pm2 kill || true
sleep 2
echo -e "${GREEN}✅ Processes cleaned${NC}"

# ============================================
# STEP 2: Clear PM2 and restart daemon
# ============================================
echo -e "${YELLOW}[2/10] Resetting PM2...${NC}"
rm -rf ~/.pm2 || true
npm install -g pm2 >/dev/null 2>&1 || true
pm2 update || true
echo -e "${GREEN}✅ PM2 reset${NC}"

# ============================================
# STEP 3: Pull latest code
# ============================================
echo -e "${YELLOW}[3/10] Pulling latest code from GitHub...${NC}"
cd "$PROJECT_DIR"
git fetch origin
git reset --hard origin/main
echo -e "${GREEN}✅ Code updated${NC}"

# ============================================
# STEP 4: Install dependencies
# ============================================
echo -e "${YELLOW}[4/10] Installing dependencies...${NC}"
npm install --omit=dev >/dev/null 2>&1
echo -e "${GREEN}✅ Dependencies installed${NC}"

# ============================================
# STEP 5: Build project
# ============================================
echo -e "${YELLOW}[5/10] Building project...${NC}"
npm run build >/dev/null 2>&1
echo -e "${GREEN}✅ Build complete${NC}"

# ============================================
# STEP 6: Check and free port 5000
# ============================================
echo -e "${YELLOW}[6/10] Checking port $PORT...${NC}"
if lsof -i :$PORT >/dev/null 2>&1; then
    echo "⚠️  Port $PORT is in use. Killing process..."
    lsof -i :$PORT | awk 'NR!=1 {print $2}' | xargs kill -9 || true
    sleep 2
fi
echo -e "${GREEN}✅ Port $PORT is free${NC}"

# ============================================
# STEP 7: Start app with PM2
# ============================================
echo -e "${YELLOW}[7/10] Starting app with PM2...${NC}"
cd "$PROJECT_DIR"
pm2 start dist/server/index.js --name "cardxc" --instances max --exec-mode cluster --wait-ready --listen-timeout 10000
pm2 save
echo -e "${GREEN}✅ App started${NC}"

# ============================================
# STEP 8: Verify app is running
# ============================================
echo -e "${YELLOW}[8/10] Verifying app is running...${NC}"
sleep 3
if pm2 list | grep -q "cardxc"; then
    echo -e "${GREEN}✅ App is running${NC}"
else
    echo -e "${RED}❌ App failed to start. Checking logs...${NC}"
    pm2 logs cardxc --lines 20
    exit 1
fi

# ============================================
# STEP 9: Check if port is listening
# ============================================
echo -e "${YELLOW}[9/10] Checking if port $PORT is listening...${NC}"
sleep 2
if netstat -tlnp 2>/dev/null | grep -q ":$PORT"; then
    echo -e "${GREEN}✅ Port $PORT is listening${NC}"
else
    echo -e "${RED}❌ Port $PORT is not listening${NC}"
    pm2 logs cardxc --lines 50
    exit 1
fi

# ============================================
# STEP 10: Restart Nginx
# ============================================
echo -e "${YELLOW}[10/10] Restarting Nginx...${NC}"
nginx -t >/dev/null 2>&1 || true
systemctl restart nginx || true
echo -e "${GREEN}✅ Nginx restarted${NC}"

# ============================================
# FINAL STATUS
# ============================================
echo ""
echo "=================================================="
echo -e "${GREEN}✅ CardXC Emergency Recovery Complete!${NC}"
echo "=================================================="
echo ""
echo "📊 Status:"
echo "   PM2 Status:"
pm2 list
echo ""
echo "   Port Status:"
netstat -tlnp 2>/dev/null | grep ":$PORT" || echo "   (checking...)"
echo ""
echo "🌐 Website: https://cardxc.online"
echo "📋 Logs: pm2 logs cardxc"
echo "🔄 Restart: pm2 restart cardxc"
echo ""
echo "If you still see 502 error, wait 30 seconds for Cloudflare cache to clear."
echo ""
