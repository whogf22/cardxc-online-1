# CLAUDE.md

## Project Overview

CardXC is a fintech platform for digital payments, virtual cards, gift cards, and wallet management. Full-stack TypeScript application with React frontend and Express backend, deployed on Cloudflare Workers.

## Tech Stack

- **Frontend:** React 19 + Vite + TailwindCSS + TypeScript
- **Backend:** Express 5 (ESM) + TypeScript
- **Database:** PostgreSQL (pg driver)
- **Real-time:** Socket.IO
- **Payments:** Stripe (Checkout, Issuing, 3DS2)
- **Testing:** Vitest (frontend), Jest (backend)
- **Deployment:** Cloudflare Workers (Wrangler)

## Common Commands

```bash
# Development
npm run dev              # Start frontend (port 5000) + backend (port 3001)
npm run server           # Backend only
npm run client           # Frontend only (Vite dev server)

# Build
npm run build            # Production build (Vite)
npm run deploy           # Build + deploy to Cloudflare Workers

# Testing
npm run test             # Run vitest once
npm run test:watch       # Run vitest in watch mode

# Code Quality
npm run lint             # ESLint on src/ (TS/TSX)
npm run type-check       # TypeScript type checking (tsconfig.app.json)

# Database
npm run db:schema        # Apply user schema
npm run db:seed          # Seed test users
```

## Project Structure

```
src/                     # Frontend React app
  pages/                 # Page components (30+)
  components/            # Reusable UI components
  hooks/                 # Custom React hooks
  contexts/              # React context providers
  lib/                   # API client, utilities, validation
  router/                # Route configuration
  types/                 # TypeScript type definitions
  i18n/                  # Internationalization (i18next)

server/                  # Backend Express app
  routes/                # API route handlers (20+)
  services/              # Business logic services
  middleware/             # Auth, logging, rate limiting, security
  db/                    # Database pool, init, migrations, schemas
  config/                # Swagger docs

scripts/                 # Utility scripts (DB, MCP, backups)
mcp-server/              # Model Context Protocol server
```

## Key Architecture Notes

- Frontend proxies `/api` to backend (port 3001) during development
- Path alias `@/` maps to `src/` in frontend code
- ESM modules throughout (`"type": "module"` in package.json)
- Backend uses `tsx` for TypeScript execution
- API docs available at `/api-docs` (Swagger)
- Environment variables configured via `.env` (see `.env.example`)
