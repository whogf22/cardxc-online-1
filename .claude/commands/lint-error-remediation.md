---
name: lint-error-remediation
description: Workflow command scaffold for lint-error-remediation in cardxc-online-1.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /lint-error-remediation

Use this workflow when working on **lint-error-remediation** in `cardxc-online-1`.

## Goal

Fixing ESLint errors (e.g., @typescript-eslint/no-unused-vars) across multiple source files, updating lint config, and refactoring code to comply with lint rules.

## Common Files

- `eslint.config.ts`
- `src/**/*.tsx`
- `src/**/*.ts`
- `package-lock.json`
- `tsconfig.*.json`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Update eslint.config.ts to adjust rules or ignore patterns
- Refactor source files to comply with new or existing lint rules (e.g., prefix unused variables with underscore)
- Update related configuration files if necessary (e.g., tsconfig, package-lock.json)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.