# CardXC Hardening — Task List

Companion to `tasks/plan.md`. Tasks are dependency-ordered. **[NEEDS APPROVAL]** = changes money-movement behavior or enables real-money features; do not implement without explicit human approval (and verified provider agreements/secrets where noted).

Repo commands (verification): focused tests `npx vitest run <path>`; full tests `npm run test`; types `npm run type-check:all`; build `npm run build`; browser smoke = login `test@cardxc.local / Password1!` → dashboard.

---

## Phase 0 — Secrets & supply chain

### Task 1: Triage and apply non-forced dependency fixes (S3)
**Description:** `npm audit --omit=dev` reports 2 critical / 20 high, all transitive via `ws` / `websocket-driver` / `ethers` under `socket.io`. Apply the available non-forced remediation and verify realtime + crypto still work.
**Acceptance criteria:**
- [ ] `npm audit --omit=dev --audit-level=high` has no unmitigated **reachable** critical/high, or each remaining item is documented with a reachability justification and review date.
- [ ] No use of `npm audit fix --force`; lockfile diff reviewed per package.
**Verification:**
- [ ] `npm run test` (72+ pass), `npm run build` succeeds.
- [ ] Manual: Socket.IO connects and a notification is received after login.
**Dependencies:** None. **Files:** `package.json`, `package-lock.json`. **Scope:** S.

### Task 2 [NEEDS APPROVAL / OPS]: Rotate live secrets & verify prod webhook secrets (S16, unblocks S2)
**Description:** Execute `ROTATION_LIST.md` for any value still live (signing secrets → DB → provider keys), scrub leaked keys from git history, and confirm `STRIPE_WEBHOOK_SECRET` and `FLUZ_WEBHOOK_SECRET` are set in prod.
**Acceptance criteria:**
- [ ] No value listed in `ROTATION_LIST.md` remains valid; `.env*` are `chmod 600`; `gitleaks detect` clean.
- [ ] `FLUZ_WEBHOOK_SECRET` and `STRIPE_WEBHOOK_SECRET` confirmed present in prod env.
**Verification:**
- [ ] Provider dashboards show old keys revoked; app boots with new secrets; login works.
**Dependencies:** None (external/ops). **Files:** env only (no app code). **Scope:** OPS — requires provider console access.

### Task 3: Fix `.cursor` skills rule path (C1)
**Description:** `.cursor/rules/agent-skills.mdc` references `.cursor/skills/using-agent-skills/SKILL.md`, but skills live in `.agents/skills/`. Point the rule at the real path (or add a `.cursor/skills` pointer) so the workflow is discoverable. Note `.cursor` is git-ignored — decide whether to un-ignore this rule.
**Acceptance criteria:**
- [ ] The path referenced by the rule resolves to an existing `SKILL.md`.
**Verification:**
- [ ] `test -f` on the referenced path succeeds.
**Dependencies:** None. **Files:** `.cursor/rules/agent-skills.mdc` (+ maybe `.gitignore`). **Scope:** XS.

### Checkpoint: Phase 0
- [ ] Deps triaged & audit re-run; prod webhook secrets confirmed; tests + build green.

---

## Phase 1 — Financial integrity  **[NEEDS APPROVAL]**

### Task 4 [NEEDS APPROVAL]: Server-authoritative gift-card pricing (S1)
**Description:** The buy handler trusts `req.body.rate` to compute `totalCostCents`, letting a buyer pay ~1% of face value. Derive the rate server-side (from `giftCardPricingService`/`calculateTransactionProfit`) and ignore any client-supplied `rate` for cost.
**Acceptance criteria:**
- [ ] Cost is computed only from server-side pricing; a request with `rate: 1` is charged the correct server price (or rejected).
- [ ] `our_rate`/`cost_cents`/`profit_cents` persisted from server pricing, not client input.
**Verification:**
- [ ] New test: POST buy with `rate: 1` does NOT deduct ~1% (red before fix, green after).
- [ ] `npm run test`, `npm run type-check:all` pass.
**Dependencies:** Open question #1 (pricing source). **Files:** `server/routes/giftCards.ts`, `server/services/giftCardPricingService*`, test. **Scope:** M.

