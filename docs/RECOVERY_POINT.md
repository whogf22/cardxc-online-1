# Recovery Point

Recorded 2026-08-22 (UTC). Reference-only record: **no tag, branch, or push was created by
this document.** Creating the backup reference and any pushing requires owner authorization.

## 1. State at the start of this phase

| Item | Value |
| --- | --- |
| Repository | `whogf22/cardxc-online-1` |
| Branch checked out at start | `main` |
| HEAD SHA at start | `34108102ffecd7caf6baa7d84f1a13e0d6198857` |
| `git status --short` | *(empty — clean working tree)* |
| `git diff` | *(empty)* |
| `git diff --cached` | *(empty)* |
| Untracked files | none |
| Shallow clone? | No (`git rev-parse --is-shallow-repository` → `false`) |

No unexpected local, staged, or untracked change existed, so nothing had to be stopped for.

## 2. Key references

| Reference | SHA |
| --- | --- |
| `main` HEAD (`origin/main`, `origin/HEAD`) | `34108102ffecd7caf6baa7d84f1a13e0d6198857` (`34108102`) |
| PR #13 HEAD — `cursor/cardxc-deep-fix-6a35` | `baf0dd58f80af80f3a8ec23234ebd69846a73b09` (`baf0dd58`) |
| PR #13 merge base with `main` | `34108102ffecd7caf6baa7d84f1a13e0d6198857` (branch is linear on top of `main`) |
| PR #13 merged into `main`? | **No** |
| `origin/backup-before-purge` | `08cd1aa` (pre-existing remote reference, not created here) |
| `origin/cursor/dev-environment-setup-6a35` | `32ee1fb` (pre-existing) |
| Working branch for this documentation phase | `devin/1787372747-provider-v2-docs`, based on `34108102` |

The current HEAD of the documentation branch differs from `34108102` only by the commit that
adds the five files in `docs/` (see `DEVIN_CHANGE_MANIFEST.md`).

## 3. Proposed immutable backup reference (NOT created)

| Item | Value |
| --- | --- |
| Proposed tag name | `backup/pre-provider-v2-20260822` |
| Exact commit it must point at | `baf0dd58f80af80f3a8ec23234ebd69846a73b09` (PR #13 HEAD — the work that must be preserved) |
| Secondary tag (optional) | `backup/pre-provider-v2-main-20260822` → `34108102ffecd7caf6baa7d84f1a13e0d6198857` |

Rationale for pointing the primary backup at `baf0dd58` rather than `main`: `main` is already
protected by `origin/main`, whereas the remediation work at risk of loss is the unmerged
PR #13 branch.

## 4. Commands the owner would run (do not run without authorization)

Local, non-destructive — creates references only, changes no file:

```bash
# annotated, immutable-by-convention local tags
git tag -a backup/pre-provider-v2-20260822 baf0dd58f80af80f3a8ec23234ebd69846a73b09 \
  -m "Backup of PR #13 remediation HEAD before provider v2 work"
git tag -a backup/pre-provider-v2-main-20260822 34108102ffecd7caf6baa7d84f1a13e0d6198857 \
  -m "Backup of main before provider v2 work"

# optional local branch pointers (same commits)
git branch backup/pre-provider-v2-20260822-branch baf0dd58f80af80f3a8ec23234ebd69846a73b09
```

Verify:

```bash
git rev-parse backup/pre-provider-v2-20260822        # must print baf0dd58f80af80f3a8ec23234ebd69846a73b09
git rev-parse backup/pre-provider-v2-main-20260822   # must print 34108102ffecd7caf6baa7d84f1a13e0d6198857
```

Publishing (**requires explicit owner authorization** — pushing makes the reference and
anything reachable from it visible to everyone with repository access):

```bash
git push origin refs/tags/backup/pre-provider-v2-20260822
git push origin refs/tags/backup/pre-provider-v2-main-20260822
```

A safer alternative to pushing is a bare local mirror kept off the remote:

```bash
git clone --mirror https://github.com/whogf22/cardxc-online-1.git \
  ~/cardxc-online-1-mirror-20260822.git
```

## 5. Constraints

- Never use `git tag -f`, `git tag -d`, or `git push --delete` on a backup reference.
- Never force-push over `main` or `cursor/cardxc-deep-fix-6a35`.
- Do not push any local branch that could contain uncommitted or sensitive local work; push
  only the exact tags above, after authorization.
- Restoring from a backup reference is itself a destructive operation on the current branch —
  it requires its own approval and a `DEVIN_CHANGE_MANIFEST.md` entry.

## 6. Not verified

- Remote branch protection rules, required checks, and who can push to `main` — `NOT VERIFIED`
  (not inspected in this phase).
- Existence of any off-repository backup (database dumps, provider dashboards, Cloudflare
  configuration) — `OWNER INPUT REQUIRED`.
- Whether `origin/backup-before-purge` (`08cd1aa`) is still needed — `OWNER INPUT REQUIRED`;
  it was left untouched.
