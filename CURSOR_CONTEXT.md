# CardXC - Cursor IDE Context

## Project Purpose
CardXC is a **modern fintech platform** for digital banking operations. It provides secure financial tools including virtual cards, P2P transfers, savings goals, and advanced fraud detection.

## Core Features
- **Virtual Cards**: Instant issuance, freeze/unfreeze, spending limits
- **Transactions**: Real-time P2P transfers and payment processing
- **Wallet Management**: Multi-currency support, balance tracking
- **Savings Goals**: Automated savings with goal tracking
- **Rewards & Gift Cards**: Loyalty program and gift card purchases
- **Security**: 2FA, IP blocking, fraud detection, device fingerprinting
- **Admin Dashboard**: User management, analytics, system monitoring
- **AI Integration**: Smart insights via Google Gemini AI
- **MCP Server**: Remote debugging for AI assistants (Google Antigravity compatible)

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.1.0 | UI Framework |
| Vite | 7.3.1 | Build tool & dev server |
| TypeScript | 5.8 | Type safety |
| TailwindCSS | 3.4.17 | Styling |
| Framer Motion | - | Animations |
| React Router | 7.x | Routing |
| Lucide React | - | Icons |
| Recharts | - | Charts/Analytics |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20.x | Runtime |
| Express | 5.2.1 | HTTP Server |
| TypeScript | 5.8 | Type safety |
| PostgreSQL | - | Database (Neon-backed) |
| JWT | - | Authentication |
| Nodemailer | - | Email service |
| Stripe | - | Payment processing |

### Services & Integrations
| Service | Purpose |
|---------|---------|
| Google Gemini AI | AI-powered analysis and code generation |
| Stripe | Payment processing |
| SMTP (Hostinger) | Transactional emails |
| Sentry | Error tracking (optional) |

---

## Folder Structure

```
cardxc/
├── src/                          # Frontend React application
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Base UI components (Modal, Card, Tabs)
│   │   ├── ProtectedRoute.tsx    # Auth route wrapper
│   │   ├── AdminRoute.tsx        # Admin-only route wrapper
│   │   ├── DashboardLayout.tsx   # Main dashboard layout
│   │   ├── KYCStatusBanner.tsx   # KYC verification banner
│   │   └── ...                   # 40+ components
│   ├── pages/                    # Page components
│   │   ├── dashboard/            # User dashboard
│   │   ├── wallet/               # Wallet management
│   │   ├── transactions/         # Transaction history
│   │   ├── cards/                # Virtual cards
│   │   ├── profile/              # Profile & settings (7 sub-pages)
│   │   ├── admin-dashboard/      # Admin panel
│   │   ├── signin/signup/        # Authentication
│   │   └── ...                   # 25+ pages
│   ├── contexts/                 # React contexts
│   │   ├── AuthContext.tsx       # Authentication state
│   │   ├── ToastContext.tsx      # Toast notifications
│   │   └── CurrencyContext.tsx   # Currency preferences
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts            # Auth hook
│   │   ├── useRealtimeBalance.ts # Real-time balance updates
│   │   └── ...                   # 10+ hooks
│   ├── lib/                      # Utility libraries
│   │   ├── api.ts                # API client
│   │   ├── apiClient.ts          # HTTP client wrapper
│   │   ├── authClient.ts         # Auth client (renamed from supabase.ts)
│   │   ├── currencyUtils.ts      # Currency formatting
│   │   ├── inputSanitizer.ts     # XSS protection
│   │   └── ...                   # 15+ utilities
│   ├── router/                   # Routing configuration
│   │   └── config.tsx            # Route definitions
│   └── types/                    # TypeScript types
│
├── server/                       # Backend Express application
│   ├── routes/                   # API route handlers
│   │   ├── auth.ts               # Authentication endpoints
│   │   ├── user.ts               # User management
│   │   ├── transactions.ts       # Transaction endpoints
│   │   ├── cards.ts              # Virtual card endpoints
│   │   ├── payments.ts           # Payment processing
│   │   ├── admin.ts              # Admin endpoints
│   │   ├── savings.ts            # Savings goals
│   │   ├── rewards.ts            # Rewards system
│   │   └── ...                   # 15+ route files
│   ├── services/                 # Business logic services
│   │   ├── emailService.ts       # Email sending
│   │   ├── fraudService.ts       # Fraud detection
│   │   ├── backgroundJobs.ts     # Scheduled tasks
│   │   ├── twoFactorService.ts   # 2FA implementation
│   │   └── ...                   # 10+ services
│   ├── middleware/               # Express middleware
│   │   ├── auth.ts               # JWT authentication
│   │   ├── rateLimit.ts          # Rate limiting
│   │   ├── errorHandler.ts       # Global error handling (503 for DB errors)
│   │   └── ...
│   ├── db/                       # Database configuration
│   │   └── pool.ts               # PostgreSQL pool + isDatabaseConnectionError()
│   └── index.ts                  # Server entry point
│
├── mcp-server/                   # MCP Server for AI assistants
│   └── http-server.js            # HTTP-based MCP server (port 8080)
│
├── shared/                       # Shared types between frontend/backend
└── public/                       # Static assets
    └── images/
        └── testimonials/         # Real person photos for testimonials
```

