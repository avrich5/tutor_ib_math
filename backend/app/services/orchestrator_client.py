"""Thin typed wrapper around home_orchestrator HTTP API."""
from __future__ import annotations

import httpx
from app.config import settings


class OrchestratorClient:
    def __init__(self) -> None:
        self._base = settings.orchestrator_url.rstrip("/")
        self._headers = {"X-API-Key": settings.orchestrator_api_key}

    async def embed_text(self, text: str) -> list[float]:
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(
                f"{self._base}/v1/embed",
                json={"text": text},
                headers=self._headers,
            )
            r.raise_for_status()
            return r.json()["embedding"]

    async def check_answer(
        self,
        student_answer: str,
        reference_answer: str,
        *,
        answer_format: str = "expression",
        variables: list[str] | None = None,
    ) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(
                f"{self._base}/v1/math/check-answer",
                json={
                    "student_answer": student_answer,
                    "reference_answer": reference_answer,
                    "answer_format": answer_format,
                    "variables": variables or [],
                },
                headers=self._headers,
            )
            r.raise_for_status()
            return r.json()

    async def explore_function(self, expression: str, variable: str = "x") -> dict:
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(
                f"{self._base}/v1/math/explore-function",
                json={"expression": expression, "variable": variable},
                headers=self._headers,
            )
            r.raise_for_status()
            return r.json()


orchestrator = OrchestratorClient()
