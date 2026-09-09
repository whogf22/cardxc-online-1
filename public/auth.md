# Auth.md — CardXC

## Current authentication model

CardXC currently authenticates users through the CardXC web application. Public agent registration and public OAuth/OIDC client registration are not advertised at this time.

## Guidance for AI agents

- Treat CardXC authentication as human-controlled unless CardXC publishes an explicit agent authorization flow.
- Do not automate sign-in, session-cookie handling, MFA, KYC decisions, payments, transfers, withdrawals, card issuance, or crypto transactions from this document.
- Do not request or expose passwords, API keys, session cookies, access tokens, or other credentials.
- Use the public read-only discovery resources for website information and documentation.

## Public discovery resources

- API catalog: https://www.cardxc.online/.well-known/api-catalog
- Agent Skills index: https://www.cardxc.online/.well-known/agent-skills/index.json
- ARD manifest: https://www.cardxc.online/.well-known/ard.json
- LLM guidance: https://www.cardxc.online/llms.txt

## Future agent authorization

If CardXC later enables OAuth/OIDC or agent registration, the authoritative discovery metadata will be published under the appropriate `/.well-known/` endpoints. Until then, absence of those metadata endpoints means agents must not assume OAuth or agent registration support.
