# Spag AI Studio (prototype)

A platform where businesses in Nigeria and Africa build and run AI voice agents, like Vapi or Retell but made for the Nigerian market: respectful addressing (Sir and Ma), calling-hours and opt-out enforcement, local voices, and Naira billing.

> **Status: prototype skeleton.** Everything runs locally with **mock** providers. No paid API keys are needed. Nothing here is legal advice. All regulatory text is a draft that **needs legal review**.

## What works today (Milestones 1 to 5)

| Area | Where | Status |
|---|---|---|
| Core rules: addressing, voice cleaner, emails, phones, Lagos time | `packages/core/src` | Done + tests |
| Prompt compiler (five-part framework, locked guardrails) and linter | `packages/core/src/prompt` | Done + tests |
| 8 preset agents as data files | `packages/core/presets/*.json` | Done (Zara is a placeholder) |
| Website with email sign-in (magic link) | `apps/web` | Done |
| Organisations, members, roles (Owner, Admin, Member, Viewer), invites | `apps/web/src/app/(app)/settings` | Done |
| Agent Builder: presets, business details, blocks, live preview, lint, variables, tools, silence, voice picker | `apps/web/src/components/agent-builder` | Done |
| Translation files (English now; Pidgin, Yoruba, Hausa, Igbo ready to fill) | `apps/web/src/i18n/messages` | Structure done |
| Voice library with previews (Play buttons, try your own line) | `apps/web/src/app/(app)/voices`, `src/components/voice` | Done |
| Simulator: pretend calls with any agent, simulated tools, silence, calling-hours check | `apps/web/src/app/(app)/simulator`, `packages/core/src/simulator` | Done + tests |
| Provider adapters (language model, text-to-speech) with free mock defaults | `apps/web/src/server/providers` | Done + tests |
| Leads: CSV import (sensitive columns refused), add by hand, opt-out, do-not-call list | `apps/web/src/app/(app)/leads`, `packages/core/src/leads` | Done + tests |
| Compliance gate before every call attempt (hours, opt-out, do-not-call, consent, source, attempts) | `packages/core/src/compliance` | Done + tests |
| Campaigns with a mock phone line, retries and callbacks | `apps/web/src/app/(app)/campaigns`, `apps/web/src/server/dialer.ts` | Done |
| Calls log with transcripts and block reasons; dashboard totals | `apps/web/src/app/(app)/calls`, `dashboard` | Done |
| Billing: prepaid naira wallet, per-minute call charges, pretend checkout, Paystack ready (verify + signed webhook) | `apps/web/src/app/(app)/billing`, `apps/web/src/server/wallet.ts`, `packages/core/src/billing` | Done + tests |
| Voice worker starter (Python, FastAPI) and its secure link to the web app | `services/voice-worker`, `apps/web/src/app/api/voice` | Starter (not yet run: see its README) |
| Real phone calls, Nigerian numbers, real voices | — | Needs accounts: see `docs/DEVELOPER_HANDOFF.md` |

## How to run it

### Easiest: one click in GitHub Codespaces (nothing to install)

Codespaces runs the whole project on a GitHub computer, and you use it in your browser.

