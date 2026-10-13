# Spag AI Studio (prototype)

A platform where businesses in Nigeria and Africa build and run AI voice agents, like Vapi or Retell but made for the Nigerian market: respectful addressing (Sir and Ma), calling-hours and opt-out enforcement, local voices, and Naira billing.

> **Status: prototype skeleton.** Everything runs locally with **mock** providers. No paid API keys are needed. Nothing here is legal advice. All regulatory text is a draft that **needs legal review**.

## What works today (Milestone 1)

| Area | Where | Status |
|---|---|---|
| Address builder (Mr, Miss, Sir, Ma, Mode A and B) | `packages/core/src/address` | Done + tests |
| Spoken-text sanitiser (no "slash", money, dates and times as words) | `packages/core/src/speech` | Done + tests |
| Spoken-email normaliser ("ada dot obi gmail" becomes ada.obi@gmail.com) | `packages/core/src/email` | Done + tests |
| Nigerian phone tools (E.164, read-back) | `packages/core/src/phone` | Done + tests |
| Time tools (calling window, booking window, greetings, goodbyes) | `packages/core/src/time` | Done + tests |
| Prompt compiler (five-part framework, locked guardrails) | `packages/core/src/prompt/compiler.ts` | Done + tests |
| Prompt linter | `packages/core/src/prompt/linter.ts` | Done + tests |
| 8 preset agents as data files | `packages/core/presets/*.json` | Done (Zara is a placeholder) |
| Names pronunciation starter list | `packages/core/data/names-pronunciation.json` | Done (to be verified) |
| Website, database, voice, billing | — | Coming in M2 to M5 |

## How to run it

### One-time setup

1. Install **Node.js 20 or newer** from https://nodejs.org (choose "LTS").
2. Install **pnpm**: open a terminal and run `npm install -g pnpm`.
3. Get the code and install packages:
   ```bash
   git clone <this repository URL>
   cd Spagai
   pnpm install
   ```

### Everyday commands (run from the project folder)

| Command | What it does | What you should see |
|---|---|---|
| `pnpm test` | Runs all automatic checks | `Tests  159 passed` and no red text |
| `pnpm typecheck` | Checks the code for type mistakes | No errors |
| `pnpm demo` | Shows the core logic in action, including a full compiled Zara prompt and lint score | Seven numbered sections ending with `Score 100/100` |
| `pnpm demo clinic-booking` | Same demo, with a different preset | The clinic prompt |

Preset ids you can pass to `pnpm demo`: `fintech-outbound-zara`, `fintech-support`, `repayment-reminders`, `kyc-follow-up`, `telecom-churn-complaint`, `real-estate-lead-qualifier`, `clinic-booking`, `delivery-confirmation`.

## Project layout

```
packages/core/        Pure business rules (no internet, no database) + tests
  src/                The logic, one folder per topic
  presets/            Preset agents as JSON data files
  data/               Names pronunciation starter list
  test/               Automatic tests (Vitest)
  scripts/demo.ts     The `pnpm demo` script
docs/                 Architecture, decisions, compliance to-do, developer handoff
```

Coming next: `apps/web` (website, M2), `services/voice-worker` (Python stub, M5), `docker-compose.yml` (database, M2).

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the pieces fit together
- [docs/DECISIONS.md](docs/DECISIONS.md): every choice made, and why
- [docs/COMPLIANCE_TODO.md](docs/COMPLIANCE_TODO.md): items for a lawyer (draft, needs legal review)
- [docs/DEVELOPER_HANDOFF.md](docs/DEVELOPER_HANDOFF.md): what a senior developer must build for production
- [docs/zara-prompt.md](docs/zara-prompt.md): paste the real Zara prompt here