---

## Environment Variables

### Required Secrets (Set via Replit Secrets)
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | JWT signing secret |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Gemini AI API key |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Gemini AI base URL |

### Application Config (Environment Variables)
| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | production | Environment mode |
| `VITE_APP_DOMAIN` | https://cardxc.online | App domain |
| `VITE_ADMIN_DOMAIN` | https://cardxc.online | Admin domain |
| `AUTH_API_URL` | [configured] | Auth API URL (replaces SUPABASE_URL) |
| `AUTH_API_KEY` | [configured] | Auth API key (replaces SUPABASE_ANON_KEY) |
| `SMTP_HOST` | smtp.hostinger.com | Email server |
| `SMTP_PORT` | 465 | Email port |
| `SMTP_USER` | admin@cardxc.online | Email user |
| `MCP_API_KEY` | cardxc-mcp-key | MCP server API key |
| `MCP_SECRET` | [generated] | MCP JWT secret |

---

## API Endpoints

### Authentication (`/api/auth/*`)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Get current session
- `POST /api/auth/verify-2fa` - 2FA verification
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset

### User (`/api/user/*`)
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `POST /api/user/kyc` - Submit KYC documents

### Transactions (`/api/transactions/*`)
- `GET /api/transactions` - List transactions
- `POST /api/transactions/transfer` - P2P transfer
- `GET /api/transactions/:id` - Transaction details

### Cards (`/api/cards/*`)
- `GET /api/cards` - List virtual cards
- `POST /api/cards` - Create new card
- `PUT /api/cards/:id/freeze` - Freeze/unfreeze card
- `PUT /api/cards/:id/limits` - Update spending limits

### Payments (`/api/payments/*`)
- `POST /api/payments/deposit` - Initiate deposit
- `POST /api/payments/withdraw` - Initiate withdrawal
- `POST /api/payments/webhook` - Payment webhooks

### Admin (`/api/admin/*`)
- `GET /api/admin/users` - List all users
- `GET /api/admin/transactions` - All transactions
- `PUT /api/admin/users/:id/status` - Update user status
- `GET /api/admin/analytics` - System analytics

### MCP Server (Port 8080)
- `GET /health` - Health check
- `GET /mcp/manifest` - MCP manifest
- `GET /mcp/tools` - Available tools
- `POST /auth/token` - Get JWT token
- `POST /execute` - Execute tool
- `POST /mcp/tools/call` - MCP protocol tool call

---

## Error Handling