### Task 5 [NEEDS APPROVAL]: Fail-closed Fluz/provider webhook (S2)
**Description:** When `FLUZ_WEBHOOK_SECRET` is unset the signature block is skipped and the handler still credits wallets. Mirror the Stripe path: reject (503) when the secret is missing.
**Acceptance criteria:**
- [ ] With no secret configured, `POST /api/webhooks/payment` returns 503 and credits nothing.
- [ ] With secret configured, a valid signature still succeeds; invalid/missing → 401.
**Verification:**
- [ ] Tests for all three cases (no secret / valid / invalid). `npm run test` green.
**Dependencies:** Task 2 (confirm secret set in prod first, or legitimate events will be dropped). **Files:** `server/routes/cardCheckout.ts`, test. **Scope:** S.

### Task 6 [NEEDS APPROVAL]: Enforce crypto confirmation gate (S4)
**Description:** `REQUIRED_CONFIRMATIONS` is stored but not required before crediting. Gate wallet credit on confirmations ≥ required; keep deposits `pending` until then.
**Acceptance criteria:**
- [ ] A deposit with confirmations < required is not credited; it credits once the threshold is met (idempotently).
**Verification:**
- [ ] Unit test around the monitor credit path with mocked confirmation counts. `npm run test` green.
**Dependencies:** Open question #3. **Files:** `server/services/tronDepositMonitor.ts`, test. **Scope:** M.

### Task 7 [NEEDS APPROVAL]: Server-side payment kill-switch (S5)
**Description:** Implement `GET/POST /api/admin/payment-mode` (SUPER_ADMIN) persisting a server-side flag, and enforce it in checkout/deposit routes. Remove reliance on the `localStorage` flag.
**Acceptance criteria:**
- [ ] When disabled server-side, new checkout/deposit requests are rejected (e.g. 503) regardless of client state.
- [ ] Admin UI reads/writes the real endpoint; fail-closed on read error.
**Verification:**
- [ ] Tests: toggle off → checkout blocked; on → allowed. Browser: admin toggle persists across reload.
**Dependencies:** Open question #4. **Files:** `server/routes/admin.ts` (or new), checkout/deposit routes, `src/pages/admin-operations/components/PaymentSettingsTab.tsx`, `src/lib/paymentUtils.ts`, tests. **Scope:** M.

### Checkpoint: Phase 1  **(human sign-off required before merge)**
- [ ] Each task has an exploit test that is red before and green after.
- [ ] `npm run test` + `type-check:all` + `build` green.

---

## Phase 2 — AuthN/AuthZ hardening

### Task 8: Remove JWT from signin/signup response body (S6)
**Description:** Auth already sets an httpOnly cookie; also returning the token in JSON lets XSS read it from memory. Drop `token` from the body (keep the cookie); update any client that reads it.
**Acceptance criteria:**
- [ ] signin/signup responses contain no raw JWT; authenticated flows still work via cookie.
**Verification:**
- [ ] `npm run test`; browser smoke login → dashboard; `/api/user/profile` 200.
**Dependencies:** None. **Files:** `server/routes/auth.ts`, possibly `src/lib/*`, tests. **Scope:** S.

### Task 9: Enforce 2FA on Google OAuth login (S7)
**Description:** Password sign-in enforces 2FA when enabled; the OAuth callback does not. Apply the same 2FA gate (or a documented policy decision) to OAuth logins.
**Acceptance criteria:**
- [ ] A 2FA-enabled user logging in via OAuth is challenged for the second factor (or policy explicitly exempts OAuth, documented).
**Verification:**
- [ ] Test around the OAuth callback with a 2FA-enabled user. `npm run test` green.
**Dependencies:** Open question #5. **Files:** `server/routes/auth.ts`, test. **Scope:** S.

