# CardXC Deep-Fix Audit

**Date:** 2026-08-15
**Scope:** Current repository (`whogf22/cardxc-online-1`), branch `cursor/cardxc-deep-fix-6a35` (builds on the Stripe-safety branch).
**Mode:** Inspect → reproduce → fix existing functionality. No new product features were added.
**Method:** Findings verified against current code (not assumed from prior audits). Gates run: `type-check:all`, `test`, `build`, `lint`, `npm audit`.

> This document describes the **current** system only. Business, licensing, provider-approval, and KYB facts are **not** asserted here — see `PAYMENT_GATEWAY_MASTER_READINESS.md` and `payment-provider-readiness.md`, where they are marked NOT VERIFIED / EXTERNAL BLOCKER / OWNER INPUT REQUIRED.
>
> **Legal entity (owner-verified 2026-08-15):** CARDXC LLC. The earlier
> GAMENOVA VAULT LLC reference in `routes/legal.ts` was a stale backend config
> value and has been corrected; all customer-facing legal pages already used
> CARDXC LLC. No Plaid integration exists in the repository.

## 1. Existing feature inventory (classification)

| Area | Status | Notes |
| --- | --- | --- |
| Auth (signup/signin/logout/reset, JWT+DB sessions, bcrypt-12, 2FA speakeasy) | EXISTS AND WORKS | HS256 pinned; hard-fail on missing secret; rate-limited; lockout |
| Admin RBAC (`requireRole('SUPER_ADMIN')`) | EXISTS AND WORKS | Applied at router scope on admin routers |
| Wallet / transactions / transfers | EXISTS AND WORKS | Integer cents; DB transactions; row locks on withdrawal/swap/gift-buy |
| Card checkout (Fluz) + card orders | EXISTS AND WORKS | Server-authoritative amount/currency |
| Stripe Checkout (embedded) + webhook | EXISTS AND WORKS | Hardened (see §3) |
| Deposit-OTP flow | EXISTS AND WORKS | Hashed OTP + constant-time compare |
| Gift cards (buy/sell via Fluz pricing) | EXISTS BUT UNSAFE → FIXED | Client-controlled price (P0) fixed this pass |
| Crypto deposit monitor (TronGrid) | EXISTS AND WORKS | Unique tx_hash + atomic claim; confirmation gate is partial |
| Crypto payout provider (`cryptoProviderService`) | EXISTS (default `manual`) | binance/coinbase/circle/trongrid/manual; not auto-triggered by card funds after fixes |
| Virtual cards (Stripe Issuing / Fluz) | EXISTS, PROVIDER-GATED | Falls back gracefully when unconfigured |
| KYC document upload | EXISTS BUT INCOMPLETE → HARDENED | Magic-byte validation added this pass |
| Health endpoints, audit logging, background jobs | EXISTS AND WORKS | — |
| Adyen (`VITE_ADYEN_CLIENT_KEY`, `paymentUtils.ts`) | DEAD / UNUSED | Client-only helper, not imported anywhere; no secret exposed |
| Plaid | DOES NOT EXIST | Re-scanned (plaid/link_token/PLAID_* etc.) — no implementation. OUT OF SCOPE — NEW FEATURE if desired. PLAID SANDBOX: NOT TESTABLE until a separate authorized Plaid task |

## 2. Providers discovered (current code)

| Provider | Files | Purpose | Status |
| --- | --- | --- | --- |
| Stripe | `services/stripeService.ts`, `routes/cardCheckout.ts`, `services/stripeIssuingService.ts` | Card deposit (Checkout) + webhooks; virtual-card issuing | Config-gated; **approval NOT VERIFIED** |
| Fluz | `services/fluzClient.ts` (REST), `services/fluzApi.ts` (GraphQL), `fluzMerchant.ts`, `giftCardPricingService.ts`, `cardProductService.ts` | Gift cards / card products / payout links | Config-gated; **approval NOT VERIFIED** |
| Crypto payout | `services/cryptoProviderService.ts` | USDT payout (binance/coinbase/circle/trongrid/manual) | Default `manual`; **approval/licensing NOT VERIFIED** |
| TronGrid | `services/tronDepositMonitor.ts`, `routes/crypto.ts` | On-chain USDT deposit monitoring | Read-only chain queries |
| SMTP/nodemailer | `services/emailService.ts` | Transactional email | — |

## 3. Findings and fixes (this pass)

Severity: P0 = critical financial/security; P1 = serious; P2 = important.

