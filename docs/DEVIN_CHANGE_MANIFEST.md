# Devin Change Manifest (ledger)

Every change made by an agent (or anyone) to this repository from this point on must be
recorded here as an entry using the template below. One entry per logical change (usually
one commit or one PR). No entry may be edited retroactively except to append corrections
labelled as such.

Any field that cannot be established from the repository itself must be marked
`NOT VERIFIED`, `OWNER INPUT REQUIRED`, `LEGAL REVIEW REQUIRED`, or
`PROVIDER CONFIRMATION REQUIRED`.

## Entry template

```
### <YYYY-MM-DD> — <short title>

- Change:
- Reason:
- Files:
- Existing behavior:
- New behavior:
- PR #13 interaction:
- Provider impact:
- Database impact:
- Security impact:
- Tests before:
- Tests after:
- Breaking change:
- Rollback:
- Evidence:
```

Field meanings:

| Field | What to record |
| --- | --- |
| Change | What was done, in one sentence. |
| Reason | Why it was done, and who asked for it. |
| Files | Exact paths added/modified/deleted. |
| Existing behavior | Behavior before the change, verified in code. |
| New behavior | Behavior after the change, verified in code/tests. |
| PR #13 interaction | Whether the change touches, depends on, or could regress any PR #13 remediation (see `PR13_INVENTORY.md`). |
| Provider impact | Stripe / Fluz / TronGrid / crypto payout / any future provider. State `NONE` if untouched. |
| Database impact | Schema, migration, or data-mutating effects. State `NONE` if untouched. |
| Security impact | Auth, RBAC, webhook verification, fail-closed posture, secrets, PII. |
| Tests before | Test state before the change (command + result, or `NOT RUN`). |
| Tests after | Test state after the change (command + result, or `NOT RUN`). |
| Breaking change | API/contract/env-var/DB breaking? Yes/No + detail. |
| Rollback | Exact steps to undo, non-destructively. |
| Evidence | Commit SHAs, file:line references, test output, PR links. |

---

## Entries

### 2026-08-22 — Documentation and inventory scaffolding (this phase)

- Change: Added five new documentation files under `docs/`:
  `DEVIN_CHANGE_MANIFEST.md`, `DO_NOT_TOUCH_WITHOUT_APPROVAL.md`, `PR13_INVENTORY.md`,
  `FEATURE_INVENTORY.md`, `RECOVERY_POINT.md`.
- Reason: Owner-requested non-destructive documentation-and-inventory phase preceding any
  provider work (Privy / Meld / Crossmint / Daimo). Establishes a change ledger, a
  do-not-touch register, a verified record of the PR #13 remediation surface, a feature
  inventory, and a recovery reference — before any implementation is proposed.
- Files: `docs/DEVIN_CHANGE_MANIFEST.md`, `docs/DO_NOT_TOUCH_WITHOUT_APPROVAL.md`,
  `docs/PR13_INVENTORY.md`, `docs/FEATURE_INVENTORY.md`, `docs/RECOVERY_POINT.md`
  (all newly created; no existing file added, modified, or deleted).
- Existing behavior: No change ledger, do-not-touch register, PR #13 inventory, feature
  classification, or recovery-point record existed on `main`.
- New behavior: Same runtime behavior (documentation only). The five documents now exist as
  the reference set for subsequent phases.
- PR #13 interaction: None functional. `PR13_INVENTORY.md` reads and documents branch
  `cursor/cardxc-deep-fix-6a35` (HEAD `baf0dd58`) read-only; nothing on that branch was
  modified, merged, rebased, or cherry-picked. No PR #13 remediation was altered.
- Provider impact: NONE. No provider code, credential, configuration, or SDK was touched.
  No Privy / Meld / Crossmint / Daimo integration was implemented.
- Database impact: NONE. No schema, migration, or query was added or changed; no database
  was connected to.
- Security impact: NONE to runtime behavior. No secret values are recorded in these
  documents; `.env`, `.env.production.example`, and all secret-bearing paths were untouched.
  `DO_NOT_TOUCH_WITHOUT_APPROVAL.md` raises the approval bar for sensitive areas.
- Tests before: NOT RUN (documentation-only phase; no test, build, lint, or install command
  was executed). Last recorded baseline is PR #13's own gate record in
  `docs/CARDXC_DEEP_FIX_AUDIT.md` on branch `cursor/cardxc-deep-fix-6a35`
  (`npm test` PASS 112/112, `type-check:all` PASS, `build` PASS, `lint` PASS) —
  NOT re-verified in this phase.
- Tests after: NOT RUN (same reason).
- Breaking change: No.
- Rollback: Delete the five added files (`git rm docs/DEVIN_CHANGE_MANIFEST.md
  docs/DO_NOT_TOUCH_WITHOUT_APPROVAL.md docs/PR13_INVENTORY.md docs/FEATURE_INVENTORY.md
  docs/RECOVERY_POINT.md`) or close/revert the documentation PR. No other artifact is
  affected.
- Evidence: Base branch `main` at `34108102ffecd7caf6baa7d84f1a13e0d6198857` with a clean
  working tree (`git status --short` empty, `git diff` empty, `git diff --cached` empty) at
  the start of the phase; PR #13 branch `cursor/cardxc-deep-fix-6a35` at
  `baf0dd58f80af80f3a8ec23234ebd69846a73b09`. Claim-by-claim verification for
  `PR13_INVENTORY.md` is cited inline in that document.
