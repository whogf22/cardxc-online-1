# CardXC - Google Antigravity IDE Context

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
- **MCP Server**: Remote debugging for AI assistants (Antigravity compatible)

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

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20.x | Runtime |
| Express | 5.2.1 | HTTP Server |
| TypeScript | 5.8 | Type safety |
| PostgreSQL | - | Database (Neon-backed) |
| JWT | - | Authentication |

### AI & Services
| Service | Purpose |
|---------|---------|
| Google Gemini AI | AI-powered analysis and code generation |
| Stripe | Payment processing |
| SMTP (Hostinger) | Transactional emails |

---

## Folder Structure

```
cardxc/
├── src/                          # Frontend React application
│   ├── components/               # Reusable UI components
│   ├── pages/                    # Page components (25+ pages)
│   ├── contexts/                 # React contexts (Auth, Toast, Currency)
│   ├── hooks/                    # Custom React hooks (10+)
│   ├── lib/                      # Utility libraries (15+)
│   ├── router/                   # Routing configuration
│   └── types/                    # TypeScript types
│
├── server/                       # Backend Express application
│   ├── routes/                   # API route handlers (15+ files)
│   ├── services/                 # Business logic services (10+)
│   ├── middleware/               # Express middleware
│   │   └── errorHandler.ts       # Global error handling (503 for DB errors)
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

## MCP Server Connection (Antigravity)

### Configuration
Add to MCP Servers → Manage → View raw config:
```json
{
  "mcpServers": {
    "cardxc": {
      "transport": {
        "type": "http",
        "url": "https://[replit-url]:8080/mcp/tools/call"
      }
    }
  }
}
```

### Authentication
```bash
# Get JWT Token
POST https://[replit-url]:8080/auth/token
Body: { "apiKey": "cardxc-mcp-key", "username": "antigravity" }

# Use token in header
Authorization: Bearer <token>
```

### MCP Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mcp/manifest` | GET | MCP manifest for discovery |
| `/.well-known/mcp.json` | GET | Alternative manifest |
| `/mcp/tools` | GET | Gemini-style function declarations |
| `/mcp/initialize` | POST | MCP protocol handshake |
| `/mcp/tools/list` | GET | List tools (auth required) |
| `/mcp/tools/call` | POST | Call a tool (auth required) |

### Available Tools
| Tool | Description |
|------|-------------|
| `list_files` | List all files in the project |
| `read_file` | Read file contents |
| `write_file` | Write content to files |
| `run_command` | Execute shell commands |
| `query_database` | Run SQL queries |
| `get_project_info` | Get project structure info |
| `get_system_health` | Check API health |
| `ai_analyze` | Use Gemini AI to analyze code/problems |
| `ai_generate_code` | Generate code based on requirements |
| `ai_fix_error` | Analyze and fix code errors |
| `search_files` | Search for files containing patterns |
| `get_logs` | Retrieve recent application logs |

---

## API Endpoints

### Authentication (`/api/auth/*`)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Get current session
- `POST /api/auth/verify-2fa` - 2FA verification

### User (`/api/user/*`)
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `POST /api/user/kyc` - Submit KYC documents

### Transactions (`/api/transactions/*`)
- `GET /api/transactions` - List transactions
- `POST /api/transactions/transfer` - P2P transfer

### Cards (`/api/cards/*`)
- `GET /api/cards` - List virtual cards
- `POST /api/cards` - Create new card
- `PUT /api/cards/:id/freeze` - Freeze/unfreeze card

### Admin (`/api/admin/*`)
- `GET /api/admin/users` - List all users
- `GET /api/admin/analytics` - System analytics

---

## Error Handling

### Database Connection Errors (503)
```json
{
  "success": false,
  "error": {
    "message": "Service temporarily unavailable. Please try again later.",
    "code": "SERVICE_UNAVAILABLE"
  }
}
```
- **Detection**: `isDatabaseConnectionError()` in `server/db/pool.ts`
- **Handles**: ECONNREFUSED, ETIMEDOUT, connection failures

### Standard Error Codes
| Code | Status | Description |
|------|--------|-------------|
| `SERVICE_UNAVAILABLE` | 503 | Database connection failure |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |

---

## Running Services

