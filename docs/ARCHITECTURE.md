# Architecture

> Updated each milestone. Parts marked *(planned)* do not exist yet.

## The big picture

```mermaid
flowchart LR
    subgraph Browser
        UI[Business user<br/>Agent Builder, Leads,<br/>Campaigns, Dashboard]
    end

    subgraph web["apps/web (Next.js, M2-M3)"]
        Pages[Pages and API routes]
        Auth[Email login]
        Compliance[Compliance gate<br/>every call attempt<br/>planned M4]
        Providers[Provider adapters<br/>LLM + TTS, mock by default<br/>M3]
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
        Sim[Lab mock brain<br/>silence handling]
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

## The simulator (M3)

```mermaid
sequenceDiagram
    actor U as User
    participant S as Lab page
    participant A as simulate() server action
    participant C as packages/core
    participant L as LLM provider (mock or OpenAI-compatible)
    U->>S: Pick a pretend customer and a time, press Start call
    S->>A: start
    A->>C: buildCallValues + compilePrompt (call mode)
    A-->>S: first message, calling-hours check, full prompt
    U->>S: Type what the customer says (or Stay silent)
    S->>A: message / silence
    A->>L: prompt + conversation + the agent's tools
    L-->>A: reply text + tool calls
    A->>C: sanitiseForSpeech, lintSpokenLine, validateAppointment / isValidEmail
    A-->>S: line, what the voice will say, warnings, checked tool results
    S->>S: Speak the line (browser speech for mock voices)
```

| Folder | Purpose |
|---|---|
| `packages/core/src/simulator` | Mock agent brain, day and time parsing, silence turns (pure, tested) |
| `apps/web/src/server/providers` | `getLlm()` and `synthesise()`: mock and OpenAI-compatible adapters |
| `apps/web/src/app/(app)/lab` | Lab pages (formerly the Simulator) and the `simulate` server action |
| `apps/web/src/app/(app)/voices` | Voice library page and the `previewVoice` server action |
| `apps/web/src/components/voice` | `useSpeaker` hook (browser speech or audio) and the Play button |

## Campaigns and the compliance gate (M4)

```mermaid
flowchart TD
    R[Run calls] --> D[Next due leads<br/>PENDING and nextAttemptAt passed]
    D --> G{checkCallAttempt<br/>hours, opt-out, do-not-call,<br/>consent, source, attempts}
    G -- blocked --> B[Save BLOCKED call with reasons<br/>permanent reason: stop this lead]
    G -- allowed --> C[Compile prompt in call mode<br/>for this lead]
    C -- missing values --> F[Save FAILED call<br/>lead stopped: missing details]
    C --> P[Place the call<br/>mock telephony now, real in M5]
    P --> O{Outcome}
    O -- opted out --> X[Lead opted out + do-not-call list<br/>same transaction]
    O -- booked, not interested, wrong number --> Done[Lead done]
    O -- callback --> CB[Next try at the agreed time]
    O -- no answer --> NA[Next try after the wait]
```

### Data model added in M4

```mermaid
erDiagram
    Organisation ||--o{ Lead : has
    Organisation ||--o{ DoNotCall : keeps
    Organisation ||--o{ Campaign : runs
    Agent ||--o{ Campaign : used_by
    Campaign ||--o{ CampaignLead : includes
    Lead ||--o{ CampaignLead : in
    Lead ||--o{ Call : receives
    Campaign ||--o{ Call : makes
    Lead { string phone "E.164, unique per org" string source boolean consent boolean optedOut json extra }
    Call { string status "BLOCKED NO_ANSWER COMPLETED FAILED" json blockReasons json transcript json toolCalls }
```

## Billing (M5)

```mermaid
sequenceDiagram
    actor O as Owner or Admin
    participant W as apps/web
    participant DB as PostgreSQL
    participant P as Paystack (or pretend checkout)
    O->>W: Top up ₦20,000
    W->>DB: WalletTransaction TOPUP, PENDING, unique reference
    W-->>O: Go to checkout
    O->>P: Pay
    P-->>W: Return to /billing/return (verify with Paystack API)
    P-)W: Webhook charge.success (HMAC-SHA512 signed)
    W->>DB: Flip PENDING → SUCCESS once, add to balance
    Note over W,DB: Each answered call: Call + charge (CALL_CHARGE) in one transaction
```

## Voice worker (M5 starter)

`services/voice-worker` (Python, FastAPI) will run the live call loop. Today it validates call requests,
checks the shared secret, and cleans lines through `POST /api/voice/sanitise` on the web app.
