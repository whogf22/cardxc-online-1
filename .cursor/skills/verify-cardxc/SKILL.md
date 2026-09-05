---
name: verify-cardxc
description: Verify the CardXC React/Vite web app and Express API through real user-facing routes; use for UI, auth, wallet, checkout, and release-proof tasks.
---

# Verify CardXC

## Surface
Primary surface: React 19 web UI served by Vite. Secondary surface: Express API under `/api`. Public proof must use the browser-visible route, not internal state setters or test-only endpoints.

## Launch
Use two explicit processes because Vite is configured on port 5000 and proxies `/api` to port 5001.

```bash
mkdir -p .cursor/verification-artifacts
PORT=5001 DISABLE_BACKGROUND_JOBS=true NODE_ENV=development ./node_modules/.bin/tsx server/index.ts > .cursor/verification-artifacts/server.log 2>&1 & echo $! > .cursor/verification-artifacts/server.pid
./node_modules/.bin/vite --host 0.0.0.0 --port 5000 > .cursor/verification-artifacts/vite.log 2>&1 & echo $! > .cursor/verification-artifacts/vite.pid
```

Ready means both checks pass: `curl -fsS http://127.0.0.1:5001/api/health` and `curl -fsSI http://127.0.0.1:5000/`.
## Doctor
Run these before driving the app:

```bash
curl -fsS http://127.0.0.1:5001/api/health
curl -fsSI http://127.0.0.1:5000/
for f in .cursor/verification-artifacts/server.pid .cursor/verification-artifacts/vite.pid; do p=$(cat "$f"); ps -p "$p" -o pid=,command=; done
```

If the API cannot start because non-production secrets or a dev database are absent, mark authenticated flows `BLOCKED`; do not point verification at production to compensate.

## Drive
Use Cursor Cloud Agent computer use on `http://127.0.0.1:5000`. Prefer route URLs and stable visible text/labels. For public smoke proof, visit `/`, use the `Get Started` or `Sign In` controls, and confirm navigation. For auth forms, use the email field with placeholder `Enter email address` and the password field with placeholder `Enter password` only with dedicated non-production test credentials.

Use the feature map under `features/` to choose the real user path. Never use production customer data, production payment instruments, or production admin credentials.
## Evidence
Create a timestamped directory under `.cursor/verification-artifacts/<timestamp>/`. Capture:
- before screenshot/video frame showing the starting route/state;
- action sequence or short video for the changed path;
- after screenshot showing the observable result;
- relevant browser/API/server log excerpts;
- exact test/build commands and exit codes.

Proof must exercise the real user path and show both action and resulting state. For financial or external-provider boundaries, use sandbox/test mode only and separately prove that no production side effect occurred.

## Cleanup
Kill only the PIDs created by Launch:

```bash
kill_tree() {
  p="$1"
  for c in $(pgrep -P "$p" 2>/dev/null || true); do kill_tree "$c"; done
  kill "$p" 2>/dev/null || true
}
for f in .cursor/verification-artifacts/server.pid .cursor/verification-artifacts/vite.pid; do
  [ -f "$f" ] || continue
  kill_tree "$(cat "$f")"
done
```

Do not delete `.cursor/verification-artifacts/<timestamp>/`; evidence survives cleanup. Never kill by process name.

## Maintenance
When routes, startup commands, or major user flows change, run `/maintain-verification-skill` and re-prove at least one mapped feature.