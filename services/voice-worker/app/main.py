"""Spag AI voice worker (M5 starter).

This service will run the real-time call loop (telephony audio in, speech-to-text,
language model, text-to-speech, audio out). Today it is a starter:

* it checks requests from the web app with the shared secret,
* it validates a call request (Nigerian number, prompt, first message, tools),
* it cleans every line through the web app's /api/voice/sanitise endpoint, so the
  speech rules live in one place (packages/core),
* in "mock" mode it accepts the call and returns what would be said first.

The real audio pipeline is planned with LiveKit Agents or Pipecat (see README.md).
"""

from __future__ import annotations

import os
import secrets
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app.spag_client import SpagClient

MODE: Literal["mock", "live"] = "live" if os.environ.get("VOICE_WORKER_MODE") == "live" else "mock"
SHARED_SECRET = os.environ.get("WORKER_SHARED_SECRET", "")

app = FastAPI(title="Spag AI voice worker", version="0.1.0")


def get_client() -> SpagClient:
    return SpagClient(base_url=os.environ.get("SPAG_APP_URL", "http://localhost:3000"), secret=SHARED_SECRET)


def require_secret(authorization: str | None = Header(default=None)) -> None:
    """The web app calls us with the same shared secret it expects from us."""
    if len(SHARED_SECRET) < 32:
        raise HTTPException(status_code=503, detail="WORKER_SHARED_SECRET is not set (32+ characters).")
    given = authorization[7:] if authorization and authorization.startswith("Bearer ") else ""
    if not secrets.compare_digest(given.encode(), SHARED_SECRET.encode()):
        raise HTTPException(status_code=401, detail="unauthorised")


class Silence(BaseModel):
    check_in_after_seconds: int = Field(ge=3, le=60)
    check_in_message: str = Field(min_length=1, max_length=300)
    max_check_ins: int = Field(ge=0, le=3)
    end_call_after_seconds: int = Field(ge=5, le=120)
    closing_message: str = Field(min_length=1, max_length=300)


class CallRequest(BaseModel):
    call_id: str = Field(min_length=1, max_length=100)
    # Nigerian mobile in E.164, as stored by the web app.
    phone: str = Field(pattern=r"^\+234[789][01]\d{8}$")
    prompt: str = Field(min_length=1, max_length=20_000)
    first_message: str = Field(min_length=1, max_length=1_000)
    voice_id: str = Field(min_length=1, max_length=100)
    tools: list[Literal["check_calendar", "book_appointment", "reschedule_appointment", "save_lead_data", "end_call"]]
    silence: Silence


class CallAccepted(BaseModel):
    call_id: str
    mode: Literal["mock", "live"]
    first_line_spoken: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": MODE}


@app.post("/calls", status_code=202, dependencies=[Depends(require_secret)])
async def start_call(request: CallRequest, client: SpagClient = Depends(get_client)) -> CallAccepted:
    if MODE == "live":
        # Not built yet: connect the SIP/telephony provider and the LiveKit Agents or Pipecat pipeline here.
        raise HTTPException(status_code=501, detail="Live calling is not built yet. Run with VOICE_WORKER_MODE=mock.")
    spoken = await client.sanitise(request.first_message)
    return CallAccepted(call_id=request.call_id, mode=MODE, first_line_spoken=spoken)
