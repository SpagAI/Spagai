# Developer handoff

> Started in M1, completed in M5. This document tells a senior developer what the prototype does, what is fake, and what must be built for production.

## What exists now (M1)

- `packages/core`: pure TypeScript rules with 159 Vitest tests. Run `pnpm test`.
- Presets as JSON in `packages/core/presets`, validated by `presetSchema` (`src/agent`).
- `pnpm demo` prints the core logic in action.

## Integration contract for the voice pipeline (draft)

When the real-time engine (LiveKit Agents or Pipecat) is built in `services/voice-worker`, it should:

1. Fetch the compiled prompt in **call mode** (`compilePrompt(template, { values, mode: "call" })` with `buildCallValues(lead, now)`). Refuse to dial if `errors` is not empty.
2. Pass **every** agent utterance through `sanitiseForSpeech` before TTS. Prefer an HTTP endpoint on the web app over re-implementing it in Python.
3. Implement the tools in `TOOL_DEFINITIONS` (`appointment_date` as `YYYY-MM-DD`, `appointment_time` as `HH:MM`, WAT). Validate bookings with `validateAppointment`. Normalise spoken emails with `normaliseSpokenEmail` before saving.
4. Apply silence settings (`DEFAULT_SILENCE`: check in after 7 seconds, one check-in, end after 15 seconds with a closing message).
5. Ask the compliance gate before every dial attempt *(M4)*.

## To be completed in M5

The real-time voice pipeline, telephony and Nigerian numbers, local-language voices, production security and scaling.
