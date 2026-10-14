# Developer handoff

> Started in M1, completed in M5. This document tells a senior developer what the prototype does, what is fake, and what must be built for production.

## What exists now (M5)

- `packages/core`: pure TypeScript rules with Vitest tests. Run `pnpm test`.
- Presets as JSON in `packages/core/presets`, validated by `presetSchema` (`src/agent`).
- `pnpm demo` prints the core logic in action.
- `apps/web`: Next.js 16 app with magic-link sign-in, organisations, roles, invites, audit log, the Agent Builder, a voice library with previews, a call simulator, leads with a do-not-call list, campaigns behind a compliance gate (mock telephony), a calls log and a prepaid naira wallet (pretend checkout or Paystack). Prisma 6 + PostgreSQL.
- `services/voice-worker`: Python (FastAPI) starter for the live call loop. Not yet connected to a phone line.
- Provider adapters in `apps/web/src/server/providers` (mock by default; any OpenAI-compatible API for the language model and text-to-speech).

## Production hardening already noted (web)

- **Rate limiting** is in memory (`src/server/rate-limit.ts`). With more than one server, move it to Redis or the hosting platform's limiter.
- **Email**: set real SMTP (or a transactional email provider) and `EMAIL_TRANSPORT=smtp`. Console mode refuses to run unless `APP_URL` is localhost.
- **Sessions**: 30-day database sessions with httpOnly cookies. Consider shorter sessions or re-authentication for admin actions, and a "sign out everywhere" button.
- **Client IP** comes from `x-forwarded-for`. Trust it only behind your own proxy.
- **Content Security Policy** is not set yet. Add one when the final set of scripts and providers is known.
- **Agent config** is a JSON column validated by `agentConfigSchema`. If the format changes, write a migration that re-validates every saved agent.

## Integration contract for the voice pipeline (draft)

When the real-time engine (LiveKit Agents or Pipecat) is built in `services/voice-worker`, it should:

1. Fetch the compiled prompt in **call mode** (`compilePrompt(template, { values, mode: "call" })` with `buildCallValues(lead, now)`). Refuse to dial if `errors` is not empty.
2. Pass **every** agent utterance through `sanitiseForSpeech` before TTS. Prefer an HTTP endpoint on the web app over re-implementing it in Python.
3. Implement the tools in `TOOL_DEFINITIONS` (`appointment_date` as `YYYY-MM-DD`, `appointment_time` as `HH:MM`, WAT). Validate bookings with `validateAppointment`. Normalise spoken emails with `normaliseSpokenEmail` before saving.
4. Apply silence settings (`DEFAULT_SILENCE`: check in after 7 seconds, one check-in, end after 15 seconds with a closing message).
5. Ask the compliance gate before every dial attempt *(M4)*.

## Still to build for production

The real-time voice pipeline, telephony and Nigerian numbers, local-language voices, production security and scaling. See "Production notes added in M5" below for the step-by-step list.

## Production notes added in M3

- **Simulator cost control**: with a real language model, every simulator message is a paid request. Add per-organisation rate limits and usage metering before opening it to customers.
- **Speech-to-text** is not wired yet: the simulator takes typed replies. Add an ASR adapter next to `getLlm()` when testing by microphone is needed.
- **Real voices**: set `provider`, `providerVoiceId` and `status: "available"` in `packages/core/data/voices.json`, then set `TTS_PROVIDER` and `OPENAI_COMPATIBLE_TTS_MODEL`. For providers that are not OpenAI-compatible, add an adapter in `synthesise()`.
- **Pronunciation**: `names-pronunciation.json` is not yet passed to text-to-speech. Do this per provider (SSML or phoneme input).

## Production notes added in M4

- **Real telephony** replaces `runMockCall` inside `apps/web/src/server/dialer.ts`. Keep the order: gate, compile in call mode, dial, act on the outcome. The "pretend it is" time is already ignored unless `TELEPHONY_PROVIDER=mock`; remove it once real calls exist.
- **Batches run on a button press** inside the web request. Production needs a background worker or queue (with locking so two workers never call the same lead) and a scheduler that respects each campaign's window.
- **Do-not-disturb register**: the national register is not checked. Add it as one more block in `checkCallAttempt`.
- **Consent evidence**: store when and how consent was given (date, wording, form or recording) instead of a yes/no flag.
- **Removing a number from the do-not-call list** is deliberately not possible in the app. Build it only as an audited Owner action if lawyers agree.
- **Lead list size**: pages show the newest 200 leads. Add paging for large lists.
- **Transcripts** are stored as JSON on each call with no retention limit yet. Add retention settings (compliance item 3).

## Production notes added in M5

### To make real phone calls (needs accounts)

1. **Phone line**: a voice API or SIP trunk with Nigerian numbers (for example Africa's Talking, or a carrier SIP trunk). Register the numbers and confirm NCC rules (see `docs/COMPLIANCE_TODO.md`).
2. **Real-time pipeline** in `services/voice-worker`: LiveKit Agents or Pipecat, speech-to-text and text-to-speech that handle Nigerian English, and a fast language model. Keep using `/api/voice/sanitise` for every line.
3. **Dialling**: in `apps/web/src/server/dialer.ts`, replace `runMockCall` with a request to the worker's `POST /calls`, then record the result when the worker reports back (transcript, tool calls, duration). Add a signed callback endpoint for that. Keep the gate, the balance check and the single transaction for call + charge.
4. **Stop calls when money runs out**: pass the remaining balance (in minutes) to the worker so it can end the call politely.
5. **Background jobs**: campaigns must run from a queue, not a button press (see M4 notes).
6. **Recording notice and retention**: needs the lawyer's answer first (compliance items 2 and 3).

### Payments

- Switch `PAYMENTS_PROVIDER=paystack`, set `PAYSTACK_SECRET_KEY`, and set the webhook URL in the Paystack dashboard to `<APP_URL>/api/webhooks/paystack`. Test with Paystack's test keys first.
- Not built: receipts and VAT invoices, refunds, a price per organisation in the UI, auto top-up, low-balance emails, and an admin screen for manual credits.
- `apps/web/src/server/wallet.ts` is the only place that changes balances. Keep it that way.

### Security

- `WORKER_SHARED_SECRET` is a single shared secret. In production, rotate it, and consider mTLS or short-lived signed tokens between services.
- Add a Content Security Policy once the payment and voice scripts are final (already noted in M2).