### Task 10: Ownership check on Stripe session-status (S11)
**Description:** `GET /checkout/stripe-session/:sessionId/status` returns status for any `sessionId`. Join to `card_orders.user_id` and 403/404 when the caller doesn't own it.
**Acceptance criteria:**
- [ ] A user cannot read another user's session status.
**Verification:**
- [ ] Test: cross-user request → 403/404; owner → 200. `npm run test` green.
**Dependencies:** None. **Files:** `server/routes/cardCheckout.ts`, test. **Scope:** S.

### Task 11: Re-validate DB session on Socket.IO connect (S13)
**Description:** Socket auth verifies the JWT but not the DB `sessions` row, so a signed-out/revoked session keeps its socket until token expiry. Re-check the active session like HTTP `authenticate`.
**Acceptance criteria:**
- [ ] A socket connection with a revoked session is rejected.
**Verification:**
- [ ] Manual/integration: sign out, then attempt socket connect with old token → refused.
**Dependencies:** None. **Files:** `server/services/socketService.ts`, `realtimeService.ts`. **Scope:** S.

### Checkpoint: Phase 2
- [ ] `type-check:all` + `test` + `build` + browser login smoke green.

---

## Phase 3 — Defense-in-depth / consistency

### Task 12: KYC magic-byte validation (S8)
**Description:** Uploads validate declared MIME + size but not content. Verify magic bytes and reject spoofed types.
**Acceptance criteria:** [ ] A file with an image MIME but non-image bytes is rejected.
**Verification:** [ ] Unit test on the validator; `npm run test`. **Files:** `server/routes/user.ts` (+ helper), test. **Scope:** S.

### Task 13: Idempotency on card-order creation (S9)
**Description:** Add a client/idempotency key to order creation and converge webhook vs OTP completion to one path so retries/concurrency can't double-create or double-credit.
**Acceptance criteria:** [ ] Duplicate create requests produce one order; concurrent webhook+OTP completion credits once.
**Verification:** [ ] Tests for duplicate create and concurrent completion. **Files:** `server/routes/cardCheckout.ts`, `server/routes/depositOtp.ts`, `server/db/init.ts`, tests. **Scope:** M.

### Task 14: `FOR UPDATE` on transfer/deposit paths (S12)
**Description:** Add row locking to the `transactions.ts` transfer/deposit wallet mutations for consistency with withdrawal/swap/gift-card paths.
**Acceptance criteria:** [ ] Wallet mutations select the row `FOR UPDATE` within the transaction.
**Verification:** [ ] Existing transaction tests still pass; add a concurrency test if feasible. **Files:** `server/routes/transactions.ts`, tests. **Scope:** S.

### Task 15: Remove `'unsafe-inline'` from CSP (S10)
**Description:** Replace inline-script/style allowance with nonces/hashes so CSP actually mitigates XSS.
**Acceptance criteria:** [ ] `scriptSrc`/`styleSrc` no longer contain `'unsafe-inline'`; app renders and HMR works in dev.
**Verification:** [ ] Browser DevTools shows no CSP violations on key pages; build succeeds. **Files:** `server/index.ts`, `index.html`. **Scope:** M.

### Task 16: Validate `:txHash` before TronGrid call (S14)
**Description:** Validate the hash format (hex/length) before interpolating into the outbound TronGrid URL.
**Acceptance criteria:** [ ] Malformed hash → 400 before any outbound request.
**Verification:** [ ] Test with malformed hash. **Files:** `server/routes/crypto.ts`, test. **Scope:** XS.

### Task 17: Centralized `sanitizeUser` helper (S15)
**Description:** Replace ad-hoc field allowlisting with one helper that strips `password_hash`/`two_factor_secret`/etc., used by all user-returning endpoints.
**Acceptance criteria:** [ ] All user responses go through the helper; no sensitive field leaks.
**Verification:** [ ] Grep shows no direct user-row spreads in responses; `npm run test`. **Files:** `server/lib/*`, `server/routes/*`, tests. **Scope:** M.

### Checkpoint: Complete
- [ ] All acceptance criteria met; `type-check:all` + `test` + `build` + browser smoke green; plan reviewed.
