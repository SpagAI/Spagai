# Roadmap

What is planned but not built yet. Ideas from chat go here so they are not lost if a session is. When something is built, move it to "Done recently" with its decision number from `docs/DECISIONS.md`.

> Started on 24 Nov 2026, after the original build session was lost. The items below come from the decisions log and developer handoff. Ideas the founder discussed in that chat but never wrote down are not here yet: add them as they are remembered.

## Next up

- [ ] **Phone system for the SIP trunk.** Choose what answers the phone line and carries live audio to the agent (for example LiveKit, a provider's voice API, or our own server), then plug it in behind `apps/web/src/server/telephony.ts` (D165).
- [ ] **Real phone calls.** Replace the mock dialer with the voice worker, add the signed callback, end calls politely when money runs out (`docs/DEVELOPER_HANDOFF.md`, "Production notes added in M5").
- [ ] **Founder's real Zara prompt.** Paste it into `docs/zara-prompt.md` so the `fintech-outbound-zara` preset can be rebuilt from it.

## Later

- [ ] Built-in tools switched back on (booking, saving lead data); today agents use only the workspace's own tools and MCP servers (D141).
- [ ] Campaigns run from a background queue and scheduler, not a button press.
- [ ] Nigerian numbers, and checking numbers against the national do-not-disturb register.
- [ ] Consent evidence (date, wording, source) instead of a yes/no flag.
- [ ] Payments for real customers: Paystack live keys, receipts and VAT invoices, refunds, auto top-up, low-balance emails.
- [ ] Translations: Pidgin, Yoruba, Hausa and Igbo files are ready to fill.
- [ ] More real voice providers (ElevenLabs, Cartesia, OpenAI are demo-only today, D88, D111).
- [ ] Production security: Content Security Policy, rotating the worker secret, Redis rate limiting.

## Needs the lawyer first

See `docs/COMPLIANCE_TODO.md`: recording notice and retention, calling rules, AI disclosure wording, data protection registration.

## Done recently

- Knowledge base made real: stored, searched and used in every reply (D166 to D168)
- SIP trunk shell: connect a phone line from any provider (D165)
- MCP servers as a source of agent tools, including Make.com (D158 to D162, D169, D170)
- Usage page, now part of Billing (D157, D161, D164)
- Publish button in the agent builder (D156)
- Ship bell (D154)
