---
name: audit-bugfix-and-hardening
description: Workflow command scaffold for audit-bugfix-and-hardening in cardxc-online-1.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /audit-bugfix-and-hardening

Use this workflow when working on **audit-bugfix-and-hardening** in `cardxc-online-1`.

## Goal

Performing a security or code audit, which includes fixing bugs, addressing security issues, resolving lint errors, adding or updating tests, and hardening configuration or middleware.

## Common Files

- `server/middleware/**/*.ts`
- `server/middleware/__tests__/*.test.ts`
- `src/pages/dashboard/components/*.tsx`
- `src/pages/wallet/components/*.tsx`
- `src/contexts/*.ts*`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Identify and fix bugs and security issues in middleware and core logic
- Update or add tests for critical components and middleware
- Harden configuration files and middleware logic
- Update related UI components if needed

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.