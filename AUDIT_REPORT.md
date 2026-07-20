# CardXC Online — Consolidated Security Audit Report

**Date:** 2026-04-17
**Scope:** `/Users/sakib/cardxc-online-1` (local clone, same codebase as remote `/root/cardxc-backend`)
**Output mode:** Findings-only. No code changes made.
**Sub-reports:**
- [AUDIT_SERVER.md](./AUDIT_SERVER.md) — backend (`server/`)
- [AUDIT_SRC.md](./AUDIT_SRC.md) — frontend (`src/` + `index.html`)
- [AUDIT_ENV.md](./AUDIT_ENV.md) — env files, configs, git history, file permissions
- [ROTATION_LIST.md](./ROTATION_LIST.md) — every secret that must be rotated

---

## Grand Totals

| Severity | server/ | src/ | env/config | **Total** |
|----------|---------|------|------------|-----------|
| CRITICAL | 7 | 2 | 5 | **14** |
| HIGH     | 8 | 6 | 3 | **17** |
| MEDIUM   | 9 | 5 | 4 | **18** |
| LOW      | 6 | 7 | 3 | **16** |
| **All**  | **30** | **20** | **15** | **65** |

---

## Immediate (do today) — 14 CRITICAL findings

These are exploitable now in the current deployment. Rotate first, then patch.

### Authentication / signing

1. **`JWT_SECRET = secret123`** — `.env:JWT_SECRET` (9 chars). All JWTs are forgeable by anyone who reads this file. (env)
2. **`SESSION_SECRET = secret123`** — same value, same risk for session cookies. (env)
3. **Fallback JWT secret in source** — `server/middleware/auth.ts:13` returns `'dev-only-secret-do-not-use-in-production'` if env is absent. A second, divergent fallback exists in `server/routes/auth.ts:38` (`'dev-only-secret-' + REPL_ID`). Two modules, two different secrets, guessable when `REPL_ID` leaks.
4. **Stripe webhook accepts unsigned events** — `server/routes/cardCheckout.ts:888` processes events without signature verification when `STRIPE_WEBHOOK_SECRET` is absent. Attacker can spoof `charge.succeeded` to credit arbitrary wallets.
5. **Phone-verify accepts any 6-digit code** — `server/routes/auth.ts:857` — regex-only validation, no server-side OTP record checked. Trivial account-takeover vector.

### Identity / data exposure

6. **Third-party API key committed to git** — `attached_assets/Pasted-App-details-API-Key-...txt`, decoded value `dfbe85c0-f3cc-425a-bc01-df66157efc31:a4ff6c664416f762d259a92b9922eca8` + associated `User ID` and `Business Account ID`. Permanent in history. (env)
7. **`DATABASE_URL` with plaintext password on a public IP** — `postgresql://postgres:baby69%40D@76.13.28.186:5432/cardxc`. Postgres is internet-reachable; password is weak. (env)
8. **`BROWSER_USE_API_KEY` in world-readable `.env.local`** (`-rw-r--r--`, 644). (env)

### Security-controls bypass

9. **WAF bypass for every request** — `server/index.ts:235–248`. The middleware chain (`blockSuspiciousIPs`, `detectMaliciousInput`, `preventPathTraversal`, `validateRequestSize`) is skipped when `req.path.startsWith('/')` — which is every path. All WAF checks are effectively off.

### Payment / financial integrity

10. **`Math.random()` for card `lastFour`** — `server/routes/user.ts:331`. Non-crypto RNG for a value tied to a financial instrument identifier.
11. **Same pattern in `server/routes/cards.ts:141`**.
12. **`VITE_ADYEN_API_KEY` inlined into browser bundle** — `src/lib/paymentUtils.ts:69`. Payment-processor server key shipped to every browser. Whoever views source can call Adyen as the merchant.

### Client-side session theft

13. **Auth token stored in `localStorage`** — `src/pages/wallet/components/DepositModal.tsx:28,37,46`. Any XSS permanently exfiltrates the session. Contradicts `AuthContext` which correctly uses httpOnly cookies.

### Scanner evasion

14. **`.gitleaks.toml` allowlists `attached_assets/`** — the exact directory hiding finding #6. Gitleaks cannot have caught it.

---

## High priority (do this week) — 17 HIGH findings

### Backend (`server/`)

