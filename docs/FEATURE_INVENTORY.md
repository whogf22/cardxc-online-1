# Feature Inventory (existing customer + admin features)

Scope: repository `whogf22/cardxc-online-1` at `main` = `34108102`, cross-checked against
branch `cursor/cardxc-deep-fix-6a35` = `baf0dd58` (PR #13) where PR #13 changes the posture
of a feature. Determined by reading `server/routes/`, `server/services/`, `src/pages/`, and
`src/router/config.tsx`. **No feature was executed, exercised, or tested in this phase** —
"exists" means "implemented in code", not "verified working at runtime".

Classification legend:

| Class | Meaning |
| --- | --- |
| **KEEP** | Exists, no known defect or policy problem; leave as-is. |
| **KEEP_AND_FIX** | Exists but has a known gap/defect that should be fixed without changing scope. |
| **KEEP_BUT_GATE** | Exists but must stay behind a flag, role gate, provider approval, or KYC/compliance gate. |
| **DEPRECATE_WITH_APPROVAL** | Appears unused/dead; propose retirement only with owner approval. |
| **REMOVE_WITH_APPROVAL** | Candidate for removal; requires owner approval (nothing is removed in this phase). |

Uncertainty labels used below: `NOT VERIFIED`, `OWNER INPUT REQUIRED`,
`LEGAL REVIEW REQUIRED`, `PROVIDER CONFIRMATION REQUIRED`.

---

## 1. Customer features

| Feature | Where (evidence) | Class | Notes |
| --- | --- | --- | --- |
| Authentication (signup, signin, sessions, logout, password reset, email verification) | `server/routes/auth.ts` (`/signup`, `/signin`, `/session`, `/sessions`, `/password-reset/*`, `/change-password`); `src/pages/{signin,signup,forgot-password,reset-password,verify-email}` | KEEP | JWT + DB-backed sessions; PR #13 adds `fullName` control-char/length validation. |
| Google OAuth sign-in | `server/routes/auth.ts` (`/google`, `/google/callback`, `/google-status`); `src/pages/auth` (`/auth/callback`) | KEEP_BUT_GATE | PR #13 makes the OAuth path fail closed when 2FA is enabled (no session issued). Whether to build a dedicated OAuth+2FA completion flow is `OWNER INPUT REQUIRED`. |
| 2FA (TOTP) | `server/routes/auth.ts` (`/2fa/setup`, `/2fa/verify`, `/2fa/disable`); `server/services/twoFactorService.ts`; `src/pages/profile/security` | KEEP | Security control; see `PR13_INVENTORY.md` §5. |
| Phone OTP verification | `server/routes/auth.ts` (`/request-phone-otp`, `/verify-phone`) | KEEP_AND_FIX | Exists; delivery provider and production behavior `NOT VERIFIED`. |
| Profile + preferences (personal, payments, security, accessibility, language, notifications, privacy) | `server/routes/user.ts` (`/profile`), `server/routes/preferences.ts`; `src/pages/profile/*` | KEEP | |
| Trusted devices / activity log | `server/routes/preferences.ts` (`/devices`, `/devices/:id/trust`, `/activity`); `server/services/deviceService.ts` | KEEP | |
| Dashboard | `src/pages/dashboard/*` (incl. `PortfolioSection`, `PlatformTransferModal`), `/dashboard`, `/dashboard/data` | KEEP | |
| Wallets and balances (fiat cents + `usdt_balance_cents`, reserved funds) | `server/routes/user.ts` (`/wallets`), `server/routes/admin.ts` wallet views, `src/pages/wallet/*` (`BalanceCards`) | KEEP | Guarded debits net of `reserved_cents` (PR #13 §8). |
| Transactions / history / receipts | `server/routes/transactions.ts` (`/history`, `/`, `/:id`), `server/services/transactionHistoryService.ts`; `src/pages/transactions` | KEEP | |
| Spending insights + export | `server/routes/insights.ts` (`/spending-by-category`, `/monthly-trend`, `/top-merchants`, `/summary`, `/export`) | KEEP | |
| Card checkout (Fluz card products) | `server/routes/cardCheckout.ts` (`/card-products`, `/card`); `server/services/cardProductService.ts`; `src/pages/checkout` | KEEP_BUT_GATE | Provider-config gated; `PROVIDER CONFIRMATION REQUIRED` for production use. |
| Stripe Checkout deposit (embedded) + session status | `server/routes/cardCheckout.ts` (`/stripe-config`, `/stripe-session`, `/stripe-session/:id/status`), `server/services/stripeService.ts`; `src/pages/wallet/components/DepositModal.tsx` | KEEP_BUT_GATE | KYC mandatory in production, email verification on by default, stablecoin fulfillment off by default (`server/services/fulfillmentPolicy.ts`). IDOR fix must not regress. |
| Deposit OTP (email OTP for card deposits) | `server/routes/depositOtp.ts`, mounted at `/api/deposit-otp` | KEEP | Hashed OTP + constant-time compare (per PR #13 audit; `NOT VERIFIED` by execution). |
| Virtual cards — platform (Stripe Issuing / local fallback) | `server/routes/cards.ts` (`/`, `/:id/reveal`, freeze/unfreeze, spending-limit, block-merchant, category-limit, `/:id/top-up`, `DELETE /:id`), `server/services/stripeIssuingService.ts`; `src/pages/cards`, `/create-virtual-card` | KEEP_BUT_GATE | Falls back to local-only records when the provider is unconfigured; `PROVIDER CONFIRMATION REQUIRED` for live issuing. |
| Virtual cards — Fluz-backed | `server/routes/fluz.ts` (`/virtual-cards*`, incl. reveal, lock/unlock, bulk); `src/pages/fluz/*` | KEEP_BUT_GATE | Single **shared** provider account; PR #10/#13 gate shared-account endpoints behind `SUPER_ADMIN`. Do not un-gate. |
| Transfers (platform/internal) | `server/routes/transactions.ts` (`/transfer`), `src/pages/transfer`, `PlatformTransferModal` | KEEP | |
| P2P transfer | `server/routes/payments.ts` (`/p2p/transfer`); `src/pages/payments` | KEEP | Guarded-debit + overdraw regression tests exist (`paymentsOverdraw.test.ts`). |
| Payment links | `server/routes/payments.ts` (`/payment-links`, `/payment-links/:code/public`, `/payment-links/:code/pay`), `src/lib/api.ts`, `src/pages/payments` | KEEP_AND_FIX | Public unauthenticated pay path — abuse/rate-limit posture `NOT VERIFIED`. |
| QR payments | `server/routes/payments.ts` (`/qr/generate`, `/qr/:code/pay`) | KEEP | |
| Recurring payments | `server/routes/payments.ts` (`/recurring` GET/POST/DELETE), `server/services/backgroundJobs.ts` | KEEP_AND_FIX | Scheduler correctness in production `NOT VERIFIED`. |
| Split bills | `server/routes/payments.ts` (`/split`, `/splits`, `/splits/:id/pay`), `server/db/init.ts` split tables | KEEP | |
| Crypto deposits (USDT/TRC-20) | `server/routes/crypto.ts` (`/config`, `/deposit/intent`, `/deposit/:id/status`, `/tx/:txHash`), `server/services/tronDepositMonitor.ts`; `src/pages/wallet/components/CryptoDepositModal.tsx` | KEEP_BUT_GATE | 20-confirmation gate + exact-amount attribution (PR #13 §1) must not regress. Shared hot wallet — operationally sensitive. |
| Crypto withdrawals / payouts | `server/routes/withdrawal.ts`, `server/services/{withdrawalService,cryptoProviderService}.ts`; `CryptoWithdrawModal.tsx` | KEEP_BUT_GATE | Payout provider defaults to `manual`; admin approval required. Licensing posture `LEGAL REVIEW REQUIRED`. |
| Stablecoin (USDT) balance + fulfillment from card funds | `usdt_balance_cents` across wallet/dashboard UI; `server/services/fulfillmentPolicy.ts` | KEEP_BUT_GATE | Card→stablecoin fulfillment is OFF unless `ENABLE_STABLECOIN_FULFILLMENT=true`. Enabling it is `LEGAL REVIEW REQUIRED` + `OWNER INPUT REQUIRED`. |
| Swap (fiat ↔ USDT) | `server/routes/swap.ts` (`/rates`, `/balances`, `/quote`, `/execute`), `server/services/swapService.ts`; `src/pages/swap` | KEEP_BUT_GATE | Row-locked execution; rate source and spread policy `OWNER INPUT REQUIRED`. |
| Gift cards (buy/sell requests, products, my gift cards) | `server/routes/giftCards.ts` (`/products`, `/requests`), `server/services/giftCardPricingService.ts`; `src/pages/giftcards` | KEEP_BUT_GATE | Server-authoritative pricing (PR #13 §2) must not regress; provider-backed. |
| Rewards / cashback / subscriptions detection | `server/routes/rewards.ts` (`/`, `/cashback`, `/referral`, `/subscriptions*`, `/subscriptions/detect`); `src/pages/rewards` | KEEP | Cashback funding source and rates `OWNER INPUT REQUIRED`. |
| Referrals | `server/routes/referrals.ts` (`/`, `/list`, `/validate/:code`), `server/routes/rewards.ts` (`/referral/apply`); `src/pages/referral` | KEEP | Double-payout race previously fixed on `main`. |
| Fluz referral info | `server/routes/fluz.ts` (`/referral/info`, `/referral/url/:merchantId`); `src/pages/fluz/referral` | KEEP_BUT_GATE | Shared-account endpoint — `SUPER_ADMIN` gated; keep gated. |
| Savings vaults, round-ups, budgets, alerts, analytics | `server/routes/savings.ts` (`/vaults*`, `/roundup`, `/budgets*`, `/analytics`, `/alerts*`); `src/pages/savings` | KEEP | Atomic guarded debits; `savingsVault.test.ts`. |
| Address book / withdrawal addresses | `server/routes/fluz.ts` (`/addresses`), `src/pages/{address,address-book}`, `/fluz/addresses` | KEEP_BUT_GATE | Shared-account address endpoints gated to admin scope; keep gated. |
| KYC document upload + status | `server/routes/user.ts` (`/kyc/upload`, `/kyc/status`), `server/lib/fileSignature.ts` (PR #13); admin `PUT /users/:userId/kyc-status` | KEEP_AND_FIX | Magic-byte validation added by PR #13. No third-party identity verification provider exists — a real IDV integration is a NEW FEATURE, `OWNER INPUT REQUIRED` + `LEGAL REVIEW REQUIRED`. |
| Notifications (in-app) | `server/routes/notifications.ts`, `server/services/notificationService.ts`; `src/pages/notifications` | KEEP | |
| Real-time updates (Socket.IO) | `server/services/socketService.ts` | KEEP | PR #13 adds per-event session revalidation + real `SUPER_ADMIN` gate; must not regress. |
| Transactional email | `server/services/{emailService,emailTemplates}.ts` | KEEP | SMTP configuration `NOT VERIFIED`. |
| AI assistant / chat | `server/routes/ai.ts` (`/conversations*`), `server/services/aiUsageService.ts` (PR #13) | KEEP_BUT_GATE | Prompt-injection hardening + per-user usage budget added on PR #13; keep budget/rate limits. |
| Support / contact | `server/routes/support.ts` (`GET /contact`); `src/pages/support` | KEEP_AND_FIX | Backend exposes contact info only — there is no ticketing/case backend. A support inbox/ticketing system is a NEW FEATURE, `OWNER INPUT REQUIRED`. |
| Onboarding flow | `src/pages/onboarding` | KEEP | |
| Marketing/public pages (home, how-it-works, features, merchants, calculator) | `src/pages/{home,how-it-works,feature,merchants,calculator}` | KEEP | Product/marketing claims `LEGAL REVIEW REQUIRED`. |
| Legal pages (terms, privacy, refund, AML) | `server/routes/legal.ts` (`/terms`, `/privacy`, `/refund`); `src/pages/{terms,privacy,refund-policy,aml-policy}` | KEEP_BUT_GATE | Entity = `CARDXC LLC`. Any wording change is `LEGAL REVIEW REQUIRED`. |
| Checkout simulation page | `src/pages/checkout` route `/checkout/simulate/:id` | KEEP_BUT_GATE | Confirm it is not reachable/usable in production — `NOT VERIFIED`, `OWNER INPUT REQUIRED`. |

## 2. Admin features

| Feature | Where (evidence) | Class | Notes |
| --- | --- | --- | --- |
| Admin login + dashboard | `src/pages/{admin-login,admin-dashboard}`, `/admin-operations`; routers gated by `requireRole('SUPER_ADMIN')` | KEEP_BUT_GATE | Keep router-scope RBAC. |
| User management (list, export, create, view, status, password reset, role, KYC status) | `server/routes/admin.ts` (`/users*`, `/users/export`, `/users/:id/{status,password,role,kyc-status}`) | KEEP_BUT_GATE | High-privilege; every action must stay audited. |
| Wallet views + per-user balance | `server/routes/admin.ts` (`/wallets`, `/users/:userId/balance`, `/local-user-db`) | KEEP_BUT_GATE | |
| Withdrawal approval / rejection | `server/routes/admin.ts` (`/withdrawals`, `/withdrawals/:id/{approve,reject}`) | KEEP | PR #13 adds strict `rowCount === 1` guarded-debit check + reserve double-release guard; must not regress. |
| Manual wallet adjustments with approval workflow | `server/routes/admin.ts` (`/adjustments`, `/adjustments/:id/{approve,reject}`) | KEEP_BUT_GATE | Direct ledger impact — see `DO_NOT_TOUCH_WITHOUT_APPROVAL.md` #13. |
| Admin transactions view | `server/routes/admin.ts` (`/transactions`) | KEEP | |
| Audit logs + export | `server/routes/admin.ts` (`/audit-logs`, `/audit-logs/export`), `server/services/auditService.ts` | KEEP | Append-only expectation; do not add delete paths. |
| Fraud flags + review | `server/routes/admin.ts` (`/fraud-flags`, `/fraud-flags/:id/review`), `server/services/fraudService.ts` | KEEP | Fail-closed behavior (PR #13 §8) must not regress. |
| Provider/Stripe status views | `server/routes/admin.ts` (`/stripe-status`, `/payment-provider-status`), `server/routes/health.ts` (`/provider`) | KEEP | |
| Admin card-deposit intents | `server/routes/admin.ts` (`/card-deposit/create-intent`, `/card-deposit/confirm`) | KEEP_BUT_GATE | Admin-initiated money movement; keep audited + `SUPER_ADMIN`. |
| Gift-card request queue | `server/routes/admin.ts` (`/gift-card-requests`) | KEEP | |
| Analytics (dashboard, signups, volume, revenue, top users, geographic, pending) | `server/routes/adminAnalytics.ts` | KEEP | |
| Security console (failed logins, IP blacklist, sessions, force-logout, lock/unlock account, audit) | `server/routes/adminSecurity.ts` | KEEP_BUT_GATE | |
| Super-admin payments router | mounted at `/api/super-admin/payments` (`server/index.ts:321`) | KEEP_BUT_GATE | |
| Health / readiness / version endpoints | `server/routes/health.ts` | KEEP | |
| Shared Fluz account operations (transactions, merchants, offers, catalog, bulk orders, hot-wallet balance) | `server/routes/fluz.ts`, `server/routes/crypto.ts` (`/wallet/balance`) | KEEP_BUT_GATE | Explicitly `SUPER_ADMIN`-gated by earlier remediation; **do not** re-expose to customers. |
| MCP server (tooling/integration) | `mcp-server/` (`http-server.js`, `mcp-auth.js` on PR #13) | KEEP_BUT_GATE | Auth + SQL guard added on PR #13. Should not be exposed publicly — deployment posture `NOT VERIFIED`. |

## 3. Present-but-unused / questionable (nothing removed in this phase)

| Item | Evidence | Class | Notes |
| --- | --- | --- | --- |
| `server/services/realtimeService.ts` | Not referenced from `server/index.ts` | DEPRECATE_WITH_APPROVAL | PR #13's audit flags it as dead code. Keep until owner approves removal. |
| Adyen client helper (`VITE_ADYEN_CLIENT_KEY`, `paymentUtils.ts`) | Flagged in PR #13 audit as unused client-only helper | DEPRECATE_WITH_APPROVAL | `NOT VERIFIED` in this phase beyond the branch audit note. |
| `server/services/reloadlyService.ts` | Service file present; wiring to routes `NOT VERIFIED` | KEEP_BUT_GATE | Determine whether Reloadly is an active provider — `PROVIDER CONFIRMATION REQUIRED`. |
| Legacy root audit docs (`AUDIT_*.md`, `ROTATION_LIST.md`) and `attached_assets/` transcripts on `main` | Present on `main`; deleted by PR #13 | REMOVE_WITH_APPROVAL | Already handled by PR #13; do not duplicate that deletion outside the PR. |
| `sedYboWRx` stray file on `main` | Repo root | REMOVE_WITH_APPROVAL | Deleted by PR #13. |

## 4. Explicitly absent (do not assume otherwise)

- **NFT features / references:** a case-insensitive search for `nft` across `server/` and
  `src/` returns **no matches** at `main`. Nothing NFT-related exists to preserve or delete.
  (`NOT VERIFIED` for other branches.)
- **Plaid:** no implementation (consistent with PR #13's audit). Adding it is a NEW FEATURE.
- **Privy, Meld, Crossmint, Daimo:** **no code, config, env var, or dependency exists** for
  any of them at `main` or on `baf0dd58`. All four are NEW FEATURES requiring an approved
  plan; `PROVIDER CONFIRMATION REQUIRED` and `LEGAL REVIEW REQUIRED`.
- **Ticketing/case-management support backend:** absent (see support row above).
- **Third-party identity-verification (IDV) provider:** absent; KYC is manual document
  upload + admin status change.

## 5. Runtime verification status

`NOT VERIFIED` for every row: no server was started, no test/build/lint/`npm install` was
run, and no database or provider sandbox was contacted during this phase. The only recorded
quality-gate baseline is PR #13's own claim in `docs/CARDXC_DEEP_FIX_AUDIT.md`
(branch-only): `type-check:all` PASS, `npm test` PASS 112/112, `build` PASS, `lint` PASS,
`npm audit` 5 remaining — reproduced here, not re-verified.
