# DO NOT TOUCH WITHOUT APPROVAL

Register of sensitive areas. Nothing in this register may be changed, executed, rotated,
migrated, rewritten, or deleted without **explicit, written, per-instance owner approval**
that names the specific action. Blanket or prior approval does not carry over between
actions or sessions.

Rules that apply to every entry:

1. Ask first, in writing, naming the exact command / console change to be made.
2. Never take the action "to unblock" a build, test, CI job, or deploy.
3. Prefer an additive, reversible alternative and propose it instead.
4. Record the approved action in `DEVIN_CHANGE_MANIFEST.md` before performing it.
5. If a change is discovered to have happened without approval, stop and report — do not
   "fix" it with further changes.

| # | Area | Examples of forbidden-without-approval actions | Why |
| --- | --- | --- | --- |
| 1 | **Git history rewrite** | `git rebase` of published branches, `git commit --amend` on pushed commits, `filter-branch`/`filter-repo`, `git reset --hard`, `git clean`, `git restore`, tag deletion/re-pointing | Destroys the audit trail and can silently delete remediation work (e.g. PR #13). |
| 2 | **Force push** | `git push --force`, `--force-with-lease`, deleting remote branches, pushing over `main` or `cursor/cardxc-deep-fix-6a35` | Irreversibly overwrites remote work of others. |
| 3 | **Production database** | Any connection with write intent, `DROP`, `TRUNCATE`, `DELETE`, `ALTER`, schema migrations, backfills, index changes, restores, `server/db/init.ts` DDL changes applied to prod | Customer funds and balances are stored here; loss is unrecoverable. |
| 4 | **Production provider configuration** | Enabling/disabling a provider, changing provider mode (test↔live), webhook endpoints/secrets, callback URLs, API versions | Directly affects money movement and can silently break settlement. |
| 5 | **Production DNS** | Any record change for `cardxc.online` (A/AAAA/CNAME/MX/TXT/NS), nameserver changes, TTL edits, domain transfer | Global outage and email/deliverability risk; also affects provider domain verification. |
| 6 | **Cloudflare production routing** | Workers routes, `wrangler` deploys to production, custom domains, page rules, WAF/firewall rules, cache rules, SSL mode, `wrangler.jsonc` production changes | Can take down or misroute the whole application. |
| 7 | **Stripe production settings** | Live API keys, live webhook endpoints/secrets, Stripe Issuing configuration, payout/settlement settings, Radar rules, product/price objects, Connect settings | Live payments and card issuing; misconfiguration causes real financial loss. |
| 8 | **Fluz production settings** | Live credentials, shared-account operations, merchant/catalog config, payout links, referral configuration, bulk order operations | Shared provider account — one wrong call affects all users. |
| 9 | **Privy production configuration** | App IDs/secrets, allowed origins, login methods, embedded-wallet policy, key-export/recovery settings | Wallet custody and authentication surface. PROVIDER CONFIRMATION REQUIRED before any change. |
| 10 | **Meld production configuration** | Live keys, on/off-ramp partner selection, KYC/limits configuration, supported assets/regions, webhook secrets | Fiat on/off-ramp — regulated flow. PROVIDER CONFIRMATION REQUIRED. |
| 11 | **Crossmint production configuration** | Live API keys, project/collection settings, custodial-wallet configuration, checkout/minting settings, webhook secrets | Custody and payment surface. PROVIDER CONFIRMATION REQUIRED. |
| 12 | **Daimo production configuration** | Live keys, payment-intent/link configuration, chain/asset selection, destination addresses, webhook secrets | On-chain settlement destinations — an address change is an irreversible loss vector. |
| 13 | **Financial ledger history** | Editing/deleting rows in `transactions`, `crypto_transactions`, `crypto_ledger_entries`, `wallets` balances, `card_orders`, admin adjustment records; changing idempotency keys or unique constraints; "corrective" balance writes | The ledger is the source of truth for customer money and for audit/AML obligations. |
| 14 | **Production secrets** | Reading, printing, copying, committing, rotating, or moving any production secret or `.env`/`.env.production`; changing `.env.example` contract; CI/CD or Cloudflare secret bindings; SSH keys; database credentials | Exposure is a reportable security incident; rotation can cause outage. |
| 15 | **Legal entity information** | Company name (`CARDXC LLC`), registration/tax identifiers, addresses, terms/privacy/AML/refund policy text, licensing or regulatory claims, `server/routes/legal.ts` and `src/pages/{terms,privacy,aml-policy,refund-policy}` | LEGAL REVIEW REQUIRED — misstatements create regulatory and provider-onboarding risk. |

## Additional standing constraints (current phase)

- Do **not** modify `.env`, `.env.example`, `.env.production.example`, `package.json`, or any
  file under `server/` or `src/` during the documentation-and-inventory phase.
- Do **not** implement Privy, Meld, Crossmint, or Daimo (or any other provider) until the
  owner approves a specific implementation plan.
- Do **not** merge, rebase, cherry-pick, or otherwise alter branch
  `cursor/cardxc-deep-fix-6a35` (PR #13, HEAD `baf0dd58`).
- Do **not** delete existing code, references, or documentation as "cleanup" — including
  anything that looks unused (e.g. `server/services/realtimeService.ts`, the Adyen client
  helper). Removal requires approval and its own manifest entry.
