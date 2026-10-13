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

## M2: Web shell, login, organisations, Agent Builder

| # | Decision | Why |
|---|---|---|
| D29 | **Next.js 16.4, React 19, Tailwind CSS 4** | Current stable versions at the time of building. |
| D30 | **Prisma 6.19 (not 7 or 8)** | Prisma's "latest" tag was a pre-release (8.0 RC), and 7 changed the setup significantly. 6.x is stable and widely documented. Upgrade later as one focused task. |
| D31 | **Custom magic-link sign-in instead of the Auth.js library** (this replaces D2's library choice; the magic-link approach is unchanged) | About 150 lines we fully control: random token, only its SHA-256 hash stored, 15-minute expiry, single use, sessions in the database with a 30-day expiry and an httpOnly cookie. Avoids a beta dependency. |
| D32 | **The emailed link opens a page with a "Sign in" button** rather than signing in immediately | Email security scanners open links automatically and would otherwise use up the one-time link. |
| D33 | **First sign-in creates the user and their own organisation** (as Owner), named after their company email domain, or "Name's organisation" for Gmail, Yahoo and similar | Fastest path to a working account. Invited people join the inviting organisation instead. |
| D34 | **Roles: Owner, Admin, Member, Viewer.** Only owners can create or change owners. Nobody can change their own role. The last owner cannot be removed or demoted. | Standard, safe defaults. Rules are pure functions with tests (`apps/web/src/server/permissions.ts`). |
| D35 | **Rate limits:** sign-in links limited to 5 per email and 20 per IP address per 15 minutes, in memory | Protects the only public endpoint. Production with several servers needs Redis (see handoff). |
| D36 | **Same reply whether or not an email has an account** | Stops people discovering which emails are registered. |
| D37 | **`EMAIL_TRANSPORT` setting** (`smtp` or `console`). Console mode prints emails to the terminal and is only allowed when `APP_URL` is localhost. In development, emails are always also printed. | Sign-in works even when the fake inbox is not running, without risking links being logged in production. |
| D38 | **Agent configuration is stored as one validated JSON document** (`Agent.config`), checked by `agentConfigSchema` in core on every save and load | The builder edits many nested parts (blocks, variables, tools, silence). One validated document keeps the database simple while the format is still changing. Searchable fields (name, status, preset) are separate columns. |
| D39 | **Guardrails are enforced on the server too**: every save runs `normaliseAgentConfig`, which puts back any removed guardrail, switches disabled ones back on, and always adds the `end_call` tool | The screen hides the remove button, but the server must not trust the browser. |
| D40 | **"Mark as ready" requires**: no compile errors (all required business details filled), no lint errors, and a voice chosen. Warnings are allowed. | Prevents half-finished agents going into campaigns (M4). |
| D41 | **The live preview runs in the browser** using the same core compiler and linter | Instant feedback with no server round trip. The same code runs on the server at save time. |
| D42 | **Preview "sample lead"** is Chinedu Okafor (male), with a fixed sample time of Tuesday 13 October 2026, 10:30 WAT | A fixed time keeps the server and browser pages identical. A switch shows the raw `{{placeholders}}` instead. |
| D43 | **shadcn/ui components were written by hand** in the standard shadcn style (`components.json` included) | The shadcn download site was blocked from the build environment. The code is the same kind that the shadcn CLI copies in, so later `npx shadcn add …` works normally. |
| D44 | **Native `<select>` for dropdowns** | Best behaviour on phones, and accessible by default. |
| D45 | **Translations**: one JSON file per language; missing text falls back to English. The language picker shows Pidgin, Yoruba, Hausa and Igbo as "coming soon". | Translators fill a JSON file. No code changes are needed to add a language. |
| D46 | **Audit log** records organisation creation, renames, invites, role changes, removals, and agent create, save and delete | Basis for the compliance audit trail in M4. Visible to Owners and Admins in Settings. |
| D47 | **Security headers** (no framing, no MIME sniffing, strict referrer, microphone same-origin only) set in `next.config.ts` | Cheap protection from common web attacks. |
| D48 | **Starter voice list** lives in `packages/core/data/voices.json` (mock voices for en-NG, pcm, yo, ha, ig, plus one placeholder for a local provider). The database table and preview player come in M3. | Lets the voice picker work in M2 without building M3 early. Non-English sample lines need native-speaker checks. |
| D49 | `AGENTS.md` in `apps/web` is generated by Next.js for AI coding assistants and is committed | Next.js re-creates it on every `pnpm dev`; committing it keeps the working tree clean. |

## Between M2 and M3: viewing the project

| # | Decision | Why |
|---|---|---|
| D50 | **GitHub Codespaces set-up** (`.devcontainer/`): a Node 22 container plus PostgreSQL 16 and Mailpit, sharing one network so `localhost` works as it does locally. On creation it installs pnpm and packages, writes `apps/web/.env` with the codespace's own web address, applies migrations and seeds demo data. Each time it opens, it starts `pnpm dev` and opens the app. | The founder's laptop has hardware virtualisation switched off, so Docker Desktop cannot run there. Codespaces needs nothing installed. |
| D51 | **Development sign-in shortcut** (`DEV_SHOW_LOGIN_LINK=true`): after requesting a link, the page shows an "Open my sign-in link" button. The app refuses to start in production with it on (tested). | Finding the link in an inbox or terminal was the hardest step for non-developers. |
| D52 | **Codespaces address trusted exactly**: `allowedDevOrigins` and Server Actions `allowedOrigins` list only `<codespace>-3000.<forwarding domain>`, set only when running inside a codespace | Next.js blocks requests from unexpected origins (protection against cross-site attacks). A wildcard such as `*.app.github.dev` would trust every codespace on GitHub. |
