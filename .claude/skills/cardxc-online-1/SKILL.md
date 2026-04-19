```markdown
# cardxc-online-1 Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill provides guidance on contributing to the `cardxc-online-1` TypeScript codebase. It covers established coding conventions, common workflows for linting and auditing, and testing patterns. The repository is organized without a specific framework and uses a mixture of code and configuration files, with a focus on code quality and security.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `userProfile.ts`, `dashboardWidget.tsx`

### Import Style
- Use **relative imports** for modules within the project.
  - Example:
    ```typescript
    import { getUser } from './userService';
    import Dashboard from '../components/dashboard';
    ```

### Export Style
- **Mixed**: Both named and default exports are used.
  - Example (named export):
    ```typescript
    export function validateInput(input: string): boolean { ... }
    ```
  - Example (default export):
    ```typescript
    export default Dashboard;
    ```

### Commit Patterns
- Commits are **freeform**, sometimes prefixed with `audit`.
- Average commit message length: ~62 characters.
  - Example: `audit: fix unused variable in wallet middleware`

## Workflows

### Lint Error Remediation
**Trigger:** When you need to resolve lint errors project-wide, especially after updating lint rules or dependencies.  
**Command:** `/fix-lint-errors`

1. Update `eslint.config.ts` to adjust rules or ignore patterns as needed.
2. Refactor source files to comply with new or existing lint rules (e.g., prefix unused variables with an underscore).
    - Example:
      ```typescript
      // Before
      const unusedVar = 42;

      // After (to satisfy @typescript-eslint/no-unused-vars)
      const _unusedVar = 42;
      ```
3. Update related configuration files if necessary (e.g., `tsconfig.json`, `package-lock.json`).
4. Run the linter to ensure all issues are resolved.

**Files Involved:**
- `eslint.config.ts`
- `src/**/*.tsx`
- `src/**/*.ts`
- `package-lock.json`
- `tsconfig.*.json`

### Audit, Bugfix, and Hardening
**Trigger:** When initiating a codebase audit for security, stability, or compliance.  
**Command:** `/run-audit`

1. Identify and fix bugs and security issues in middleware and core logic.
2. Update or add tests for critical components and middleware.
    - Example:
      ```typescript
      // server/middleware/__tests__/authMiddleware.test.ts
      import { authenticate } from '../authMiddleware';

      test('should reject invalid tokens', () => {
        // ...
      });
      ```
3. Harden configuration files and middleware logic.
4. Update related UI components if needed to reflect backend or logic changes.

**Files Involved:**
- `server/middleware/**/*.ts`
- `server/middleware/__tests__/*.test.ts`
- `src/pages/dashboard/components/*.tsx`
- `src/pages/wallet/components/*.tsx`
- `src/contexts/*.ts*`

## Testing Patterns

- **Test files** follow the pattern `*.test.*` (e.g., `authMiddleware.test.ts`).
- The specific testing framework is **unknown**, but tests are colocated with the code (especially in middleware).
- Example test file:
  ```typescript
  // server/middleware/__tests__/rateLimiter.test.ts
  import { rateLimiter } from '../rateLimiter';

  test('should limit requests', () => {
    // test implementation
  });
  ```

## Commands

| Command            | Purpose                                            |
|--------------------|---------------------------------------------------|
| /fix-lint-errors   | Fix all lint errors project-wide                  |
| /run-audit         | Perform a security/code audit and hardening pass  |
```