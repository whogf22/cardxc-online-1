# CardXC Online — Fintech Platform

## Overview
CardXC is a full-stack fintech platform for digital payments, virtual cards, gift cards, crypto, and wallet management. Monorepo with React frontend and Express backend.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS + SWC
- **Backend**: Express 5 + TypeScript (ESM via tsx)
- **Database**: PostgreSQL (via `pg` pool, no ORM — raw SQL)
- **Payments**: Stripe (Checkout, Issuing, 3DS2)
- **Real-time**: Socket.IO
- **Validation**: Zod + express-validator
- **Auth**: JWT + bcryptjs + speakeasy (2FA)
- **Deployment**: Cloudflare Workers (wrangler) + Vite build

## Project Structure
```
src/              # React frontend
  pages/          # Route pages (auth, dashboard, wallet, cards, etc.)
  components/     # Shared UI components
  contexts/       # React contexts (auth, theme, etc.)
  hooks/          # Custom React hooks
  lib/            # API client, utilities
  router/         # Route configuration
server/           # Express backend
  routes/         # API route handlers
  services/       # Business logic (stripe, crypto, fraud, email, etc.)
  db/             # PostgreSQL pool, init, schema
  middleware/     # Auth, rate limiting, security
  config/         # Server configuration
  lib/            # Shared server utilities
mcp-server/       # MCP server for tooling integration
scripts/          # DB backup, deployment, health check scripts
```

## Common Commands
```bash
npm run dev          # Start dev (backend + vite frontend concurrently)
npm run server       # Backend only (tsx server/index.ts)
npm run client       # Frontend only (vite)
npm run build        # Vite production build
npm run deploy       # Build + wrangler deploy to Cloudflare Workers
npm test             # Run tests (vitest)
npm run test:watch   # Watch mode tests
npm run type-check   # TypeScript check (tsconfig.app.json)
npm run lint         # ESLint on src/
npm run db:schema    # Run local DB schema
npm run db:seed      # Seed local users
```

## Key Architecture Notes
- Backend entry: `server/index.ts`
- Frontend entry: `src/main.tsx`, app root: `src/App.tsx`
- Database connection pool: `server/db/pool.ts`, init: `server/db/init.ts`
- Schema SQL: `DATABASE_SETUP.sql` (full), `server/db/local-user-schema.sql` (local)
- API routes mounted under `/api/` prefix
- Cloudflare Workers config: `wrangler.jsonc` (SPA mode with nodejs_compat)
- Environment variables in `.env` (DATABASE_URL, JWT_SECRET, SESSION_SECRET)

## Testing
- Framework: Vitest (config: `vitest.config.ts`)
- Frontend tests: `src/test/`
- Backend route tests: `server/routes/__tests__/`
- Backend service tests: `server/services/__tests__/`
- Use `vitest run` for single run, `vitest` for watch mode