| ID | Sev | Category | File | Observed | Fix | Regression test | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DF-1 | P0 | Financial / client-controlled price | `routes/giftCards.ts` | Buy amount deducted used client `rate` (`totalCostCents = amountCents * rate/100`); `rate=1` → pay ~1% of face value | Server-authoritative pricing via `calculatePricing`; client `rate` ignored (buy→sell rate, sell→buy rate) | `__tests__/giftCardPricing.test.ts` | FIXED |
| DF-2 | P0 | Webhook forgery | `routes/cardCheckout.ts` (`/webhooks/payment`) | Provider webhook processed events (crediting wallets) when `FLUZ_WEBHOOK_SECRET` unset (fail-open) | Fail-closed: 503 when secret unset (mirrors Stripe) | `__tests__/providerWebhookFailClosed.test.ts` | FIXED |
| DF-3 | P0 | Stripe → stablecoin value | `routes/cardCheckout.ts`, `routes/depositOtp.ts` | Card/Stripe success auto-credited USDT + crypto ledger unconditionally | Gated behind `ENABLE_STABLECOIN_FULFILLMENT` (default off) across all paths | `__tests__/cardCheckoutStripeWebhook.test.ts` | FIXED (Stripe-safety branch) |
| DF-4 | P0 | Webhook fulfillment integrity | `routes/cardCheckout.ts` (`/webhooks/stripe`) | Credited without verifying `payment_status`/amount/currency | Require `payment_status==='paid'` + amount_total/currency match; else FAILED + audit | `cardCheckoutStripeWebhook.test.ts` | FIXED (Stripe-safety branch) |
| DF-5 | P1 | IDOR | `routes/cardCheckout.ts` (`/stripe-session/:id/status`) | Any authed user could read any session's status | Ownership check via `card_orders`; 404 otherwise | `__tests__/stripeSessionStatusIdor.test.ts` | FIXED |
| DF-6 | P1 | KYC enforcement | `routes/cardCheckout.ts` | KYC optional by default | Mandatory in production (`isKycRequiredForCardCheckout`) | `cardCheckoutStripeSession.test.ts` | FIXED (Stripe-safety branch) |
| DF-7 | P1 | Deceptive descriptors | `routes/cardCheckout.ts` | Randomized fake merchant names on completion | Honest `CardXC Wallet Deposit` / "Card deposit to CardXC wallet" | `cardCheckoutStripeWebhook.test.ts` | FIXED (Stripe-safety branch) |
| DF-8 | P2 | File upload / MIME spoofing | `routes/user.ts` (`/kyc/upload`) | Only declared MIME + size validated | Magic-byte content validation; delete + reject on mismatch | `lib/__tests__/fileSignature.test.ts` | FIXED |
| DF-9 | P1 | Dependency CVEs | `package-lock.json` | 33 advisories (2 critical/20 high) transitive via `ws`/`ethers`/`socket.io` | Non-forced `npm audit fix` → 5 remaining | full suite green | FIXED (partial) |

### Pre-merge remediation pass (2026-08-15) — the previously deferred items

