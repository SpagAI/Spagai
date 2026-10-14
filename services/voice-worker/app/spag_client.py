"""Calls back into the Spag AI web app (apps/web) with the shared secret."""

from __future__ import annotations

import httpx


class SpagClient:
    def __init__(self, base_url: str, secret: str, timeout: float = 5.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._secret = secret
        self._timeout = timeout

    async def sanitise(self, text: str) -> str:
        """Clean a line for speech with the platform's own rules (POST /api/voice/sanitise)."""
        async with httpx.AsyncClient(timeout=self._timeout) as http:
            response = await http.post(
                f"{self._base_url}/api/voice/sanitise",
                json={"text": text},
                headers={"authorization": f"Bearer {self._secret}"},
            )
            response.raise_for_status()
            return str(response.json()["spoken"])
