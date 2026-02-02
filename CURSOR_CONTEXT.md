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
| RemixIcon | - | Iconography |
| Recharts | - | Charts/Analytics |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20.x | Runtime |
| Express | 5.2.1 | HTTP Server |
| TypeScript | 5.8 | Type safety |
| PostgreSQL | - | Database (Neon-backed) |
| Drizzle ORM | - | Database ORM |
| JWT | - | Authentication |
| Nodemailer | - | Email service |
| Stripe | - | Payment processing (Backend only) |

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
│   │   └── ...                   # 40+ components
│   ├── pages/                    # Page components
│   │   ├── dashboard/            # User dashboard
│   │   ├── wallet/               # Wallet management
│   │   ├── profile/              # Profile & settings (accessibility, language, etc.)
│   │   ├── cards/                # Virtual cards
│   │   ├── admin-dashboard/      # Admin panel
│   │   └── ...                   # 25+ pages
│   ├── contexts/                 # React contexts (Auth, Toast, Currency)
│   ├── lib/                      # Utility libraries (api.ts, authClient.ts, currencyUtils.ts)
│   ├── router/                   # Routing configuration
│   └── types/                    # TypeScript types
│
├── server/                       # Backend Express application
│   ├── routes/                   # API route handlers
│   ├── services/                 # Business logic (email, fraud, background)
│   ├── middleware/               # Express middleware (auth, rateLimit, errorHandler)
│   ├── db/                       # Database configuration (pool.ts, schema.ts)
│   └── index.ts                  # Server entry point
│
├── mcp-server/                   # MCP Server for AI assistants
│   └── http-server.js            # HTTP-based MCP server (port 8080)
│
├── shared/                       # Shared types between frontend/backend
└── public/                       # Static assets (images, icons)
```

---

## Environment Variables

### Required Secrets
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: JWT signing secret
- `AI_INTEGRATIONS_GEMINI_API_KEY`: Gemini AI API key
- `GITHUB_PERSONAL_ACCESS_TOKEN`: GitHub personal access token

### App Config
- `NODE_ENV`: production/development
- `VITE_APP_DOMAIN`: https://cardxc.online
- `VITE_ADMIN_DOMAIN`: https://cardxc.online
- `AUTH_API_URL`: Backend Auth API URL
- `AUTH_API_KEY`: Backend Auth API Key
- `MCP_API_KEY`: `cardxc-mcp-key`

---

## Complete Change History (Last Updated: February 2, 2026)

### February 2, 2026 - Synchronization & Key Management
- **SSH Key Integration**: Added SSH private/public keys for secure project access.
- **GitHub Sync**: Fully synchronized with latest Cursor IDE changes via `git pull --rebase`.
- **Secret Management**: Verified and configured `GITHUB_PERSONAL_ACCESS_TOKEN`.

### January 30, 2026 - White-Label & Security
- **Branding Removal**: Stripped all third-party logos (PayPal, Visa, Mastercard) from the frontend.
- **Generic Labels**: Replaced specific brand names with "Credit & Debit Cards".
- **Code Refactor**: Renamed `supabase.ts` to `authClient.ts` to remove service-specific naming.
- **Profile Redesign**: Implemented a comprehensive mobile-first Profile section with 7 sub-pages.

### January 29, 2026 - API Migration
- **Supabase to API**: Migrated all database operations from direct Supabase calls to a secure backend API layer (`api.ts`).
- **Error Handling**: Implemented 503 Service Unavailable handling for database connection failures.
- **DevOps**: Configured autoscale deployment and crash-proof startup validation.

### MCP Server Features
- **Remote Debugging**: Full support for Cursor/Antigravity via HTTP MCP.
- **AI Tools**: `list_files`, `read_file`, `write_file`, `run_command`, `query_database`, `ai_analyze`, `ai_fix_error`.
- **Security**: JWT-based authentication for AI assistant connections.

---

## Deploy Readiness
- **Build Pipeline**: ✅ Passed
- **Security Audit**: ✅ Passed (No frontend secrets)
- **Port Config**: ✅ 5000 (Vite), 3001 (Express), 8080 (MCP)
- **Mobile-First**: ✅ All pages responsive

---
*Last Updated: February 02, 2026*
