# CardXC — Compliance Review Packet for PR #7

**Pull request:** [#7 — Compliance remediation and consent controls](https://github.com/whogf22/cardxc-online-1/pull/7)
**Branch:** `compliance-audit-fixes` → `main`
**Head commit at time of writing:** `df78ee3`
**Status:** Technical checks green (type-check, lint, tests, build, CI all pass). **NOT ready to merge** — the items below require human sign-off first.

---

## How to use this packet

This document lists the open legal, compliance, privacy, finance, security, and business decisions that remain in the codebase as visible placeholders. Each item includes a plain-language description, the exact decision or evidence required, the accountable role, the affected live surface, the risk of leaving it unresolved, and a blank block for the reviewer to record their decision.

Rules for reviewers and engineers acting on this packet:

- Do **not** delete a `[BUSINESS: ...]`, `[BUSINESS/LEGAL ...]`, or `[LEGAL REVIEW REQUIRED]` marker until the repo contains verifiable source that resolves it.
- Do **not** invent facts (partnerships, PCI status, registrations, custody arrangements, testimonials, reward amounts, or legal conclusions).
- Record approved wording, evidence links, or a decision in the "Decision / approved wording / evidence" block. Engineering will implement approved wording in a follow-up change; this packet does not itself change customer-facing copy.
- Line numbers reference commit `df78ee3`. Re-confirm before editing, as line numbers shift.

**Legend — "Live?"**: *Live* = rendered on a customer-facing route today. *Dead* = present in source but not currently mounted (lower exposure, still fix before any future use).

---

## Priority 0 — Regulatory disclosures (address first)

### P0-1. "Not a bank" / money transmitter / MSB / FinCEN disclosure is entirely missing

- **Plain language:** The product markets money movement, multi-currency wallets, and crypto features, but nowhere on the site does it state whether CardXC is a bank, whether deposits are or are not bank deposits, or how the money-movement service is licensed or registered (for example, money transmitter licensing, MSB/FinCEN registration, or a partner bank/licensed provider arrangement). A full-text search for "not a bank", "money transmitter", "money services business", "MSB", "FinCEN", and "money transmission" returns **no matches** anywhere in the codebase.
- **Decision/evidence required:** Confirm CardXC's actual regulatory posture and the exact disclosure language to publish. Provide the operating entity name, whether services run through a licensed/partner bank or a licensed money transmitter/MSB, any state licenses or FinCEN MSB registration numbers, and the required "CardXC is not a bank; banking/payment services provided by ..." style statement and where it must appear.
- **Owner:** Legal + Compliance (Finance to confirm entity/licensing facts).
- **Affected live surface:** Site-wide gap. Most relevant to the homepage money-movement claims (`src/pages/home/components/HeroSection.tsx`, `src/data/features.ts`), footer (`src/pages/home/components/Footer.tsx`), and legal/marketing meta (`src/components/SEOHead.tsx:4`, `index.html:20`). No single line to cite because the disclosure does not exist.
- **Risk if unresolved:** High. Potential unlicensed money-transmission exposure, UDAAP/FTC Act §5 risk from implying bank-like status without disclosure, and state regulator/consumer-protection action. This is the single highest-risk gap.

**Decision / approved wording / evidence:**

```
(blank — for Legal + Compliance)
```

---

### P0-2. PCI DSS Level 1 AOC holder is unnamed

- **Plain language:** The site states that payments are "processed by a PCI DSS Level 1 certified provider" and shows a "PCI DSS Processing" trust badge, but never names the provider that actually holds the PCI DSS Level 1 Attestation of Compliance (AOC). A claim of PCI Level 1 must be backed by a specific named entity's current AOC.
- **Decision/evidence required:** Provide the legal name of the payment processor(s) that hold the current PCI DSS Level 1 AOC, a copy or link to the current AOC / attestation, and confirm CardXC is authorized to reference that provider's compliance. Confirm whether CardXC itself is in PCI scope (SAQ type) and approve the exact attribution wording.
- **Owner:** Security + Compliance (Business to confirm the processor relationship).
- **Affected live surface:**
  - `src/data/features.ts:38` — `'Payments processed by a PCI DSS Level 1 certified provider'` (feature detail, live)
  - `src/pages/home/components/TrustSection.tsx:3` — same description string
  - `src/pages/home/components/Footer.tsx:172` — "PCI DSS Processing" badge (live footer)
- **Risk if unresolved:** High. Unsubstantiated security/compliance certification claims are a classic FTC Act §5 deception risk and can breach payment-provider agreements. Naming the wrong or non-attested entity compounds the exposure.

**Decision / approved wording / evidence:**

```
(blank — for Security + Compliance)
```

---

## Privacy

### PR-1. CCPA/CPRA "sale"/"sharing" determination and Global Privacy Control handling

- **Plain language:** The privacy policy asserts California rights and states "We do not sell your personal information for money," but has not confirmed whether analytics/advertising data flows legally qualify as a "sale" or "sharing" under CCPA/CPRA, nor finalized the opt-out mechanism or Global Privacy Control (GPC) signal handling.
- **Decision/evidence required:** Determine whether any current data sharing (analytics, ads, error monitoring) is a "sale" or "sharing" under CCPA/CPRA; confirm the opt-out method (including whether a "Do Not Sell or Share My Personal Information" link is required) and how GPC browser signals are honored. Approve the final policy wording.
- **Owner:** Privacy + Legal.
- **Affected live surface:** `src/pages/privacy/page.tsx:197-201` (marker at line 197; live Privacy Policy page, section "8a. Your California Privacy Rights").
- **Risk if unresolved:** High. Incorrect "sale"/"sharing" statements or missing GPC handling are directly enforceable under CCPA/CPRA and can trigger regulator action and statutory penalties.

**Decision / approved wording / evidence:**

```
(blank — for Privacy + Legal)
```

---

### PR-2. GDPR/UK GDPR legal bases, international transfer mechanism, and EU/UK representative or DPO

- **Plain language:** The policy lists GDPR rights but has not confirmed the legal basis for each processing activity, the mechanism used for international data transfers (for example Standard Contractual Clauses), or whether an EU/UK representative or Data Protection Officer must be designated.
- **Decision/evidence required:** Confirm the lawful basis for each processing purpose, the transfer mechanism(s) in use, and whether an Art. 27 EU/UK representative and/or a DPO is required; provide names/contact details if so. Approve the final wording.
- **Owner:** Privacy + Legal.
- **Affected live surface:** `src/pages/privacy/page.tsx:226-229` (marker at line 226; live Privacy Policy page, section "8b. Rights in the EEA and UK (GDPR)").
- **Risk if unresolved:** High for EEA/UK users. Missing legal bases, transfer safeguards, or a required representative are enforceable GDPR gaps with significant potential fines.

**Decision / approved wording / evidence:**

```
(blank — for Privacy + Legal)
```

---

## Custody

### CU-1. Fund custody, segregation, and cold-storage claims

- **Plain language:** The "Vault Systems" feature describes "Institutional-grade asset protection" and says funds use "safeguards such as segregated accounts ... with cold storage used where applicable." It is not confirmed that client funds are in fact held in segregated accounts, what the actual custody arrangement is, whether cold storage is used, or under what regulatory registration.
- **Decision/evidence required:** Confirm the true custody model — who holds client funds, whether accounts are legally segregated, whether/where cold storage is used, the custodian's name and any applicable registrations/licenses — and approve wording that matches reality. Where a safeguard is not in place, the claim must be removed or qualified.
- **Owner:** Finance + Compliance (Legal to approve final wording).
- **Affected live surface:**
  - `src/data/features.ts:87` — `description: 'Institutional-grade asset protection'`
  - `src/data/features.ts:89-95` — `[BUSINESS/LEGAL REVIEW REQUIRED]` marker (line 89) and `fullDescription` (line 93) / "Segregated client funds where applicable" (line 95), live feature detail.
- **Risk if unresolved:** High. Overstating custody/segregation protections is both an FTC Act §5 deception risk and a potential customer-funds/safeguarding regulatory issue.

**Decision / approved wording / evidence:**

```
(blank — for Finance + Compliance)
```

---

## Referral terms

### RF-1. Referral reward structure, amounts, eligibility, and fixed effective date

- **Plain language:** Referral terms currently describe rewards as "discretionary" and "not guaranteed" but leave the actual reward structure, amounts, and eligibility unconfirmed. The "Last updated" date is generated dynamically with `new Date()`, so the displayed effective date changes every month even if the terms do not.
- **Decision/evidence required:** Confirm the final referral reward structure (amounts/forms, if any), eligibility and anti-abuse rules, tax handling, and a fixed counsel-approved "Last updated"/effective date. Approve the final terms wording.
- **Owner:** Legal + Business (Finance to confirm any monetary/tax treatment).
- **Affected live surface:**
  - `src/pages/referral-terms/page.tsx:40` — `[LEGAL REVIEW REQUIRED]` marker
  - `src/pages/referral-terms/page.tsx:35` — dynamic `new Date()` "Last updated" date
  - `src/pages/referral-terms/page.tsx:85-90` — "Rewards Are Discretionary" section
  - `src/pages/referral/ReferralDashboardPage.tsx:277-282` — customer-facing discretionary-reward disclosure (live dashboard)
- **Risk if unresolved:** Medium. Undefined or inconsistent reward terms and a shifting effective date create consumer-protection and enforceability risk and can undercut the "discretionary" framing.

**Decision / approved wording / evidence:**

```
(blank — for Legal + Business)
```

---

## Testimonials

### TS-1. Real, consented testimonials and star-rating basis

- **Plain language:** Fabricated testimonials were removed; the testimonials array is now empty and both testimonial components render nothing (`return null`) while empty, so no fake social proof is shown. Before testimonials are re-enabled, real customer quotes with written consent are required, and the component's fixed five-star rendering needs a defined, truthful ratings basis.
- **Decision/evidence required:** Provide real customer testimonials with documented written consent (quote, attribution, permission), and define how any star rating is sourced so it reflects genuine customer ratings rather than a hardcoded value.
- **Owner:** Business + Legal.
- **Affected live surface (currently suppressed until data is supplied):**
  - `src/mocks/testimonials.ts:11` — `[BUSINESS: ...]` marker; `:21` — empty array
  - `src/pages/home/components/FeaturedTestimonial.tsx:10` — `[BUSINESS: ...]` marker; `:39` — `return null`
  - `src/pages/home/components/TestimonialsSection.tsx:28-29` — empty-state `return null`
- **Risk if unresolved (only if re-enabled without consent/basis):** High. Fake or unsubstantiated reviews/ratings violate the FTC fake-reviews rule (16 CFR Part 465) and FTC Act §5. Leaving it empty is safe; the risk is in re-enabling without evidence.

**Decision / approved wording / evidence:**

```
(blank — for Business + Legal)
```

---

## Marketing statistics

### MK-1. Unverified quantitative marketing claims (24/7, 180+ countries, 150+ assets, 50+ currencies)

- **Plain language:** Several specific numeric claims appear in marketing copy without confirmed backing: "24/7" support/monitoring, "180+ countries", "150+ assets", and "50+ currencies". Each factual claim needs to be true and substantiated, or qualified/removed.
- **Decision/evidence required:** Confirm and provide evidence for each claim as actually offered today: is support genuinely 24/7; are same-day transfers really available to 180+ countries; does the wallet hold 150+ assets; are 50+ currencies supported? Approve corrected wording where a claim cannot be substantiated.
- **Owner:** Business (Compliance to confirm claims meet substantiation standards).
- **Affected surfaces:**
  - **Live —** 24/7: `src/pages/home/components/StatsSection.tsx:6`, `src/pages/home/components/HeroSection.tsx:72`, `src/components/SEOHead.tsx:4`, `index.html:20` and `index.html:167`; feature copy `src/data/features.ts:33,37,105,107,109`. 180+ countries: `src/data/features.ts:21`. 150+ assets: `src/data/features.ts:45,47,49`.
  - **Dead (not currently mounted, fix before any reuse) —** 50+ currencies and 180+ countries in `src/pages/home/components/AboutSection.tsx:41,51`.
- **Risk if unresolved:** Medium. Unsubstantiated quantitative claims are FTC Act §5 deception risks; live homepage/meta exposure is the priority, dead-code copy is lower urgency.

**Decision / approved wording / evidence:**

```
(blank — for Business + Compliance)
```

---

## Cookies

### CK-1. Named third-party cookie providers and links

- **Plain language:** The cookie policy refers generally to "third-party providers (for example, payment processing and error ...)" but does not list the specific third-party cookie/SDK providers or link to their policies, which a complete cookie disclosure requires.
- **Decision/evidence required:** Provide the finalized list of third-party providers that set cookies or similar technologies (analytics, payments, error monitoring, etc.), their purposes, and links to their privacy/cookie policies. Approve the final list.
- **Owner:** Privacy + Business.
- **Affected live surface:** `src/pages/cookie-policy/page.tsx:115-118` (`[BUSINESS/LEGAL: ...]` marker at line 118; live Cookie Policy page).
- **Risk if unresolved:** Medium. Incomplete cookie disclosures weaken CCPA/CPRA and GDPR/ePrivacy compliance and consent validity.

**Decision / approved wording / evidence:**

```
(blank — for Privacy + Business)
```

---

## Social profiles

### SP-1. Ownership and accuracy of linked social profiles

- **Plain language:** The footer links to Twitter/X, Facebook, LinkedIn, and Instagram profiles. It should be confirmed that these accounts are official, owned/controlled by CardXC, active, and safe to link.
- **Decision/evidence required:** Confirm each linked profile is an official CardXC account (or remove/replace it). Verify the URLs resolve to the intended official pages.
- **Owner:** Business.
- **Affected live surface:** `src/pages/home/components/Footer.tsx:21-24`
  - `:21` `https://x.com/cardxc`
  - `:22` `https://www.facebook.com/share/16o9sy49rA/`
  - `:23` `https://linkedin.com/company/cardxc`
  - `:24` `https://instagram.com/cardxc`
- **Risk if unresolved:** Low/Medium. Linking to unofficial or unmonitored accounts creates brand-impersonation and consumer-confusion risk.

**Decision / approved wording / evidence:**

```
(blank — for Business)
```

---

## Summary of required human approvals

| # | Item | Owner(s) | Live? | Priority |
|---|------|----------|-------|----------|
| P0-1 | "Not a bank" / money transmitter / MSB / FinCEN disclosure (missing) | Legal + Compliance (+ Finance) | Site-wide gap | P0 |
| P0-2 | PCI DSS Level 1 AOC holder identity + evidence | Security + Compliance (+ Business) | Yes | P0 |
| PR-1 | CCPA/CPRA "sale"/"sharing" + GPC | Privacy + Legal | Yes | High |
| PR-2 | GDPR legal bases / transfers / representative / DPO | Privacy + Legal | Yes | High |
| CU-1 | Fund custody / segregation / cold storage | Finance + Compliance (+ Legal) | Yes | High |
| RF-1 | Referral reward structure + fixed effective date | Legal + Business (+ Finance) | Yes | Medium |
| TS-1 | Consented testimonials + rating basis | Business + Legal | Suppressed | High if re-enabled |
| MK-1 | 24/7 / 180+ / 150+ / 50+ marketing stats | Business + Compliance | Yes (some dead) | Medium |
| CK-1 | Named third-party cookie providers | Privacy + Business | Yes | Medium |
| SP-1 | Social profile ownership/accuracy | Business | Yes | Low/Medium |

**FDIC:** No open item. False "FDIC insured" claims were removed; only a regression test guard references the term.

**Do not merge PR #7 until P0-1 and P0-2 are resolved and the remaining items have documented decisions.** This packet contains no legal conclusions; all determinations are reserved to the named reviewers.
