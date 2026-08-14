# CardXC Online — Production-Readiness Audit & Remediation

**Date:** 2026-08-14
**Scope:** Full repo (`server/`, `src/`, DB schema, payment/crypto/card/gift-card flows, auth, config, tests, build).
**Mode:** Audit + implement highest-priority *safe* fixes. No real-money functionality was enabled; unsupported financial paths were kept fail-closed.

---

## 1. Executive summary

The codebase has already been through a substantial security-hardening pass (see `AUDIT_*.md` / `FIXES_*.md`, dated 2026-04-17, and subsequent commits). I **verified** those gates are actually in place (Section 3), then closed the two remaining **money-safety** gaps I found in the settlement and value-out paths, with tests.

Baseline and post-change checks are fully green:

| Check | Result |
|---|---|
| `type-check` (app) | ✅ pass |
| `type-check:server` | ✅ pass |
| `test` (vitest) | ✅ **87 passed** (was 72; +15 new) |
| `lint` | ✅ pass (0 warnings, `eslint src`) |
| `build` (vite) | ✅ pass |

**Final verdict: NO-GO for real-money production** in the current repository state. The blockers fall into two classes:

- **External / operational — not satisfiable from source code:** secret rotation, provider/licensing approvals, and operational config. These gate GO regardless of code quality.
- **Repository-remediable — owned by engineering:** sanctions/AML screening (must be implemented in code) and dependency CVEs (dependency bumps + regression testing). Ownership and conditions are in Sections 7–8.

The application is **LIMITED-GO for a sandbox / test-key posture**, because financial endpoints correctly fail closed when providers/config are absent. Conditions to reach GO are in Section 8.

---

## 2. Changes made in this pass

### 2.1 Stripe checkout webhook — credit only settled funds (money-safety, fail-closed)
**File:** `server/routes/cardCheckout.ts`

Previously the `/stripe` webhook credited the wallet on `checkout.session.completed` **without checking `payment_status`**. Because the Checkout session is created with `automatic_payment_methods.allow_redirects: 'always'`, asynchronous/redirect payment methods can fire `checkout.session.completed` while `payment_status` is still `unpaid` — crediting money that has not cleared.

- The credit logic was extracted into an idempotent helper `creditStripeCheckoutSession(session)` (unique `stripe_<sessionId>` idempotency key, order-COMPLETED guard, `ON CONFLICT DO NOTHING` ledger insert, duplicate-key race caught).
- `checkout.session.completed` now credits **only when `session.payment_status === 'paid'`**; otherwise it logs and waits.
- Added `checkout.session.async_payment_succeeded` → credit, and `checkout.session.async_payment_failed` → mark order `FAILED`.
- Credited amount still comes exclusively from the stored `card_orders` row, never from webhook-supplied values.

### 2.2 Value-out endpoints — fail-closed eligibility gate (compliance/security)
**Files:** `server/middleware/financialEligibility.ts` (new), `server/routes/withdrawal.ts`

The withdrawal endpoints (`/api/withdraw/bank`, `/crypto`, `/platform`) previously required only `authenticate` + rate limiting — **no identity/eligibility gate on money leaving the platform**. Added `requireFinancialEligibility`, applied to all three routes:

- Re-checks `account_status === 'active'` (defense in depth). A missing/NULL status is rejected, never defaulted to active (fail closed).
- **Email verification required by default** (`REQUIRE_EMAIL_VERIFIED_FOR_WITHDRAWAL`, default on) — mirrors the existing card-checkout deposit posture.
- **KYC opt-in** (`REQUIRE_KYC_FOR_WITHDRAWAL`, default off) — mirrors `REQUIRE_KYC_FOR_CARD_CHECKOUT` so operators configure one consistent identity posture.
- Fails closed on any lookup failure / missing user.
- Ordered **after** `financialOpLimiter` in the route chain so a rate-limited flood is rejected before it incurs the eligibility DB lookup.

### 2.3 Tests added (+15)
- `server/routes/__tests__/cardCheckoutStripeWebhook.test.ts` — unpaid `completed` does **not** credit; paid `completed` credits; `async_payment_succeeded` credits; `async_payment_failed` marks FAILED without crediting; duplicate delivery (`23505`) does not double-credit; credit uses the stored order amount, never the webhook-supplied `amount_total`.
- `server/middleware/__tests__/financialEligibility.test.ts` — pass/deny matrix across email, KYC (opt-in), active/inactive/NULL account status, missing user, thrown lookup (fail closed), unauthenticated request, and env toggles.

---

## 3. Verification of previously-claimed safety gates (task: "can gates be bypassed?")

Confirmed present and effective in the current tree:

- **JWT secret** — `server/lib/jwtSecret.ts` throws on missing secret and on `< 32` chars; no `dev-only-secret`/`secret123` fallback survives anywhere in `server/`. Algorithms pinned to `HS256` at verify/sign sites.
- **Session/identity binding** — `authenticate` rejects a token whose `userId` claim ≠ session owner, and rejects non-active accounts.
- **Stripe webhook signature** — `STRIPE_WEBHOOK_SECRET` mandatory (503 when unset), signature required (401), verified via SDK; no "skip in dev" path.
- **Fluz webhook** — HMAC verified with length-guarded `timingSafeEqual`; idempotent via `payment_webhook_logs`; order-COMPLETED guard.
- **Amount integrity** — both webhook credit paths use the stored `card_orders.amount_cents`, never webhook input.
- **Crypto withdrawal double-spend** — `withdrawalService` refunds only when the payout never left custody; a post-send bookkeeping failure does not refund (unit-tested).
- **WAF bypass** — the old `req.path.startsWith('/')` (matched every path) is replaced by an explicit `SECURITY_BYPASS_EXACT` allowlist.
- **CSPRNG** — no `Math.random()` remains in card/payment/crypto/wallet code.

