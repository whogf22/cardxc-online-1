# Contributing to CardXC

Thank you for helping improve CardXC. Because this repository contains fintech and payment-related code, changes that affect authentication, balances, ledger state, deposits, withdrawals, cards, webhooks, KYC, provider integrations, or administrative actions require extra review.

## Development setup

1. Install Node.js 20+ and PostgreSQL 16+.
2. Clone the repository.
3. Copy the production example only as a reference and create a local `.env` with development credentials. Never commit secrets.
4. Install dependencies:

```bash
npm ci
```

5. Run the application:

```bash
npm run dev
```

## Required checks

Before opening a pull request, run:

```bash
npm run lint
npm run type-check:all
npm test
npm run build
```

The same checks run in GitHub Actions.

## Pull request expectations

- Keep changes focused and explain the user-facing impact.
- Add or update tests for behavior changes.
- Never weaken authentication, authorization, webhook verification, idempotency, rate limiting, or financial fail-closed behavior merely to make a test pass.
- Do not commit API keys, webhook secrets, access tokens, private keys, production database URLs, or customer data.
- Do not state that a provider is approved, live, certified, licensed, or production-ready unless the repository contains current evidence and the business owner has verified the external approval.
- Treat provider API integration and provider approval as separate facts.
- Preserve integer/minor-unit accounting and transaction boundaries for money-moving paths.
- Any new money-changing operation must define idempotency, reconciliation, failure recovery, audit logging, and authorization behavior.

## Financial-change checklist

For changes that can alter a user balance or create an external financial action, document all of the following in the PR:

- Source of truth for the amount and currency.
- Authorization rule.
- Idempotency key or duplicate-prevention mechanism.
- Database transaction/locking behavior.
- External provider/webhook verification.
- Failure and retry behavior.
- Reconciliation path.
- Audit-log event.
- Tests for replay, duplicate, partial-failure, and unauthorized access scenarios.

## Public copy and trust claims

Customer-facing copy must be accurate. Avoid unverified claims such as:

- "PCI compliant" without applicable current attestation/evidence.
- "24/7 support" without an operational support commitment.
- "available in 180+ countries" without current provider coverage evidence.
- "bank-level security" as a substitute for describing specific controls.
- "powered by" or "partnered with" a provider when only an integration or application exists.

Prefer concrete language such as "2FA supported", "TLS-secured", "provider availability varies", or an explicit `Development`, `Conditional`, `Beta`, or `Production` status.

## Security issues

Do not open a public issue for a suspected vulnerability that could expose users, secrets, funds, or infrastructure. Follow `SECURITY.md` for private reporting instructions.

## Release policy

A release tag is not a marketing badge. `v1.0.0` should be created only after the documented production gates are satisfied, including financial integrity checks, external provider/compliance approvals where required, monitoring, recovery, and deployment verification.
