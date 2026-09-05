# Sign in

## Sub-features
Email/password entry, password visibility control, submit/loading state, 2FA challenge shell, error messaging.

## How to get to it (user POV)
Open `http://127.0.0.1:5000/signin`.

## Driving it with Cursor computer use
Confirm `Welcome Back` renders. Use the email field with placeholder `Enter email address` and password field with placeholder `Enter password`. For form-shell proof, use intentionally invalid non-secret input and verify validation/error behavior; only complete authentication with dedicated non-production credentials.

## Gotchas
Never reuse production credentials. If API/dev auth is unavailable, mark successful-login proof `BLOCKED` rather than pointing the flow at production.