# Working on Spag AI Studio

Notes for every Claude session on this repository. Read this first.

Spag AI Studio is a platform where businesses in Nigeria and Africa build and run AI voice agents (like Vapi or Retell, made for the Nigerian market). The founder is not a developer: explain things in plain English, without jargon, and say what they will see.

## The repository is the memory, not the chat

A chat session can be lost or deleted (one was, in November 2026). Anything that matters must be written into this repository and pushed, so a brand-new session can carry on from the files alone.

- **Every decision** (what was built or chosen, and why) goes in `docs/DECISIONS.md` as the next numbered row (`D171`, `D172`, ...), under the right heading. Quote the founder's request in the "Why" column when there is one.
- **Plans, ideas and to-dos** that come up in chat but are not built yet go in `docs/ROADMAP.md`. When something on it is built, move it to "Done recently" with its decision number.
- **The README feature table** ("What works today") gets a row, or an updated row, for every new feature.
- **Production gaps** (what is fake, what needs a real account) go in `docs/DEVELOPER_HANDOFF.md`; anything legal goes in `docs/COMPLIANCE_TODO.md` (always marked as needing legal review, never as compliant).
- Update these docs **in the same commit** as the code they describe.

## Commit, push and ship

- Commit after each finished piece of work, with a plain-English message saying what changed for the user. Push straight away: work that is not pushed lives only on a temporary cloud computer.
- **Shipping means the change reaches `main`.** Cloudflare builds and publishes the live site (https://spagai-studio.team-spagai.workers.dev) from `main` only. A push to any other branch does not change the live site.
- When a change reaches `main`, **the ship bell rings**: the page `/ship-bell` (D154) checks `/api/version` every 20 seconds and chimes on the founder's computer when the live commit changes.
- After shipping, check `https://spagai-studio.team-spagai.workers.dev/api/version` until it shows the new commit (D132), then tell the founder it is live. If it has not changed after about 10 minutes, Cloudflare may have missed the push (D163): check Workers & Pages → spagai-studio → Deployments, and push again if no build is listed.
- The Cloudflare worker is close to the free plan's 3 MB limit (D163). Keep heavy libraries out of the server bundle (load them in the browser only when needed, as the knowledge base does with pdf.js).

## Checks before committing

```bash
pnpm typecheck
pnpm test
```

Both must pass. Say so honestly if something could not be run (for example, no database in the session).

## Where things are

- `apps/web`: the website (Next.js on Cloudflare Workers, Prisma + Neon Postgres). Pages in `src/app/(app)/`, server code in `src/server/`.
- `packages/core`: pure business rules with tests (addressing, prompt compiler, compliance gate, billing, simulator).
- `services/voice-worker`: Python starter for live calls (not connected yet).
- `docs/`: decisions, roadmap, architecture, developer handoff, compliance to-do.

## House rules from past decisions

- Interface text is plain and friendly; the brand purple `#5B2BC4` is only for buttons and highlights (D95). Two looks: Day (white) and Night (black) (D96).
- Times are shown in Lagos time.
- Never store secrets in plain text: keys and MCP addresses are encrypted, SIP passwords are not stored (D91, D92, D158).
- Nothing is called compliant with any law; regulatory text is a draft that needs legal review.
