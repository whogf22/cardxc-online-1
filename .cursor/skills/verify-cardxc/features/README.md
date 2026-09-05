# CardXC verification feature map

Start with public, non-destructive paths; protected paths require dedicated non-production credentials.

- `home.md` — landing page and primary navigation
- `calculator.md` — public calculator route
- `signin.md` — sign-in form and validation shell
- `signup.md` — account creation form shell
- `dashboard.md` — authenticated dashboard gate

For every proof: launch with `verify-cardxc`, run Doctor, drive one path in the browser, capture before/action/after evidence, then cleanup only the PIDs you started.