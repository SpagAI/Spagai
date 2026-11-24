# Roadmap

What is planned but not built yet. Ideas from chat go here so they are not lost if a session is. When something is built, move it to "Done recently" with its decision number from `docs/DECISIONS.md`.

> Started on 24 Nov 2026, after the original build session was lost. The items below come from the decisions log and developer handoff. Ideas the founder discussed in that chat but never wrote down are not here yet: add them as they are remembered.

## Next up

- [ ] **Phone system for the SIP trunk.** Choose what answers the phone line and carries live audio to the agent (for example LiveKit, a provider's voice API, or our own server), then plug it in behind `apps/web/src/server/telephony.ts` (D165).
- [ ] **Real phone calls.** Replace the mock dialer with the voice worker, add the signed callback, end calls politely when money runs out (`docs/DEVELOPER_HANDOFF.md`, "Production notes added in M5").
- [ ] **YarnGPT listening for Pidgin agents.** Whisper garbles Pidgin callers (see the test below). Use YarnGPT's live transcription (`wss://api.yarngpt.ai/api/v1/asr/stream`, server only, raw 16-bit PCM mono) for agents whose Language is Pidgin; keep Whisper for English. Then the founder tests by speaking Pidgin in Test your agent.
- [x] **Pidgin voices with YarnGPT** (built: D172; listening is the item above) (founder, 24 Nov 2026: "I want to just try adding YarnGPT and see if we can get the agent to speak Pidgin"). Add YarnGPT as a second voice provider next to Fish Audio, without changing Fish voices or agents that use them. From the official docs (yarngpt.ai/api-docs): use `POST https://api.yarngpt.ai/api/v1/streaming/conversation` (made for voice agents: audio comes straight back, up to 5,000 characters, mp3/wav/pcm); Bearer key; read voices from `GET /api/v1/voices` (ids change, never hardcode); optional `target_language: "pcm"` translates English into Pidgin before speaking. No test key: every call spends real credits. Limits are the same on every plan and cannot be raised, including **3 conversation streams at once per account**, which matters for real calls later. YarnGPT also does speech-to-text in African languages, worth comparing with Whisper for understanding Pidgin callers. Needs: a YarnGPT API key (this session's network and Cloudflare's `YARNGPT_API_KEY`).
  - **Tested on 24 Nov 2026** (key saved on the build environment). Voices: 16, all list Pidgin; first audio in 0.2 to 0.8 s. Founder: the Pidgin accent "has not gotten there yet, but at least we can work with that".
  - **AI brain (Groq `openai/gpt-oss-120b`) understands Pidgin well**: it followed a scripted Pidgin call correctly (said it is an AI, took a callback time, accepted an opt-out). With a loose instruction it drifted into standard English after a few turns; a firm "reply ONLY in Pidgin, every turn" instruction with a few example phrases kept it in Pidgin all call. **It got loan arithmetic wrong once** (said ₦120,000 interest instead of ₦75,000): exact amounts should be written into the prompt or knowledge base, not worked out by the AI.
  - **Listening is the weak link.** On a Pidgin opt-out line ("make una comot my number for una list. I no wan make una dey call me again"), Groq Whisper produced "bo me kuna comot my number for na list, a dey am kuna dey call me again"; YarnGPT's speech-to-text produced "make una comot my number for una list ade i am make una dey call me again" (much closer). Caveat: the test audio was made by YarnGPT's own voice, not a real caller on a phone line. YarnGPT's upload route took about 4 s (too slow per turn); its live WebSocket route (`/api/v1/asr/stream`, server only) is the one for conversations.
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

- First message follows the agent's language (D174)
- Pidgin agents: 16 YarnGPT voices and a "reply only in Pidgin" rule (D172)
- Knowledge base made real: stored, searched and used in every reply (D166 to D168)
- SIP trunk shell: connect a phone line from any provider (D165)
- MCP servers as a source of agent tools, including Make.com (D158 to D162, D169, D170)
- Usage page, now part of Billing (D157, D161, D164)
- Publish button in the agent builder (D156)
- Ship bell (D154)
