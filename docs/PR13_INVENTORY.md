# PR #13 Inventory — branch `cursor/cardxc-deep-fix-6a35`

Reconstructed by reading the branch code directly, not from prior summaries.

| Reference | Value |
| --- | --- |
| PR | #13 |
| Branch | `cursor/cardxc-deep-fix-6a35` |
| Branch HEAD | `baf0dd58f80af80f3a8ec23234ebd69846a73b09` (`baf0dd58`) |
| Merge base / `main` HEAD | `34108102ffecd7caf6baa7d84f1a13e0d6198857` (`34108102`) |
| Merged into `main`? | **No.** The branch is linear on top of `34108102`; `main` does not contain any of its commits. |
| Commits ahead of `main` | 22 (`3410810..baf0dd5`) |
| Diff size | 186 files changed, 8623 insertions, 8151 deletions (deletions are dominated by removed `attached_assets/` transcripts/screenshots and legacy `AUDIT_*.md` / `ROTATION_LIST.md` files) |
| Verification method | `git worktree` checkout of `baf0dd58` (read-only) + `git diff main..baf0dd58` per file. No test/build/lint/install command was run in this phase. |

> **Regression rule.** Every row marked "Security control — MUST NOT REGRESS" is a
> fail-closed or authorization control. Any later change that weakens it (including
> "temporarily", to make a build/test/deploy pass) requires explicit owner approval and a
> `DEVIN_CHANGE_MANIFEST.md` entry.

---

## 1. TRON/TRC-20 deposit attribution + confirmation gate

**Files:** `server/services/tronDepositMonitor.ts` (+304 / −? lines net, heavily rewritten),
tests `server/services/__tests__/depositAmountBinding.test.ts` (new, 168 lines),
`depositAttribution.test.ts` (new, 286 lines), `depositConfirmations.test.ts` (new, 242 lines),
plus the pre-existing `depositMonitor.test.ts`.

Verified in code:

- `const REQUIRED_CONFIRMATIONS = 20;` at `server/services/tronDepositMonitor.ts:10` —
  confirmed verbatim, including the constant name and the value `20`.
- The constant gates crediting in more than one place: the maturation pass
  (`if (confirmations >= REQUIRED_CONFIRMATIONS)`), the primary credit path, and a
  **defensive re-check inside the credit function** which rejects when
  `!Number.isFinite(confirmations) || confirmations < REQUIRED_CONFIRMATIONS`
  (fail-closed on unknown/failed/not-solidified state).
- Under-confirmed deposits are logged and held (`'Deposit under-confirmed, awaiting
  confirmations'`) rather than credited; `recheckPendingDeposits()` matures them later.
- Attribution ("FIN-1") binds an incoming on-chain transfer to a **unique
  `expected_amount` on an active, unexpired pending deposit intent** — because all users
  deposit into one shared hot wallet, the exact amount is the attribution key. When there is
  not exactly one candidate intent, `recordUnattributedDeposit()` holds the transfer for
  manual reconciliation instead of crediting a guess.
- The credited amount is the intent's `expected_amount` (falling back to the observed
  amount), not a client-supplied value.
- Atomic claim via `tx_hash` (set on the intent row, removing it from future attribution
  queries) preserves the earlier double-credit protection.

**Classification: Security control (financial integrity) — MUST NOT REGRESS.**
Lowering `REQUIRED_CONFIRMATIONS`, removing the defensive re-check, or crediting
unattributed transfers would reintroduce a direct fund-loss path.

## 2. Server-authoritative gift-card pricing

**Files:** `server/routes/giftCards.ts` (+84 lines net),
`server/services/giftCardPricingService.ts` (+294),
tests `server/routes/__tests__/giftCardPricing.test.ts`,
`server/routes/__tests__/giftCardBuyFailClosed.test.ts`,
`server/services/__tests__/giftCardPricingFloor.test.ts`;
frontend adjusted in `src/pages/giftcards/components/{GiftCardItem,PurchaseModal}.tsx`.

