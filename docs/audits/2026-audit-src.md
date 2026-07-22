# Frontend Security Audit — src/ scope
**Date:** 2026-04-17  
**Scope:** `/Users/sakib/cardxc-online-1/src/**` + `index.html`  
**Auditor:** Security Reviewer Agent

---

## CRITICAL

| Severity | File:Line | Excerpt | Fix |
|----------|-----------|---------|-----|
| CRITICAL | `src/lib/paymentUtils.ts:69` | `import.meta.env.VITE_ADYEN_API_KEY` — Adyen API key (a server-side payment processing secret) is referenced client-side via a `VITE_` prefix, meaning it is bundled into the browser-accessible JS payload | Move Adyen API key operations server-side only. The client should only ever hold the public `clientKey`. Never prefix payment processor API keys with `VITE_`. |
| CRITICAL | `src/pages/wallet/components/DepositModal.tsx:28,37,46` | `localStorage.getItem('token') \|\| sessionStorage.getItem('token')` — auth token read from `localStorage`/`sessionStorage` and placed directly into `Authorization: Bearer` headers. Any XSS on any page exfiltrates this token permanently. | Use `httpOnly` cookies for auth tokens. If a bearer pattern is required, the token must never touch `localStorage`/`sessionStorage`. |

---

## HIGH

| Severity | File:Line | Excerpt | Fix |
|----------|-----------|---------|-----|
| HIGH | `src/main.tsx:192` | `helpP.innerHTML = 'Please check your <code style=...>.env</code> file...'` — direct `innerHTML` assignment with a hardcoded string. Although the value is a constant today, this establishes a pattern of unsafe DOM injection in bootstrap error-handling code that runs before React initialises. | Use `document.createElement('code')` + `textContent` for each code element, then assemble via `appendChild`. The existing PR comment "SECURITY FIX: Escape error message" shows awareness of the risk but the fix was not applied consistently to this sibling element. |
| HIGH | `src/main.tsx:212` | `rootElement.innerHTML = ''` — clears the root via `innerHTML` rather than `replaceChildren()` or repeated `removeChild()`. Benign now, but combined with line 192 this function mixes safe and unsafe DOM patterns in critical startup code. | Replace with `rootElement.replaceChildren()` (supported in all modern targets). |
| HIGH | `src/pages/signin/page.tsx:30-32` | `setError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')))` — URL query param `error_description` is decoded and placed into React state which is then rendered into the DOM. React auto-escapes text interpolation (`{error}`) so XSS via the DOM is blocked, **but** if this string is ever passed to a component that renders it via `dangerouslySetInnerHTML` or logged to an analytics/error platform, it becomes a reflected XSS vector. An attacker can craft a phishing URL with a convincing fake error message. | Allowlist expected error strings or truncate + strip non-printable characters before setting state. Do not trust `error_description` from the URL. |
| HIGH | `src/pages/auth/callback/page.tsx:20,143-144` | `accessToken` and `refreshToken` are extracted from `window.location.hash` (fragment) and passed to `supabase.auth.setSession()`. Hash fragments are readable by all scripts on the page. If any third-party script runs before the fragment is consumed and cleared, tokens are exposed. | Consume and clear the hash immediately upon extraction (`history.replaceState('', '', location.pathname + location.search)`). Consider using PKCE with the code parameter in the query string instead of implicit-flow tokens in the hash. |
| HIGH | `index.html` — no `Content-Security-Policy` meta tag or HTTP header observed | Three external stylesheet origins (`api.fontshare.com`, `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`) load with no `integrity=` SRI attribute and no CSP to restrict the allowed origins. A compromised CDN can inject arbitrary CSS capable of exfiltrating form data (CSS data exfiltration). | Add `integrity=` SRI hashes to all CDN `<link>` tags. Add a `Content-Security-Policy` header (preferably at the edge/Cloudflare layer) with `style-src 'self' 'nonce-{N}' https://api.fontshare.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com`. |
| HIGH | `index.html` — no security headers present | No `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, or `Permissions-Policy` headers are set in `index.html` or observed in build config. This is a fintech app. | Configure these headers at the Cloudflare Workers edge layer or via `wrangler.jsonc` response headers. Minimum: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`. |

