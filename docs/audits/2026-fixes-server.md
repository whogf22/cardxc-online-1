# Server Security Fixes — Remediation Log

**Scope:** `/Users/sakib/cardxc-online-1/server/**`
**Date:** 2026-04-17
**Audit:** `AUDIT_SERVER.md` (30 findings)

---

## CRITICAL (7)

| # | Finding | File:Line | Change |
|---|---------|-----------|--------|
| 1 | Fallback JWT secret in middleware | `server/middleware/auth.ts:5,26` | Removed inline fallback; imported `getJwtSecret` from new `server/lib/jwtSecret.ts` which throws if `SESSION_SECRET`/`JWT_SECRET` missing or <32 chars |
| 1 | New centralized JWT secret module | `server/lib/jwtSecret.ts` (new) | Validates env at first access; caches; single source of truth |
| 2 | Second fallback JWT secret in auth routes | `server/routes/auth.ts:29-55` | Removed duplicate `getJwtSecret`; now imports shared module |
| 3 | `Math.random` for virtual-card last-four | `server/routes/user.ts:24,337` | Replaced with `randomInt(1000, 10000)` from `node:crypto` |
| 3 | Same pattern in cards route | `server/routes/cards.ts:12,142` | Same fix using `randomInt` |
| 4 | `POST /api/auth/verify-phone` not validating server-issued OTP | `server/routes/auth.ts:930-1002` | Rewrote to look up record in new `phone_verification_otps` table and compare SHA-256 hashes via `timingSafeEqual` |
| 4 | New OTP schema | `server/db/init.ts:665-680` | Added `phone_verification_otps` table + indexes |
| 4 | New `POST /api/auth/request-phone-otp` route | `server/routes/auth.ts:870-924` | Generates CSPRNG 6-digit code, stores SHA-256 hash, never echoes code (dev-only log) |
| 5 | Security middleware bypass matched `/` (every path) | `server/index.ts:281-301` | Replaced prefix `startsWith` bypass with explicit `SECURITY_BYPASS_EXACT` set + narrow `/` and `/api/mcp` checks |
| 6 | Stripe webhook secret optional outside production | `server/routes/cardCheckout.ts:874-898` | Made `STRIPE_WEBHOOK_SECRET` mandatory; returns 503 when unset; removed conditional skip |

## HIGH (8)

| # | Finding | File:Line | Change |
|---|---------|-----------|--------|
| 7 | `jwt.verify` / `jwt.sign` without pinned algorithm | `server/middleware/auth.ts:26`, `server/routes/auth.ts:50,277,318`, `server/services/socketService.ts:49`, `server/services/realtimeService.ts:33` | All call sites now pass `{ algorithms: ['HS256'] }` (verify) or `{ algorithm: 'HS256' }` (sign) |
| 8 | Chat integration routes unauthenticated | `server/replit_integrations/chat/routes.ts:4,22,37,56,68,83` | Added `authenticate` middleware to every route handler |
| 9 | Image integration route unauthenticated | `server/replit_integrations/image/routes.ts:4,9` | Added `authenticate` middleware |
| 10 | `Math.random` in financial record fields | `server/routes/cardCheckout.ts:29,325-342,946-951` | Replaced all `Math.random()` with `randomInt` from `node:crypto` |
| 11 | Socket.IO auth warn-not-throw on missing secret | `server/services/socketService.ts:6,47-49` | Uses `getJwtSecret()` (throws). Algorithm pinned |
| 12 | Realtime socket same issue | `server/services/realtimeService.ts:7,31-34` | Uses `getJwtSecret()` + algorithm pinned |
| 13 | Deposit OTPs stored in plaintext | `server/routes/depositOtp.ts:32-40,113-115,206-212,391-395` | Store `sha256(code)` hex; verify by re-hashing submitted code and `timingSafeEqual` on buffers. Schema widened to VARCHAR(128) via `ALTER TABLE` guard in `server/db/init.ts:663-676` |
| 14 | CSP allowed `'unsafe-eval'` | `server/index.ts:116-120` | Removed `'unsafe-eval'`; left `'unsafe-inline'` with TODO to migrate to nonce-based CSP |

## MEDIUM (9)