Verified in code: the route still accepts an optional `rate` body field for backward
compatibility but the handler explicitly ignores it — comment at
`server/routes/giftCards.ts:53-56`: "pricing is server-authoritative. Any client-supplied
`rate` is IGNORED; the applicable rate is derived from server pricing so a caller cannot set
their own price (e.g. rate=1 to pay ~1% of face value). Buy uses our sell rate; sell uses our
buy rate." Buy/sell paths compute cost and profit from the server rate inside a DB
transaction, and there is an explicit guard against selling at a loss or computing a charge
from a null rate (pricing floor).

Also verified: the wallet debit in this path is a guarded debit against **available** funds
(`balance_cents - COALESCE(reserved_cents, 0)`) with `FOR UPDATE`.

**Classification: Security control (financial integrity) — MUST NOT REGRESS.**

## 3. Fail-closed provider and Stripe webhooks

**File:** `server/routes/cardCheckout.ts` (293 lines changed),
tests `providerWebhookFailClosed.test.ts`, `cardCheckoutStripeWebhook.test.ts`,
`webhookAuthBeforeLog.test.ts`.

Verified in code:

- Provider (Fluz) webhook: `PROVIDER_WEBHOOK_SECRET = process.env.FLUZ_WEBHOOK_SECRET`;
  when unset the handler returns **503 before doing any work**
  (`server/routes/cardCheckout.ts:234`), with the comment "Fail-closed: a provider webhook
  secret is REQUIRED… processing an unsigned/forged event could credit arbitrary wallets."
- Authenticate-before-persist ordering: missing signature → 401, malformed body → 400, HMAC
  compared with a length guard + constant-time comparison, and nothing is written to
  `payment_webhook_logs` and no idempotency "already processed" oracle is answered before the
  HMAC verifies.
- Stripe webhook: `STRIPE_WEBHOOK_SECRET` is required in **all** environments
  (`cardCheckout.ts:893-921`) — unset → reject; otherwise the event is verified via
  `constructWebhookEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`.
- Fulfillment verification is fail-closed: crediting only occurs when Stripe reports the
  session paid (with amount/currency match); otherwise the order is failed and audited.

**Classification: Security control (webhook forgery / unauthenticated credit) — MUST NOT REGRESS.**

## 4. Fulfillment gating policy

**File:** `server/services/fulfillmentPolicy.ts` (new, 52 lines),
test `server/services/__tests__/fulfillmentPolicy.test.ts`; consumed by
`server/routes/cardCheckout.ts` and `server/routes/depositOtp.ts`.

Verified in code — all flags read at call time (not module load):

- `isStablecoinFulfillmentEnabled()` → `process.env.ENABLE_STABLECOIN_FULFILLMENT === 'true'`;
  **off unless explicitly enabled**, so card-funded deposits credit only the fiat wallet.
- `isKycRequiredForCardCheckout()` → **always `true` when `NODE_ENV === 'production'`**;
  opt-in elsewhere via `REQUIRE_KYC_FOR_CARD_CHECKOUT=true`.
- `isEmailVerificationRequiredForCardCheckout()` → on by default; only disabled by an
  explicit `REQUIRE_EMAIL_VERIFIED_FOR_CARD_CHECKOUT=false`.
- Honest descriptors: `DEPOSIT_MERCHANT_DISPLAY_NAME = 'CardXC Wallet Deposit'` and
  `depositDescription() === 'Card deposit to CardXC wallet'` — replacing previously
  randomized/fake merchant names.

**Classification: Security + compliance control — MUST NOT REGRESS.**
Note for provider work: any new on/off-ramp provider must route through this policy rather
than around it. Whether card-funded stablecoin purchase is permitted for this entity is
`OWNER INPUT REQUIRED` / `LEGAL REVIEW REQUIRED` — the code deliberately defaults to off.

## 5. OAuth 2FA gate

**File:** `server/routes/auth.ts` (+33 lines), test
`server/routes/__tests__/oauth2faGate.test.ts`.

Verified in code: the Google callback now selects `two_factor_enabled` and, when set, does
**not** establish a session — it records a failed attempt (`TWO_FACTOR_REQUIRED`), logs a
`LOGIN_BLOCKED` security event, writes an audit log
(`USER_LOGIN_GOOGLE_2FA_REQUIRED`) and redirects to `/signin?...&require_2fa=1`. Comment:
"if the account has 2FA enabled, the OAuth (IdP) assertion is NOT sufficient on its own".