---

## MEDIUM

| Severity | File:Line | Excerpt | Fix |
|----------|-----------|---------|-----|
| MEDIUM | `src/pages/wallet/components/DepositModal.tsx:112-140` | `new URLSearchParams(window.location.search)` reads `deposit` and `session_id` params, then calls `checkoutApi.getStripeSessionStatus(returnSessionId)` with the raw value. No validation of `returnSessionId` format before it is sent as a query parameter to the backend API. | Validate that `session_id` matches the expected Stripe session ID format (`/^cs_[a-zA-Z0-9_]+$/`) before use. |
| MEDIUM | `src/lib/paymentUtils.ts:38-39` | `import.meta.env.ADYEN_CLIENT_KEY` (without `VITE_` prefix) is accessed client-side. Non-`VITE_` env vars are **not** inlined by Vite and will resolve to `undefined` at runtime — but the code silently falls back, masking misconfiguration. | Remove the bare `ADYEN_CLIENT_KEY` fallback; only use `VITE_ADYEN_CLIENT_KEY` on the frontend. |
| MEDIUM | `src/pages/auth/callback/page.tsx:134` | `catch (err: any)` — `err.message` and `err.code` are taken directly from a caught exception of unknown origin and displayed to users via `setError()`. Depending on the Supabase SDK error format, internal messages including stack traces or server details could be surfaced. | Sanitize or allowlist error messages before displaying. Map known error codes to user-friendly strings; fall back to a generic message for unknown codes. |
| MEDIUM | `src/pages/signin/page.tsx:30-32` (open redirect risk) | The `error_description` query param is displayed in the UI. While `navigate()` calls all use hardcoded paths, a social-engineering attack via a crafted `?error_description=Your+session+expired.+Click+here+to+re-enter+your+password` can make the legitimate signin page display fake instructions. | Strip HTML, limit length to ~200 chars, and only display pre-approved error messages. |
| MEDIUM | `src/lib/inputSanitizer.ts:22-23` | `sanitizeText` reads `div.innerHTML` after setting `div.textContent`. This is a correct HTML-entity-encoding technique, but `div.innerHTML` returns HTML entities (`&amp;`, `&lt;`, etc.) which will double-encode if the result is later inserted via `textContent`. The dual-use of the same function for both "safe text for textContent" and "safe text for innerHTML" contexts increases confusion. | Rename to `encodeForHTMLAttribute` and document the single intended usage context. Use `escapeHTML` (already present) for string-level escaping. |
| MEDIUM | `vite.config.ts:46` | `sourcemap: false` — source maps are correctly disabled in production. **No finding.** *(Recorded here to confirm check was performed.)* | No action required. |

---

## LOW

