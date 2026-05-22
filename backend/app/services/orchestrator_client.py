"""Thin typed wrapper around home_orchestrator HTTP API."""
from __future__ import annotations

import json as _json
import logging

import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class OrchestratorClient:
    def __init__(self) -> None:
        self._base = settings.orchestrator_url.rstrip("/")
        self._headers = {"X-API-Key": settings.orchestrator_api_key}

    # ── Embeddings ────────────────────────────────────────────────────────────

    async def embed_text(self, text: str) -> list[float]:
        embed_base = settings.embedding_agent_url.rstrip("/")
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(f"{embed_base}/embed", json={"text": text})
            r.raise_for_status()
            return r.json()["embedding"]

    # ── Math helpers (via orchestrator → math_agent) ─────────────────────────

    async def check_answer(
        self,
        student_answer: str,
        reference_answer: str,
        *,
        answer_format: str = "expression",
        variables: list[str] | None = None,
        question_stem: str | None = None,
    ) -> dict:
        payload: dict = {
            "student_answer": student_answer,
            "reference_answer": reference_answer,
            "answer_format": answer_format,
            "variables": variables or [],
        }
        if question_stem is not None:
            payload["question_stem"] = question_stem
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(
                f"{self._base}/v1/math/check-answer",
                json=payload,
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

    # ── Chat (via orchestrator → chat_agent) ─────────────────────────────────

    async def chat_completion(
        self,
        messages: list[dict],
        *,
        system: str = "",
        max_tokens: int = 2048,
    ) -> dict:
        """Returns {content, tokens_in, tokens_out, provider}."""
        async with httpx.AsyncClient(timeout=120.0) as c:
            r = await c.post(
                f"{self._base}/v1/chat/message",
                json={"messages": messages, "system": system, "max_tokens": max_tokens},
                headers=self._headers,
            )
            r.raise_for_status()
            return r.json()

    async def chat_stream(
        self,
        messages: list[dict],
        *,
        system: str = "",
        max_tokens: int = 2048,
    ):
        """Yields {type, ...} dicts. Types: provider, start, delta, usage."""
        async with httpx.AsyncClient(timeout=300.0) as c:
            async with c.stream(
                "POST",
                f"{self._base}/v1/chat/message/stream",
                json={"messages": messages, "system": system, "max_tokens": max_tokens},
                headers=self._headers,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if not payload:
                        continue
                    yield _json.loads(payload)


orchestrator = OrchestratorClient()