Known UX consequence (documented on the branch in `docs/CARDXC_DEEP_FIX_AUDIT.md`, verified
here as still applicable): a Google-created account has a random password the user does not
know, so such a user with 2FA enabled must use "Forgot password" before they can sign in.
A dedicated OAuth-2FA completion flow is **not** implemented — `OWNER INPUT REQUIRED` if it
should be built.

Same file also tightened `fullName` validation on signup (length cap + no control
characters, via `isValidFullName` from `server/lib/aiPrompt.ts`) because `full_name` reaches
the AI context block — an injection-hardening control, tests `signupFullName.test.ts`,
`legacyFullName.test.ts`, `aiPrompt.test.ts`.

**Classification: Security control (2FA bypass) — MUST NOT REGRESS.**

## 6. Stripe session-status IDOR fix

**File:** `server/routes/cardCheckout.ts:855-890`, test
`server/routes/__tests__/stripeSessionStatusIdor.test.ts`.

Verified in code: `GET /checkout/stripe-session/:sessionId/status` looks up `card_orders` by
`provider_payment_id` and requires the caller to be the order's `user_id`,
`target_user_id`, or `created_by_user_id` (or `SUPER_ADMIN`); otherwise it throws a **404**
("so we don't reveal whether an arbitrary session id exists").

**Classification: Security control (IDOR / information disclosure) — MUST NOT REGRESS.**

## 7. Legal entity name

**File:** `server/routes/legal.ts` (4 lines changed).

Verified in code: `const COMPANY_NAME = 'CARDXC LLC';` at `server/routes/legal.ts:7`,
replacing the stale backend value. Customer-facing legal pages already used CARDXC LLC.

