# Changelog

All notable changes to CardXC are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project intends to use Semantic Versioning once production release criteria are satisfied.

## [Unreleased]

### Added
- GitHub CI quality gate for linting, TypeScript checks, automated tests, and production builds.
- Public company and support trust surfaces.
- Repository feature/readiness status documentation.
- Contributor guidance and production-readiness checklist.

### Changed
- Public marketing copy is being aligned with capabilities that can be verified from the repository and provider-readiness documentation.
- Legal/support routes are being hardened for unauthenticated public access where appropriate.

### Security
- Provider integration is explicitly separated from provider approval or production authorization.
- Financial features remain subject to environment gates, provider approval, compliance review, and production readiness checks.

## [0.1.0] - 2026-09-07

### Added
- React 19 + Vite frontend.
- Node.js + Express backend.
- PostgreSQL data layer.
- Wallet, transaction, virtual-card, gift-card, security, notification, and administrative foundations.
- Stripe, Fluz, crypto-provider, TronGrid, SMTP, Sentry, Swagger, rate-limiting, and security-control integrations present in the codebase.

### Notes
- `0.1.0` is a development baseline, not a declaration that all financial features are approved or production-ready.
- A `1.0.0` release must not be cut solely for presentation. It requires the release gates described in `README.md` and the provider/readiness documentation to pass.
