# Server Security Audit — CardXC Backend
**Scope:** `/Users/sakib/cardxc-online-1/server/**`
**Date:** 2026-04-17
**Auditor:** Security Reviewer Agent

---

## CRITICAL Findings

| Severity | File:Line | Excerpt | Fix |
|----------|-----------|---------|-----|
| CRITICAL | `server/middleware/auth.ts:13` | `return secret \|\| 'dev-only-secret-do-not-use-in-production'` — fallback hardcoded JWT secret used when SESSION_SECRET is absent | Remove all fallback literals; fail hard unconditionally (not just in production) if SESSION_SECRET is unset |
| CRITICAL | `server/routes/auth.ts:38` | `return 'dev-only-secret-' + (process.env.REPL_ID \|\| 'local')` — second independent fallback JWT secret in the auth route module (separate from middleware/auth.ts). Both modules independently compute JWT_SECRET at module-load time and diverge | Consolidate JWT secret resolution into a single module; enforce required env var in all environments |
| CRITICAL | `server/routes/user.ts:331` | `const lastFour = Math.floor(1000 + Math.random() * 9000).toString()` — `Math.random()` used to generate virtual card's last-four digits, a display identifier tied to a financial instrument | Use `crypto.randomInt(1000, 10000)` |
| CRITICAL | `server/routes/cards.ts:141` | Same pattern: `Math.floor(1000 + Math.random() * 9000)` used for card last-four in the cards route | Use `crypto.randomInt(1000, 10000)` |
| CRITICAL | `server/routes/auth.ts:857–868` | `POST /api/auth/verify-phone` accepts a phone number and OTP code, updates the user's phone directly in the DB, but **does not validate that the OTP was actually issued for that phone number** — any 6-digit code with the correct format passes the regex check and the phone is set | Validate OTP against a server-side issued token tied to that specific phone number before persisting |
| CRITICAL | `server/index.ts:235–248` | Security middleware stack (`validateRequestSize`, `blockSuspiciousIPs`, `detectMaliciousInput`, `preventPathTraversal`) is **bypassed entirely** for any path starting with `/`, `/mcp`, `/auth/token`, `/execute`, `/tools`, `/health`, `/.well-known` — the `/` prefix matches every path on the server | Tighten the bypass list to exact path matches (`req.path === '/api/health'`), not `startsWith('/')` |
| CRITICAL | `server/routes/cardCheckout.ts:888–896` | Stripe webhook at `POST /api/webhooks/stripe` accepts and processes events **without signature verification** when `STRIPE_WEBHOOK_SECRET` is unset in any non-production environment. This allows spoofed webhook events to credit arbitrary user wallets | Require the webhook secret unconditionally; reject unsigned requests even in development |

---

## HIGH Findings