| Service | Port | Status |
|---------|------|--------|
| Frontend (Vite) | 5000 | ✅ Running |
| Backend (Express) | 3001 | ✅ Running |
| MCP Server | 8080 | ✅ Running |

---

## Admin Access
- Email: siyamhasan4@gmail.com
- Role: SUPER_ADMIN
- KYC: Approved (bypasses verification)

---

## Recent Changes
- Added database connection error handling (503 for ECONNREFUSED/ETIMEDOUT)
- Added `isDatabaseConnectionError()` helper in `server/db/pool.ts`
- Added real person photos to testimonials section (`public/images/testimonials/`)
- Updated `TestimonialsSection.tsx` and `FeaturedTestimonial.tsx` with real photos
- Created context files for external IDE integration
- Added JWT authentication to MCP server
- Integrated Google Gemini AI for code analysis and generation
- Redesigned MCP server landing page
- Fixed Rate Limiter IPv6 compatibility issues
- Fixed KYC banner display for Super Admin users

---

## Static Assets

| Path | Purpose |
|------|---------|
| `public/images/testimonials/*.jpg` | Real person photos for testimonials |

---

---

## Fixed Issues (January 29, 2026)

### Complete Supabase Migration - ALL FILES FIXED

**Wallet & Withdrawals:**
- `src/pages/wallet/page.tsx` - Replaced with `userApi.getWallets()`, `userApi.getTransactions()`
- `src/pages/wallet/components/WithdrawModal.tsx` - Replaced with `userApi.requestWithdrawal()`
- `src/pages/dashboard/components/WithdrawModal.tsx` - Replaced with `userApi.requestWithdrawal()`

**Admin Operations (7 files):**
- `PaymentSettingsTab.tsx` - Uses localStorage-based state
- `UsersTab.tsx` - Replaced with `adminApi.getUsers()`
- `OverviewTab.tsx` - Replaced with `adminApi.getOverview()`
- `LedgerExplorerTab.tsx` - Replaced with `adminApi.getLedger()`, `adminApi.getUsers()`
- `WalletBalancesTab.tsx` - Replaced with `adminApi.getUsers()`
- `WithdrawalsTab.tsx` - Replaced with `adminApi.getWithdrawals()`, `adminApi.getUsers()`
- `RiskMonitorTab.tsx` - Replaced with `adminApi` calls

**Support & KYC:**
- `src/pages/support/page.tsx` - Uses localStorage-based ticket management
- `src/components/KYCDocumentUpload.tsx` - Replaced with `userApi.getProfile()`, `userApi.updateProfile()`
- `src/components/PhoneVerification.tsx` - Replaced with `userApi.updateProfile()`
- `src/components/AdminHealthCheck.tsx` - Replaced with `healthApi.check()`, `userApi.getProfile()`

**Services:**
- `src/lib/exchangeRateService.ts` - Removed supabase fallback, uses external API only
- `src/contexts/CurrencyContext.tsx` - Removed unused supabase import

---

## Profile & Settings Pages (January 30, 2026)

### Main Profile Page (`/profile`)
- User card with avatar, name, PRO MEMBER badge
- Settings menu with 7 items
- Support section with Help center and Report a problem
- Logout button

### Profile Sub-Pages
| Route | Purpose |
|-------|---------|
| `/profile/personal` | Name, email, phone, DOB, country, gender |
| `/profile/payments` | Card details, currency preference |
| `/profile/security` | Password, PIN, 2FA toggle, login history |
| `/profile/accessibility` | Voice, zoom, screen reader, font size |
| `/profile/language` | 6 language options with selection |
| `/profile/notifications` | Email, message, in-app toggles |
| `/profile/privacy` | Data sharing, personalization, location |

### Design Patterns
- Mobile-first iOS-style design
- White backgrounds with subtle borders
- RemixIcon for all icons
- Consistent back navigation

---

## Deploy Readiness Status

| Check | Status |
|-------|--------|
| Build Pipeline | ✅ Passed (13.50s) |
| LSP Diagnostics | ✅ No errors |
| Security Audit | ✅ No secrets in frontend |
| Port Configuration | ✅ 5000/3001/8080 |
| Database Connection | ✅ 503 on failure |
| Crash-proof Startup | ✅ Environment validation |
| Autoscale Deploy | ✅ Configured |

---

## Last Updated
January 30, 2026
