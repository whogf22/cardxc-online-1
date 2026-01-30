# CardXC - GitHub Copilot Instructions

## Project Overview
CardXC is a modern fintech platform for digital banking. It provides virtual cards, P2P transfers, savings goals, and fraud detection with a white-label approach (no third-party branding visible).

## Tech Stack

### Frontend
- React 19 + TypeScript + Vite
- TailwindCSS for styling
- React Router 7 for routing
- Framer Motion for animations
- RemixIcon for icons

### Backend
- Node.js 20 + Express 5 + TypeScript
- PostgreSQL (Neon-backed via Drizzle ORM)
- JWT authentication
- Stripe for payments (backend only, no frontend branding)

## Project Structure
```
src/                    # React frontend
├── components/         # Reusable UI components
├── pages/              # Page components (route-based)
├── contexts/           # React contexts (Auth, Toast, Currency)
├── hooks/              # Custom React hooks
├── lib/                # Utilities (api.ts, currencyUtils.ts, authClient.ts)
├── router/             # Route configuration
└── types/              # TypeScript types

server/                 # Express backend
├── routes/             # API endpoints
├── middleware/         # Auth, rate limiting, validation
├── db/                 # Database schema and queries
├── services/           # Business logic
└── utils/              # Helper functions

mcp-server/             # MCP server for AI debugging
shared/                 # Shared types between frontend/backend
```

## Code Conventions

### React Components
- Use functional components with hooks
- Use TypeScript interfaces for props
- Mobile-first responsive design
- Use existing UI components from `src/components/ui/`

### API Calls
- Use `src/lib/api.ts` for all API calls (userApi, adminApi, authApi)
- Never use direct fetch calls; use the api client
- All endpoints are prefixed with `/api/`

### Styling
- Use TailwindCSS classes
- Follow existing color scheme (blue primary, gray backgrounds)
- Mobile-first: design for mobile, then add responsive breakpoints
- Use RemixIcon classes (ri-*) for icons

### Authentication
- Use `useAuthContext()` for auth state
- Auth client in `src/lib/authClient.ts` (renamed from supabase.ts)
- Protected routes use `<ProtectedRoute>` wrapper
- Admin routes use `<AdminRoute>` wrapper
- Super Admin bypasses KYC requirements

### Database
- Use Drizzle ORM for queries
- Never change primary key ID types
- Use `npm run db:push` for schema sync

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/api.ts` | API client with all endpoints |
| `src/lib/authClient.ts` | Authentication client (renamed from supabase.ts) |
| `src/contexts/AuthContext.tsx` | Authentication state management |
| `src/router/config.tsx` | All route definitions |
| `server/routes/` | Backend API endpoints |
| `server/db/schema.ts` | Database schema (Drizzle) |
| `server/db/pool.ts` | PostgreSQL pool + isDatabaseConnectionError() |

## Important Rules

1. **White-label**: No third-party branding (PayPal, Stripe, Visa logos) in frontend
2. **Security**: Never expose secrets; use environment variables
3. **No mock data**: Use real API calls; no placeholder data in production
4. **Mobile-first**: All UI must work on mobile screens
5. **Type safety**: Use TypeScript types; avoid `any`
6. **Generic payment labels**: Use "Credit & Debit Cards" not "Visa, Mastercard, Amex"

## User Roles
- `USER`: Standard user (requires KYC for full access)
- `ADMIN`: Can manage users and view analytics
- `SUPER_ADMIN`: Full access, bypasses all restrictions

## Environment Variables
- Frontend: `VITE_*` prefix for client-side env vars
- Backend: `DATABASE_URL`, `SESSION_SECRET`, `STRIPE_*`
- Auth: `AUTH_API_URL`, `AUTH_API_KEY` (not Supabase names)
- Secrets: Use Replit secrets vault for sensitive values

## Common Patterns

### Adding a new page
1. Create component in `src/pages/[name]/page.tsx`
2. Add route in `src/router/config.tsx`
3. Use `BottomNavigation` for mobile nav

### Adding an API endpoint
1. Add route handler in `server/routes/[module].ts`
2. Add corresponding function in `src/lib/api.ts`
3. Use proper middleware (requireAuth, requireAdmin)

### Database queries
```typescript
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const user = await db.select().from(users).where(eq(users.id, id));
```

## Testing
- Run `npm run dev` to start development server
- Frontend runs on port 5000
- Backend API runs on port 3001
- MCP server runs on port 8080

---

## Profile & Settings Pages

### Routes
| Route | Purpose |
|-------|---------|
| `/profile` | Main profile with settings menu |
| `/profile/personal` | Name, email, phone, DOB, country, gender |
| `/profile/payments` | Card details, currency preference |
| `/profile/security` | Password, PIN, 2FA toggle, login history |
| `/profile/accessibility` | Voice, zoom, screen reader, font size |
| `/profile/language` | 6 language options |
| `/profile/notifications` | Email, message, in-app toggles |
| `/profile/privacy` | Data sharing, personalization, location |

### Design Guidelines
- Mobile-first iOS-style design
- White backgrounds with subtle borders
- RemixIcon (ri-*) for all icons
- Consistent back navigation headers

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
- Created 6 new sub-pages for profile settings
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
- `src/pages/wallet/page.tsx`
- `src/pages/wallet/components/WithdrawModal.tsx`
- `src/pages/dashboard/components/WithdrawModal.tsx`
- `PaymentSettingsTab.tsx`, `UsersTab.tsx`, `OverviewTab.tsx`
- `LedgerExplorerTab.tsx`, `WalletBalancesTab.tsx`, `WithdrawalsTab.tsx`, `RiskMonitorTab.tsx`
- `src/pages/support/page.tsx`
- `src/components/KYCDocumentUpload.tsx`
- `src/components/PhoneVerification.tsx`
- `src/components/AdminHealthCheck.tsx`
- `src/lib/exchangeRateService.ts`
- `src/contexts/CurrencyContext.tsx`

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
- Created IDE context files for external integration
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
| Build Pipeline | Passed |
| LSP Diagnostics | No errors |
| Security Audit | No secrets in frontend |
| Port Configuration | 5000/3001/8080 |
| Database Connection | 503 on failure |
| Autoscale Deploy | Configured |

---

## Last Updated
January 30, 2026