1. Click **[Open Spag AI Studio in Codespaces](https://codespaces.new/SpagAI/Spagai/tree/claude/hello-l9zr41?quickstart=1)** (sign in to GitHub if asked).
2. Click **Create new codespace**. The first start takes about 3 to 5 minutes. It sets everything up: database, packages, tables and demo data.
3. When the terminal at the bottom says **Ready**, a browser tab opens with the app. If it does not, open the **Ports** tab and click the globe icon next to **Spag AI Studio (3000)**.
4. Sign in with `demo@spagai.local`, click **Email me a sign-in link**, then **Open my sign-in link**, then **Sign in**.

Codespaces is free for personal accounts up to a monthly limit. When you finish, stop it at https://github.com/codespaces (click ⋯ then **Stop codespace**). Next time, open it from the same page; it keeps your data.

### On your own computer

### One-time setup

1. Install **Node.js 20 or newer** from https://nodejs.org (choose "LTS").
2. Install **pnpm**: open a terminal and run `npm install -g pnpm`.
3. Install **Docker Desktop** from https://www.docker.com/products/docker-desktop and start it. (It runs the database and a fake email inbox.)
4. Get the code and install packages:
   ```bash
   git clone <this repository URL>
   cd Spagai
   pnpm install
   ```
5. Create your settings file by copying the example:
   - Mac or Linux: `cp .env.example apps/web/.env`
   - Windows (PowerShell): `Copy-Item .env.example apps/web/.env`
6. Start the database and fake inbox: `pnpm services:up`
7. Create the database tables: `pnpm db:migrate`
8. (Optional) Add demo data: `pnpm db:seed`

### Start the website

```bash
pnpm dev
```

Then open **http://localhost:3000** in your browser.

**To sign in:** type any email address and click "Email me a sign-in link". Then click **Open my sign-in link** (a shortcut shown only during development), then "Sign in". The email also arrives in the fake inbox at **http://localhost:8025**, and the link is printed in the terminal.

- New email address: you get your own new organisation as its Owner.
- With demo data: sign in as `demo@spagai.local` (Owner, has a Zara agent and ten leads), or `viewer@spagai.local` (read-only).

### Everyday commands (run from the project folder)

| Command | What it does | What you should see |
|---|---|---|
| `pnpm dev` | Runs the website at http://localhost:3000 | "Ready" in the terminal |
| `pnpm test` | Runs all automatic checks | Two lines ending `passed` (core and web), no red text |
| `pnpm typecheck` | Checks the code for type mistakes | No errors |
| `pnpm demo` | Shows the core logic in the terminal | Seven numbered sections ending `Score 100/100` |
| `pnpm services:up` / `pnpm services:down` | Start or stop the database and fake inbox | — |
| `pnpm db:studio` | Opens a simple database browser | A web page listing tables |

Preset ids you can pass to `pnpm demo`: `fintech-outbound-zara`, `fintech-support`, `repayment-reminders`, `kyc-follow-up`, `telecom-churn-complaint`, `real-estate-lead-qualifier`, `clinic-booking`, `delivery-confirmation`.

### If something goes wrong

- **"Can't reach database server"**: Docker is not running, or you skipped `pnpm services:up`.
- **No email in the inbox**: copy the link from the terminal where `pnpm dev` is running.
- **"Too many attempts"**: sign-in links are limited to 5 per email per 15 minutes. Wait, or restart `pnpm dev`.

## Project layout

```
apps/web/             The website (Next.js)
  src/app/            Pages: login, dashboard, agents, settings
  src/components/     Screen building blocks (shadcn/ui style) and the Agent Builder
  src/server/         Sign-in, sessions, database access, permissions, rate limiting
  src/i18n/messages/  Interface text: en.json (+ pcm, yo, ha, ig to fill in)
  prisma/             Database tables (schema.prisma), migrations, demo data
  test/               Automatic tests
packages/core/        Pure business rules (no internet, no database) + tests
  src/                The logic, one folder per topic
  presets/            Preset agents as JSON data files
  data/               Names pronunciation list and starter voice list
docs/                 Architecture, decisions, compliance to-do, developer handoff
docker-compose.yml    Local database and fake email inbox
```

`services/voice-worker/`  The real-time call worker (Python starter, see its README)

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the pieces fit together
- [docs/DECISIONS.md](docs/DECISIONS.md): every choice made, and why
- [docs/COMPLIANCE_TODO.md](docs/COMPLIANCE_TODO.md): items for a lawyer (draft, needs legal review)
- [docs/DEVELOPER_HANDOFF.md](docs/DEVELOPER_HANDOFF.md): what a senior developer must build for production
- [docs/zara-prompt.md](docs/zara-prompt.md): paste the real Zara prompt here