| Severity | File:Line | Excerpt | Fix |
|----------|-----------|---------|-----|
| HIGH | `server/middleware/auth.ts:37` / `server/routes/auth.ts:328` | `jwt.verify(token, JWT_SECRET)` — no explicit `algorithms` option passed. jsonwebtoken ≥9 defaults to HS256 but omitting the explicit option is fragile and leaves open algorithm confusion if the library default changes | Always pass `{ algorithms: ['HS256'] }` as the options argument to `jwt.verify` |
| HIGH | `server/routes/auth.ts:63` | `jwt.sign({ userId, sessionId }, JWT_SECRET, { expiresIn: \`${SESSION_DURATION_HOURS}h\` })` — algorithm not pinned in sign options | Add `algorithm: 'HS256'` to the `jwt.sign` options object |
| HIGH | `server/replit_integrations/chat/routes.ts:21–138` | `GET /api/conversations`, `POST /api/conversations`, `DELETE /api/conversations/:id`, `POST /api/conversations/:id/messages` are **unauthenticated**. These endpoints expose AI conversation data and relay arbitrary user input to Gemini with no auth middleware | Add the `authenticate` middleware to all chat integration routes |
| HIGH | `server/replit_integrations/image/routes.ts:6–39` | `POST /api/generate-image` is **unauthenticated**. Any anonymous caller can send an arbitrary prompt to the AI image generation endpoint, incurring API costs and potential prompt-injection | Add the `authenticate` middleware |
| HIGH | `server/routes/cardCheckout.ts:325–341` / `server/routes/cardCheckout.ts:949–951` | `Math.random()` used to generate merchant display names and order IDs embedded in financial transaction records (`uniqueId = Math.floor(100 + Math.random() * 900)`) | Use `crypto.randomInt` for any value written to financial records |
| HIGH | `server/services/socketService.ts:45` | `const jwtSecret = process.env.SESSION_SECRET \|\| process.env.JWT_SECRET` — Socket.IO auth accepts either env var with no fallback enforcement. If neither is set, a warning is logged but the connection is rejected before the check; however the algorithm is not pinned | Require the secret unconditionally and pin algorithm to HS256 |
| HIGH | `server/routes/depositOtp.ts:108–111` | OTP code (`otpCode`) is stored **in plaintext** in the `deposit_otps` table (`INSERT INTO deposit_otps ... otp_code ...`). If the DB is compromised, all pending OTPs are exposed. The comparison at line 201 does not use a hash | Store a `SHA-256` or `HMAC` hash of the OTP; compare hashes at verification time |
| HIGH | `server/index.ts:110–111` | CSP `scriptSrc` contains both `'unsafe-inline'` and `'unsafe-eval'`. This negates XSS protection from the CSP for script execution and enables JS injection via `eval` | Remove `'unsafe-eval'`; migrate any inline scripts to nonce-based or external scripts |

---

## MEDIUM Findings

| Severity | File:Line | Excerpt | Fix |
|----------|-----------|---------|-----|
| MEDIUM | `server/routes/auth.ts:286–354` | `GET /api/auth/session` uses `jwt.verify` without algorithm pinning (see HIGH above) and then returns the full `user` row from DB including `two_factor_enabled` without redacting sensitive metadata | Pin algorithm; review what user fields are returned |
| MEDIUM | `server/services/paymentHelper.ts:34,36,46` | `Math.random()` used to generate simulated merchant names, order IDs, and MCC codes attached to internal transaction records | Use `crypto.randomInt` for financial metadata |
| MEDIUM | `server/index.ts:95–104` | CORS `allowedOrigins` includes a subdomain wildcard logic (`cleanOrigin.endsWith('.' + cleanAllowed)`) — any subdomain of a configured domain is accepted. If a subdomain is compromised, cross-origin cookies are freely sent | Only allowlist explicit, known subdomains |
| MEDIUM | `server/routes/user.ts:371–376` | KYC file upload path (`req.file.path`) is stored directly in DB (`INSERT INTO kyc_documents ... file_path = $3`). If an attacker bypasses multer via an SSRF or API quirk and corrupts the path field, it could be used to reference arbitrary server paths at read time | Normalize stored paths to be relative to a fixed upload root, never store absolute `req.file.path` |
| MEDIUM | `server/services/realtimeService.ts:32` / `server/services/socketService.ts:47` | Log warnings reveal that the application will start without JWT secrets set (`'Neither SESSION_SECRET nor JWT_SECRET is set'`). The absence of a hard crash means the app silently starts with no valid secret | Replace warn with a startup-time throw |
| MEDIUM | `server/routes/auth.ts:688–697` | `GET /api/auth/google/callback` — the `req.query.error` value at line 691 is passed through `encodeURIComponent` into a redirect URL but the OAuth error value itself comes from Google's response and could contain crafted strings. The path is `/signin?error_description=...` — if the frontend renders query params unsanitized this is a reflected-XSS vector | Validate `oauthError` against a known list of Google OAuth error codes before embedding |
| MEDIUM | `server/index.ts:185–226` | MCP proxy paths (`/mcp`, `/auth/token`, `/execute`, `/tools`) are proxied without authentication to an internal service on port 8080. The path `/auth/token` in particular could be confused with `/api/auth/...` endpoints | Add an auth check or restrict the MCP proxy to localhost-only source IPs |
| MEDIUM | `server/routes/admin.ts:140–156` | Admin user search at `GET /api/admin/users?search=` uses `ILIKE $1` with `%${search}%` — the search value is parameterized (safe from SQL injection) but there is no length limit on `search`, enabling expensive wildcard queries | Add a max length constraint (e.g., 100 chars) and consider full-text search limits |
| MEDIUM | `server/db/init.ts:706–715` | Bootstrap super-admin flow reads `BOOTSTRAP_SUPER_ADMIN_PASSWORD` from env at startup and logs a warning if it is too short, but the password is only validated to be ≥8 chars with no complexity requirement for an account with full platform access | Enforce a strong password policy (≥16 chars, mixed case) or mandate passphrase entropy for bootstrap credentials |

