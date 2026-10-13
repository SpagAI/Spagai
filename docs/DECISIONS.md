# Decisions log

Every technical or product choice made while building the prototype, with the reason. Newest milestone at the bottom. Anything marked **(founder may change)** is a default the founder can overrule.

## M0: Plan

| # | Decision | Why |
|---|---|---|
| D1 | pnpm monorepo: `apps/web`, `packages/core`, `services/voice-worker` | Founder's default. Keeps the pure rules separate from screens and from the real-time voice engine. |
| D2 | Login by **magic link** (Auth.js), with emails caught locally by Mailpit (a fake inbox) | No passwords to store or leak. Free locally. *(Built in M2.)* |
| D3 | Zod for input validation | One standard way to check every input, shared by core and web. |
| D4 | In-memory rate limiter locally, Redis in production | Free and simple for the prototype. *(Built in M2.)* |
| D5 | Python worker uses FastAPI | Simple, widely known, and works alongside LiveKit Agents or Pipecat. *(Built in M5.)* |

## M1: Core logic

| # | Decision | Why |
|---|---|---|
| D6 | **No date library** in core. Africa/Lagos is treated as a fixed UTC+1 offset. | Nigeria has no daylight saving time, so a fixed offset is exact, simpler and has zero dependencies. If the platform later supports other African time zones with daylight saving, swap in `date-fns-tz` inside `src/time`. |
| D7 | **Calling window is 08:00 inclusive to 21:00 exclusive** (a call may start at 20:59, not 21:00). Every day of the week by default; campaigns can restrict days. | Clear, testable boundary. **(founder may change)** |
| D8 | **Booking window is 09:00 to 18:00, Monday to Friday** by default | "Team booking window" suggests office hours. **(founder may change)** |
| D9 | **Time of day**: morning 05:00–11:59, afternoon 12:00–16:59, evening otherwise | Matches common Nigerian greeting use. |
| D10 | **Goodbye chooser**: "weekend" from Friday 15:00, all Saturday, Sunday before 17:00; otherwise "evening" from 17:00, else "day" | Friday afternoon "have a lovely weekend" sounds natural. Sunday evening switches to "good evening" because the weekend is ending. **(founder may change)** |
| D11 | **Unknown gender**: no Mr or Miss is guessed, the suffix is empty, and the address falls back to the name | Guessing a title wrongly is worse than using the name. Gendered titles (Mrs, Alhaji, …) do set the gender when the gender column is blank. |
| D12 | **Mode A uses title + last name** ("Mr Okafor"), falling back to the first name if no last name. **Mode B uses the first name**, falling back to title + last name. | Formal Nigerian address uses the surname. |
| D13 | Recognised titles: Mr, Mrs, Miss, Ms, Dr, Engr, Barr, Prof, Chief, Alhaji, Alhaja, Hajia, Pastor, Rev, Hon, Arc, Pharm. Sir, Ma, Madam and Ma'am count as **no title**. | Covers the common Nigerian titles. Easy to extend in `src/address`. |
| D14 | **Phone numbers: only Nigerian mobiles** (070x, 080x, 081x, 090x, 091x, 11 digits locally) are accepted for now | Campaigns call mobiles. The example `0722831876` in the brief has only 10 digits, so it is rejected with the message "Too short … a digit may be missing". **(founder may change if that format is real)** |
| D15 | **Numbers in speech**: British/Nigerian style ("one hundred and twenty"). Numbers of 6 or more digits with no commas, or with a leading zero, are read **digit by digit** (reference and account numbers). | "4417390021" should not become "four billion…". Write amounts with commas (`100,000`) to have them read as amounts. |
| D16 | **Hyphens in spoken text become spaces** ("twenty-five" becomes "twenty five", "follow-up" becomes "follow up"). A spaced dash becomes a pause (comma). | The brief says to strip dashes. TTS engines say both forms the same way. |
| D17 | **Slashes**: "a/b" becomes "a or b", a spaced " / " becomes a pause, "24/7" becomes "twenty-four seven", "and/or" becomes "and or". | No "slash" is ever spoken, except in website paths (e.g. "spagai dot com slash pricing") where it is part of the address. |
| D18 | **Dates written with slashes are read day-first** (15/10/2026 is 15 October) | Nigeria uses day/month/year. |
| D19 | The agent's company variable is **`company_name`**, not `business_name` | `business_name` is a lead CSV column (the lead's own business). Using it for the agent's company would clash. |
| D20 | **Four locked guardrails**: calling hours, opt-out, AI disclosure, **and data safety** (never ask for card numbers, PINs, OTPs or BVN) | The brief locks the first three. Data safety was added because the data rules forbid storing those values, and the safest place to stop it is the agent's own instructions. Users can reword guardrails but not remove or disable them. Empty wording is refilled with the default. |
| D21 | **Variables have three scopes**: `agent` (filled once when building: company name), `call` (per lead: name, amount due), `system` (filled by the platform: greeting, goodbye, address, suffix, date). The preview leaves call and system placeholders visible. Call mode requires everything. | Lets the Agent Builder show a live preview before any lead exists. |
| D22 | **Scripted lines** (what the linter checks word for word) are text in double quotes, lines starting with `Say:`, and the first message | Simple, predictable convention that authors can follow. |
| D23 | **Prompt length**: warning above ~1,500 tokens, error above ~3,000. Tokens are estimated as characters ÷ 4. | Long prompts slow down the voice reply. A rough estimate is enough for a warning. **(founder may change)** |
| D24 | **Lint score** = 100 − 25 per error − 10 per warning − 2 per info, minimum 0 | A simple number for the UI and the simulator. |
| D25 | **Presets are JSON files** validated by a Zod schema when loaded. A test checks that every preset compiles with no errors and lints with no errors or warnings. | Non-developers can read and edit them, and a broken preset fails the tests immediately. |
| D26 | **Zara preset is a placeholder** (status `placeholder`) until the founder adds `docs/zara-prompt.md` | The real prompt was not available at M1. |
| D27 | **Names dictionary hints** use simple English-style syllables with the stressed syllable in capitals. Tones are not shown. All entries are `verified: false`. | A starting point only. Native speakers must review it, and a production system should use proper phoneme or SSML input per TTS provider. |
| D28 | TypeScript source is consumed directly (no build step) by tests and, later, by Next.js via `transpilePackages` | Fewer moving parts in a prototype. |
