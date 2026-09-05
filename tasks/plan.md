# Implementation Plan: CardXC Security Audit & Hardening

**Date:** 2026-08-15
**Branch:** `cursor/security-audit-plan-6a35`
**Mode:** Read-only audit + prioritized plan. **No production/financial code was changed.**
**Skills applied:** `using-agent-skills` (router) → `code-review-and-quality` (audit) + `security-and-hardening` (sensitive domains) → `planning-and-task-breakdown` (this plan).

> ⚠️ **Approval gate:** Tasks that change money-movement behavior (gift-card pricing, crypto crediting, webhook crediting, kill-switch) or enable real-money features are marked **[NEEDS APPROVAL]**. Per the stated constraint, they must not be implemented until a human approves and (for provider changes) provider agreements/secrets are verified.

---

## 1. Overview

CardXC is a full-stack fintech platform (React 19 + Vite frontend, Express 5 + TypeScript backend, PostgreSQL via raw `pg`, Socket.IO, Stripe + Fluz providers). This document captures a verified security audit of the current `main` HEAD and a prioritized, dependency-ordered hardening plan.

The repository already contains a prior findings-only audit (`AUDIT_REPORT.md`, `AUDIT_SERVER.md`, `AUDIT_SRC.md`, `AUDIT_ENV.md`, `ROTATION_LIST.md`, dated 2026-04-17). **That report is largely stale**: most of its 14 CRITICAL and many HIGH findings have since been fixed. This plan re-verifies each sensitive domain against current code and only tracks findings that are still **OPEN** or **PARTIAL**.

## 2. Method

- Verified current state of every prior high/critical finding by reading the cited `file:line` at HEAD (not trusting the stale report).
- Ran `npm run type-check:all` (clean), `npm run build` (succeeds), `npm run test` (72/72 pass), and `npm audit --omit=dev` (33 vulns; 2 critical / 20 high, all transitive).
- Audited the sensitive domains named in the request: authentication, payments, wallet, card, transaction, KYC, admin, webhook, provider integrations.

## 3. Architecture (as-built)

```
Browser (React/Vite :5000)
  │  fetch('/api/*', credentials: 'include')   ── httpOnly auth_token cookie
  ▼  Vite dev proxy → :5001
Express app (server/index.ts :5001)
  ├─ helmet CSP/HSTS · cors allowlist · cookie-parser
  ├─ security middleware (exact-match bypass for /api/health,/api/metrics,/)
  ├─ rate limiting (apiLimiter, authLimiter, sensitiveOpLimiter, webhookLimiter)
  ├─ /api/auth (JWT HS256 + DB sessions + bcrypt-12 + 2FA speakeasy)
  ├─ /api/{user,cards,payments,checkout,transactions,savings,rewards,
  │        gift-cards,withdraw,crypto,swap,fluz,deposit-otp,...}  (authenticate)
  ├─ /api/admin/** (authenticate + requireRole('SUPER_ADMIN'))
  ├─ /api/webhooks/{payment(Fluz),stripe}  (signature auth, not JWT)
  └─ Socket.IO (JWT HS256)
        │
        ▼
PostgreSQL (raw SQL via server/db/pool.ts; schema in server/db/init.ts)
External: Stripe (Checkout/Issuing/webhooks), Fluz (REST + GraphQL), TronGrid (crypto deposits)
```

**Trust boundaries:** HTTP request bodies/params, auth cookies, Stripe/Fluz webhooks, TronGrid responses, uploaded KYC files, LLM (Gemini/OpenAI) output. Money-movement assets: wallet balances, card orders, gift-card requests, crypto deposits/withdrawals.

## 4. Verified findings (current HEAD)

### Confirmed FIXED since the prior audit (no action needed)
JWT secret hard-fail + no source fallback (`lib/jwtSecret.ts`); JWT `HS256` pinning on all 5 call sites; phone-verify and deposit-OTP now hashed (SHA-256) + `timingSafeEqual`; WAF bypass is now an exact-match allowlist; admin routers enforce `authenticate + requireRole('SUPER_ADMIN')`; card `lastFour`/identifiers use `crypto.randomInt`; **Stripe** webhook is fail-closed; no Adyen/Stripe **secret** in the browser bundle (only public client keys); no `localStorage` auth tokens (cookie-first); withdrawals authorize + lock + validate addresses; crypto double-credit protected by unique `tx_hash` index + atomic claim.

