# Local User DB (CardXC)

Minimal PostgreSQL setup for local development: **users**, **sessions**, and **wallets** only.

## 1. Create database and schema

```bash
# Create DB (PostgreSQL must be running)
createdb cardxc

# Apply schema (from project root)
psql -d cardxc -f server/db/local-user-schema.sql
```

Or with connection string:

```bash
psql "postgresql://localhost:5432/cardxc" -f server/db/local-user-schema.sql
```

## 2. Seed test users (optional)

Seeds two local users and creates a USD wallet for each:

| Email               | Password  | Role        |
|---------------------|-----------|-------------|
| test@cardxc.local   | Password1! | USER        |
| admin@cardxc.local  | Admin1!   | SUPER_ADMIN |

```bash
# From project root; set DATABASE_URL to your local DB
DATABASE_URL=postgresql://localhost:5432/cardxc npx tsx server/db/seed-local-users.ts
```

## 3. Run the app against local DB

```bash
# .env or export
DATABASE_URL=postgresql://localhost:5432/cardxc

# Or use bootstrap admin (server creates admin on first run)
BOOTSTRAP_SUPER_ADMIN_EMAIL=admin@cardxc.local
BOOTSTRAP_SUPER_ADMIN_PASSWORD=Admin1!
```

Then start the server; it will use the local `cardxc` database. Sign in at `/signin` with `test@cardxc.local` / `Password1!` or `admin@cardxc.local` / `Admin1!`.

## 4. Open Local User DB in Cursor built-in browser

1. Start the app: `npm run dev` (Vite on port 5000).
2. In Cursor: **Cmd+Shift+P** (Mac) or **Ctrl+Shift+P** (Windows/Linux) → type **Simple Browser: Show**.
3. Enter URL: **http://localhost:5000/admin-dashboard#localuserdb**
4. Sign in as admin if prompted (`admin@cardxc.local` / `Admin1!`). The page will open on the **Local User DB** tab.

## Files

- **local-user-schema.sql** – Creates `users`, `sessions`, `wallets` (no other tables).
- **seed-local-users.ts** – Inserts/updates the two dev users and their wallets.
- **init.ts** – Full schema (all tables); use for a complete local DB or CI.
