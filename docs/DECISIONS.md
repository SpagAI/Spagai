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
| D52 | **Codespaces addresses trusted narrowly**: only inside a codespace, `allowedDevOrigins` lists `<codespace>-3000.<forwarding domain>`, and Server Actions `allowedOrigins` lists that host plus `localhost:3000` (the Codespaces proxy can pass the browser's origin on as `localhost:3000`, which caused "Invalid Server Actions request"; reproduced and fixed, and a foreign origin is still rejected) | Next.js blocks requests from unexpected origins to stop cross-site attacks. A wildcard such as `*.app.github.dev` would trust every codespace on GitHub. |

## M3: Voice previews, simulator, provider adapters

| # | Decision | Why |
|---|---|---|
| D53 | **Mock voices are spoken by the browser's built-in speech** (Web Speech API). The server cleans the text with `sanitiseForSpeech` first, then the browser picks a local voice by language and gender, with a small pitch change per mock voice. | Free, needs no key, and works offline. It shows wording and timing only; Yoruba, Hausa and Igbo lines may be read with an English accent until a real provider is connected. |
| D54 | **The voice catalogue stays in `packages/core/data/voices.json`** instead of a database table (this changes D48's plan) | Nothing writes voices yet and every organisation sees the same list. Add a table when organisations can add their own or cloned voices. **(founder may change)** |
| D55 | **Provider adapters live in `apps/web/src/server/providers`**: a language-model interface (`getLlm`) and a speech function (`synthesise`), each with a mock. The real option is any **OpenAI-compatible** API, chosen with `LLM_PROVIDER` / `TTS_PROVIDER`. | One adapter covers OpenAI, Groq, Together and local servers (Ollama, vLLM). The app refuses to start if a real provider is chosen without its settings. |
| D56 | **The mock agent brain** (`packages/core/src/simulator`) recognises common replies (stop calling, are you a robot, wrong number, busy, yes, no, a day and time, an email) and answers with fixed, rule-following lines. It does not read the prompt. | Lets the whole call flow be tested for free and repeatably. Opt-out always wins over everything else. A test checks that every mock line passes the spoken-line linter. |
| D57 | **The simulator compiles the prompt in call mode**, exactly as dialling will, so missing required details stop the test with the same errors | What you test is what will run. |
| D58 | **Simulated tools use the real checks**: bookings go through `validateAppointment` (booking hours, not in the past), emails through `isValidEmail`. Nothing is stored. | Shows the failures a real call would hit. Tool calls from a real language model are filtered to the agent's own tools, and broken arguments are shown as failures. |
| D59 | **Calling hours are checked but do not block the simulator**; a warning shows what a real call would do | People often test outside office hours. The blocking gate is M4. |
| D60 | **The simulator's clock starts at the current Lagos time and can be changed** | Lets you test greetings, goodbyes and after-hours behaviour for any time. |
| D61 | **The simulator runs the last saved version of an agent**; the builder warns before opening it with unsaved changes | Keeps the simulator honest about what is stored. |

## M4: Leads, compliance gate, campaigns, calls

| # | Decision | Why |
|---|---|---|
| D62 | **One compliance function, `checkCallAttempt`**, in core. It returns every reason at once and marks each as permanent (opted out, do-not-call, no consent, no source, bad number, attempt limit) or temporary (calling hours, agent not ready, too soon). | One gate for every call (architecture rule 3), easy to test, and every reason can be logged and shown. |
| D63 | **Blocked attempts are saved as calls with status BLOCKED** and their reasons | This is the compliance audit trail. A batch stops at the first calling-hours or agent-not-ready block instead of logging the same reason for every lead. |
| D64 | **A campaign's calling window can only narrow 08:00 to 21:00** (`effectiveCallingWindow`) | Users can choose office hours, but can never widen the legal default. **(founder may change the default)** |
| D65 | **Every lead needs a lead source; consent is a yes/no record per lead.** Imports take a source and consent from columns, or one value for the whole file. | Matches the compliance to-do (item 7). What counts as proof of consent needs legal review. |
| D66 | **Sensitive CSV columns are refused by header name** (BVN, NIN, card, PAN, CVV, PIN, OTP, password); their values are never read | The data rules forbid storing them. The import result tells the user which columns were refused. |
| D67 | **Opt-outs take effect at once, for every campaign**: the lead is marked opted out and the number goes on the do-not-call list in the same database transaction. There is no undo button. | Compliance item 5. Removing a number should be a deliberate, audited admin task (not built). |
| D68 | **Re-importing a number updates its details but never clears an opt-out** | Stops an old spreadsheet from undoing someone's request. |
| D69 | **Phone numbers are unique per organisation** (E.164) | One person, one record; imports can safely be re-run. |
| D70 | **Mock telephony gives each lead a persona** (interested, busy, not interested, curious, opts out, wrong number, no answer, silent) from a hash of the lead and attempt number, then plays the call with the mock agent brain | Free, repeatable end-to-end campaigns. Real telephony replaces only the call step (M5). |
| D71 | **"Pretend it is" time on a campaign run, only with mock telephony** | Shows the calling-hours rules working at any time of day. Ignored when a real phone line is connected. |
| D72 | **Retries:** no answer means try again after the campaign's wait (default 240 minutes); a callback is tried at the agreed time; stop after the attempt limit (default 3) | Simple, respectful defaults. **(founder may change)** |
| D73 | **Leads with missing per-call values are marked "missing details" (FAILED), not blocked** | It is a data problem, not a compliance one, and the reason is shown on the call. |
| D74 | **Unknown gender: `suffix` may be empty in call mode** (`allowEmpty` on the variable), and the line is tidied ("Is now a good time, ?" becomes "Is now a good time?") | Found while testing: unknown-gender leads could never be called. Matches D11 (never guess Sir or Ma). Preset wording now says what to do when it is empty. |
| D75 | **New permissions:** `lead:view`, `lead:edit`, `campaign:run`, `call:view`. Members can import leads and run campaigns; viewers can only look. | Follows the role descriptions in `permissions.ts`. |

## M5: Billing, voice worker starter

| # | Decision | Why |
|---|---|---|
| D76 | **Prepaid wallet in kobo** (`Organisation.balanceKobo`). Every balance change is written together with a `WalletTransaction` in one database transaction, with the balance after it. | Simple for Nigerian SMEs (no invoices or credit), and the history always adds up. Money is integer kobo (architecture rule 5). |
| D77 | **Price: ₦150 per started minute of an answered call; unanswered, blocked and failed attempts are free** (`DEFAULT_RATE_PER_MINUTE_KOBO`, stored per organisation) | Easy to understand and to check. **(founder may change the price and the rounding)** |
| D78 | **A call only starts if the wallet covers at least one minute**; the batch stops with a clear message otherwise | Prevents surprise debt. A long call can take the balance slightly below zero; real telephony should end calls when the balance runs out (handoff). |
| D79 | **The call, the lead's progress, any opt-out and the charge are saved in one transaction**, and the charge reference is unique per call | A call can never be charged twice, or recorded without its charge. |
| D80 | **Top-ups: from ₦1,000 to ₦5,000,000.** A top-up is PENDING until paid; crediting is idempotent (only the first PENDING → SUCCESS flip credits), and the amount paid must match exactly. | The return page and the webhook may both arrive; neither can double-credit. |
| D81 | **Payments provider: Paystack**, behind `PAYMENTS_PROVIDER` (`mock` or `paystack`). The browser return is never trusted: the app verifies with Paystack's API, and the webhook must carry a valid HMAC-SHA512 signature. | Paystack is widely used in Nigeria and settles in naira. Flutterwave can be added the same way. |
| D82 | **The pretend checkout only exists with `PAYMENTS_PROVIDER=mock`, and the app refuses to start in production with mock payments** | Top-ups can be tried for free, with no risk of a fake payment page going live. |
| D83 | **Billing is visible to Owners and Admins only** (`billing:view`, `billing:manage`) | Matches the role description (admins manage billing). |
| D84 | **A ₦10,000 demo credit** is added once by the seed script | Campaigns work straight after setup. |
| D85 | **Voice worker starter in Python (FastAPI)** with `GET /health` and `POST /calls`. It cleans lines through the web app's `POST /api/voice/sanitise` instead of copying the rules into Python. | One source of truth for speech rules (handoff contract item 2). The audio pipeline (LiveKit Agents or Pipecat) needs real telephony accounts, so it is not built. |
| D86 | **Worker and web app share one secret** (`WORKER_SHARED_SECRET`, 32+ characters), compared in constant time; with no secret, both sides refuse every request | Simple, safe service-to-service auth for a prototype. Use mTLS or signed tokens later. |
| D87 | **The local stand-in database must use UTF-8.** A Windows-created database (WIN1252) cannot store "₦". | Found while testing the wallet on a Windows PC. The project's Docker and Codespaces databases already use UTF-8. |

## M6: Platform pages (demo data)

| # | Decision | Why |
|---|---|---|
| D88 | **Workspaces, phone numbers, SIP trunks, the Knowledge Base, integrations and voices from ElevenLabs, Cartesia and OpenAI are demo-only.** They save realistic records but never call a real service. | The founder asked for a platform that looks and behaves fully working before real accounts are connected. |
| D89 | **"Editor" is the display name for the MEMBER role**; invites offer Admin, Editor and Viewer | Matches common SaaS wording without a database change. |
| D90 | **New permissions:** `number:manage`, `integration:manage` and `apikey:manage` (owners and admins); `knowledge:edit` (also editors) | Buying numbers costs money and keys and integrations expose data, so they stay with managers. |
| D91 | **API keys are stored hashed (to check requests) and AES-256-GCM encrypted (to reveal them again)**, with the encryption key derived from `SESSION_SECRET`. Every reveal is written to the audit log. | The brief asks for reveal and hide. Changing `SESSION_SECRET` makes old keys unrevealable (they still work). |
| D92 | **SIP trunk passwords are never stored**, only whether one was given; uploaded files are not stored either (only name, size and type) | Nothing sensitive is kept until real storage and secret management exist. |
| D93 | **Dashboard figures come from SQL aggregates in Lagos time (UTC+1)**, compared with the period before; the world map is a 260 KB equirectangular SVG used as a CSS mask, so it follows the theme | Fast enough without a charting library; one map file for light, dark and dark gray. |
| D94 | **Visited pages are kept for 30 seconds in the browser (`staleTimes.dynamic`), and every page shows the centred Spag logo animation while it loads** (black in Day, white in Night), from the moment a link is clicked | Navigation feels instant; saving anything still refreshes the affected pages. |
| D95 | **The interface is black and white (neutral greys); the brand colour, Spag purple #5B2BC4, is used only for buttons and a few highlights** (active menu item, links, focus rings, switches, the dashboard wave). At night a lighter purple, #A78BFA, is used with black text. Chart colours stay as validated (blue and orange), because they show data rather than brand. Status colours (green, red) are unchanged. | Founder brand change (it replaced an earlier all-blue look). Both purples pass 7:1 contrast. |
| D96 | **Two appearances, Day (white) and Night (black), chosen with a day/night switch** in the profile menu. Dark Grey and Deep Navy were tried and removed; anyone who had picked them now gets Night. | Founder request: simpler, just white and black. |
| D97 | **The Simulator is now called the Lab** (`/lab`); old `/simulator` links redirect | Founder request. Internal code names stay `simulator`. |
| D98 | **Call recordings in the demo are played with the browser's voices** on a timeline that matches each call's length, with the transcript beside it. Seeded calls get full conversations sized to their length. | No real audio exists until telephony is connected; this keeps play, pause, seeking and duration working. |
| D99 | **Deleting an account** needs the user to type their email. Workspaces where they are the only member are deleted with it; the only owner of a shared workspace must hand over ownership first. | Nobody else loses their work by surprise. |
| D100 | **Billing's "Total spent" is counted from the calls' costs**, so it always matches the dashboard | The demo calls were seeded without matching wallet entries. |
| D101 | **Home: chat with Zara, our AI, to build an agent**, in Plan mode (shows a plan, builds only when approved) or Build mode (builds straight away). The demo Zara is rule-based (`apps/web/src/lib/zara.ts`): it spots the kind of agent, the business and agent names, inbound or outbound, the voice and the language, then starts from the matching template. | Works with no AI service. Swap the rules for a language model later; the chat, plan card and build action stay the same. |