### Database Connection Errors
When the database is unavailable (ECONNREFUSED, ETIMEDOUT, etc.), the API returns:
```json
{
  "success": false,
  "error": {
    "message": "Service temporarily unavailable. Please try again later.",
    "code": "SERVICE_UNAVAILABLE"
  }
}
```
- **HTTP Status**: 503 (Service Unavailable)
- **Detection**: `isDatabaseConnectionError()` in `server/db/pool.ts`
- **Handler**: `errorHandler` middleware in `server/middleware/errorHandler.ts`

### Standard Errors
| Code | Status | Description |
|------|--------|-------------|
| `SERVICE_UNAVAILABLE` | 503 | Database connection failure |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Data Flow

```
User Action → React Component → API Client (lib/api.ts)
                                      ↓
                              Express Router (server/routes/*)
                                      ↓
                              Middleware (auth, rate-limit)
                                      ↓
                              Service Layer (server/services/*)
                                      ↓
                              PostgreSQL Database
                                      ↓
                              Response → React State Update → UI
```

---

## Security Features

### Implemented
- Password hashing (bcrypt 12 rounds)
- JWT session management (8h expiry)
- Rate limiting (auth: 5/15min, API: 100/min, financial: 5/min)
- SQL injection protection (parameterized queries)
- XSS protection (DOMPurify, CSP headers)
- CSRF protection headers
- IP blocking (5 failed attempts = 15min block)
- Account lockout after 5 failed logins
- Two-factor authentication (TOTP)
- Audit logging
- Fraud detection system
- Device fingerprinting
- Helmet security headers
- Input sanitization

---

## Current Status

### Running Services
| Service | Port | Status |
|---------|------|--------|
| Frontend (Vite) | 5000 | Running |
| Backend (Express) | 3001 | Running |
| MCP Server | 8080 | Running |

### Admin Access
- Email: siyamhasan4@gmail.com
- Role: SUPER_ADMIN
- KYC: Approved (bypasses verification)

---

## Quick Commands

```bash
# Start development
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run MCP server
npm run mcp:http

# Database operations
npm run db:push        # Sync schema
npm run db:push --force # Force sync
```

---

## MCP Server Connection

**URL:** `https://[replit-domain]:8080`
**API Key:** `cardxc-mcp-key`

**Get Token:**
```bash
curl -X POST "[URL]/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "cardxc-mcp-key", "username": "cursor"}'
```

**Available Tools:** list_files, read_file, write_file, run_command, query_database, get_project_info, get_system_health, ai_analyze, ai_generate_code, ai_fix_error, search_files, get_logs

---

## External IDE Integration