| # | Finding | File:Line | Change |
|---|---------|-----------|--------|
| 15 | `/api/auth/session` leaked `two_factor_enabled` | `server/routes/auth.ts:330-352` | Algorithm pinned (covered by step 7); response now returns a whitelisted `safeUser` object (id, email, full_name, role, kyc_status, account_status) |
| 16 | `Math.random` in paymentHelper statement descriptors | `server/services/paymentHelper.ts:5,34-37,45-46` | Replaced with `randomInt` |
| 17 | CORS accepted any subdomain via `endsWith('.' + cleanAllowed)` | `server/index.ts:142-158` | Exact-match only against configured allowlist |
| 18 | KYC stored `req.file.path` (absolute) | `server/routes/user.ts:373-377` | Store `req.file.filename` (basename) only; absolute path reconstructed at read time from `kycUploadDir` |
| 19 | Warn-vs-throw for missing JWT secret | (covered by 11 & 12) | Resolved via `getJwtSecret()` which throws |
| 20 | OAuth error value embedded in redirect | `server/routes/auth.ts:609-627,705-709` | `sanitizeOAuthError` validates against allowlist; unknown values become `oauth_error` |
| 21 | MCP proxy accepted any caller | `server/index.ts:200-224` | Added `isMcpRequestAuthorized`: allow loopback or matching `X-MCP-Auth === process.env.MCP_INTERNAL_TOKEN` |
| 22 | Admin search had no length cap | `server/routes/admin.ts:140-156` | Added 100-char max length check (throws 400 VALIDATION_ERROR) |
| 23 | Weak bootstrap SUPER_ADMIN password policy | `server/db/init.ts:721-737` | Requires ≥16 chars plus lower, upper, digit, symbol; throws on violation |

## LOW (6)

| # | Finding | File:Line | Change |
|---|---------|-----------|--------|
| 24 | Google callback URL derived from request Host | `server/routes/auth.ts:602-641` | In production, always uses `PRODUCTION_DOMAIN` env; derivation only in non-production |
| 25 | WAF regex blocked legitimate text | `server/middleware/security.ts:180-269` | Replaced scan-everything behaviour with explicit `WAF_RULES` (path + field-name allowlist). Free-text content fields are never scanned |
| 26 | `verify-phone` missing rate limit | `server/routes/auth.ts:874,930` | Both `/request-phone-otp` and `/verify-phone` now have `sensitiveOpLimiter` |
| 27 | In-process Map/Set for blocking state | `server/middleware/security.ts:5-93` | Abstracted behind `FailedAttemptStore`/`BlacklistStore` interfaces; emits loud warning when `REDIS_URL` not set; ready for Redis-backed implementation |
| 28 | Swagger UI always mounted | `server/index.ts:269-271` | Mounted only when `NODE_ENV !== 'production'` |
| 29 | KYC upload dir relative to `process.cwd()` | `server/routes/user.ts:17-22` | Uses `KYC_UPLOAD_DIR` (if absolute) else `path.resolve(process.cwd(), 'uploads/kyc')`; `fs.mkdirSync(..., { recursive: true })` |

---

## Cross-Cutting Changes

- **New file:** `server/lib/jwtSecret.ts` — centralized JWT secret validation.
- **Schema additions/changes** in `server/db/init.ts`:
  - `phone_verification_otps` table (new) with indexes.
  - `deposit_otps.otp_code` widened from VARCHAR(6) to VARCHAR(128) to hold SHA-256 hex digests (migration guarded by information_schema lookup).
  - Bootstrap password policy hardened.
- **`validateEnvironment`** in `server/index.ts` now fast-fails when neither `SESSION_SECRET` nor `JWT_SECRET` is set (previously just warned).

## Notes / Residual Items

- `'unsafe-inline'` remains in `scriptSrc` with a TODO; migrating to nonce-based CSP requires coordinated frontend changes (out of scope for this server-only pass).
- The Redis-backed implementation of `FailedAttemptStore`/`BlacklistStore` is not wired (no Redis client configured in the project). The abstraction is in place and emits an operational warning so operators notice the gap.
- The bootstrap password strictness change throws at startup if an existing `BOOTSTRAP_SUPER_ADMIN_PASSWORD` does not meet the new policy; operators must update their secret before the next deploy.
