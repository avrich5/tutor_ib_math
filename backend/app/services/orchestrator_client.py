"""Thin typed wrapper around home_orchestrator HTTP API."""
from __future__ import annotations

import httpx
from app.config import settings


class OrchestratorClient:
    def __init__(self) -> None:
        self._base = settings.orchestrator_url.rstrip("/")
        self._headers = {"X-API-Key": settings.orchestrator_api_key}

    async def embed_text(self, text: str) -> list[float]:
        embed_base = settings.embedding_agent_url.rstrip("/")
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(
                f"{embed_base}/embed",
                json={"text": text},
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

    async def chat_completion(
        self,
        messages: list[dict],
        *,
        system: str = "",
        max_tokens: int = 2048,
    ) -> dict:
        """Call Anthropic Messages API directly. Returns {content, tokens_in, tokens_out}."""
        headers = {
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body: dict = {
            "model": settings.anthropic_model,
            "max_tokens": max_tokens,
            "messages": messages,
        }
        if system:
            body["system"] = system

        async with httpx.AsyncClient(timeout=120.0) as c:
            r = await c.post(
                "https://api.anthropic.com/v1/messages",
                json=body,
                headers=headers,
            )
            r.raise_for_status()
            data = r.json()

        return {
            "content": data["content"][0]["text"],
            "tokens_in": data["usage"]["input_tokens"],
            "tokens_out": data["usage"]["output_tokens"],
        }

    async def chat_stream(
        self,
        messages: list[dict],
        *,
        system: str = "",
        max_tokens: int = 2048,
    ):
        """Stream Anthropic Messages API response. Yields text deltas, then usage dict."""
        headers = {
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body: dict = {
            "model": settings.anthropic_model,
            "max_tokens": max_tokens,
            "stream": True,
            "messages": messages,
        }
        if system:
            body["system"] = system

        import json as _json

        async with httpx.AsyncClient(timeout=120.0) as c:
            async with c.stream(
                "POST",
                "https://api.anthropic.com/v1/messages",
                json=body,
                headers=headers,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if not payload or payload == "[DONE]":
                        continue
                    event = _json.loads(payload)
                    etype = event.get("type")
                    if etype == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta":
                            yield {"type": "delta", "text": delta["text"]}
                    elif etype == "message_delta":
                        usage = event.get("usage", {})
                        yield {"type": "usage", "tokens_out": usage.get("output_tokens", 0)}
                    elif etype == "message_start":
                        usage = event.get("message", {}).get("usage", {})
                        yield {"type": "start", "tokens_in": usage.get("input_tokens", 0)}


orchestrator = OrchestratorClient()
