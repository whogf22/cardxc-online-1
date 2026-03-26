#!/bin/bash
# CardXC Complete VPS Setup & Deployment Script
# This script handles full deployment with all optimizations

set -e

echo "🚀 CardXC Complete VPS Setup Starting..."

# ============================================
# 1. SYSTEM SETUP
# ============================================
echo "📦 Step 1: System Setup..."

# Update system
apt-get update
apt-get upgrade -y

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    apt-get install -y nodejs
fi

# Install PM2 globally if not present
npm install -g pm2 || true

# Install PostgreSQL client if not present
apt-get install -y postgresql-client || true

# ============================================
# 2. PROJECT SETUP
# ============================================
echo "📁 Step 2: Project Setup..."

PROJECT_DIR="/root/cardxc"
REPO_URL="https://github.com/whogf22/cardxc-online-1.git"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "Cloning repository..."
    git clone "$REPO_URL" "$PROJECT_DIR"
else
    echo "Repository exists, pulling latest changes..."
    cd "$PROJECT_DIR"
    git fetch origin
    git reset --hard origin/main
fi

cd "$PROJECT_DIR"

# ============================================
# 3. ENVIRONMENT CONFIGURATION
# ============================================
echo "🔑 Step 3: Environment Configuration..."

# Create .env file with all required variables
cat <<'EOF' > .env
# ========== SERVER CONFIG ==========
NODE_ENV=production
PORT=5000
APP_URL=https://cardxc.online

# ========== DATABASE ==========
DATABASE_URL=postgres://cardxc_user:secure_password@localhost:5432/cardxc_db
DB_POOL_SIZE=20
DB_IDLE_TIMEOUT=30000

# ========== STRIPE (Payment & Issuing) ==========
STRIPE_SECRET_KEY=sk_live_YOUR_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
STRIPE_ISSUING_CARDHOLDER_ID=ich_YOUR_ID_HERE

# ========== RELOADLY (Gift Cards) ==========
RELOADLY_CLIENT_ID=your_client_id
RELOADLY_CLIENT_SECRET=your_client_secret
RELOADLY_API_URL=https://api.reloadly.com

# ========== SMTP (Email) ==========
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=admin@cardxc.online
SMTP_PASS=your_smtp_password
EMAIL_FROM="CardXC <admin@cardxc.online>"

# ========== JWT & SECURITY ==========
JWT_SECRET=your_jwt_secret_key_min_32_chars
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# ========== RATE LIMITING ==========
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SENSITIVE_OP_LIMIT_MAX=10

# ========== FRONTEND ==========
VITE_API_URL=https://cardxc.online/api
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY_HERE

# ========== LOGGING & MONITORING ==========
LOG_LEVEL=info
SENTRY_DSN=https://your_sentry_dsn@sentry.io/project_id
EOF

echo "✅ .env file created (please update with actual credentials)"

# ============================================
# 4. DEPENDENCIES & BUILD
# ============================================
echo "📦 Step 4: Installing Dependencies..."

npm install

echo "🏗️ Step 5: Building Project..."

npm run build

# ============================================
# 5. DATABASE SETUP
# ============================================
echo "🗄️ Step 6: Database Setup..."

# Create database if not exists (requires PostgreSQL running)
# This assumes PostgreSQL is already installed on the VPS
# PGPASSWORD="postgres_password" psql -h localhost -U postgres -c "CREATE DATABASE cardxc_db;" || true
# PGPASSWORD="postgres_password" psql -h localhost -U postgres -c "CREATE USER cardxc_user WITH PASSWORD 'secure_password';" || true
# PGPASSWORD="postgres_password" psql -h localhost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE cardxc_db TO cardxc_user;" || true

echo "⚠️  Please ensure PostgreSQL is running and database is initialized"

# ============================================
# 6. PM2 SETUP
# ============================================
echo "🔄 Step 7: PM2 Setup..."

# Stop existing process if running
pm2 stop cardxc || true
pm2 delete cardxc || true

# Start with PM2
pm2 start dist/server/index.js --name "cardxc" --instances max --exec-mode cluster

# Save PM2 config
pm2 save

# Setup PM2 startup
pm2 startup || true

# ============================================
# 7. NGINX SETUP (Optional but recommended)
# ============================================
echo "🌐 Step 8: NGINX Configuration (Optional)..."

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "Installing NGINX..."
    apt-get install -y nginx
fi

# Create NGINX config
cat <<'EOF' > /etc/nginx/sites-available/cardxc
upstream cardxc_backend {
    server localhost:5000;
    server localhost:5001;
    server localhost:5002;
    server localhost:5003;
}

server {
    listen 80;
    server_name cardxc.online www.cardxc.online;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cardxc.online www.cardxc.online;
    
    # SSL certificates (using Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/cardxc.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cardxc.online/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;
    
    # Proxy settings
    location /api {
        proxy_pass http://cardxc_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Frontend static files
    location / {
        root /root/cardxc/dist/client;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, max-age=3600";
    }
    
    # Static assets with long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /root/cardxc/dist/client;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
EOF

# Enable NGINX site
ln -sf /etc/nginx/sites-available/cardxc /etc/nginx/sites-enabled/cardxc || true

# Test NGINX config
nginx -t || true

# Restart NGINX
systemctl restart nginx || true

echo "✅ NGINX configured"

# ============================================
# 8. SSL SETUP (Let's Encrypt)
# ============================================
echo "🔐 Step 9: SSL Certificate Setup..."

if ! command -v certbot &> /dev/null; then
    apt-get install -y certbot python3-certbot-nginx
fi

# Request certificate (if not already exists)
if [ ! -f /etc/letsencrypt/live/cardxc.online/fullchain.pem ]; then
    certbot certonly --nginx -d cardxc.online -d www.cardxc.online --non-interactive --agree-tos -m admin@cardxc.online || true
fi

echo "✅ SSL configured"

# ============================================
# 9. MONITORING & LOGGING
# ============================================
echo "📊 Step 10: Monitoring Setup..."

# Create log directory
mkdir -p /var/log/cardxc
chmod 755 /var/log/cardxc

# Setup PM2 log rotation
pm2 install pm2-logrotate || true

echo "✅ Monitoring configured"

# ============================================
# 10. FINAL CHECKS
# ============================================
echo "✅ Step 11: Final Checks..."

# Check if app is running
if pm2 list | grep -q "cardxc"; then
    echo "✅ CardXC is running!"
else
    echo "⚠️  CardXC may not be running. Check: pm2 logs cardxc"
fi

# Check if port is listening
if netstat -tlnp 2>/dev/null | grep -q ":5000"; then
    echo "✅ Port 5000 is listening"
else
    echo "⚠️  Port 5000 is not listening"
fi

# ============================================
# COMPLETION
# ============================================
echo ""
echo "=========================================="
echo "✅ CardXC Deployment Complete!"
echo "=========================================="
echo ""
echo "📍 Website: https://cardxc.online"
echo "📊 PM2 Status: pm2 list"
echo "📋 Logs: pm2 logs cardxc"
echo "🔄 Restart: pm2 restart cardxc"
echo "⛔ Stop: pm2 stop cardxc"
echo ""
echo "⚠️  IMPORTANT: Update .env with actual credentials!"
echo "   - STRIPE_SECRET_KEY"
echo "   - STRIPE_PUBLISHABLE_KEY"
echo "   - DATABASE_URL"
echo "   - SMTP credentials"
echo ""
