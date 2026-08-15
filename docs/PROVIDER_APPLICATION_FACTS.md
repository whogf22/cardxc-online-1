# CardXC — Provider Application Facts (single source of truth)

**Date:** 2026-08-15
**Purpose:** Consistent, truthful facts for any payment-provider application. Populate ONLY verified values. Unverified items are explicitly marked and must be completed by the business owner / legal counsel. Do **not** substitute guesses (Rules 10, 24, 32, 52).

## Verified-from-code (technical) facts

| Field | Value (from current code) |
| --- | --- |
| Brand / trading name | CardXC (`cardxc.online`) |
| Legal entity | **CONFLICT — HUMAN VERIFICATION REQUIRED**: `routes/legal.ts` → "GAMENOVA VAULT LLC (operating as CardXC)"; `src/pages/terms/page.tsx` → "CARDXC LLC" |
| Website | https://cardxc.online (live status NOT VERIFIED from this environment) |
| Support email | support@cardxc.online (referenced in `routes/legal.ts`; deliverability NOT VERIFIED) |
| Legal/privacy email | legal@cardxc.online / privacy@cardxc.online (referenced) |
| Existing products | Digital wallet (fiat balance), card-funded deposits, gift cards (Fluz), virtual cards (Stripe Issuing / Fluz), P2P transfers, payment links, QR payments, crypto (USDT) deposit monitoring + payout, savings, rewards |
| Customer payment flow (card deposit) | Customer pays via Stripe Checkout (embedded) → Stripe captures → webhook verifies payment_status/amount/currency → CardXC credits the customer's **fiat** wallet balance |
| Stablecoin/crypto fulfillment | **Disabled by default** (`ENABLE_STABLECOIN_FULFILLMENT=false`); no card-funded USDT creation unless explicitly enabled with approval |
| CardXC role | Operates the wallet/app; integrates Stripe (card acceptance), Fluz (gift/card products), crypto providers (payout), TronGrid (deposit monitoring) |
| Provider roles | Stripe = card acquiring/checkout + issuing; Fluz = gift-card/card supplier; crypto providers = payout rails; TronGrid = chain data |
| Currencies | USD, EUR, GBP (validated server-side) |
| Fulfillment timing | Wallet credited on verified payment (synchronous for Stripe/webhook); asynchronous flows are not presented as "instant" |
| Refund behavior | Referenced in Terms; no dedicated automated card-refund flow verified in code |
| KYC requirement | Enforced for card checkout in production (email verified + KYC approved) |

## Money-flow classifications (honest)

| Flow | Classification | Custody / value |
| --- | --- | --- |
| Card deposit → fiat wallet | WALLET FUNDING / STORED VALUE | CardXC takes custody of stored value |
| Card/USDT → gift card (Fluz) | GIFT CARDS / DIGITAL GOODS (3rd-party supplier) | Fluz fulfills |
| USDT deposit (TronGrid) / payout | CRYPTOCURRENCY / STABLECOIN | On/off-ramp + transmission |
| Virtual card issuance | VIRTUAL CARDS (Stripe Issuing / Fluz issuer) | Third-party issuer |
| P2P transfer | MONEY TRANSFER (internal balances) | Internal stored value |

These are materially higher-risk categories for underwriting. Do not down-classify to appear lower-risk (Rule 29/11).

## Owner-input-required (NOT VERIFIED — do not guess)

| Field | Status |
| --- | --- |
| Confirmed legal entity name + incorporation jurisdiction | HUMAN VERIFICATION REQUIRED |
| Tax identifier (EIN) | OWNER INPUT REQUIRED |
| Business / operating address | OWNER INPUT REQUIRED |
| Beneficial owners / control person (name, DOB, ownership %) | OWNER INPUT REQUIRED |
| Expected monthly volume | OWNER INPUT REQUIRED |
| Average ticket | OWNER INPUT REQUIRED |
| Maximum ticket | OWNER INPUT REQUIRED |
| Transactions per month | OWNER INPUT REQUIRED |
| Chargeback history | OWNER INPUT REQUIRED |
| Processing history | OWNER INPUT REQUIRED |
| Bank / settlement account | OWNER INPUT REQUIRED |
| Countries served (business + customers) | OWNER INPUT REQUIRED (must match backend/KYC/provider support) |
| Licensing (MSB/MTL/virtual-currency) | LEGAL REVIEW REQUIRED |
| AML / sanctions program | COMPLIANCE / EXTERNAL BLOCKER |
| Provider approvals (Stripe/Fluz/crypto/bank) | PROVIDER APPROVAL REQUIRED |
