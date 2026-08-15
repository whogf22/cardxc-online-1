# CardXC — Payment Gateway Master Readiness

**Date:** 2026-08-15
**Basis:** Current repository + local app. Live `cardxc.online` review **NOT VERIFIED** (external fetch timed out from this environment).
**Rule reminder:** Provider API integration ≠ approval. Nothing below asserts any provider/bank/regulatory approval. Business/legal facts are marked NOT VERIFIED / MANUAL / EXTERNAL BLOCKER and were **not** fabricated.

## Master checklist

| # | Item | Status | Evidence / note |
| --- | --- | --- | --- |
| 1 | Business identity | **FAIL / MANUAL** | Conflicting legal entity: `routes/legal.ts` = "GAMENOVA VAULT LLC (operating as CardXC)" vs `src/pages/terms/page.tsx` = "CARDXC LLC". HUMAN VERIFICATION REQUIRED |
| 2 | Entity documents | **MANUAL** | Not present in repo; KYB docs are external — see readiness matrix |
| 3 | Beneficial owner | **UNKNOWN** | No verified owner records in repo — OWNER INPUT REQUIRED |
| 4 | Website | **NOT VERIFIED** | Live site fetch timed out; local app has homepage + legal pages |
| 5 | Product description | **PARTIAL** | Terms describe "digital wallet, virtual card, payment services"; consistency issues (see #6) |
| 6 | Business-model consistency | **FAIL** | Wallet funding + auto-USDT (now gated), gift cards, virtual cards, crypto payout — must be represented consistently to any provider; entity-name conflict (#1) |
| 7 | Pricing | **PASS (technical)** | Amounts server-authoritative; gift-card pricing fixed to server rate |
| 8 | Currency | **PASS** | Explicit currency (USD/EUR/GBP) validated server-side |
| 9 | Support | **PARTIAL / MANUAL** | `support@cardxc.online` referenced; deliverability NOT VERIFIED |
| 10 | Privacy | **PARTIAL** | Privacy page exists; unsupported security claims must be reconciled (see #36) |
| 11 | Terms | **PARTIAL** | Terms page exists; entity-name conflict (#1) |
| 12 | Refund | **PARTIAL / MANUAL** | Referenced in Terms; reconcile with actual capability |
| 13 | Cancellation | **N/A / MANUAL** | Not clearly applicable to wallet funding |
| 14 | Fulfillment | **PASS (technical)** | Honest deposit descriptors after fixes; fail-closed when provider absent |
| 15 | HTTPS | **NOT VERIFIED** | Live TLS not checked (fetch timed out); enforced in code via HSTS |
| 16 | Checkout security | **PASS** | Stripe embedded checkout; server-authoritative order/amount/currency |
| 17 | Webhook security | **PASS** | Stripe + provider webhooks fail-closed, signature-verified, idempotent |
| 18 | Server-authoritative pricing | **PASS** | Checkout + gift cards |
| 19 | Idempotency | **PASS** | Unique idempotency keys + order-status guards + unique index |
| 20 | KYC | **PARTIAL** | Enforced in production for card checkout; document review is manual/off-band |
| 21 | KYB | **MANUAL** | External document collection required |
| 22 | AML | **NOT VERIFIED** | No verified AML program in repo — EXTERNAL/COMPLIANCE BLOCKER |
| 23 | Sanctions | **NOT VERIFIED** | No sanctions-screening implementation verified — EXTERNAL BLOCKER |
| 24 | PCI scope | **MANUAL CONFIRMATION REQUIRED** | Card data handled by Stripe-hosted UI; PCI certification NOT CLAIMED |
| 25 | Fraud controls | **PARTIAL** | Rate limits, velocity checks, email verification, KYC; Stripe Radar is provider-native (config NOT VERIFIED) |
| 26 | Refunds (technical) | **PARTIAL / N/A** | No dedicated refund flow verified for card deposits |
| 27 | Dispute evidence | **PARTIAL** | Orders store user/amount/currency/provider id/timestamps + audit log |
| 28 | Reconciliation | **PARTIAL** | Webhook logs + transactions + crypto ledger; formal reconciliation NOT VERIFIED |
| 29 | Settlement | **MANUAL** | Bank/settlement external — OWNER INPUT REQUIRED |
| 30 | Restricted business | **ORANGE/RED (per flow)** | Crypto/stablecoin, wallet/stored value, gift cards, virtual cards, payouts are commonly restricted — PROVIDER REVIEW REQUIRED |
| 31 | Licensing | **LEGAL REVIEW REQUIRED** | Money transmission / MSB / virtual-currency licensing NOT VERIFIED |
| 32 | Provider approval | **REQUIRED / UNKNOWN** | No provider approval evidence in repo |
| 33 | Live credential status | **NOT VERIFIED** | Test vs live keys are env-provided; not inspected (Rule 9) |
| 34 | Processing history | **UNKNOWN** | OWNER INPUT REQUIRED |
| 35 | Bank account | **UNKNOWN / MANUAL** | OWNER INPUT REQUIRED |
| 36 | Security governance | **PARTIAL** | Verify claims (MFA, encryption-at-rest, pentest, scanning) before publishing |
| 37 | Production operations | **PARTIAL** | Health endpoints, logging, audit exist; monitoring/backup posture NOT VERIFIED |

## Overall

**NOT READY** for payment-provider underwriting as-is.

- **Technical payment readiness:** CONDITIONAL — the code-level controls (server-authoritative pricing, fail-closed webhooks/fulfillment, idempotency, honest descriptors, KYC-in-prod, IDOR fix) are in place, but crypto confirmation gating, live TLS/website review, and dependency residue remain.
- **Business/website readiness:** NOT READY — entity-name conflict, unverified website, and compliance claims must be reconciled by a human.
- **Regulatory/provider readiness:** BLOCKED pending EXTERNAL approvals and LEGAL REVIEW (licensing, AML, sanctions, provider underwriting).

These external blockers **cannot be resolved by code** (Rule 53).