---

## LOW Findings

| Severity | File:Line | Excerpt | Fix |
|----------|-----------|---------|-----|
| LOW | `server/routes/auth.ts:595–619` | `getGoogleCallbackUrl(req)` constructs the callback URL partly from `req.get('host')` after stripping the port. If `trust proxy` is on and the `Host` header is spoofable, the callback URL could be manipulated | Use a hard-coded `PRODUCTION_DOMAIN` as the primary source; never derive the callback URL from request headers in production |
| LOW | `server/middleware/security.ts:122–138` | SQL injection detection regex and XSS detection patterns are client-side heuristics applied as a WAF layer, which is not a substitute for parameterized queries. The regex for SQL injection (`\b(SELECT|INSERT|...) `) would block legitimate user input (e.g., a description containing "Select your plan") | Rely solely on parameterized queries (already done) and remove this WAF layer, or tune it to not apply to content fields |
| LOW | `server/routes/auth.ts:841–868` | `POST /api/auth/verify-phone` has no rate limiting middleware — repeated calls allowed within the existing `apiLimiter` (100/min) | Add `sensitiveOpLimiter` |
| LOW | `server/middleware/security.ts:6–18` | `failedAttempts` and `blacklistedIPs` are in-process `Map`/`Set` objects, not persisted. A server restart resets all blocks and blacklists | Use Redis or DB-backed storage for blocking state in production |
| LOW | `server/index.ts:229` | Swagger UI at `/api-docs` is accessible without authentication and exposes full API surface to anonymous clients | Restrict `/api-docs` to authenticated admin users in production via a check on `NODE_ENV` |
| LOW | `server/routes/user.ts:17–36` | KYC upload directory (`uploads/kyc`) is created relative to `process.cwd()` — this may place uploaded files inside the project root if the working directory is unexpected at startup | Use an absolute, configured path (`process.env.KYC_UPLOAD_DIR`) outside the project tree |

---

## Checks With No Findings

### 1. Hardcoded Secrets (Check 1)
No hardcoded API keys, passwords, or tokens found in source files (other than the fallback JWT secrets reported under CRITICAL). Credentials are read from `process.env`.

### 2. SQL Injection (Check 2)
All queries use `$1/$2` parameterized placeholders via the centralized `query()` / `transaction()` wrappers in `server/db/pool.ts`. No string-concatenated queries found.

### 3. NoSQL Injection (Check 3)
No MongoDB/NoSQL driver usage found. Not applicable.

### 4. Dangerous Sinks (Check 4)
No `eval()`, `new Function()`, or `child_process.exec()` calls found in server code.

### 5. Missing Auth on Sensitive Routes (Check 5)
All financial and user-mutation routes (`/api/user`, `/api/admin`, `/api/payments`, `/api/savings`, `/api/rewards`, `/api/gift-cards`, `/api/withdraw`, `/api/crypto`, `/api/swap`, `/api/deposit-otp`, `/api/cards`, `/api/transactions`, `/api/referrals`, `/api/notifications`, `/api/preferences`) apply `authenticate` middleware at the router level. The exceptions (unauthenticated AI/chat integrations) are reported under HIGH.

### 7. Password Hashing (Check 7)
`bcrypt.hash(password, 12)` used consistently (rounds=12, well above the minimum of 10). No MD5, SHA1, or plaintext comparisons found. `bcrypt.compare` used for all password verification.

