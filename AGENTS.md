# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

CardXC is a fintech platform (gift card marketplace + multi-currency wallet). Single `package.json` monorepo with:
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS (port 5000 via Vite dev server)
- **Backend**: Express 5 + TypeScript ESM (port 3001 in dev)
- **Database**: PostgreSQL 16 (local, no Docker required)

Vite proxies `/api` requests to the backend at `localhost:3001`. See `vite.config.ts` → `server.proxy`.

### Running services

1. **Start PostgreSQL**: `sudo pg_ctlcluster 16 main start`
2. **Start backend**: `NODE_ENV=development PORT=3001 npx tsx server/index.ts`
3. **Start frontend**: `NODE_ENV=development npx vite --host 0.0.0.0 --port 5000`
4. Or use `npm run dev` which starts both (backend on env `PORT` and Vite concurrently).

### Key gotchas

- The `npm run dev` script runs the backend with `PORT` from `.env` (set to `3001`) and Vite on port 5000. If `PORT` is not set to 3001, the Vite proxy to the backend will fail.
- `DATABASE_SSL=false` must be set in `.env` for local PostgreSQL without SSL.
- The backend starts in "OFFLINE MODE" if the database is unreachable — it won't crash, but most API routes will fail.
- Background jobs may log errors for missing tables (e.g., `email_verification_tokens`) if only the minimal schema from `db:schema` was applied. The full `initializeDatabase()` in `server/db/init.ts` creates all tables on startup.
- ESLint is configured in `eslint.config.ts` (flat config) and only lints `src/` (frontend). The existing codebase has ~42 lint errors (unused vars, missing deps in hooks).

### Commands reference

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Lint (frontend) | `npm run lint` |
| Type check (frontend) | `npm run type-check` |
| Tests | `npm run test` (vitest) |
| Build frontend | `npm run build` |
| Init DB schema | `npm run db:schema` |
| Seed test users | `npm run db:seed` |
| Start dev (both) | `npm run dev` |

### Test accounts (after `npm run db:seed`)

- User: `test@cardxc.local` / `Password1!`
- Admin: `admin@cardxc.local` / `Admin1!`

### Environment variables

Minimum `.env` for local development:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cardxc
DATABASE_SSL=false
SESSION_SECRET=<any-64-char-string>
JWT_SECRET=<any-64-char-string>
NODE_ENV=development
PORT=3001
```

All external service keys (Stripe, SMTP, Fluz, Reloadly, crypto, AI) are optional — the server gracefully degrades without them.
