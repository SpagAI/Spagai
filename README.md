# Spag AI Studio (prototype)

A platform where businesses in Nigeria and Africa build and run AI voice agents, like Vapi or Retell but made for the Nigerian market: respectful addressing (Sir and Ma), calling-hours and opt-out enforcement, local voices, and Naira billing.

> **Status: prototype skeleton.** Everything runs locally with **mock** providers. No paid API keys are needed. Nothing here is legal advice. All regulatory text is a draft that **needs legal review**.

## What works today (Milestones 1 and 2)

| Area | Where | Status |
|---|---|---|
| Core rules: addressing, voice cleaner, emails, phones, Lagos time | `packages/core/src` | Done + tests |
| Prompt compiler (five-part framework, locked guardrails) and linter | `packages/core/src/prompt` | Done + tests |
| 8 preset agents as data files | `packages/core/presets/*.json` | Done (Zara is a placeholder) |
| Website with email sign-in (magic link) | `apps/web` | Done |
| Organisations, members, roles (Owner, Admin, Member, Viewer), invites | `apps/web/src/app/(app)/settings` | Done |
| Agent Builder: presets, business details, blocks, live preview, lint, variables, tools, silence, voice picker | `apps/web/src/components/agent-builder` | Done |
| Translation files (English now; Pidgin, Yoruba, Hausa, Igbo ready to fill) | `apps/web/src/i18n/messages` | Structure done |
| Voice previews, simulator | — | M3 |
| Leads, campaigns, compliance engine, calls, dashboard | — | M4 |
| Billing, voice worker | — | M5 |

## How to run it

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

**To sign in:** type any email address and click "Email me a sign-in link". Open the fake inbox at **http://localhost:8025**, click the link, then click "Sign in". (The link is also printed in the terminal where `pnpm dev` is running.)

- New email address: you get your own new organisation as its Owner.
- With demo data: sign in as `demo@spagai.local` (Owner, has a Zara agent), or `viewer@spagai.local` (read-only).

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

Coming next: `services/voice-worker` (Python stub, M5).

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the pieces fit together
- [docs/DECISIONS.md](docs/DECISIONS.md): every choice made, and why
- [docs/COMPLIANCE_TODO.md](docs/COMPLIANCE_TODO.md): items for a lawyer (draft, needs legal review)
- [docs/DEVELOPER_HANDOFF.md](docs/DEVELOPER_HANDOFF.md): what a senior developer must build for production
- [docs/zara-prompt.md](docs/zara-prompt.md): paste the real Zara prompt here