- `jwt.verify` / `jwt.sign` with no pinned algorithm — `middleware/auth.ts:37`, `routes/auth.ts:63,328`, `services/socketService.ts:50`, `services/realtimeService.ts:35`. Add `{ algorithms: ['HS256'] }` everywhere.
- Unauthenticated AI chat routes — `server/replit_integrations/chat/routes.ts:21–138` (4 endpoints) exposing all conversations + relaying prompts to Gemini.
- Unauthenticated image generation — `server/replit_integrations/image/routes.ts:6–39`. Open cost-abuse + prompt injection.
- Financial record fields generated with `Math.random()` — `server/routes/cardCheckout.ts:325–341,949–951`.
- `SESSION_SECRET || JWT_SECRET` fallback with no hard fail — `server/services/socketService.ts:45`.
- **Plaintext deposit OTPs** — `server/routes/depositOtp.ts:108–111` stores OTP code unhashed in `deposit_otps` table. DB read = wallet theft.
- CSP contains `'unsafe-inline'` AND `'unsafe-eval'` — `server/index.ts:110–111`. Defeats CSP's XSS protection.

### Frontend (`src/`)

- No CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy anywhere — `index.html`.
- CDN stylesheets without SRI — `index.html:64–77` (`fontshare.com`, `jsdelivr.net`, `cdnjs.cloudflare.com`).
- OAuth hash fragment never cleared — `src/pages/auth/callback/page.tsx:20,143` — any early-loaded third-party script reads the access token.
- `innerHTML` in bootstrap error UI — `src/main.tsx:192` (sibling of a block already flagged and fixed).
- `error_description` URL param rendered as-is — `src/pages/signin/page.tsx:30-32`. React escapes in DOM, but enables phishing via the legitimate signin page.
- Raw `err.message`/`err.code` rendered to users — `src/pages/auth/callback/page.tsx:134`.

### Env / config

- `.env` perms `644` — world-readable DB creds + JWT secret.
- `.env.local` perms `644` — world-readable `BROWSER_USE_API_KEY`.
- `.gitleaks.toml` allowlist of `attached_assets/` (also counted as CRITICAL above for the concrete leak; HIGH for the structural gap).

---

## Medium (18) and Low (16)

Full detail in the three sub-reports. Highlights:

- MCP proxy routes unauthenticated — `server/index.ts:185–226`
- CORS wildcard-subdomain match — `server/index.ts:95–104`
- Swagger UI public in production — `server/index.ts:229`
- In-memory rate-limit / IP-block state (lost on restart) — `server/middleware/security.ts:6–18`
- Verbose auth logging in production — `src/contexts/AuthContext.tsx`
- Payment kill-switch enforced client-side only — `src/pages/admin-operations/components/PaymentSettingsTab.tsx:72`
- Card metadata cached in `localStorage` — `src/pages/cards/page.tsx:119`
- Build version metadata exposed in `index.html`

---

## Checks that came back clean

Backend: SQL injection (all queries parameterized via `server/db/pool.ts`), NoSQL injection (no Mongo), dangerous sinks (no `eval`/`exec`), password hashing (bcrypt rounds=12), CORS wildcard+credentials, SSRF (no user URLs to outbound HTTP), error-stack leakage (handled in `errorHandler.ts`), prototype pollution, open redirect, PII logging (emails masked).

Frontend: no `dangerouslySetInnerHTML` anywhere, no `sk_live_`/`sk_test_`/service-role tokens in bundle, no `postMessage` without origin check, no DOM-XSS via `useSearchParams→innerHTML`, sourcemaps off in prod (`vite.config.ts:46`), `target="_blank"` correctly paired with `rel="noopener noreferrer"`.

---

## Dependency CVEs

`npm audit` was not run by the agent (sandbox). Manual observations:

- `speakeasy ^2.0.0` — unmaintained 7+ years. Replace with `otplib`.
- `swagger-ui-express ^5.0.1` — historically XSS-prone; endpoint is also public (LOW finding).
- `axios`, `minimatch`, `glob` overrides in `package.json` indicate prior CVE awareness — good hygiene, keep up.

**Run locally before deploy:**
```
cd /Users/sakib/cardxc-online-1 && npm audit --omit=dev --audit-level=high
```

---

## Verification

- Each finding above carries a `file:line` reference. Open the cited location to confirm.
- To re-run backend secret scan: `rg -nE "(secret|token|key|password)\s*[:=]\s*['\"][^'\"]{12,}" server/`.
- To re-confirm env exposure: `ls -la .env* && cat .gitignore | grep env && git ls-files | grep -Ei 'env|key|secret|credential'`.
- To confirm rotation executed, check none of the listed values in `ROTATION_LIST.md` survive in `.env`, `.env.local`, `.env.save`, remote `/root/cardxc-backend/.env*`, DB, Stripe dashboard, or external service dashboards.

---

## Out of scope (explicit)

- No patches in this pass. The user asked for a findings-only audit.
- No penetration testing, no live exploit, no traffic replay.
- No infra/network review (firewalls, TLS chain, DNS) beyond what env values imply.
- No review of accessibility, UX, or performance.