### 9. Rate Limiting (Check 9)
Dedicated rate limiters present: `authLimiter` (5 req/15 min prod), `sensitiveOpLimiter`, `financialOpLimiter`, `passwordResetLimiter`, `apiLimiter`. OTP endpoints use `sensitiveOpLimiter`. The verify-phone gap is noted under LOW.

### 10. CORS (Check 10)
CORS does not use a wildcard `*` with credentials. Origin is compared against an explicit allowlist derived from env vars.

### 11. File Upload (Check 11)
`multer` configured with 10 MB size cap and MIME allowlist (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`). Filename is generated server-side (`Date.now()-UUID.ext`). The stored path concern is under MEDIUM.

### 12. SSRF (Check 12)
External `fetch`/`axios` calls target hardcoded or env-configured URLs (Google OAuth, Stripe, Fluz, Reloadly, exchange rate APIs, TronGrid). No user-supplied URLs are passed to outbound HTTP calls.

### 13. Error Leakage (Check 13)
`errorHandler.ts` correctly suppresses `err.stack` in production. Non-operational errors return generic `"An unexpected error occurred"`. No `res.json(err)` patterns found.

### 14. Logging PII/Secrets (Check 14)
No `console.log` or `logger.*` calls passing raw passwords, CVV, PAN, or full OTP codes were found. Email addresses are masked in logs (`email.substring(0,3) + '***@***'`).

### 15. Prototype Pollution (Check 15)
No `Object.assign(target, req.body)` or `_.merge(target, req.body)` patterns found.

### 17. Path Traversal (Check 17)
`preventPathTraversal` middleware actively checks for `../` sequences. `fs` calls operate on server-generated paths, not user input.

### 18. CSRF (Check 18)
No `csurf` middleware found, but the application uses `httpOnly` cookies with `sameSite: 'lax'`. `SameSite=Lax` provides partial CSRF protection for top-level navigation but not for cross-origin `fetch`/`XMLHttpRequest` POST requests from same-site subdomains. Because state-changing endpoints additionally require a valid JWT in the cookie, the practical CSRF risk is lower; however, adding an explicit CSRF token for high-value mutations (withdrawal, password change) is still recommended.

### 19. Security Headers (Check 19)
`helmet` is loaded with HSTS (31536000s, includeSubDomains, preload), X-Content-Type-Options, X-Frame-Options (DENY via custom header), Referrer-Policy, Permissions-Policy. `contentSecurityPolicy: false` is NOT set; CSP is configured. The `unsafe-eval` issue is reported under HIGH.

### 20. Open Redirect (Check 20)
`res.redirect` calls use hardcoded relative paths (`/dashboard`, `/admin-dashboard`, `/signin?error_description=...`) or redirect to Google OAuth's hardcoded URL. No `res.redirect(req.query.url)` pattern found. The OAuth error embed concern is reported under MEDIUM.

---

## Totals

```
CRITICAL: 7 | HIGH: 8 | MEDIUM: 9 | LOW: 6
```

---

## Dependency CVEs

`npm audit` could not be run in this environment (Bash tool not permitted). Based on manual inspection of `package.json`, note the following observations:

- **speakeasy** (`^2.0.0`) — last published 2017, no updates in 7+ years. No active CVEs at time of audit knowledge cutoff, but the package is unmaintained and should be replaced with `otplib` or `@otplib/preset-default`.
- **jsdom** (`^27.4.0`) — recent version, no known HIGH/CRITICAL CVEs at knowledge cutoff.
- **axios** is not a direct production dependency; the `overrides` block enforces `axios >= 1.13.5` to remediate known CVEs in transitive dependents.
- **minimatch** and **glob** overrides are also present, indicating prior awareness of CVEs in transitive dependencies.
- **swagger-ui-express** (`^5.0.1`) — Swagger UI has historically had XSS vulnerabilities. The endpoint is public (see LOW finding #5). Run `npm audit` for current advisory status.
- **firebase** (`^12.9.0`) — large dependency surface. Run `npm audit` for current status.

**Action required:** Run `npm audit --omit=dev --audit-level=high` in the project directory and address any CRITICAL/HIGH advisories before deploying.