---

## 4. Findings by severity (current state)

### Critical (environment / operational — not fixable in code here)
- **C1. Secret rotation unverifiable.** `ROTATION_LIST.md` enumerates secrets that were committed (JWT/session secrets, a `DATABASE_URL` with a weak password on a public IP, a third-party API key in `attached_assets/`). Rotation cannot be confirmed from the repo. Until every listed value is rotated and purged, treat the deployment as compromised. **Blocker.**
- **C2. No verifiable production authorization** for card issuing / banking / money movement (licensing, provider approvals). Per constraints, real-money functionality must stay disabled. **Blocker.**

### High
- **H1. Dependency CVEs.** Command: `npm audit --omit=dev --audit-level=high` against `package-lock.json` (lockfileVersion 3). Distinguish by **runtime reachability**, since the production start path is `tsx server/index.ts` (Express + Socket.IO) and does **not** load Vite:
  - **Runtime-reachable (fix first):** `websocket-driver` (critical) and `ws` (high) are pulled in by `socket.io`/`socket.io-adapter` (also `ethers`, `jsdom`) and are on the live WebSocket path.
  - **Build/dev only (lower urgency):** `vite` (high) is declared in `dependencies` (so `--omit=dev` still flags it) but is used only by `build`/`dev`/`preview` scripts — never loaded by the running server.
  Fix requires dependency bumps + regression testing (Socket.IO/Stripe smoke) — deliberately **not** auto-applied here to avoid breaking those paths. See Section 8.
- **H2. No sanctions/AML screening** in any money-in/out path. The new eligibility gate provides the KYC hook, but list-screening (OFAC/PEP), velocity/limit rules, and travel-rule handling are absent.
- **H3. Crypto payout "manual" mode records nothing.** `cryptoProviderService.createManualPayoutRequest()` returns `success/pending` and its comment claims it persists to `pending_crypto_payouts`, but there is **no insert** (the `withdrawal_requests` row is the only durable record). Reconciliation relies on that single row; the dedicated queue implied by the code does not exist.

### Medium
- **M1. Card-checkout KYC gate defaults off** (`REQUIRE_KYC_FOR_CARD_CHECKOUT`); acceptable for deposits, but should be on before real-money launch.
- **M2. In-memory rate-limit / IP-block state** (`middleware/security.ts`) is per-process; behind multiple workers/instances it is not shared (Redis wiring is stubbed).
- **M3. Swagger UI** gated to non-production only — confirm `NODE_ENV=production` is actually set in deploy.

### Low
- **L1.** CSP still contains `'unsafe-inline'` (a TODO to migrate to nonces remains).
- **L2.** `speakeasy` (2FA) is unmaintained; migrate to `otplib`.

---

## 5. Tests / results

```text
vitest run  → 14 files, 87 tests passed
tsc app     → clean
tsc server  → clean
eslint src  → clean (max-warnings 0)
vite build  → success
```

New coverage targets the two highest-risk money paths changed here (deposit settlement, value-out eligibility). Existing money-path regression tests (crypto double-spend, payments overdraw, Fluz webhook idempotency/authz) continue to pass.

---

## 6. Exact files changed

| File | Change |
|---|---|
| `server/routes/cardCheckout.ts` | Extracted `creditStripeCheckoutSession()`; gate credit on `payment_status === 'paid'`; handle async payment succeeded/failed. |
| `server/routes/withdrawal.ts` | Apply `requireFinancialEligibility` to bank/crypto/platform routes. |
| `server/middleware/financialEligibility.ts` | **New** — fail-closed value-out eligibility gate (email default-on, KYC opt-in). |
| `server/routes/__tests__/cardCheckoutStripeWebhook.test.ts` | **New** — Stripe settlement-gate tests. |
| `server/middleware/__tests__/financialEligibility.test.ts` | **New** — eligibility-gate tests. |
| `AUDIT_PRODUCTION_READINESS.md` | **New** — this report. |

---

## 7. Remaining blockers (must clear before real money)

1. **Rotate & purge every secret** in `ROTATION_LIST.md`; confirm none survive in env/DB/history (C1).
2. **Obtain and record provider/licensing authorization**; supply real (not placeholder) keys and set all webhook secrets (`STRIPE_WEBHOOK_SECRET`, `FLUZ_WEBHOOK_SECRET`) (C2).
3. **Add sanctions/AML screening + limits/velocity** to money-in/out (H2).
4. **Resolve dependency CVEs** (H1).
5. **Implement the crypto manual-payout persistence/reconciliation queue** or remove the misleading path (H3).

---

## 8. Recommended next steps

- Run `npm audit fix` on a branch, then re-run the full suite + a Socket.IO/Stripe smoke test; bump `socket.io`, `ethers`/`tronweb`, and `vite` as needed.
- Turn on `REQUIRE_KYC_FOR_CARD_CHECKOUT=true` and `REQUIRE_KYC_FOR_WITHDRAWAL=true` once KYC provider integration + screening are live.
- Back the rate-limit/IP-block stores with Redis (interfaces already exist).
- Migrate CSP to nonce-based (drop `'unsafe-inline'`) and 2FA to `otplib`.
- Add reconciliation jobs that assert Σ ledger entries == wallet balances and alert on drift.

---

## 9. Final production verdict

> **NO-GO for real-money production** until blockers 1–3 (and ideally 4–5) in Section 7 are cleared — these are operational/compliance items that cannot be satisfied from source code.
>
> **LIMITED-GO** for a sandbox / test-key deployment: the code fails closed when providers and secrets are absent, auth and webhook integrity are sound, and the deposit-settlement and value-out paths are now gated. This is a safe posture for staging and integration testing, not for handling customer funds.