| ID | Sev | Issue | Fix | Test | Status |
| --- | --- | --- | --- | --- | --- |
| PM-1 | P0 | TRON/TRC20 deposit credited without verifying on-chain confirmations | **Finality-corrected:** `getConfirmations()` now uses the **SolidityNode** endpoints `/walletsolidity/gettransactioninfobyid` + `/walletsolidity/getnowblock` (confirmed/irreversible state) and requires `receipt.result === 'SUCCESS'`; credit gated on ≥ `REQUIRED_CONFIRMATIONS`; **defensive re-check inside `creditUserDeposit`**; fail-closed (unknown/failed/not-solidified→0); `recheckPendingDeposits()` matures deposits; atomic claim + unique `tx_hash` + concurrent double-credit protection preserved | `depositConfirmations.test.ts` (full matrix) + `depositMonitor.test.ts` | FIXED |
| PM-2 | P1 | Google OAuth callback issued a session without a 2FA check (2FA bypass) | OAuth path does not create a session for `two_factor_enabled` accounts; redirects to complete standard email/password + authenticator login; audited. Fail-closed. (UX note below) | `oauth2faGate.test.ts` | FIXED |
| PM-3 | P1 | Socket.IO validated only at handshake; revoked/logged-out/expired sessions kept reading balance/transactions/admin stats on an open socket; admin check used non-existent role values | Handshake session validation (`authenticateSocketToken`) **plus** per-event `revalidateSocketSession()` before `get:balance`/`get:transactions`/`get:admin:stats` (re-checks DB session, refreshes role, emits `auth:revoked` + force-disconnects on failure); admin gate fixed to real `SUPER_ADMIN` role | `socketAuth.test.ts` (handshake + live-revocation) | FIXED |
| PM-4 | P2 | CSP hardening | **Re-verified (evidence):** `script-src 'unsafe-inline'` is required by inline `onload` CSS-swap handlers in `index.html` (3, still present) + the enforced `<meta>` CSP; removing it would break async font/icon loading (production impact). `style-src 'unsafe-inline'` is required by React inline style attributes. Exploitability of keeping it: **no reachable DOM-XSS sink** — `rg` finds no `dangerouslySetInnerHTML`/`innerHTML=` in `src/` — so this is defense-in-depth degradation, not an active exploit path. Safe narrowing applied: prod `connect-src` drops loopback `ws`. | build + browser smoke | CONDITIONAL (documented technical debt; full removal needs `'unsafe-hashes'`+per-handler hashes or external refactor with cross-browser/Safari verification) |
| PM-5 | P2 | 5 residual npm advisories | **Re-verified (evidence):** `esbuild` (moderate) = dev-server/Windows-only file read — not in prod runtime; `nodemailer` (high) `raw` option — `rg` confirms `raw` is not used; `ws` (high, ×2) via `ethers`/`tronweb` — crypto uses HTTPS `fetch`, not `ws` (socket.io's `ws` already patched). Only fixes available are **breaking** (`nodemailer@9.0.5`, `tronweb@6.0.2` via `--force`); no non-breaking fix exists. None prod-reachable. | n/a | CONDITIONAL (non-blocking technical debt; dedicated dependency-upgrade task with tests) |

### OAuth 2FA — UX implication (documented)
The OAuth 2FA gate (PM-2) is intentionally fail-closed. A user who signed up via Google is created with a random password they do not know (`auth.ts` sets a `crypto.randomBytes` password hash). If such a user later enables 2FA, the OAuth login path will no longer establish a session and redirects them to the standard email/password + authenticator flow — which they cannot complete without a password. **Expected user path:** use "Forgot password" to set a password, then sign in with password + authenticator code. This is a deliberate security trade-off; building a dedicated OAuth-2FA completion flow is a NEW FEATURE and is intentionally out of scope.

### Still deferred (documented, non-blocking technical debt)
- **Full CSP `'unsafe-inline'` removal** (script-src/style-src): evidence-backed blocker (inline `onload` handlers + `<meta>` CSP; React inline styles; no reachable XSS sink). Follow-up: `'unsafe-hashes'` + per-handler hashes or external refactor, verified in production mode across browsers incl. Safari.
- **5 npm advisories**: only breaking (`--force`) fixes exist and none are prod-reachable (see PM-5). Follow-up: dedicated dependency-upgrade task with a green suite before/after.
- **`realtimeService.ts`**: unused/dead code (not wired in `index.ts`); recommend removal in a cleanup PR.

## 4. Financial integrity status
Integer minor units throughout; critical mutations wrapped in DB transactions; idempotency keys (`stripe_<session>`, `card_<payment>`, `deposit_otp_<order>`) with a unique index; row locks on withdrawal/swap/gift-buy. After this pass, card/Stripe funds credit **only the fiat wallet** unless stablecoin fulfillment is explicitly enabled.

## 5. Auth/RBAC status
JWT HS256 pinned, DB-backed sessions, bcrypt-12, 2FA (speakeasy) verified on password sign-in, admin routers gated by `SUPER_ADMIN`. Known residuals (from prior audit, not regressions): OAuth login path does not enforce 2FA; Socket.IO auth does not re-check the DB session row.

## 6. Quality gates (this branch)
- `npm run type-check:all` — PASS
- `npm test` — PASS (112/112; +12 pre-merge regression tests)
- `npm run build` — PASS
- `npm run lint` — PASS (ESLint scope is `src/` only)
- `npm audit` / `npm audit --omit=dev` — 5 remaining (was 33); all require breaking `--force` bumps and are not prod-reachable (see PM-5)

## 7. Out of scope (new features — not built)
Plaid, any new provider/gateway, new products/pages/wallets/flows. If required: **OUT OF SCOPE — NEW FEATURE**.
