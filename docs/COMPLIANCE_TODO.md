# Compliance to-do (for a lawyer)

> **DRAFT. Needs legal review.** This is a list of questions and areas for a qualified Nigerian lawyer to confirm. It is **not** legal advice, and nothing in this repository claims to be compliant with any law or regulation.

Updated in M4 and M5. Each item lists what the prototype currently does, so the lawyer can say whether it is enough.

## 1. Data protection registration
- [ ] Confirm whether Spag AI Studio (and each business customer) must register with the Nigeria Data Protection Commission, and at what tier.
- [ ] Confirm the roles: is Spag AI a data processor for its business customers, and are they the controllers?
- [ ] Draft a data processing agreement for business customers.

## 2. Data protection impact assessment
- [ ] Confirm whether automated outbound AI calling requires an impact assessment, and prepare one.
- [ ] Review the use of voice recordings and transcripts as personal data.

## 3. Recording consent
- [ ] Confirm what notice or consent is needed before recording a call, and the exact wording the agent should say.
- [ ] Confirm retention limits for recordings and transcripts. *(Prototype plan: configurable retention, access-controlled storage. Built in M4 and M5.)*

## 4. Calling rules
- [ ] Confirm permitted calling hours for marketing and for service calls. *(Prototype default: 08:00–21:00 Africa/Lagos, checked before every call attempt by `packages/core/src/compliance`. Campaigns can narrow it but never widen it.)*
- [ ] Confirm a reasonable maximum number of attempts per person and the minimum gap between them. *(Prototype defaults: 3 attempts, 240 minutes apart, set per campaign.)*
- [ ] Confirm rules for debt and repayment reminder calls (frequency, tone, third-party contact). *(The repayment preset forbids threats, shaming and mentioning family, employers, police or court. Draft wording only.)*
- [ ] Confirm whether disclosing that the caller is an AI is required, and the wording. *(The prototype always includes an AI-disclosure guardrail.)*
- [ ] Confirm sector rules (fintech, telecom, health, real estate) that apply to automated calls.

## 5. Do-not-disturb and opt-out
- [ ] Confirm obligations under the telecom regulator's do-not-disturb framework, and how to check numbers against it.
- [ ] Confirm how fast an opt-out must take effect and how long it must be kept. *(Prototype, M4: an opt-out on a call marks the lead and adds the number to the organisation's do-not-call list at once; every later attempt is blocked and logged. Team members can add numbers by hand. Numbers cannot be removed in the app.)*
- [ ] Confirm whether every number must be checked against the national do-not-disturb register before calling, and how. *(Not built.)*

## 6. Sensitive data
- [ ] Confirm handling of BVN, card data, PINs and OTPs. *(Prototype: never stored. The agent is instructed never to ask for or accept them. Lead imports refuse columns named like BVN, NIN, card, PIN, OTP or password.)*
- [ ] Confirm health-data rules for the clinic booking preset.

## 7. Consent and lead sources
- [ ] Confirm what proof of consent is needed for each lead, and what "lead source" record is enough. *(Prototype, M4: each lead stores a source and a yes/no consent flag, set on import or by hand. Any attempt without both is blocked and logged. No consent date, wording or evidence is stored yet.)*

## 8. Payments and billing (added in M5)
- [ ] Confirm what receipts and VAT invoices must be issued for wallet top-ups and call charges, and the VAT treatment. *(Prototype: a wallet history only; no receipts or VAT.)*
- [ ] Confirm whether a prepaid wallet balance raises any payment-services or e-money questions, and the refund policy for unused balance. *(Prototype: balances are non-refundable credit for calls; no refunds built.)*
- [ ] Confirm the terms to show before taking payment (pricing, per-minute rounding, non-refundability). *(Prototype default: ₦150 per started minute of an answered call.)*

## 9. Telephony (added in M5)
- [ ] Confirm licensing and number registration needed to place automated calls from Nigerian numbers, and the caller-ID rules.
- [ ] Confirm the wording the agent must use when a call is recorded or transcribed (see item 3), before real calls are switched on.