### Still OPEN / PARTIAL (tracked in this plan)

| ID | Severity | Domain | Finding | Evidence |
|----|----------|--------|---------|----------|
| S1 | **HIGH** | gift-card / financial | Buy price is client-controlled: `rate` from `req.body` drives `totalCostCents`; buyer can pay ~1% of face value | `server/routes/giftCards.ts:53,58,82` |
| S2 | **HIGH** | webhook / financial | Fluz/provider webhook is **fail-open**: signature check skipped entirely when `FLUZ_WEBHOOK_SECRET` unset → spoofed event credits wallets | `server/routes/cardCheckout.ts:229-252` |
| S3 | **HIGH** | dependencies | `npm audit` (prod): 2 critical / 20 high, all transitive via `ws`/`websocket-driver`/`ethers` under `socket.io`; `ws` path is reachable (Socket.IO). Non-forced `npm audit fix` available | `npm audit --omit=dev` |
| S4 | **MED** | crypto / financial | Confirmation gate not enforced: `REQUIRED_CONFIRMATIONS=20` is stored but credit does not require ≥N confirmations before crediting the wallet | `server/services/tronDepositMonitor.ts:8,138-147` |
| S5 | **MED** | payments / admin | Payment kill-switch not enforced server-side; `/api/admin/payment-mode` referenced by UI but missing; flag lives in `localStorage` | `server/routes/cardCheckout.ts`, `src/pages/admin-operations/components/PaymentSettingsTab.tsx:51,93`, `src/lib/paymentUtils.ts:4-27` |
| S6 | **MED** | auth | JWT returned in `signin`/`signup` JSON body (in addition to httpOnly cookie); XSS can read it from memory | `server/routes/auth.ts:131,264` |
| S7 | **MED** | auth | Google OAuth login path does not enforce 2FA even when the account has 2FA enabled | `server/routes/auth.ts` (google callback) |
| S8 | **MED** | KYC | Upload validates declared MIME + size but not magic bytes → MIME spoofing | `server/routes/user.ts:31-38` |
| S9 | **MED** | payments | Card-order creation has no idempotency key; retries create duplicate orders; webhook vs OTP completion can race | `server/routes/cardCheckout.ts:107-111,796-800`, `server/routes/depositOtp.ts:69-73` |
| S10 | **MED** | frontend / XSS | CSP still allows `'unsafe-inline'` in `scriptSrc`/`styleSrc` (weakens XSS mitigation) | `server/index.ts:115-127` |
| S11 | **LOW/MED** | payments | Stripe session-status endpoint has no order-ownership check (any authed user reads any `sessionId` status) | `server/routes/cardCheckout.ts:846-863` |
| S12 | **LOW/MED** | transactions | `FOR UPDATE` row lock missing on `transactions.ts` transfer/deposit paths (guarded conditional UPDATE partially compensates) | `server/routes/transactions.ts:157-178,249-285` |
| S13 | **LOW/MED** | auth / realtime | Socket.IO auth verifies JWT but does not re-check the DB `sessions` row, so a revoked session stays usable on the socket until token expiry | `server/services/socketService.ts`, `realtimeService.ts` |
| S14 | **LOW** | crypto | `/api/crypto/tx/:txHash` interpolates an unvalidated hash into the TronGrid URL (probing/limited SSRF) | `server/routes/crypto.ts:85-88` |
| S15 | **LOW** | maintainability | No centralized `sanitizeUser` helper; response field allowlisting is ad hoc (future-leak risk) | `server/routes/auth.ts:340-351` |
| S16 | **OPS** | secrets | Prior rotation list (`ROTATION_LIST.md`): leaked keys in git history / weak prod secrets. Requires provider consoles + history rewrite — outside the VM | `ROTATION_LIST.md` |
| C1 | **LOW** | tooling | `.cursor/rules/agent-skills.mdc` points to `.cursor/skills/using-agent-skills/SKILL.md`, but skills actually live in `.agents/skills/`. The rule is unactionable as written | `.cursor/rules/agent-skills.mdc` |

