#!/bin/bash
# ═══════════════════════════════════════════════
#  CardXC — One-Command Deploy (Frontend + Backend)
#  Usage: ./deploy-all.sh "your commit message"
# ═══════════════════════════════════════════════

set -e

MSG="${1:-update: $(date '+%Y-%m-%d %H:%M')}"
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}  CardXC Deploy — Frontend + Backend${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""

# ── Step 1: Build frontend ──
echo -e "${CYAN}[1/4]${NC} Building frontend..."
npm run build
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# ── Step 2: Git push (triggers Cloudflare auto-deploy) ──
echo -e "${CYAN}[2/4]${NC} Pushing to GitHub..."
git add -A
git commit -m "$MSG" || echo "Nothing new to commit"
git push origin main
echo -e "${GREEN}✓ Frontend deploying via Cloudflare${NC}"
echo ""

# ── Step 3: Sync backend to VPS ──
echo -e "${CYAN}[3/4]${NC} Syncing backend to VPS..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  ./server/ root@76.13.28.186:/root/cardxc-backend/server/
echo -e "${GREEN}✓ Backend files synced${NC}"
echo ""

# ── Step 4: Restart PM2 on VPS ──
echo -e "${CYAN}[4/4]${NC} Restarting backend on VPS..."
ssh root@76.13.28.186 "cd /root/cardxc-backend && npm install --production 2>/dev/null; pm2 restart all"
echo -e "${GREEN}✓ Backend restarted${NC}"
echo ""

echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ All deployed! Live in ~60 seconds${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "  Frontend: https://cardxc.online"
echo -e "  Backend:  https://api.cardxc.online"
