# Develop CardXC locally

Follow these steps to run the app on your machine.

## 1. Prerequisites

- **Node.js** 18+ (LTS recommended)
- **PostgreSQL** 14+ (local or Docker)

## 2. Install dependencies

```bash
npm install
```

## 3. Environment

```bash
npm run setup
```

Or manually: `cp .env.development.example .env`

Edit `.env` and set at least:

- **DATABASE_URL** – e.g. `postgresql://localhost:5432/cardxc`
- **SESSION_SECRET** – any string 32+ characters

## 4. Database

Create the database and apply the **user** schema (users, sessions, wallets):

```bash
# Create DB (PostgreSQL must be running)
createdb cardxc

# Apply schema (uses DATABASE_URL from .env)
npm run db:schema

# Seed test users (optional): test@cardxc.local / Password1!, admin@cardxc.local / Admin1!
npm run db:seed
```

If you prefer the **full** schema (all tables), start the server once with `DATABASE_URL` set; it will run `initializeDatabase()` and create everything. You can still use `db:seed` for the two dev users.

## 5. Run the app

```bash
npm run dev
```

- **Frontend:** http://localhost:5000 (Vite; `/api` is proxied to the backend)
- **Backend:** http://localhost:3001

Sign in with:

- **test@cardxc.local** / **Password1!**
- **admin@cardxc.local** / **Admin1!** (admin dashboard)

## 6. Run frontend or backend only

```bash
# Backend only (API on port 3001)
npm run server

# Frontend only (port 5000; API calls need backend running)
npm run client
```

## 7. Useful scripts

| Script        | Description                          |
|---------------|--------------------------------------|
| `npm run setup` | Create `.env` from example (if missing) |
| `npm run dev` | Frontend + backend (dev)             |
| `npm run server` | Backend only                      |
| `npm run client` | Frontend only (Vite)             |
| `npm run db:schema` | Apply local user schema (users, sessions, wallets) |
| `npm run db:seed`   | Seed test users + wallets        |
| `npm run build`     | Production build                 |
| `npm run type-check`| TypeScript check                 |

## 8. Troubleshooting

- **"Missing DATABASE_URL"** – Create `.env` from `.env.development.example` and set `DATABASE_URL`.
- **"connection refused" / "ECONNREFUSED"** – Start PostgreSQL and ensure `DATABASE_URL` host/port match (e.g. `localhost:5432`).
- **"relation \"users\" does not exist"** – Run `npm run db:schema` (or start the server once for full schema).
- **Frontend loads but API 404** – Start the backend with `npm run server` or use `npm run dev` so both run.
