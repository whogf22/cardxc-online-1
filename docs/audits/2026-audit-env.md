# CardXC ENV & Config Security Audit
**Date:** 2026-04-17  
**Scope:** .env*, .gitignore, .gitleaks.toml, package.json, vite.config.ts, wrangler.jsonc, server/config/**  
**Auditor:** security-reviewer agent

---

## Table 1: All Keys Across All Env Files

| File | Key | Value (full) | Classification | Severity | Action |
|------|-----|-------------|----------------|----------|--------|
| `.env` | `DATABASE_URL` | `postgresql://postgres:baby69%40D@76.13.28.186:5432/cardxc` | REAL_SECRET | CRITICAL | Rotate DB password immediately; host is a public IP |
| `.env` | `JWT_SECRET` | `secret123` | REAL_SECRET (weak) | CRITICAL | Replace with ≥64-char random secret |
| `.env` | `SESSION_SECRET` | `secret123` | REAL_SECRET (weak) | CRITICAL | Replace with ≥64-char random secret |
| `.env.local` | `VITE_API_URL` | `https://api.cardxc.online/api` | PUBLIC/CONFIG | LOW | No action required |
| `.env.local` | `VITE_PUBLIC_SITE_URL` | `http://localhost:5173` | CONFIG | LOW | No action required |
| `.env.local` | `NODE_ENV` | `development` | CONFIG | MEDIUM | Ensure this file is never loaded in production |
| `.env.local` | `BROWSER_USE_API_KEY` | `bu_wMLacxis5Dn4B8TsT5DDsJjkDVacCJ1mHYSeSt_Q4iw` | REAL_SECRET | HIGH | Rotate — API key for Browser-Use service with `bu_` prefix indicates a real credential |
| `.env.save` | `DATABASE_URL` | `postgresql://postgres:baby69%40D@76.13.28.186:5432/cardxc` | REAL_SECRET | CRITICAL | Same as .env — same rotation requirement |
| `.env.save` | `JWT_SECRET` | `secret123` | REAL_SECRET (weak) | CRITICAL | Same as .env — replace |
| `.env.save` | `SESSION_SECRET` | `secret123` | REAL_SECRET (weak) | CRITICAL | Same as .env — replace |
| `.env.save` | *(shell script body)* | openssl rotation script fragment | CONFIG | LOW | File is a mix of a shell script and a copied .env; the script was never run — JWT_SECRET/SESSION_SECRET remain `secret123` |

**Keys observed as absent but expected for this fintech stack (should be verified server-side):**  
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENDGRID_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS` — not present in scoped files. These may be set on the server directly; the absence here is not a finding but their omission from local `.env` means local dev runs without payment/email/AI features unless set elsewhere.

---

## Table 2: Git-History and File-Permission Findings

### 2a. Git-Tracked .env Files

| File | Tracked in Git? | Commit | Severity | Notes |
|------|----------------|--------|----------|-------|
| `.env.production` | YES | `79a98f5` | MEDIUM | Committed via `feat: connect frontend to api.cardxc.online backend`. Contents are VITE_ public variables only — no secrets in this specific commit. File is correctly ignored going forward per .gitignore. |
| `.env` | NOT tracked (checked `git ls-files`) | — | OK | Correctly excluded |
| `.env.local` | NOT tracked | — | OK | Correctly excluded |
| `.env.save` | NOT tracked | — | OK | Correctly excluded |

**Finding:** The `.env.production` commit (`79a98f5`) contained only public VITE_ variables (API URL, domain names). No secrets were committed to git history in that file. No rotation required for the committed values.

**`git ls-files | grep -Ei 'env|secret|credential|key'` results:**  
- `scripts/setup-env.js` — tracked (script file, not a secret store)  
- `src/lib/env.ts` — tracked (frontend env accessor, no hardcoded secrets)  
- `src/lib/envValidation.ts` — tracked (validation logic, no hardcoded secrets)  
- `vite-env.d.ts` — tracked (TypeScript declarations, no secrets)  
- `attached_assets/Pasted-App-details-API-Key-ZGZiZTg1YzAtZjNjYy00MjVhLWJjMDEtZGY_1770693426890.txt` — tracked (CRITICAL — see below)

### 2b. CRITICAL: Real API Key in Tracked attached_assets File

**File:** `attached_assets/Pasted-App-details-API-Key-ZGZiZTg1YzAtZjNjYy00MjVhLWJjMDEtZGY_1770693426890.txt`  
**Status:** GIT-TRACKED — committed to repository history  
**Content (line 2):** `API Key-ZGZiZTg1YzAtZjNjYy00MjVhLWJjMDEtZGY2NjE1N2VmYzMxOmE0ZmY2YzY2NDQxNmY3NjJkMjU5YTkyYjk5MjJlY2E4`  
**Also present:**  
- `User ID: a3ba7743-9285-48f7-9b4c-88883812e59a`  
- `Business Account ID: 22af1e15-7428-4e45-92a4-6a1caed57887`

**Classification:** REAL_SECRET — this appears to be a third-party service API key (Base64-encoded credential, used as `Authorization: Basic <API_KEY>` per the file). The filename's Base64 segment decodes to `dfbe85c0-f3cc-425a-bc01-df66157efc31:a4ff6c664416f762d259a92b9922eca8`, indicating a UUID:secret credential pair.  
**Severity:** CRITICAL  
**Action:** Revoke/rotate this API key immediately via the issuing service's developer console. Because this file is git-tracked, the secret has been in repository history and is considered fully compromised regardless of who has repo access.

### 2c. File Permissions

| File | Permissions | Owner | Severity | Notes |
|------|------------|-------|----------|-------|
| `.env` | `-rw-r--r--` (644) | sakib/staff | HIGH | World-readable. Contains DB credentials and weak JWT secrets. Should be `600`. |
| `.env.local` | `-rw-r--r--` (644) | sakib/staff | HIGH | World-readable. Contains a real API key (`BROWSER_USE_API_KEY`). Should be `600`. |
| `.env.save` | `-rw-------` (600) | sakib/staff | OK | Correctly permissioned. |

**Fix for .env and .env.local:**
```bash
chmod 600 /Users/sakib/cardxc-online-1/.env
chmod 600 /Users/sakib/cardxc-online-1/.env.local
```

---

## Section 3: Additional Config Findings

### 3a. .gitignore Analysis
**Status:** ADEQUATE with one gap.

The `.gitignore` correctly ignores:
- `.env` ✓
- `.env.local` ✓
- `.env.production` ✓ (but was committed before this rule took full effect)
- `.env.*` ✓ (wildcard catch-all)
- `.env.*.local` ✓

**Gap:** `.env.save` is not listed by name. It is caught by the `.env.*` wildcard only if `.env.*` matches `.env.save` — in Git's glob, `.env.*` requires a dot after `env`, so `.env.save` IS covered. However, listing it explicitly would reduce ambiguity. LOW concern.

**`.gitleaks.toml` is NOT allowlisting real secrets.** The allowlist only excludes `node_modules`, `.git`, `dist`, `package-lock.json`, and `attached_assets`. The `attached_assets` path exclusion is dangerous — a real API key exists in that directory and gitleaks would skip it due to this allowlist. The tool would therefore NOT have caught the credential in `attached_assets/Pasted-App-details-API-Key-*.txt`. **Remove `attached_assets` from the gitleaks allowlist.** MEDIUM.

### 3b. vite.config.ts Analysis
- No literal secrets present. All values come from `process.env.*`. ✓
- `cors: true` on the dev server (`server.cors`) and preview server (`preview.cors`) — permissive for local development. Acceptable in a dev-only context, but `cors: true` in `preview` mode means the preview build accepts all origins. **MEDIUM** — ensure `preview` mode is never used as a production server.
- `allowedHosts: true` on both `server` and `preview` — any hostname accepted. Acceptable in dev, risky if preview is exposed. MEDIUM.
- No secrets in `define` block — only `BASE_PATH`, `IS_PREVIEW`, `NODE_ENV`. ✓

### 3c. package.json Scripts Analysis
- No hardcoded secrets in scripts. ✓
- `"start": "NODE_ENV=production tsx server/index.ts"` — correctly sets production mode.
- `"dev": "NODE_ENV=development tsx server/index.ts & ..."` — development mode correctly flagged.
- No secrets embedded in script commands. ✓

### 3d. wrangler.jsonc Analysis
- No secrets present. ✓
- Cloudflare Workers deployment with `nodejs_compat` flag. No sensitive config.
- `observability.enabled: true` — telemetry enabled; ensure observability data does not capture PII or secrets. LOW.

### 3e. server/config/ Analysis
- `server/config/swagger.ts` — no secrets; uses `process.env.SUPPORT_EMAIL` with a safe fallback. ✓
- `server/config/supportedBins.ts` — BIN list and card brand logic; no secrets. ✓

### 3f. Weak/Default JWT and Session Secrets
**JWT_SECRET = `secret123`** — 9 characters, a trivially guessable default value. Any attacker can brute-force or forge JWT tokens signed with this key, enabling full account takeover across the entire platform.  
**SESSION_SECRET = `secret123`** — same value, same risk for session cookies.  
These are the most operationally dangerous secrets in the codebase because they underpin all authentication. Every active JWT token and session is compromised.

### 3g. Database URL with Public IP
`DATABASE_URL` exposes a PostgreSQL server at `76.13.28.186:5432` (a public IP address). Combined with the password `baby69@D` (URL-decoded from `baby69%40D`), this gives direct database access to anyone who reads `.env`. The database port 5432 should not be publicly reachable; it should be firewalled to allow connections only from the application server IP.

---

## Rotation List

### JWT / Session Signing
- `JWT_SECRET` (current: `secret123`) — generate with: `openssl rand -base64 64`
- `SESSION_SECRET` (current: `secret123`) — generate with: `openssl rand -base64 64`
- **Impact:** All existing JWT tokens and sessions are invalidated on rotation. Users will be logged out. This is required.

### Database
- PostgreSQL password for user `postgres` on host `76.13.28.186:5432` (current password: `baby69@D`) — rotate via `ALTER USER postgres PASSWORD 'new_password';` and update `DATABASE_URL`.
- After rotation, firewall port 5432 to disallow public internet access.

### Browser-Use API
- `BROWSER_USE_API_KEY` (current: `bu_wMLacxis5Dn4B8TsT5DDsJjkDVacCJ1mHYSeSt_Q4iw`) — revoke and regenerate in the Browser-Use developer console.

### Third-Party Service (attached_assets file — git-committed)
- API Key from `attached_assets/Pasted-App-details-API-Key-*.txt` — the decoded credential is `dfbe85c0-f3cc-425a-bc01-df66157efc31:a4ff6c664416f762d259a92b9922eca8`. Identify the service (the file references GraphQL queries with `getAccountsByUserId`, suggesting a fintech/card-issuing platform such as Marqeta, Lithic, or similar). Revoke immediately via that service's dashboard.

---

## Summary Counts

```
CRITICAL: 5
HIGH:     3
MEDIUM:   4
LOW:      3
```

**CRITICAL (5):**
1. `JWT_SECRET = secret123` — trivially weak; all tokens forgeable
2. `SESSION_SECRET = secret123` — trivially weak; all sessions forgeable
3. `DATABASE_URL` with plaintext password to a public IP
4. `BROWSER_USE_API_KEY` in world-readable `.env.local` (644 perms)
5. Real API key committed to git in `attached_assets/` (git-tracked, permanent history)

**HIGH (3):**
1. `.env` file permissions are 644 (world-readable, contains DB + JWT secrets)
2. `.env.local` file permissions are 644 (world-readable, contains API key)
3. `attached_assets` path in `.gitleaks.toml` allowlist suppresses scanning of directory containing a real secret

**MEDIUM (4):**
1. `NODE_ENV=development` in `.env.local` (risk if loaded in production)
2. `vite.config.ts` `preview.cors: true` and `preview.allowedHosts: true` (too permissive for any internet-exposed preview)
3. `attached_assets` in gitleaks allowlist masks secret scanning for that directory
4. `.env.production` was committed to git (values were public-only this time, but the pattern sets a dangerous precedent)

**LOW (3):**
1. `.env.save` not listed by name in `.gitignore` (covered by wildcard)
2. `wrangler.jsonc` observability enabled — verify no PII in telemetry
3. `VITE_PUBLIC_SITE_URL=http://localhost:5173` in `.env.local` (localhost URL committed — minor hygiene)
