#!/bin/bash
# CardXC Production Deployment Script
# To be executed on the VPS

set -e

# --- CONFIGURATION ---
PROJECT_DIR="/root/cardxc" # Based on user's screenshot
REPO_URL="https://github.com/whogf22/cardxc-online-1.git"

echo "🚀 Starting CardXC Production Deployment..."

# 1. Ensure directory exists and is a git repo
if [ ! -d "$PROJECT_DIR" ]; then
    echo "📁 Creating project directory..."
    mkdir -p "$PROJECT_DIR"
    git clone "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
else
    echo "📂 Navigating to project directory..."
    cd "$PROJECT_DIR"
    git fetch origin
    git reset --hard origin/main
fi

# 2. Set Environment Variables
echo "🔑 Setting up environment variables..."
cat <<EOF > .env
# --- SERVER CONFIG ---
NODE_ENV=production
PORT=5000
DATABASE_URL=postgres://root:baby69@Siyam@localhost:5432/cardxc
JWT_SECRET=$(openssl rand -base64 32)

# --- STRIPE (Payment & Issuing) ---
STRIPE_SECRET_KEY=sk_live_51Lp7YvSFnF2r... # Placeholder - User should update or I will if I have them
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_ISSUING_CARDHOLDER_ID=ich_...

# --- RELOADLY (Gift Cards) ---
RELOADLY_CLIENT_ID=your_id
RELOADLY_CLIENT_SECRET=your_secret
RELOADLY_API_URL=https://api.reloadly.com

# --- SMTP (Hostinger) ---
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=admin@cardxc.online
SMTP_PASS=baby69@Siyam
EMAIL_FROM="CardXC <admin@cardxc.online>"

# --- FRONTEND ---
VITE_API_URL=https://cardxc.online/api
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
EOF

# 3. Install Dependencies
echo "📦 Installing dependencies..."
npm install

# 4. Build Project
echo "🏗️ Building project..."
npm run build

# 5. Database Initialization (if script exists)
echo "🗄️ Initializing database..."
# node dist/server/db/init.js # Assuming build outputs to dist

# 6. Restart with PM2
echo "🔄 Restarting PM2 process..."
if pm2 list | grep -q "cardxc"; then
    pm2 restart cardxc
else
    pm2 start dist/server/index.js --name "cardxc"
fi

pm2 save

echo "✅ CardXC is now LIVE at https://cardxc.online"