## 5. Prioritized plan

Ordered by risk-to-money and blast radius. Full task cards (acceptance criteria + verification) live in `tasks/todo.md`.

### Phase 0 — Secrets & supply chain (do first; low code risk)
- **T1** — Triage & apply non-forced dependency fixes (S3).
- **T2 [NEEDS APPROVAL / OPS]** — Execute `ROTATION_LIST.md` for any secrets still live; verify `FLUZ_WEBHOOK_SECRET`/`STRIPE_WEBHOOK_SECRET` set in prod (S16, enables S2).
- **T3** — Fix the `.cursor` rule path so the skills workflow is actually discoverable (C1).

### Phase 1 — Financial integrity (highest severity) — **[NEEDS APPROVAL]**
- **T4** — Server-authoritative gift-card pricing; ignore client `rate` (S1).
- **T5** — Make the Fluz/provider webhook fail-closed like Stripe (S2).
- **T6** — Enforce crypto confirmation gate before crediting (S4).
- **T7** — Server-side payment kill-switch + `/api/admin/payment-mode` (S5).

### Phase 2 — AuthN/AuthZ hardening
- **T8** — Stop returning the JWT in the signin/signup body (S6).
- **T9** — Enforce 2FA on the Google OAuth login path (S7).
- **T10** — Order-ownership check on Stripe session-status (S11).
- **T11** — Re-validate DB session on Socket.IO connect (S13).

### Phase 3 — Defense-in-depth / consistency
- **T12** — KYC magic-byte content validation (S8).
- **T13** — Idempotency key on card-order creation + single completion path (S9).
- **T14** — `FOR UPDATE` on `transactions.ts` transfer/deposit (S12).
- **T15** — Remove `'unsafe-inline'` from CSP via nonces/hashes (S10).
- **T16** — Validate `:txHash` format before outbound TronGrid call (S14).
- **T17** — Centralized `sanitizeUser` response helper (S15).

### Checkpoints
- **After Phase 0:** deps triaged, `npm audit` re-run, prod webhook secrets confirmed; tests + build green.
- **After Phase 1:** each financial change has a failing-then-passing test proving the exploit is closed; **human sign-off required before merge**.
- **After Phase 2 & 3:** full `type-check:all` + `test` + `build` + browser smoke (login → dashboard) green.

## 6. Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Changing pricing/credit logic breaks legitimate flows or double-processes money | High | Write exploit test first (red), fix (green); wrap in DB transactions; require human approval (Phase 1 gate) |
| `npm audit fix` bumps `ws`/`ethers`/`socket.io` transitively and breaks realtime/crypto | Med | One change, review lockfile diff, run tests + manual socket check before/after (per `code-review-and-quality` dependency discipline) |
| Rotating live secrets logs users out / breaks provider calls | Med | Sequence per `ROTATION_LIST.md` (signing secrets → DB → providers); coordinate; verify provider agreements first |
| Making Fluz webhook fail-closed rejects real events if secret misconfigured in prod | Med | Gate T5 behind T2 (confirm `FLUZ_WEBHOOK_SECRET` is set) so we don't drop legitimate credits |
| CSP nonce migration breaks inline scripts / HMR | Low | Stage in dev, verify via browser DevTools before prod |

## 7. Open questions (need human input before Phase 1)

1. **Gift-card pricing source of truth** (S1/T4): where is the authoritative buy/sell rate (existing `giftCardPricingService` / `calculateTransactionProfit`)? Confirm the intended margin so the fix computes the correct price.
2. **Real-money posture** (S2/S5): is Fluz/Stripe live today? If live, T2/T5 must be sequenced with verified provider secrets before we flip fail-closed.
3. **Crypto confirmations** (S4/T6): confirm the required confirmation count per network (currently constant 20) and the desired UX for pending deposits.
4. **Kill-switch semantics** (S5/T7): should "payments disabled" block new orders only, or also webhook crediting of in-flight orders?
5. **OAuth 2FA** (S7/T9): should OAuth logins require a second factor, or is the IdP considered sufficient?

## 8. Out of scope

No penetration testing / live exploitation, no infra/network/TLS review, no accessibility/performance pass, and no production deployment. Implementation of any task here is a separate, approved change.
