"""Thin typed wrapper around home_orchestrator HTTP API + LLM providers."""
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

    # ── Chat: OpenAI primary → Anthropic fallback ────────────────────────────

    async def chat_completion(
        self,
        messages: list[dict],
        *,
        system: str = "",
        max_tokens: int = 2048,
    ) -> dict:
        """Returns {content, tokens_in, tokens_out, provider}."""
        if settings.openai_api_key:
            try:
                return await self._openai_completion(messages, system=system, max_tokens=max_tokens)
            except Exception as exc:
                logger.warning("OpenAI chat_completion failed, falling back to Anthropic: %s", exc)

        return await self._anthropic_completion(messages, system=system, max_tokens=max_tokens)

    async def chat_stream(
        self,
        messages: list[dict],
        *,
        system: str = "",
        max_tokens: int = 2048,
    ):
        """Yields text deltas then usage dict. OpenAI primary → Anthropic fallback."""
        if settings.openai_api_key:
            try:
                async for event in self._openai_stream(messages, system=system, max_tokens=max_tokens):
                    yield event
                return
            except Exception as exc:
                logger.warning("OpenAI chat_stream failed, falling back to Anthropic: %s", exc)

        async for event in self._anthropic_stream(messages, system=system, max_tokens=max_tokens):
            yield event

    # ── OpenAI implementation ─────────────────────────────────────────────────

    async def _openai_completion(
        self,
        messages: list[dict],
        *,
        system: str,
        max_tokens: int,
    ) -> dict:
        oai_messages = []
        if system:
            oai_messages.append({"role": "system", "content": system})
        oai_messages.extend(messages)

        async with httpx.AsyncClient(timeout=120.0) as c:
            r = await c.post(
                "https://api.openai.com/v1/chat/completions",
                json={
                    "model": settings.openai_model,
                    "max_tokens": max_tokens,
                    "messages": oai_messages,
                },
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
            )
            r.raise_for_status()
            data = r.json()

        return {
            "content": data["choices"][0]["message"]["content"],
            "tokens_in": data["usage"]["prompt_tokens"],
            "tokens_out": data["usage"]["completion_tokens"],
            "provider": "openai",
        }

    async def _openai_stream(
        self,
        messages: list[dict],
        *,
        system: str,
        max_tokens: int,
    ):
        oai_messages = []
        if system:
            oai_messages.append({"role": "system", "content": system})
        oai_messages.extend(messages)

        async with httpx.AsyncClient(timeout=120.0) as c:
            async with c.stream(
                "POST",
                "https://api.openai.com/v1/chat/completions",
                json={
                    "model": settings.openai_model,
                    "max_tokens": max_tokens,
                    "stream": True,
                    "stream_options": {"include_usage": True},
                    "messages": oai_messages,
                },
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
            ) as resp:
                resp.raise_for_status()
                started = False
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if not payload or payload == "[DONE]":
                        continue
                    event = _json.loads(payload)
                    # Final usage chunk sent by stream_options: include_usage
                    if event.get("usage") and not event.get("choices"):
                        usage = event["usage"]
                        yield {"type": "start", "tokens_in": usage.get("prompt_tokens", 0)}
                        yield {"type": "usage", "tokens_out": usage.get("completion_tokens", 0)}
                        continue
                    choices = event.get("choices", [])
                    if not choices:
                        continue
                    if not started:
                        started = True
                    delta = choices[0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        yield {"type": "delta", "text": content}

    # ── Anthropic implementation ──────────────────────────────────────────────

    async def _anthropic_completion(
        self,
        messages: list[dict],
        *,
        system: str,
        max_tokens: int,
    ) -> dict:
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
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
            )
            r.raise_for_status()
            data = r.json()

        return {
            "content": data["content"][0]["text"],
            "tokens_in": data["usage"]["input_tokens"],
            "tokens_out": data["usage"]["output_tokens"],
            "provider": "anthropic",
        }

    async def _anthropic_stream(
        self,
        messages: list[dict],
        *,
        system: str,
        max_tokens: int,
    ):
        body: dict = {
            "model": settings.anthropic_model,
            "max_tokens": max_tokens,
            "stream": True,
            "messages": messages,
        }
        if system:
            body["system"] = system

        async with httpx.AsyncClient(timeout=120.0) as c:
            async with c.stream(
                "POST",
                "https://api.anthropic.com/v1/messages",
                json=body,
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
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
