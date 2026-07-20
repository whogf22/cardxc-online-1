# Security Headers — Cloudflare Workers Edge

## Scope

Adds defense-in-depth HTTP response headers to every route served by the
Cloudflare Workers Assets edge for the CardXC Online SPA.

Deployment mode: `assets.not_found_handling: "single-page-application"` in
`wrangler.jsonc`. There is no custom Worker `fetch` handler, so headers are
applied via the `_headers` file convention supported by Workers Assets /
Cloudflare Pages. Vite copies anything under `/public` verbatim into `/dist`
on build, so `public/_headers` becomes `dist/_headers` at deploy time.

## Files Created

### `public/_headers` (new)

Adds the following response headers to `/*`:

| Header | Value | Addresses |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | F-HDR-01 HSTS missing |
| `X-Content-Type-Options` | `nosniff` | F-HDR-02 MIME sniffing |
| `X-Frame-Options` | `DENY` | F-HDR-03 Clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | F-HDR-04 Referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com"), interest-cohort=()` | F-HDR-05 Powerful features / FLoC |
| `Cross-Origin-Opener-Policy` | `same-origin` | F-HDR-06 Cross-origin isolation |
| `Cross-Origin-Resource-Policy` | `same-site` | F-HDR-07 Side-channel / Spectre |
| `X-XSS-Protection` | `0` | F-HDR-08 Legacy XSS auditor disabled (per OWASP guidance) |
| `Content-Security-Policy` | see below | F-HDR-09 XSS / injection / data exfiltration |

Additional cache rules (non-security, operational):

- `/assets/*` → `Cache-Control: public, max-age=31536000, immutable` (Vite hashed assets).
- `/index.html` → `Cache-Control: public, max-age=0, must-revalidate` (SPA shell).

### Content-Security-Policy (F-HDR-09)

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://js.stripe.com https://checkout.stripe.com;
style-src 'self' 'unsafe-inline' https://api.fontshare.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com;
img-src 'self' data: blob: https:;
font-src 'self' data: https://api.fontshare.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.gstatic.com;
connect-src 'self' https://api.cardxc.online wss://api.cardxc.online https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.exchangerate-api.com https://api.dicebear.com https://logo.clearbit.com;
frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests
```

Host adjustments beyond the baseline spec, grounded in actual `src/` usage:

- `style-src` + `font-src`: added `https://fonts.googleapis.com` and
  `https://fonts.gstatic.com` — `src/index.css` imports Inter and
  Space Grotesk from Google Fonts.
- `connect-src`: added `https://api.exchangerate-api.com`
  (`src/lib/exchangeRateService.ts`), `https://api.dicebear.com`
  (`src/utils/avatar.ts`), and `https://logo.clearbit.com`
  (`src/pages/home/components/BrandsStrip.tsx`). Without these, the live
  app would break at runtime.
- `img-src 'self' data: blob: https:`: kept permissive because avatar,
  logo, and profile images pull from multiple third-party origins. Can be
  tightened to an explicit allowlist in a follow-up if desired.

## Files Confirmed (No Modification)

### `wrangler.jsonc`

Already uses Worker Assets SPA mode with no custom `fetch` handler:

```jsonc
{
  "assets": { "not_found_handling": "single-page-application" },
  "compatibility_flags": ["nodejs_compat"]
}
```

The `_headers` file is the correct mechanism — no Worker script edit is
needed. If a custom `fetch` handler is added later, the same headers must
be applied there via `new Response(..., { headers })` or they will be lost.

### `.gitleaks.toml`

Confirmed: the `attached_assets` entry is no longer present in the
`[allowlist].paths` array. Current allowlist:

```
paths = [
  "node_modules",
  "\\.git",
  "dist",
  "package-lock\\.json",
]
```

Addresses F-GL-01 (secret scanner allowlist scope reduced — repo-local
`attached_assets/` directory is now scanned for leaked credentials).

### `index.html`

Inspected. Currently has **no** `<meta http-equiv="Content-Security-Policy">`
tag. Per task instructions a separate agent is expected to add one. The
edge CSP header from `_headers` is the authoritative policy:

- If a meta-CSP is later added and it is stricter than the edge header,
  the browser intersects the two and the app may break.
- Recommendation: rely solely on the edge `_headers` CSP. If a meta tag
  is added for defense-in-depth, it must be identical to or a strict
  superset of the edge policy.

## Verification Checklist

After the next `npm run deploy`:

- [ ] `curl -sI https://cardxc.online/` shows all nine security headers.
- [ ] DevTools Console has no CSP violation reports on: home, auth,
      dashboard, wallet deposit/withdraw, Stripe checkout flow, avatar
      rendering, brand-logo strip, calculator (exchange rates).
- [ ] `https://securityheaders.com/?q=cardxc.online` grade ≥ A.
- [ ] Mozilla Observatory score ≥ 90.
- [ ] Stripe Checkout opens in iframe without being blocked.
- [ ] Supabase realtime (`wss://*.supabase.co`) connects.
- [ ] `api.cardxc.online` fetch and websocket both succeed.

## Findings Addressed

- **F-HDR-01** HSTS missing → `Strict-Transport-Security` added.
- **F-HDR-02** MIME sniffing allowed → `X-Content-Type-Options: nosniff`.
- **F-HDR-03** Clickjacking vector open → `X-Frame-Options: DENY` and
  `frame-ancestors 'none'` in CSP.
- **F-HDR-04** Full referrer sent cross-origin → `Referrer-Policy`.
- **F-HDR-05** No feature permissions policy → `Permissions-Policy` with
  camera / mic / geolocation denied, FLoC disabled, `payment` scoped to
  Stripe Checkout only.
- **F-HDR-06 / F-HDR-07** No COOP / CORP → `same-origin` / `same-site`.
- **F-HDR-08** Legacy XSS auditor → explicitly disabled (OWASP guidance).
- **F-HDR-09** No CSP → full CSP with `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`, `upgrade-insecure-requests`, and explicit allowlists
  per directive.
- **F-GL-01** Gitleaks allowlist over-broad → `attached_assets` removed.
