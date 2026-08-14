# CardXC — Safe Deployment Runbook (cardxc.online)

**Goal:** reconcile the VPS working code with GitHub, then deploy safely to
`cardxc.online` while **preserving production env vars and database data** and
**keeping all gated real-money features OFF**.

> ⚠️ This runbook is executed **by you on machines that have access** (the VPS,
> and a machine with Cloudflare/GitHub credentials). The Claude session that
> wrote this has **no VPS/production access** and cannot run any of it.

> ⚠️ **Never** commit real secrets. All commands below reference env var
> *names* only. Production `.env` files stay on the box and are never
> overwritten by a deploy.

---

## 0. Preconditions / decisions

- Confirm which surface serves `cardxc.online`:
  - **Frontend (SPA):** Vite build → Cloudflare Workers (`wrangler`, auto-deploys on push to `main` via the Git integration we can see on PRs).
  - **Backend (API):** Express via `npm start` (`NODE_ENV=production tsx server/index.ts`) on the **VPS**, talking to PostgreSQL (`DATABASE_URL`).
- The changes to ship are 4 commits on `claude/developer-roadmap-content-3yxyev` (PR #9). They are **not merged**. Deploy production from `main` **after** merge, not from the feature branch.

---

## 1. FIRST: capture any VPS drift into git (do NOT skip)

If anyone hot-patched code directly on the VPS, that work exists **only** on the
box. A deploy that pulls GitHub over it will **erase it**. Capture it first.

On the **VPS**, in the app directory:

```bash
git status                 # uncommitted changes = drift
git stash list             # stashed drift
git log --oneline -5       # is the VPS ahead of / behind origin?
git fetch origin
git status -sb             # shows ahead/behind vs tracked branch
```

If `git status` shows changes:

```bash
# Preserve them on a dedicated branch and push — do not discard.
git checkout -b vps-drift-$(date +%Y%m%d)
git add -A
git commit -m "chore: capture live VPS drift before deploy"
git push -u origin vps-drift-$(date +%Y%m%d)
```

Then open a PR from that branch and reconcile it with `main`/PR #9 **before**
deploying. If `git status` is clean and the VPS is at or behind `origin/main`,
there is no drift — proceed.

> Files that are *supposed* to differ on the VPS (e.g. `.env`, `.env.local`,
> `uploads/`) should already be in `.gitignore`. Confirm with
> `git check-ignore .env` → it should print `.env`. If it does not, **stop** and
> fix `.gitignore` before committing anything, so secrets never get pushed.

---

## 2. Verify the diff you are about to ship

From a checkout (or the VPS after fetch):

```bash
git fetch origin
git diff --stat origin/main...origin/claude/developer-roadmap-content-3yxyev
git log --oneline origin/main..origin/claude/developer-roadmap-content-3yxyev
```

Expected (this deploy):

```text
b951e5c chore(tools): add mattpocock diagnosing-bugs skill
caa5edb fix(withdraw): fail closed on crypto withdrawal when no automated payout provider
402916a fix(review): address CodeRabbit findings on eligibility gate + stripe credit
4d09f53 fix(payments): gate deposit credit on settlement + fail-closed value-out eligibility
```

All four are safety/correctness fixes; none enable real-money features.

---

## 3. Back up the database and env BEFORE deploying

Data preservation is not automatic just because the schema is idempotent — take
a real backup first.

```bash
# On a host with DB access. Use the SAME DATABASE_URL the app uses.
pg_dump "$DATABASE_URL" --no-owner --format=custom \
  -f "cardxc-$(date +%Y%m%d-%H%M%S).dump"

# Snapshot the production env too (kept OUTSIDE git).
cp .env ".env.backup-$(date +%Y%m%d-%H%M%S)"
```

There is also `npm run db:backup` (`scripts/backup-user-db.js`) — use it if it
matches your prod DB.

**Schema safety note:** `server/db/init.ts` is idempotent — every table is
`CREATE TABLE IF NOT EXISTS` (40 tables, 0 `DROP`/`TRUNCATE`/`DELETE`) and column
changes use guarded `ALTER TABLE ... IF EXISTS/IF NOT EXISTS`. Running it on
deploy will **not** drop or wipe existing data. Still, keep the backup.

---

## 4. Keep real-money features gated (verify env)

These are the switches that keep unsupported money movement fail-closed. Confirm
production values are **safe** (below) and do NOT change them as part of this
deploy:

| Env var | Safe value | Effect if enabled |
|---|---|---|
| `CRYPTO_PROVIDER` | unset or `manual` | With no automated provider, crypto withdrawals now **fail closed (503)** — do not set a live provider unless a hot wallet + approvals exist. |
| `TRON_HOT_WALLET_PRIVATE_KEY` | **unset** | Enables real on-chain USDT payouts. Leave unset. |
| `STRIPE_SECRET_KEY` | test key or unset | A `sk_live_…` key enables real charges. Use test mode until launch-approved. |
| `STRIPE_ISSUING_CARDHOLDER_ID` | **unset** | Enables real card issuance. Leave unset. |
| `STRIPE_WEBHOOK_SECRET` | set (required) | If unset, the Stripe webhook returns 503 (fail-closed) — set it, but only alongside a test/live key you intend to use. |
| `FLUZ_WEBHOOK_SECRET` | set if Fluz used | Verifies Fluz webhook signatures. |
| `REQUIRE_EMAIL_VERIFIED_FOR_WITHDRAWAL` | unset/`true` | Default-on email gate on money-out. Leave on. |
| `REQUIRE_KYC_FOR_WITHDRAWAL` | `true` for launch | Turn on once KYC/AML screening is live. |
| `REQUIRE_KYC_FOR_CARD_CHECKOUT` | `true` for launch | Same, for deposits. |

Quick check on the VPS (names only, never print values to shared logs):

```bash
for v in CRYPTO_PROVIDER TRON_HOT_WALLET_PRIVATE_KEY STRIPE_ISSUING_CARDHOLDER_ID; do
  if [ -n "${!v}" ]; then echo "$v = SET (review!)"; else echo "$v = unset (safe)"; fi
done
```

---

## 5. Pre-deploy verification (must be green)

On a checkout of the exact commit you will deploy:

```bash
npm ci
npm run type-check:all      # app + server TypeScript
npm test                    # vitest — expect 88 passing
npm run build               # vite production build
```

Do not proceed if any of these fail.

---

## 6. Merge, then deploy

### 6a. Merge to main (your call — you asked to hold this earlier)
Merge PR #9 once you're satisfied. Production deploys from `main`.

### 6b. Frontend (Cloudflare Workers)
The Git integration auto-builds on push to `main`. Or manually, from a machine
with Cloudflare creds (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`):

```bash
npm run deploy              # = vite build && wrangler deploy
```

### 6c. Backend (VPS) — preserves .env, no data loss
On the **VPS**, in the app directory:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main      # ff-only avoids surprise merges

npm ci                              # install locked deps
# .env is untouched (gitignored). Do NOT copy any .env from the repo.

# Restart the backend with your process manager. Examples — use YOURS:
#   pm2 restart cardxc-backend
#   sudo systemctl restart cardxc-backend
#   (docker) docker compose up -d --build
```

The app runs its idempotent schema init on boot; existing data is preserved.

---

## 7. Post-deploy validation

```bash
node scripts/validate-production.js https://cardxc.online
# Expect: OK /api/health, /api/health/detailed (database: connected),
#         /api/health/ready (ready), /api/health/live (live)
```

Then smoke-check by hand: sign in, load wallet/cards, and confirm a crypto
withdrawal attempt returns **503 "Crypto withdrawals are not available right
now."** (proves the fail-closed gate is live and no funds can be stranded).

---

## 8. Rollback

- **Backend:** `git checkout <previous-good-sha> && npm ci && <restart>`.
- **Frontend:** redeploy the previous commit (`wrangler` rollback or re-deploy the prior `main` sha).
- **Database:** only if a migration went wrong — restore the Section 3 dump:
  `pg_restore --clean --no-owner -d "$DATABASE_URL" cardxc-<ts>.dump`
  (destructive — last resort, and only against a confirmed-bad state).

---

## What this deploy intentionally does NOT do

- Does **not** enable real-money card issuing, live Stripe charges, or automated crypto payouts (all remain gated / fail-closed).
- Does **not** modify or migrate production data destructively.
- Does **not** touch production secrets — `.env` on the VPS is authoritative and untouched.

Per `AUDIT_PRODUCTION_READINESS.md`, the platform is **LIMITED-GO for a
sandbox/test-key posture** and **NO-GO for real money** until the Section 7
blockers (secret rotation, provider/licensing authorization, sanctions/AML
screening, dependency CVEs) are cleared.
