# Compliance to-do (for a lawyer)

> **DRAFT. Needs legal review.** This is a list of questions and areas for a qualified Nigerian lawyer to confirm. It is **not** legal advice, and nothing in this repository claims to be compliant with any law or regulation.

Items will be expanded in M4 and M5. Each item lists what the prototype currently does, so the lawyer can say whether it is enough.

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
- [ ] Confirm permitted calling hours for marketing and for service calls. *(Prototype default: 08:00–21:00 Africa/Lagos, enforced in code. See `packages/core/src/time`.)*
- [ ] Confirm rules for debt and repayment reminder calls (frequency, tone, third-party contact). *(The repayment preset forbids threats, shaming and mentioning family, employers, police or court. Draft wording only.)*
- [ ] Confirm whether disclosing that the caller is an AI is required, and the wording. *(The prototype always includes an AI-disclosure guardrail.)*
- [ ] Confirm sector rules (fintech, telecom, health, real estate) that apply to automated calls.

## 5. Do-not-disturb and opt-out
- [ ] Confirm obligations under the telecom regulator's do-not-disturb framework, and how to check numbers against it.
- [ ] Confirm how fast an opt-out must take effect and how long it must be kept. *(Prototype: the agent records opt-outs immediately and an opt-out registry blocks future calls. Built in M4.)*

## 6. Sensitive data
- [ ] Confirm handling of BVN, card data, PINs and OTPs. *(Prototype: never stored. The agent is instructed never to ask for or accept them.)*
- [ ] Confirm health-data rules for the clinic booking preset.

## 7. Consent and lead sources
- [ ] Confirm what proof of consent is needed for each lead, and what "lead source" record is enough. *(Prototype plan: each call attempt is blocked without a consent record and a lead source. Built in M4.)*
