# INDEPENDENT PR #13 FINAL CERTIFICATION

Prepared by an independent verification pass. Nothing in the prior remediation
report was taken on trust; every claim below is backed by a command run in this
session.

---

## 1. Revision tested

| | |
|---|---|
| Requested HEAD | `c340636` |
| HEAD at start of this pass | `c340636b6e50974d0c976553f80fd67849e5fb1b` — **exact match** |
| HEAD at end of this pass | `97a3c66` (5 new commits appended) |
| Immutable baseline | `baf0dd58f80af80f3a8ec23234ebd69846a73b09` |
| Branch | `claude/pr13-fix-all` |
| `baf0dd5..c340636` | 21 commits (10 original + 11 first-remediation), unchanged |
| PR branch `cursor/cardxc-deep-fix-6a35` | `baf0dd5` local **and** `origin/` — untouched |

History preserved: no merge, push, deploy, rebase, reset, squash, amend, clean or
rewrite. All new work is appended.

## 2. Working tree

Clean. `git status --short` reports only the untracked `node_modules` symlink.
Files changed by this pass (`c340636..97a3c66`) are listed in §6.

## 3. Environment proof — **PHASE 2 FAILED**

The task premise ("a machine that supports normal local socket binding and npm
registry access") is **false for this environment**. Diagnosed before touching
application code, per systematic-debugging; not classified as an application
failure.

| Probe | Result |
|---|---|
| `listen(0, '127.0.0.1')` | **EPERM** |
| `listen(0, '0.0.0.0')` | **EPERM** |
| `listen(45999, '127.0.0.1')` | **EPERM** |
| `listen(0, '::1')` | **EPERM** |
| Unix domain socket `listen(path)` | **EPERM** |
| `dns.lookup('registry.npmjs.org')` | **ENOTFOUND** |
| `dns.lookup('api.anthropic.com')` | **ENOTFOUND** |
| `npm ping` | **E403** — `Connection blocked by network allowlist` |
| `npm view express version` | **E403** |
| uid / platform | 501 / Darwin 25.2.0 arm64 |

Every socket family is denied, so no workaround exists and none was attempted.
Consequences: Phase 3 (`npm ci` from registry), Phase 4 (the 19 socket-bound
suites) and Phase 9 (`npm audit`) **cannot be satisfied here**.

**Phase 3, partial:** in a disposable clean checkout (`git archive` — no worktree
mutation) `npm ci --offline` from the committed lockfile exits **0**, adds 1005
packages, leaves every tracked file byte-identical (sha compared before/after),
and `node_modules/firebase` is **absent**. That validates lockfile integrity; it
is not a substitute for a registry install.

## 4. Test results — final tree, full suite, nothing excluded

```
Test Files  19 failed | 52 passed (71)
     Tests  98 failed | 655 passed (753)
  Duration  35.51s
  VITEST_EXIT=1
```

- `listen EPERM` occurrences: **98** — exactly 1:1 with the 98 failures
- `AssertionError` occurrences: **0**
- Skipped tests: **0**
- `.skip` / `.only` / `.todo` / `xit` / `xdescribe` in tracked tests: **NONE**
- No test file is excluded by config; no integration test was replaced by a mock

## 5. Socket-bound suites — **NOT EXECUTED**

I cannot confirm the 19 executed, because they did not. The failing-file set is
**byte-identical** to the 19 named in the brief (verified with `diff`):

adminWithdrawalApproval · aiRouteHardening · aiStreamAbort · cardCheckoutCheckout
· cardCheckoutStripeSession · cardCheckoutStripeWebhook · cardCheckoutWebhook ·
fluzAuthz · giftCardBuyFailClosed · giftCardPricing · legacyFullName ·
oauth2faGate · paymentsOverdraw · providerWebhookFailClosed · savingsVault ·
signupFullName · smoke · stripeSessionStatusIdor · webhookAuthBeforeLog

Four are money-path suites: `adminWithdrawalApproval`, `paymentsOverdraw`,
`savingsVault`, `cardCheckoutStripeWebhook`. **None of them ran.** They are not
called passed, not weakened, and not replaced.

## 6. Findings reproduced and fixed this pass

### F-1 · HIGH · Stripe webhook rejects every correctly-paid deposit (pre-existing)
- **Root cause** — `card_orders.amount_cents` is `BIGINT`; node-postgres maps OID
  20 to `parseBigInteger`, returning a **string** (`pg-types/lib/textParsers.js:167`),
  and no `setTypeParser` override exists. `paidAmount !== order.amount_cents`
  compared a JS number to that string, so `5000 !== "5000"` was always true.
- **RED** — with `amount_cents: "10000"` and `amount_total: 10000`, the order was
  marked `FAILED`, `CARD_PAYMENT_MISMATCH` was audited, `{received:true}`
  permanently ACKed the event, and no wallet credit occurred.
- **Fix** — `server/routes/cardCheckout.ts`: normalise with `Number()` before
  comparing; explicitly reject a null `paidAmount` or non-finite expectation.
- **GREEN** — matching payment credited; underpayment (5000/10000), overpayment
  (20000/10000) and missing `amount_total` all still refused with no credit.
- **Commit** `97a3c66`. Present at baseline `baf0dd5`; untouched by PR 13 until now.

### F-2 · HIGH · stablecoin credit silently skipped (regression from `012205b`)
- **Root cause** — `usdtCentsForFiatCents` guarded with
  `Number.isFinite(fiatCents)`, which does not coerce (ES2015: non-Number → false).
  `Number.isFinite("5000") === false`, so it returned `null` for every real row and
  every stablecoin credit was skipped while the fiat credit still committed — a
  systematic under-credit, mislabelled in the log as "unconvertible amount". The
  replaced code (`Math.round(order.amount_cents / USDT_RATE)`) coerced correctly.
- **RED** — `usdtCentsForFiatCents("10000", 1)` returned `null`.
- **Fix** — `server/lib/usdtRate.ts`: explicit `normaliseCents()` accepting number,
  bigint or strict digit string; still rejects exponent form, separators, signs,
  non-integers, unsafe magnitudes and bad rates.
- **GREEN** — string and number forms agree; all fail-safe cases still refuse.
- **Commit** `97a3c66`. Gated behind default-off `ENABLE_STABLECOIN_FULFILLMENT`,
  so not live — but it would have failed the moment the feature was enabled.

### F-3 · MEDIUM · `POST /vaults/:id/deposit` — 22P02 with message disclosure (Phase 6)
- **Root cause** — the one vault route left without path-id validation; `req.params.id`
  reached `WHERE id = $1` on a `uuid` column.
- **RED** — returned **500** and the response body contained the Postgres text
  `invalid input syntax for type uuid`. Information disclosure, not just a bad status.
  A SQL-ish id and a UUID-shaped-but-non-RFC-4122 id both reached the database.
- **Fix** — `param('id').isUUID()`; plus the vault credit predicate now carries
  `user_id` with `rowCount !== 1` throwing, so ownership is enforced in SQL and the
  wallet debit rolls back rather than the money landing in someone else's vault.
- **GREEN** — 400 `VALIDATION_ERROR`, **zero** statements executed, no Postgres text
  in the response.
- **Commit** `bae6105`.

### F-4 · MEDIUM · client USDT precision contradicted the server rule (Phase 5 caller audit)
- **Root cause** — the server now rejects >2 dp (the ledger is
  `usdt_balance_cents`), but the only calling UI advertised `step="0.00000001"`,
  placeholder `0.00000000`, and three `toFixed(8)` displays. A user entering
  `10.005` got an opaque 400. The MAX button was safe (balance derives from
  `usdt_balance_cents / 100`); manual entry was not.
- **Fix** — the server rule is **unchanged**. New `src/lib/usdtAmount.ts` mirrors it
  client-side (digit-string parse, rejects rather than truncates); the modal
  validates before submit, `step` is `0.01`, and displays render at ledger precision.
- **GREEN** — 15 tests, including a case replaying the **exact** accept/reject
  boundary set from the server suite so the two rules cannot drift.
- **Commit** `a9b2346`.

### F-5 · MEDIUM · `asset_type` migration cannot classify legacy USDT-funded bank rows
- **Root cause** — the back-fill covers only `withdrawal_type='crypto'`. Verified
  against baseline: the pre-change bank path with `walletType:'usdt'` debited
  `usdt_balance_cents` then inserted `withdrawal_type='bank', status='pending'`.
  Those rows inherit `asset_type='fiat'`. `/approve` and `/reject` both require a
  fiat reserve that was never taken (so they refuse and the row is unresolvable),
  `/usdt/refund` refuses them as `WRONG_ASSET_TYPE`, and if the user holds another
  pending fiat withdrawal whose reserve covers the amount, `/approve` could settle
  this row against **that** reserve — double-charging and stranding the other.
- **Fix** — the funding wallet was never persisted, so no migration can classify
  them. Rather than guess, at-risk rows are **flagged** `LEGACY_ASSET_TYPE_UNVERIFIED`
  in `admin_notes`: no status, no `asset_type`, no balance changed; existing notes
  preserved; `NOT LIKE` guard makes a re-run a no-op.
- **GREEN** — 11 tests: `ADD COLUMN` precedes the CHECK, the default prevents the
  CHECK failing on existing rows, both constraints dropped before adding
  (idempotent), the status CHECK is a strict **superset** of the previous list,
  every status literal written to `withdrawal_requests` anywhere in the tree is
  permitted, and the flag statement's SET clause touches `admin_notes` only.
- **Commit** `f1cc716`. **Residual: an operator must triage flagged rows.**

**Files changed this pass** (`git diff --stat c340636..97a3c66`): `server/db/init.ts`,
`server/lib/usdtRate.ts`, `server/routes/cardCheckout.ts`, `server/routes/savings.ts`,
`src/lib/usdtAmount.ts`, `src/pages/wallet/components/CryptoWithdrawModal.tsx`,
`server/routes/__tests__/savingsVault.test.ts` (fixture only), plus 4 new test files.

## 7. Money-path race verification — what was actually done

**Honest scope statement:** no real Postgres instance and no live concurrency were
available. Races were verified two ways: (a) reading the SQL and reasoning from
documented READ COMMITTED / EvalPlanQual semantics; (b) socket-free behavioural
tests that drive the real Express routers in-process with a mock client which
*models* Postgres predicate and NULL-arithmetic semantics, so changing the modelled
state changes the HTTP outcome. That is stronger than a source grep and weaker than
a real database. It is **not** a substitute for the four unexecuted money-path suites.

Concurrency scenarios exercised this way (existing + new):
- claim lost (`rowCount 0`) on all four card-order fulfillment paths → no credit, no
  ledger row, no completion audit
- admin USDT settle vs refund, and duplicate refund → exactly one balance effect
- reserve write with `reserved_cents` NULL / 0 / >0, available exactly equal to the
  debit, one cent below, and a concurrent drain
- bank and platform idempotency: same key + same payload, same key + conflicting
  payload (409), and the concurrent `23505` loser
- unrelated unique violations and a CHECK violation injected into the fulfillment
  transaction → propagate as errors; Stripe not ACKed

## 8. Static gates — exact exit codes

| Gate | Command | Exit |
|---|---|---|
| Server type-check | `tsc --noEmit -p tsconfig.server.json` | **0** |
| Frontend type-check | `tsc --noEmit -p tsconfig.app.json` | **0** |
| Lint | `eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0` | **0** |
| Production build | `vite build` | **0** (`✓ built in 2.29s`) |

Nothing suppressed. Caveat recorded: `tsconfig.server.json` sets `strict: false`,
`strictNullChecks: false`, `noImplicitAny: false` — exit 0 is a weak diagnostic, not
a strong type proof. That weakness is exactly what let F-1 and F-2 (string vs number)
pass type-check.

## 9. npm audit — **NOT VERIFIED**

| Command | Result |
|---|---|
| `npm audit` | exit **1** — `403 Forbidden`, `Connection blocked by network allowlist` |
| `npm audit --omit=dev` | exit **1** — same |

No advisory count, severity split, reachability, or fix-availability classification
can be given. No offline inspection is offered as a substitute, and nothing is
hidden. Single package root (one `package.json`). No dependency was changed this
pass; `npm audit fix --force` was not run.

## 10. Remaining blockers — stated plainly

1. **The 19 socket-bound suites did not execute**, including four money-path suites.
   `listen()` is EPERM for TCP (v4/v6, ephemeral and fixed) and for Unix sockets.
2. **`npm audit` is unverified** — the registry is blocked by a network allowlist.
3. **`npm ci` from the registry was not performed** — only an offline install from
   the committed lockfile.
4. **No real Postgres** — the `asset_type` / `held` migration has never been
   executed. Its statement shape and ordering are asserted; its runtime behaviour
   is not.
5. **Legacy row triage outstanding** — flagged `LEGACY_ASSET_TYPE_UNVERIFIED` rows
   need a human decision (F-5).
6. **Three adversarial reviewer passes (Phase 10) were dispatched and had not
   returned when this document was written.** Their findings are therefore **not**
   incorporated. This is a gap in Phase 10, not a pass.
7. **Self-certification limit** — I authored F-1…F-5. Per the brief's own rule I am
   not a valid approver for them; they need a subsequent independent adversarial pass.
8. **CSP retains `unsafe-inline`** on `scriptSrc` and `styleSrc` (documented
   rationale in `server/index.ts`). Unchanged this pass.
9. **Provider / legal readiness: NOT VERIFIED.** No approval state was upgraded; a
   grep of all added lines for `PROVIDER_APPROVED` / `PRODUCTION_ENABLED` /
   `LEGAL_CLEARED` / `PCI compliant` / `certified` / `production ready` returns nothing.

**Preserved invariants (re-verified on the final tree):** `COMPANY_NAME = 'CARDXC LLC'`;
`CRYPTO_AUTO_PAYOUT_ENABLED === 'true'` (default OFF); `ENABLE_STABLECOIN_FULFILLMENT === 'true'`
(default OFF); `CRYPTO_PROVIDER || 'manual'`; **0** GameNova runtime references; **0**
literal `NODE_ENV === 'production'` comparisons left in non-test server code (the one
grep hit is a comment).

## 11. MERGE GO / NO-GO — **MERGE NO-GO**

Mandated by the brief's own rule: required money-path gates remain unexecuted
(blocker 1) and the dependency gate is unverified (blocker 2). Independently of
that rule, this pass found **two HIGH defects** in code the previous report
presented as complete — one pre-existing (F-1: every paid Stripe deposit rejected)
and one a regression introduced by the previous pass (F-2). Both are now fixed with
RED→GREEN evidence, but their existence is direct evidence that the mock-based
verification available in this environment is not sufficient to certify this PR.

## 12. PRODUCTION GO / NO-GO — **PRODUCTION NO-GO**

Follows from §11, plus: the migration has never run against Postgres, deployment is
a human-only action, and provider/legal readiness is unverified.

---

### What a valid certification requires next

On a host that permits `listen()` and reaches `registry.npmjs.org`:
`npm ci`; the full suite with **all 19** socket-bound suites executing; `npm audit`
and `npm audit --omit=dev` with findings classified; the `asset_type` / `held`
migration applied to a scratch Postgres with real concurrent settle/refund and
webhook/OTP/replay races; and an independent adversarial review of F-1…F-5, which
this pass authored and therefore cannot approve.

No integration, merge, push or deployment commands are provided.
