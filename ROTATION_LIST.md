# CardXC — Secret Rotation List

**Date:** 2026-04-17
**Context:** Derived from `AUDIT_ENV.md` + cross-references in `AUDIT_SERVER.md` / `AUDIT_SRC.md`.
**Status of each:** ALL items below must be rotated. Every value listed was either weak, committed to git, world-readable on disk, or shipped to the browser bundle.

Rotate in the order shown — signing secrets first (breaks sessions), then data-path credentials, then third-party keys.

---

## 1. Signing secrets — CRITICAL — rotate first

Users will be logged out. Expect support volume.

| Secret | Current value | Where it lives | Generate new with |
|--------|---------------|----------------|-------------------|
| `JWT_SECRET` | `secret123` | `.env`, `.env.save` | `openssl rand -base64 64` |
| `SESSION_SECRET` | `secret123` | `.env`, `.env.save` | `openssl rand -base64 64` |

After rotation: delete `.env.save` (stale copy of old weak secret).

Also remove the fallback literals that mask missing env at startup:
- `server/middleware/auth.ts:13`
- `server/routes/auth.ts:38`

Both must throw (not warn) when secret is absent.

---

## 2. Database — CRITICAL — rotate second

| Credential | Current | Action |
|------------|---------|--------|
| Postgres `postgres` user password | `baby69@D` | `ALTER USER postgres PASSWORD '<new>';` on `76.13.28.186:5432` |
| Postgres public reachability | port 5432 open on public IP `76.13.28.186` | `ufw deny 5432` / security-group rule restricting source to the app-server IP only |
| `DATABASE_URL` | `postgresql://postgres:baby69%40D@76.13.28.186:5432/cardxc` | rewrite with new password after the two steps above |

---

## 3. Third-party provider keys — CRITICAL

| Provider | Key | Where | Action |
|----------|-----|-------|--------|
| Browser-Use | `BROWSER_USE_API_KEY = bu_wMLacxis5Dn4B8TsT5DDsJjkDVacCJ1mHYSeSt_Q4iw` | `.env.local` (644 perms) | Revoke in Browser-Use console → issue new key → write to `.env.local`, `chmod 600` |
| **Unknown issuer** (likely fintech / card-issuing — Marqeta / Lithic / similar based on GraphQL shape) | decoded `dfbe85c0-f3cc-425a-bc01-df66157efc31:a4ff6c664416f762d259a92b9922eca8` | `attached_assets/Pasted-App-details-API-Key-ZGZiZTg1Y....txt` — committed to git | Identify the issuer from the GraphQL schema in the file (`getAccountsByUserId` etc.) → revoke → rotate → BFG/`git filter-repo` the file out of git history and force-push |
| Adyen | `VITE_ADYEN_API_KEY` (value not in local `.env*` — check production) | `src/lib/paymentUtils.ts:69` references it as `import.meta.env.VITE_ADYEN_API_KEY` → whatever value Vite inlined at build time is public | Rotate Adyen API key in Adyen dashboard. Going forward, move all Adyen API-key operations server-side; the browser should only hold the public `clientKey` |

### Not present locally but must be verified on prod server

Ask whether these were set on `/root/cardxc-backend/.env` on `76.13.28.186` — they are referenced by the server code but absent from local `.env*`:

- `STRIPE_SECRET_KEY` — if `sk_live_*`, verify; otherwise N/A
- `STRIPE_WEBHOOK_SECRET` — MUST be set; without it, `server/routes/cardCheckout.ts:888` accepts unsigned events (CRITICAL in audit)
- `SENDGRID_API_KEY` — if present on prod, rotate as a precaution given broader posture
- `OPENAI_API_KEY` — same
- `SUPABASE_SERVICE_ROLE_KEY` — same
- `GEMINI_API_KEY` / Google service key — feeds unauthenticated `/api/conversations` routes; rotate + add auth before re-enabling
- `REPL_ID` — feeds the second fallback JWT secret in `server/routes/auth.ts:38`; if this has ever been public, JWT forging was trivial

To enumerate prod env without exposing the file:
```
ssh root@76.13.28.186 'grep -E "^[A-Z_]+=" /root/cardxc-backend/.env | cut -d= -f1'
```

Cross-reference against this list; any absent required secret is a config finding.

---

## 4. Post-rotation hardening (required)

These aren't rotations but they prevent the next leak:

1. `chmod 600 .env .env.local` on local and on `76.13.28.186:/root/cardxc-backend/.env*`.
2. Remove `attached_assets` from the allowlist in `.gitleaks.toml` (it hid the credential).
3. Rewrite git history to remove the leaked token file:
   ```
   git filter-repo --path 'attached_assets/Pasted-App-details-API-Key-ZGZiZTg1Y....txt' --invert-paths
   git push --force-with-lease
   ```
   After force-push, anyone with a clone must re-clone. Coordinate with the team.
4. Run `gitleaks detect --no-git -s /Users/sakib/cardxc-online-1` once after step 3 to confirm no further leaks.
5. Delete `.env.save` after verifying `.env` has the new values. It only exists as stale duplicate.
6. Enforce required env at startup — crash, don't warn — in `server/middleware/auth.ts`, `server/routes/auth.ts`, `server/services/socketService.ts`, `server/services/realtimeService.ts`.

---

## Rotation completion checklist

- [ ] JWT_SECRET rotated; all users re-authenticated
- [ ] SESSION_SECRET rotated
- [ ] Fallback JWT secret literals removed from `server/middleware/auth.ts:13` and `server/routes/auth.ts:38`
- [ ] Postgres password changed
- [ ] Postgres port 5432 firewalled (not publicly reachable)
- [ ] `DATABASE_URL` updated with new password in `.env` and on prod
- [ ] `BROWSER_USE_API_KEY` revoked + reissued + `.env.local` updated + chmod 600
- [ ] Unknown fintech API key in `attached_assets/` revoked with issuer
- [ ] `attached_assets/Pasted-App-details-API-Key-*.txt` removed from working tree
- [ ] Git history rewritten to remove the token file; force-pushed
- [ ] `VITE_ADYEN_API_KEY` rotated; client bundle no longer references it
- [ ] `STRIPE_WEBHOOK_SECRET` verified set on prod
- [ ] `.env.save` deleted
- [ ] `.env`, `.env.local` chmod 600 on local and prod
- [ ] `gitleaks detect` passes with the `attached_assets` allowlist entry removed