### Cursor IDE (MCP)
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "cardxc": {
      "type": "http",
      "url": "https://[replit-url]:8080",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

### Google Antigravity
Add to MCP Servers → Manage → View raw config:
```json
{
  "mcpServers": {
    "cardxc": {
      "transport": { "type": "http", "url": "https://[replit-url]:8080/mcp/tools/call" }
    }
  }
}
```

### SSH (Real-time Sync)
```bash
# Generate key in Replit: Tools → SSH → Generate Key
ssh -i ~/.ssh/replit_key replit@your-repl.replit.dev
```

---

## Static Assets

| Path | Purpose |
|------|---------|
| `public/images/testimonials/*.jpg` | Real person photos for testimonials |

---

## Complete Change History

### January 30, 2026 - White-Label Security Enhancements

**Branding Removal:**
- Removed PayPal icon and branding from deposit panel
- Replaced "Visa, Mastercard, Amex" text with generic "Credit & Debit Cards"
- Production bundle verified clean: 0 third-party service names exposed
- All payment processing fully abstracted (Fluz/Stripe backend, no frontend branding)

**Code Refactoring:**
- Renamed `supabase.ts` to `authClient.ts` with backward compatibility export
- Updated `env.ts` to remove Supabase variable names (now AUTH_API_URL/AUTH_API_KEY)

**Profile Page Redesign:**
- Redesigned main Profile page with user card (avatar, name, PRO MEMBER badge)
- Added 7 settings menu items with icons and navigation
- Created 6 new sub-pages:
  - /profile/personal - Personal Information (name, email, phone, DOB, country, gender)
  - /profile/payments - Payments Information (card details, currency)
  - /profile/security - Login & Security (password, 2FA, login history)
  - /profile/accessibility - Accessibility settings (voice, zoom, screen reader, font size)
  - /profile/language - Language & translation (6 language options)
  - /profile/privacy - Privacy & sharing settings
- Added Support section with Help center and Report a problem
- Mobile-first design with consistent styling

### January 29, 2026 - Complete API Migration

**Supabase to API Migration:**
All `supabase.from()` calls replaced with proper API calls:
- Wallet pages: `userApi.getWallets()`, `userApi.getTransactions()`, `userApi.requestWithdrawal()`
- Admin operations (7 files): `adminApi.getUsers()`, `adminApi.getOverview()`, `adminApi.getLedger()`, etc.
- Support page: localStorage-based ticket management
- KYC/Phone verification: `userApi.getProfile()`, `userApi.updateProfile()`
- Exchange rate service: External API only (removed supabase fallback)

**Files Updated:**
- `src/pages/wallet/page.tsx` - Replaced with userApi calls
- `src/pages/wallet/components/WithdrawModal.tsx` - Replaced with userApi.requestWithdrawal()
- `src/pages/dashboard/components/WithdrawModal.tsx` - Replaced with userApi.requestWithdrawal()
- `PaymentSettingsTab.tsx` - Uses localStorage-based state
- `UsersTab.tsx` - Replaced with adminApi.getUsers()
- `OverviewTab.tsx` - Replaced with adminApi.getOverview()
- `LedgerExplorerTab.tsx` - Replaced with adminApi.getLedger(), adminApi.getUsers()
- `WalletBalancesTab.tsx` - Replaced with adminApi.getUsers()
- `WithdrawalsTab.tsx` - Replaced with adminApi.getWithdrawals(), adminApi.getUsers()
- `RiskMonitorTab.tsx` - Replaced with adminApi calls
- `src/pages/support/page.tsx` - Uses localStorage-based ticket management
- `src/components/KYCDocumentUpload.tsx` - Replaced with userApi.getProfile(), userApi.updateProfile()
- `src/components/PhoneVerification.tsx` - Replaced with userApi.updateProfile()
- `src/components/AdminHealthCheck.tsx` - Replaced with healthApi.check(), userApi.getProfile()
- `src/lib/exchangeRateService.ts` - Removed supabase fallback, uses external API only
- `src/contexts/CurrencyContext.tsx` - Removed unused supabase import

**DevOps Audit:**
- Build pipeline validated (14.61s, no errors)
- Security audit passed (no secrets in frontend)
- Port configuration verified (5000/3001/8080)
- Crash-proof startup with environment validation
- Autoscale deployment configured

### Earlier Changes

- Added database connection error handling (503 for ECONNREFUSED/ETIMEDOUT)
- Added `isDatabaseConnectionError()` helper in `server/db/pool.ts`
- Added real person photos to testimonials section
- Created context files for external IDE integration
- Added JWT authentication to MCP server
- Integrated Google Gemini AI for code analysis and generation
- Added AI-powered error fixing capabilities
- Redesigned MCP server landing page
- Fixed Rate Limiter IPv6 compatibility issues
- Fixed KYC banner display for Super Admin users
- Fixed 404 page component issue

---

## Deploy Readiness Status

| Check | Status |
|-------|--------|
| Build Pipeline | Passed (14.61s) |
| LSP Diagnostics | No errors |
| Security Audit | No secrets in frontend |
| Port Configuration | 5000/3001/8080 |
| Database Connection | 503 on failure |
| Crash-proof Startup | Environment validation |
| Autoscale Deploy | Configured |

---

## Last Updated
January 30, 2026