**Classification: Compliance/legal content — `LEGAL REVIEW REQUIRED` before any further
change** (not a technical security control, but listed in
`DO_NOT_TOUCH_WITHOUT_APPROVAL.md` #15).

## 8. Reserved funds, admin approval, fraud fail-closed

- **Reserved-funds-aware debits.** Verified: guarded debits now subtract reserved funds
  before checking availability — `server/routes/cards.ts:511-516`
  (`WHERE … balance_cents - COALESCE(reserved_cents, 0) >= $1`, comment: prevents spending
  funds "reserved by a pending withdrawal") and the same pattern in
  `server/routes/giftCards.ts:92-105` with `FOR UPDATE`. Test
  `server/routes/__tests__/reservedFundsDebit.test.ts` (new, 149 lines).
  **Security control (financial integrity) — MUST NOT REGRESS.**
- **Admin withdrawal approval.** Verified in `server/routes/admin.ts:473-497`: the guarded
  debit's `rowCount` must be exactly 1; otherwise it logs and throws
  `INSUFFICIENT_BALANCE`, rolling back the whole approval so the withdrawal stays `pending`
  and its transaction is not marked `SUCCESS`. Related release-of-reserve double-release
  guard at `admin.ts:533-545`. Test `adminWithdrawalApproval.test.ts` (new, 147 lines).
  **Security control (financial integrity) — MUST NOT REGRESS.**
- **Fraud engine fail-closed.** Verified in `server/services/fraudService.ts`:
  `checkLoginVelocity()` now returns `{ allowed: false, reason: 'Security checks are
  temporarily unavailable…' }` on error (was `allowed: true`), and `runFraudChecks()` returns
  `{ passed: false, flags: ['FRAUD_CHECK_ERROR'], score: 100 }` on error (was
  `passed: true`). Test `fraudFailClosed.test.ts` (new, 86 lines).
  **Security control (brute-force / unscreened transactions during outage) — MUST NOT REGRESS.**

## 9. Other hardening on the branch (verified present, same must-not-regress posture)

| Item | Evidence |
| --- | --- |
| KYC upload magic-byte validation | `server/lib/fileSignature.ts` (new) + `server/routes/user.ts`, test `fileSignature.test.ts` |
| Socket.IO session re-validation per event + real `SUPER_ADMIN` admin gate | `server/services/socketService.ts` (+216), test `socketAuth.test.ts` (227 lines) |
| MCP auth + SQL guard, CORS origin allow-list, AI prompt/stream hardening, rate-limit additions | `mcp-server/mcp-auth.js` (new), `server/lib/{corsOrigin,aiPrompt,tokenAmount}.ts` (new) + tests, `server/routes/ai.ts` (+157), `server/middleware/rateLimit.ts`, `server/index.ts` (+70) |
| AI usage accounting with concurrency safety | `server/services/aiUsageService.ts` (new, 144) + `aiUsageConcurrency.test.ts` |
| Env-contract enforcement script | `scripts/ensure-env.sh` (new) + `scripts/__tests__/ensureEnv.test.ts` |
| Secret-bearing files untracked / `.env.production.example` placeholders | `.gitignore` (+8), `.env.production.example` (+48) |
| Withdrawal / swap / background-job hardening | `server/services/{withdrawalService,swapService,backgroundJobs,stripeService}.ts` |

## 10. Dependency audit reductions

**File:** `package-lock.json` (1254 lines changed), `package.json` (one line:
`nodemailer ^8.0.1 → ^9.0.5`), documented in `docs/CARDXC_DEEP_FIX_AUDIT.md` on the branch.

The branch's own audit document records advisories going **33 → 5** via a non-forced
`npm audit fix`, with the remaining five (esbuild dev-only, nodemailer `raw` unused, `ws` ×2
via `ethers`/`tronweb`) argued as not production-reachable and only fixable by breaking bumps.

**`NOT VERIFIED` in this phase:** no `npm install` or `npm audit` was executed here, so the
33 → 5 numbers are reproduced from the branch's document, not independently confirmed. The
`nodemailer` major bump to `^9.0.5` in `package.json` is verified as present in the diff.

## 11. Documentation added by PR #13 (do not duplicate or overwrite)

`docs/CARDXC_DEEP_FIX_AUDIT.md`, `docs/PAYMENT_GATEWAY_MASTER_READINESS.md`,
`docs/PROVIDER_APPLICATION_FACTS.md`, `docs/payment-provider-readiness.md`,
plus `README.md` / `SECURITY.md` / `DEVELOPMENT.md` additions. These exist only on
`cursor/cardxc-deep-fix-6a35`, not on `main`. The docs added in the current phase use
different filenames and therefore do not conflict.

## 12. Deletions performed by PR #13 (context for reviewers)

PR #13 removed the legacy root-level audit files (`AUDIT_ENV.md`, `AUDIT_REPORT.md`,
`AUDIT_SERVER.md`, `AUDIT_SRC.md`, `ROTATION_LIST.md`), a stray `sedYboWRx` file, and a large
set of `attached_assets/` screenshots/transcripts. Those deletions are part of the protected
PR #13 work and were **not** replicated, reverted, or otherwise touched in this phase; the
files still exist on `main`.

## 13. Test-suite surface added by PR #13

New/updated test files on the branch (not executed in this phase):
`adminWithdrawalApproval`, `aiRouteHardening`, `aiStreamAbort`, `cardCheckoutStripeSession`,
`cardCheckoutStripeWebhook`, `giftCardBuyFailClosed`, `giftCardPricing`, `legacyFullName`,
`oauth2faGate`, `paymentsOverdraw` (updated), `providerWebhookFailClosed`,
`reservedFundsDebit`, `savingsVault` (updated), `signupFullName`,
`stripeSessionStatusIdor`, `webhookAuthBeforeLog`, `aiUsageConcurrency`, `aiUsageService`,
`depositAmountBinding`, `depositAttribution`, `depositConfirmations`, `emailService`,
`fraudFailClosed`, `fulfillmentPolicy`, `giftCardPricingFloor`, `socketAuth`,
`aiPrompt`, `corsOrigin`, `fileSignature`, `mcpAuth`, `mcpSqlGuard`, `tokenAmount`,
`ensureEnv`.

These are the regression tests protecting the controls above. **Deleting, skipping, or
weakening any of them requires owner approval.**
