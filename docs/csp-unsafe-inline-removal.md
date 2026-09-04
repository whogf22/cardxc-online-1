# CSP hardening follow-up: remove `script-src 'unsafe-inline'`

## Status

`script-src 'unsafe-inline'` is intentionally retained in the current release.
Removing it requires a separate implementation pass for the three inline
scripts/handlers on the landing page.

## Why it is currently needed

The `index.html` shell contains:

1. **Whop tracking pixel** (`public/index.html` ~L191)
   - Inline `<script>` that bootstraps `window.whop` and loads `https://t.whop.tw/s.js`.
2. **JSON-LD structured data** (`public/index.html` ~L96, ~L127, ~L141)
   - Three inline `<script type="application/ld+json">` blocks for Organization,
     WebSite, and FAQPage schema.
3. **Fontshare preload `onload` handler** (`public/index.html` ~L73)
   - `onload="this.onload=null;this.rel='stylesheet'"` on the async CSS preload
     link.

Until these are either moved to external files, hashed (`'sha256-...'`), or
rendered with a per-response nonce, dropping `'unsafe-inline'` will break the
Whop pixel, structured data, or font loading.

## Proposed removal plan

1. **Whop pixel**
   - Move the inline bootstrap to an external JS file under `/public/static/whop-pixel.js`
     (or load it via the existing `analytics` module if it already supports
     third-party scripts).
   - Add the file hash to `script-src` or serve it with a nonce.
   - Keep `https://t.whop.tw` in `script-src` for the loaded `s.js`.

2. **JSON-LD structured data**
   - Option A: Move each JSON-LD block to an external `.jsonld` file and load
     with `<script type="application/ld+json" src="/organization.jsonld">`.
     Note: external JSON-LD requires the file to be served with the correct
     media type and may still need `script-src` approval for the origin.
   - Option B: Compute the SHA-256 hash of each inline block and add
     `'sha256-<hash>'` to `script-src` (CSP hash source must match the exact
     script content, including whitespace).
   - Option C: Render the blocks server-side/with a nonce if a nonce-based CSP
     is adopted at the edge.

3. **Fontshare preload onload**
   - Replace the inline `onload` with a small external script that promotes
     preloaded stylesheets to `rel="stylesheet"`, or load the CSS normally
     without the preload/onload pattern.
   - If kept inline, compute its SHA-256 hash and add it to `script-src`.

4. **Final CSP update**
   - Remove `'unsafe-inline'` from `script-src` in:
     - `index.html` meta CSP
     - `public/_headers`
     - `server/index.ts` Helmet CSP
   - Add the required hashes or keep the external script origins.

## Verification

- [ ] `npm test` still passes.
- [ ] `npm run build` still passes.
- [ ] Browser smoke test: cardxc.online loads, Whop pixel fires, structured
      data is present, Fontshare CSS loads, no CSP console errors.
- [ ] `script-src 'unsafe-inline'` is absent from effective response headers.

## Related files

- `index.html`
- `public/_headers`
- `server/index.ts`
- `server/__tests__/cspPolicy.test.ts`
