# CardXC — Per-Provider Readiness Matrix

**Date:** 2026-08-15
**Rule reminder:** API integration ≠ approval (Rule 13). Provider policies below are **general, well-known categories** and are marked where official research could not be retrieved in this environment. Confirm each against the provider's current official documentation before applying.

> **Official research status:** Live provider-policy fetching was **not available/verified** in this environment (external fetch timed out). Treat policy rows as "OFFICIAL RESEARCH NOT CONFIRMED — verify at the provider's official docs." No provider policy is asserted as fact here.

## 1. Stripe (Checkout + Webhooks + Issuing)

- **Purpose:** Card acceptance for wallet deposits (embedded Checkout); virtual-card issuing (`stripeIssuingService`).
- **Integration files:** `services/stripeService.ts`, `routes/cardCheckout.ts`, `services/stripeIssuingService.ts`, `routes/cards.ts`.
- **Current status:** SANDBOX/UNKNOWN (keys are env-provided; not inspected per Rule 9).
- **Approval:** NOT VERIFIED.
- **Current CardXC flow:** Customer → Stripe Checkout → webhook (verified) → CardXC fiat wallet credit. USDT auto-credit disabled by default.
- **Business restrictions (verify officially):** wallet/stored-value, crypto/stablecoin on-ramp, money transmission, and prepaid/gift are commonly **restricted or prohibited** for standard Stripe accounts; Issuing and crypto have separate programs/approvals.
- **Crypto/stablecoin policy:** ORANGE/RED — REQUIRES explicit Stripe review/approval; keep `ENABLE_STABLECOIN_FULFILLMENT=false` until approved.
- **Does CardXC flow match public description?** PARTIAL — legal entity resolved (CARDXC LLC); still reconcile wallet/crypto representation with the provider's underwriting.
- **Missing technical items:** live `STRIPE_WEBHOOK_SECRET` in prod; end-to-end test-mode charge verification; crypto confirmation gating if crypto is enabled.
- **Missing business/docs:** KYB, beneficial owners, bank account — OWNER INPUT REQUIRED.
- **Technical readiness:** CONDITIONAL. **Business-model readiness:** RESTRICTED REVIEW.

## 2. Fluz (gift cards / card products)

- **Purpose:** Gift-card & card-product catalog, pricing, payout links.
- **Integration files:** `services/fluzClient.ts`, `services/fluzApi.ts`, `services/fluzMerchant.ts`, `services/giftCardPricingService.ts`, `services/cardProductService.ts`, `routes/fluz.ts`, `routes/cardCheckout.ts`.
- **Current status:** UNKNOWN (config-gated; single shared platform account per code comments; sensitive ops gated to SUPER_ADMIN).
- **Approval:** NOT VERIFIED.
- **Webhook:** `/api/webhooks/payment` — now **fail-closed** (requires `FLUZ_WEBHOOK_SECRET`), signature-verified, idempotent.
- **Business restrictions (verify officially):** gift-card/prepaid supply and third-party fulfillment terms per Fluz agreement.
- **Missing:** provider agreement/approval evidence; `FLUZ_WEBHOOK_SECRET` in prod.
- **Technical readiness:** CONDITIONAL. **Business-model readiness:** RESTRICTED REVIEW.

## 3. Crypto payout providers (`cryptoProviderService`)

- **Purpose:** Send USDT to user wallets (payout/off-ramp).
- **Providers supported in code:** `binance_pay`, `coinbase_commerce`, `circle`, `trongrid`, `manual` (default `manual`).
- **Integration files:** `services/cryptoProviderService.ts`, `routes/withdrawal.ts`, `routes/crypto.ts`.
- **Current status:** Default `manual`; live providers UNKNOWN.
- **Approval/licensing:** NOT VERIFIED — crypto/stablecoin transmission commonly requires **money-transmitter / virtual-currency licensing** — LEGAL REVIEW REQUIRED; EXTERNAL BLOCKER.
- **Crypto/stablecoin policy:** RED — money transmission / VASP obligations likely apply.
- **Technical readiness:** CONDITIONAL (address validation present). **Business-model readiness:** BLOCKED pending licensing/approval.

## 4. TronGrid (deposit monitoring)

- **Purpose:** Read-only on-chain USDT (TRC20) deposit detection.
- **Integration files:** `services/tronDepositMonitor.ts`, `routes/crypto.ts`.
- **Current status:** Read-only chain queries to fixed host; double-credit protection (unique tx_hash + atomic claim).
- **Gap:** confirmation-count gate not enforced before credit (financial-behavior change — approval required).
- **Business-model readiness:** tied to crypto licensing (see #3).

## 5. SMTP / nodemailer (transactional email)

- **Purpose:** OTP / deposit-success / notification email.
- **Status:** Config-gated; not a payment provider. Advisory: pending `nodemailer` advisory (raw-option) — verify `raw` not used with untrusted input.

## 6. Plaid — NOT PRESENT

Re-scanned the repository (`plaid`, `link_token`, `PlaidLink`, `usePlaidLink`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`) — **no Plaid implementation exists**. OUT OF SCOPE — NEW FEATURE. **PLAID SANDBOX: NOT TESTABLE** until a separate authorized Plaid sandbox integration task. Sandbox access ≠ production approval.

## Summary

| Provider | Technical readiness | Business-model readiness |
| --- | --- | --- |
| Stripe | CONDITIONAL | RESTRICTED REVIEW |
| Fluz | CONDITIONAL | RESTRICTED REVIEW |
| Crypto payout | CONDITIONAL | BLOCKED (licensing) |
| TronGrid | CONDITIONAL | tied to crypto licensing |
| SMTP | N/A | N/A |

All business-model readiness items require EXTERNAL PROVIDER APPROVAL and/or LEGAL REVIEW and cannot be resolved by code.
