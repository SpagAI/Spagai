# Architecture

> Updated each milestone. Parts marked *(planned)* do not exist yet.

## The big picture

```mermaid
flowchart LR
    subgraph Browser
        UI[Business user<br/>Agent Builder, Leads,<br/>Campaigns, Dashboard]
    end

    subgraph web["apps/web (Next.js, M2)"]
        Pages[Pages and API routes]
        Auth[Email login]
        Compliance[Compliance gate<br/>every call attempt<br/>planned M4]
        Providers[Provider adapters<br/>mock by default<br/>planned M3]
    end

    subgraph core["packages/core (pure logic, M1)"]
        Address[Address builder<br/>Sir / Ma rules]
        Sanitiser[Spoken-text sanitiser]
        Email[Spoken-email normaliser]
        Phone[Nigerian phone tools]
        Time[Time tools<br/>Africa/Lagos]
        Compiler[Prompt compiler<br/>5-part framework + guardrails]
        Linter[Prompt linter]
        Presets[(Preset JSON files)]
    end

    DB[(PostgreSQL via Prisma)]
    Worker["services/voice-worker (Python)<br/>planned M5: plug in LiveKit Agents or Pipecat"]
    Ext["Real providers (later)<br/>LLM, ASR, TTS, telephony,<br/>Paystack, Flutterwave"]

    UI --> Pages
    Pages --> Auth
    Pages --> core
    Pages --> Compliance --> core
    Pages --> DB
    Pages --> Providers -.optional.-> Ext
    Worker -.uses compiled prompt + sanitiser rules.-> Pages
    Worker -.-> Ext
```

## Rules of the road

1. **`packages/core` is pure.** No network, no database, no reading the clock unless a `Date` is passed in. That makes every rule testable and reusable by the website, the simulator and (via an API) the voice worker.
2. **Everything outside is behind an interface.** LLM, speech-to-text, text-to-speech, telephony and payments each have an interface with a **mock** adapter. Real ones are switched on through environment variables (see `.env.example`).
3. **One gate for every call.** *(planned M4)* Every call attempt passes through one compliance function (calling hours, opt-out, do-not-disturb, consent, lead source). The reason for every block is logged.
4. **Text is cleaned before it is spoken.** Every line the agent says goes through `sanitiseForSpeech` before text-to-speech.
5. **Time is always Africa/Lagos (WAT). Money is always integer kobo.**

## packages/core modules

| Module | Main functions | Used by |
|---|---|---|
| `address` | `buildAddress`, `checkAddressRule` | Prompt runtime values, linter |
| `speech` | `sanitiseForSpeech` | TTS path, demo |
| `email` | `normaliseSpokenEmail`, `emailToSpeech` | save_lead_data tool, sanitiser |
| `phone` | `parseNigerianPhone`, `formatNigerianPhone`, `phoneToSpeech` | Lead import, sanitiser |
| `time` | `isWithinCallingWindow`, `isWithinBookingWindow`, `validateAppointment`, `getTimeOfDay`, `chooseGoodbye` | Compliance, booking tools, prompt runtime |
| `prompt` | `compilePrompt`, `lintPrompt`, `lintSpokenLine`, `buildCallValues` | Agent Builder, simulator, dialer |
| `agent` | `TOOL_DEFINITIONS`, `DEFAULT_SILENCE`, `presetSchema` | Agent Builder, presets |
| `presets` | `PRESETS`, `getPreset`, `presetToTemplate` | Agent Builder |
| `names` | `getNamePronunciation` | Future TTS pronunciation hints |

## How a prompt is built

```mermaid
flowchart TD
    P[Preset JSON or user's blocks] --> G[Add locked guardrails<br/>calling hours, opt-out,<br/>AI disclosure, data safety]
    G --> O[Order by framework:<br/>Beginning, Adjunct, Body x3 phases,<br/>Anything else, End]
    O --> V[Fill variables<br/>agent values now;<br/>call and system values at dial time]
    V --> R[Compiled prompt + first message<br/>+ length estimate + variable report]
    R --> L[Linter: questions per turn, symbols,<br/>Sir/Ma placement, guardrails, length,<br/>repeats, after-hours wording]
```

## Signing in (magic link)

```mermaid
sequenceDiagram
    actor U as User
    participant W as apps/web
    participant DB as PostgreSQL
    participant M as Email (Mailpit locally)
    U->>W: Enter email on /login
    W->>W: Rate limit (per email, per IP)
    W->>DB: Save SHA-256 hash of a random token (15 min, single use)
    W->>M: Email link /auth/verify?token=...
    U->>W: Open link, click "Sign in"
    W->>DB: Mark token used, find or create user and organisation
    W->>DB: Create session (hash only)
    W-->>U: httpOnly session cookie, go to /dashboard
```

## apps/web layout

| Folder | Purpose |
|---|---|
| `src/app/login`, `src/app/auth/verify` | Public sign-in pages (server actions) |
| `src/app/(app)/…` | Signed-in pages. The layout calls `requireOrg()`, which redirects to /login if needed. |
| `src/app/(app)/agents/actions.ts` | Create, save (server-side guardrail enforcement and readiness check) and delete agents |
| `src/app/(app)/settings/actions.ts` | Rename organisation, invite, change roles, remove members |
| `src/server/auth` | Tokens, login links, sessions |
| `src/server/permissions.ts` | Role rules (pure, tested) |
| `src/server/rate-limit.ts` | In-memory rate limiter (pure, tested) |
| `src/components/agent-builder` | The Agent Builder: tabs, blocks editor, live preview panel |
| `src/i18n` | Translation files and helpers |

## Data model (M2)

```mermaid
erDiagram
    User ||--o{ Membership : has
    Organisation ||--o{ Membership : has
    User ||--o{ Session : has
    Organisation ||--o{ Agent : owns
    Organisation ||--o{ AuditLog : records
    Membership { string role "OWNER ADMIN MEMBER VIEWER" }
    Agent { json config "AgentConfig from core" string status "DRAFT READY" }
    LoginToken { string tokenHash "hash only" datetime expiresAt }
```
