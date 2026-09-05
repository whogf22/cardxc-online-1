# Home

## Sub-features
Landing page, mobile menu, Sign In navigation, Get Started navigation, contact entry points.

## How to get to it (user POV)
Open `http://127.0.0.1:5000/`.

## Driving it with Cursor computer use
Confirm the landing page renders. Click `Get Started` and verify the browser reaches `/signup`; return to `/`, click `Sign In`, and verify `/signin`.

## Gotchas
Do not treat a 200 HTML response alone as UI proof. Capture the starting page plus the post-click URL/state. Mobile menu has an ARIA label `Open menu` / `Close menu` and is a stable handle for narrow-viewport checks.