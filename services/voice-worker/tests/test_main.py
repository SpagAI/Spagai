"""Run with:  pytest   (from services/voice-worker, after pip install -r requirements-dev.txt)"""

from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient

SECRET = "s" * 40

VALID_CALL = {
    "call_id": "call_1",
    "phone": "+2348031234567",
    "prompt": "You are Zara.",
    "first_message": "Good morning, Mr Okafor. Your payment of ₦25,000 is due.",
    "voice_id": "mock-en-ng-female-1",
    "tools": ["save_lead_data", "end_call"],
    "silence": {
        "check_in_after_seconds": 7,
        "check_in_message": "Hello, are you still there?",
        "max_check_ins": 1,
        "end_call_after_seconds": 15,
        "closing_message": "Goodbye.",
    },
}


class FakeClient:
    async def sanitise(self, text: str) -> str:
        return text.replace("₦25,000", "twenty five thousand naira")


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("WORKER_SHARED_SECRET", SECRET)
    monkeypatch.delenv("VOICE_WORKER_MODE", raising=False)
    import app.main as main

    main = importlib.reload(main)
    main.app.dependency_overrides[main.get_client] = FakeClient
    return TestClient(main.app)


def auth(secret: str = SECRET) -> dict[str, str]:
    return {"authorization": f"Bearer {secret}"}


def test_health(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok", "mode": "mock"}


def test_needs_the_shared_secret(client: TestClient) -> None:
    assert client.post("/calls", json=VALID_CALL).status_code == 401
    assert client.post("/calls", json=VALID_CALL, headers=auth("wrong" * 10)).status_code == 401


def test_accepts_a_valid_call_and_cleans_the_first_line(client: TestClient) -> None:
    response = client.post("/calls", json=VALID_CALL, headers=auth())
    assert response.status_code == 202
    assert response.json() == {
        "call_id": "call_1",
        "mode": "mock",
        "first_line_spoken": "Good morning, Mr Okafor. Your payment of twenty five thousand naira is due.",
    }


@pytest.mark.parametrize("phone", ["08031234567", "+2347221234567", "+44803123456"])
def test_rejects_numbers_that_are_not_nigerian_mobiles_in_e164(client: TestClient, phone: str) -> None:
    assert client.post("/calls", json={**VALID_CALL, "phone": phone}, headers=auth()).status_code == 422


def test_rejects_unknown_tools(client: TestClient) -> None:
    assert client.post("/calls", json={**VALID_CALL, "tools": ["transfer_money"]}, headers=auth()).status_code == 422
