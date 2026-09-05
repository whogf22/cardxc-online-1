# Dashboard

## Sub-features
Protected-route gate, authenticated dashboard shell, navigation to wallet/transactions/cards/profile.

## How to get to it (user POV)
Open `http://127.0.0.1:5000/dashboard` after signing in with a dedicated non-production test account.

## Driving it with Cursor computer use
First prove the unauthenticated gate redirects or blocks access. For authenticated proof, sign in through `/signin`, then navigate to `/dashboard` and capture the visible account/dashboard state plus any relevant API logs.

## Gotchas
Never use production customer data. Do not perform withdrawals, purchases, transfers, card issuance, crypto sends, or admin actions as part of dashboard verification.