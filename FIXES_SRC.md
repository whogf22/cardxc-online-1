# Frontend Security Fixes — src/ scope

**Date:** 2026-04-17
**Scope:** `src/**` + `index.html` + `vite.config.ts`
**Audit source:** `AUDIT_SRC.md`

All 20 findings from `AUDIT_SRC.md` are addressed below.

---

## CRITICAL

| # | Finding | File:Line | Fix |
|---|---------|-----------|-----|
| 1 | `VITE_ADYEN_API_KEY` referenced in client bundle | `src/lib/paymentUtils.ts:67-80` | Removed `VITE_ADYEN_API_KEY` and `VITE_ADYEN_MERCHANT_ACCOUNT` references. `hasAdyenConfig()` now only checks the public `VITE_ADYEN_CLIENT_KEY`; added TODO to replace with a backend config endpoint. |
| 2 | Auth tokens read from localStorage/sessionStorage | `src/pages/wallet/components/DepositModal.tsx:26-55` | Replaced all three `localStorage.getItem('token')` reads with `credentials: 'include'` so the httpOnly session cookie (consistent with `AuthContext`) carries auth. Dropped `Authorization: Bearer ${token}` header. |

## HIGH

| # | Finding | File:Line | Fix |
|---|---------|-----------|-----|
| 3 | `helpP.innerHTML = ...` XSS pattern | `src/main.tsx:192-209` | Replaced with `document.createElement('code')` + `textContent` + `appendChild` safe DOM construction. |
| 4 | `rootElement.innerHTML = ''` | `src/main.tsx:229` | Replaced with `rootElement.replaceChildren(errorContainer)`. |
| 5 | `error_description` rendered without allowlist | `src/pages/signin/page.tsx:9-34, 56-60` | Added `KNOWN_ERRORS` map, `resolveSigninError()` with 120-char limit and `[\w .,!?-]` character-class strip, generic fallback. |
| 6 | Hash-fragment tokens not cleared before await | `src/pages/auth/callback/page.tsx:34-58, 174-203` | `history.replaceState(null, '', pathname + search)` is now called synchronously inside `handleAuthCallback` after token extraction and BEFORE any await; also called in the outer `useEffect` error branch. |
| 7 | No CSP in `index.html` | `index.html:11-19` | Added `<meta http-equiv="Content-Security-Policy">` with directives from the task spec (default-src 'self', connect-src, frame-src for Stripe, object-src 'none', etc.). |
| 8 | CDN stylesheets without SRI / `crossorigin` | `index.html:65-83` | Added `crossorigin="anonymous"` to all three CDN link tags (both preload and noscript fallbacks). Left a TODO for pinning sha384 integrity hashes — could not compute hashes because the sandboxed shell denies `curl` / `openssl` / `node` network access; the task instruction to compute hashes via Bash was blocked by the environment. fontshare CSS is dynamic so SRI is infeasible (noted inline). |

## MEDIUM

| # | Finding | File:Line | Fix |
|---|---------|-----------|-----|
| 9 | `session_id` not validated before use | `src/pages/wallet/components/DepositModal.tsx:112-128` | Added `STRIPE_SESSION_ID_RE = /^cs_[a-zA-Z0-9_]+$/`; mismatched values set error state and clear the query string instead of proceeding. |
| 10 | Bare `ADYEN_CLIENT_KEY` fallback | `src/lib/paymentUtils.ts:36-50` | Removed bare `ADYEN_CLIENT_KEY` fallback. Only `VITE_ADYEN_CLIENT_KEY` is used; a dev-mode console warning fires when missing, and UI disables itself via `checkAdyenConfig()` returning false. |
| 11 | Raw `err.message` / `err.code` rendered | `src/pages/auth/callback/page.tsx:8-25, 161-171, 271-286` | Added `friendlyAuthError()` mapping; all SDK errors are logged via `console.error` but the user sees only the mapped friendly string. Resend error path also updated. |
| 12 | `error_description` length/charset limits | `src/pages/signin/page.tsx:9-34` | Handled together with #5. |
| 13 | `sanitizeText` dual-use confusion | `src/lib/inputSanitizer.ts:16-30, 55` | Renamed `sanitizeText` → `escapeForHTMLAttribute` with JSDoc explaining the single intended usage context. Internal caller in `validateAndSanitizeInput` updated. No external callers exist in `src/`. |

## LOW

| # | Finding | File:Line | Fix |
|---|---------|-----------|-----|
| 14 | PII email read from localStorage | `src/pages/auth/callback/page.tsx:244-270` | No frontend writer exists in `src/` (confirmed via grep across repo). Reads now prefer `sessionStorage`, fall back to a one-time legacy localStorage read which is immediately `removeItem`-d, so stale PII does not persist. |
| 15 | `[Auth]` console.log noise | `src/contexts/AuthContext.tsx:48,66,72,161,214,257` | All five flagged `console.log('[Auth] ...')` sites are now guarded with `if (import.meta.env.DEV)`. |
| 16 | Client-side `payment_disabled_mode` flag | `src/pages/admin-operations/components/PaymentSettingsTab.tsx:26-100` | Removed `localStorage.setItem('payment_disabled_mode', ...)` and the corresponding read. Added `fetch('/api/admin/payment-mode')` GET + POST with `credentials:'include'`, fail-closed on error, and a TODO for the backend endpoint. |
| 17 | Card metadata cached in localStorage | `src/pages/cards/page.tsx:16-22, 119-126` | Removed the initial-state localStorage read and the persisting `useEffect`. Added a mount-time `localStorage.removeItem('cardxc_prepaid_cards')` to clean up legacy caches. |
| 18 | SRI absent on CDN stylesheets | `index.html:65-83` | Handled together with #8. |
| 19 | Build metadata exposed | `index.html:9-11` | Removed `<meta name="build-version">` and `<meta name="build-timestamp">`. |
| 20 | `server.cors: true` / `preview.cors: true` | `vite.config.ts:70-103` | Replaced with explicit `{ origin: ["http://localhost:5173", "http://localhost:3000"], credentials: true }` on both `server` and `preview`. Confirmed `sourcemap: false` remains. |

---

## Items with caveats

- **SRI hashes (#8 / #18)** — I was unable to compute `sha384-...` integrity values for remixicon and font-awesome; the sandbox denied both `curl`/`openssl` and `node`-based network access. I added `crossorigin="anonymous"` today (a prerequisite for SRI) and left an inline TODO with the exact shell command so the hashes can be pinned in a follow-up. The CSP meta tag added in #7 already restricts which origins may serve CSS, which provides defence-in-depth until SRI is pinned.
- **Payment-mode backend endpoint (#16)** — the code now calls `/api/admin/payment-mode` but the backend route is out of scope for this patch. TODO left inline. The client fails closed (treats payments as disabled) if the endpoint is not yet live.
- **Adyen backend proxy (#1)** — client code no longer references the server API key. The task noted that client code that currently calls Adyen directly should be replaced with `fetch('/api/payments/adyen/...')`; no such direct client-side Adyen SDK call existed in `src/` (only the env-var checks in `paymentUtils.ts`), so only the env-var references required removal. TODO left for the future backend config endpoint.
