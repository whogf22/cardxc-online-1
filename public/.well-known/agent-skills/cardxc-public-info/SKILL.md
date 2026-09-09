---
name: cardxc-public-info
description: Read CardXC public information, policies, and discovery resources without performing financial actions.
---

# CardXC Public Info

Use this skill when an AI agent needs to understand CardXC from its public website.

## Allowed

- Read the public homepage and published informational pages.
- Read public Terms, Privacy, Refund Policy, and AML Policy pages.
- Read `/llms.txt`, the API catalog, and other public discovery metadata.
- Summarize only what the published CardXC pages actually state.

## Safety boundaries

- This skill is read-only.
- Do not initiate payments, transfers, withdrawals, card issuance, crypto sends, KYC decisions, or any other financial action.
- Do not claim that a provider, license, regulated capability, production API, or agent authorization flow exists unless CardXC publicly publishes it.
- Do not request, expose, or store secrets, credentials, session cookies, API keys, or personal data.

## Public resources

- Home: https://www.cardxc.online/
- How it works: https://www.cardxc.online/how-it-works
- Terms: https://www.cardxc.online/terms
- Privacy: https://www.cardxc.online/privacy
- Refund policy: https://www.cardxc.online/refund-policy
- AML policy: https://www.cardxc.online/aml-policy
- LLM guidance: https://www.cardxc.online/llms.txt
