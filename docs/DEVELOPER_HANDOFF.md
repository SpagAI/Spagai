# Developer handoff

> Started in M1, completed in M5. This document tells a senior developer what the prototype does, what is fake, and what must be built for production.

## What exists now (M2)

- `packages/core`: pure TypeScript rules with Vitest tests. Run `pnpm test`.
- Presets as JSON in `packages/core/presets`, validated by `presetSchema` (`src/agent`).
- `pnpm demo` prints the core logic in action.
- `apps/web`: Next.js 16 app with magic-link sign-in, organisations, roles, invites, audit log and the Agent Builder. Prisma 6 + PostgreSQL.

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

## To be completed in M5

The real-time voice pipeline, telephony and Nigerian numbers, local-language voices, production security and scaling.
