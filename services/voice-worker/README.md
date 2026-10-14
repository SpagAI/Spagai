# Spag AI voice worker (M5 starter)

A small Python service (FastAPI) that will run real phone calls: telephony audio in,
speech-to-text, the language model with the agent's compiled prompt, text-to-speech,
and audio out. **Today it is a starter**, not a working phone line.

## What it does now

- `GET /health`: is it running, and in which mode.
- `POST /calls` (needs `Authorization: Bearer <WORKER_SHARED_SECRET>`): checks a call request
  (Nigerian mobile in `+234…` form, prompt, first message, voice, tools, silence settings).
  In `mock` mode it accepts the call and returns the first line cleaned for speech.
- Every line is cleaned by the web app's `POST /api/voice/sanitise`, so the speech rules
  (numbers, naira, emails, phone numbers, Sir and Ma) live in one place: `packages/core`.

> Python was not available on the machine this was written on, so these files have not been run
> yet. Run the tests below first.

## Run it

Needs Python 3.11 or newer.

```bash
cd services/voice-worker
python -m venv .venv
.venv/Scripts/activate        # Windows. On Mac or Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

Start it (the web app must be running too):

```bash
WORKER_SHARED_SECRET=<same 32+ character secret as apps/web/.env> SPAG_APP_URL=http://localhost:3000 uvicorn app.main:app --port 8000
```

| Setting | Meaning |
|---|---|
| `WORKER_SHARED_SECRET` | Same value as in `apps/web/.env`. At least 32 characters. Both sides refuse requests without it. |
| `SPAG_APP_URL` | Where the web app runs. Default `http://localhost:3000`. |
| `VOICE_WORKER_MODE` | `mock` (default) or `live`. `live` returns "not built yet" until the pipeline exists. |

## What is needed for real calls

1. **A Nigerian phone line**: a SIP trunk or voice API with Nigerian numbers (for example Africa's Talking,
   or a local carrier's SIP trunk). Needs an account, number registration and NCC rules confirmed.
2. **The real-time pipeline**: LiveKit Agents or Pipecat, connected to that phone line.
3. **Speech providers**: speech-to-text and text-to-speech that handle Nigerian English (and later Pidgin,
   Yoruba, Hausa, Igbo), plus a fast language model.
4. **Hooks back to the web app**: report the transcript, tool calls and duration when a call ends,
   so the existing outcome handling, opt-outs and billing in `apps/web/src/server/dialer.ts` apply.

See `docs/DEVELOPER_HANDOFF.md` for the full list.