| Severity | File:Line | Excerpt | Fix |
|----------|-----------|---------|-----|
| LOW | `src/pages/auth/callback/page.tsx:197-198` | `localStorage.getItem('pending_signup_email')` and `localStorage.getItem('signup_email')` — email address stored in localStorage. No code was found that writes these keys within the audited `src/` scope (the writer may be in `server/` or an external flow). PII in localStorage is accessible to any XSS. | Confirm write location; if frontend-written, use `sessionStorage` or pass via URL state instead. |
| LOW | `src/contexts/AuthContext.tsx:48,66,161,205,214` | Multiple `console.log('[Auth] Signing in')`, `console.log('[Auth] Signing out')`, `console.log('[Auth] Checking authentication')` statements in production auth code. Verbose auth lifecycle logging aids attackers doing recon in dev tools. | Guard with `if (import.meta.env.DEV)` or use the project's `logger.ts` which already gates on `isDev`. |
| LOW | `src/pages/admin-operations/components/PaymentSettingsTab.tsx:72` | `localStorage.setItem('payment_disabled_mode', ...)` — a client-side flag controls whether payments are enabled. Any user in the browser console can set `localStorage.setItem('payment_disabled_mode','false')` to re-enable payments. | Payment feature flags must be enforced server-side. Client-side flags are advisory UI only. |
| LOW | `src/pages/cards/page.tsx:119` | `localStorage.setItem('cardxc_prepaid_cards', JSON.stringify(prepaidCards))` — virtual card data cached in localStorage. Card metadata (last 4 digits, card IDs) persisting in localStorage is accessible to any XSS. | Use `sessionStorage` at most; prefer server-side session. Clear on sign-out. |
| LOW | `index.html:56-77` — CDN resources without SRI | `https://api.fontshare.com`, `https://cdn.jsdelivr.net/npm/remixicon@4.6.0/fonts/remixicon.css`, `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css` loaded without `integrity=` attributes. | Add `integrity=` SRI hashes. Example: `integrity="sha384-..."`. |
| LOW | `index.html` — build metadata exposed | `<meta name="build-version" content="155.0" />` and `<meta name="build-timestamp" content="2026-04-16T11:00:00Z" />` are publicly visible. Attackers use version + timestamp to look up known vulnerabilities in specific build artefacts. | Remove from the HTML `<head>`. Embed version in a non-public monitoring endpoint or a comment stripped at build time. |

---

## Zero-Hit Checks (clean)

| Check | Result |
|-------|--------|
| `dangerouslySetInnerHTML` in src/ | Zero occurrences — clean |
| Hardcoded `sk_live_`, `sk_test_`, `SG.`, JWT secrets in src/ | Zero occurrences — clean |
| `SUPABASE_SERVICE_ROLE` / `STRIPE_SECRET` / `OPENAI_API_KEY` in src/ | Zero occurrences — clean |
| `window.addEventListener('message', ...)` without origin check | Zero occurrences — clean |
| `useSearchParams()` flowing into `innerHTML` / `dangerouslySetInnerHTML` | Zero occurrences — clean |
| `target="_blank"` without `rel="noopener noreferrer"` | Zero occurrences — all instances have correct rel attribute |
| `jwt-decode` / client-side JWT role trust | Zero occurrences — auth role resolved server-side via `authApi.getSession()` — clean |
| `http://10.x` / `http://192.168.x` hardcoded IPs | Zero occurrences — clean |
| `sourcemap: true` in production build | `sourcemap: false` confirmed in `vite.config.ts:46` — clean |
| Trivial client-side password bypass (`length > 0`) | Minimum 8-char check present in all sign-up/reset flows — clean |
| `window.location.href = <userInput>` open redirect | All `window.location.href` assignments use hardcoded strings or controlled API paths — clean |

---

## Summary

**CRITICAL: 2 | HIGH: 6 | MEDIUM: 5 | LOW: 7**

### Priority Remediation Order

1. **(CRITICAL)** Remove `VITE_ADYEN_API_KEY` from client bundle — move all Adyen server-secret operations to `server/`.
2. **(CRITICAL)** Replace `localStorage`/`sessionStorage` token storage in `DepositModal` with `httpOnly` cookie auth (consistent with the rest of the auth flow in `AuthContext`).
3. **(HIGH)** Add security headers at the Cloudflare Workers edge: `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
4. **(HIGH)** Add `integrity=` SRI to all three CDN stylesheet `<link>` elements in `index.html`.
5. **(HIGH)** Consume and `history.replaceState` the hash fragment immediately in `auth/callback/page.tsx` after token extraction.
6. **(HIGH)** Fix `main.tsx:192` `innerHTML` assignment to use safe DOM construction consistently.
7. **(MEDIUM)** Sanitize and length-limit `error_description` URL param before displaying on `signin/page.tsx`.
8. **(LOW)** Guard all `console.log` auth lifecycle statements behind `import.meta.env.DEV`.
9. **(LOW)** Move payment-disabled flag enforcement to server-side.
10. **(LOW)** Remove `build-version` / `build-timestamp` meta tags from `index.html`.
