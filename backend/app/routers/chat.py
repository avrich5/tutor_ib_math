"""Chat sessions and messages — Phase 5 Stages 1-2 (sync + SSE streaming)."""
from __future__ import annotations

import json as _json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.db import SessionLocal, get_db
from app.models.chat import ChatMessage, ChatSession
from app.models.session import StudySession
from app.models.user import AppUser
from app.routers.auth import get_current_user
from app.services.chat_context import build_context_prompt
from app.services.orchestrator_client import orchestrator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

# Approximate cost for claude-haiku-4-5: $0.80/$4.00 per 1M tokens (in/out)
_COST_IN = 0.80 / 1_000_000
_COST_OUT = 4.00 / 1_000_000


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class CreateSessionRequest(BaseModel):
    study_session_id: str | None = None
    title: str | None = None


class SendMessageRequest(BaseModel):
    content_md: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_uuid(value: str, field: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid UUID for {field}: {value!r}")


def _get_chat_session(session_id: str, user: AppUser, db: Session) -> ChatSession:
    sid = _parse_uuid(session_id, "session_id")
    s = db.query(ChatSession).filter_by(id=sid, user_id=user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return s


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/sessions")
async def create_session(
    req: CreateSessionRequest,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    study_session_id = None
    if req.study_session_id:
        ss_uuid = _parse_uuid(req.study_session_id, "study_session_id")
        ss = db.query(StudySession).filter_by(id=ss_uuid, user_id=user.id).first()
        if not ss:
            raise HTTPException(status_code=404, detail="Study session not found or not owned by user")
        study_session_id = ss.id

    session = ChatSession(
        id=uuid.uuid4(),
        user_id=user.id,
        study_session_id=study_session_id,
        title=req.title,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "chat_session_id": str(session.id),
        "started_at": session.started_at.isoformat(),
    }


@router.get("/sessions")
async def list_sessions(
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(ChatSession)
        .filter_by(user_id=user.id)
        .order_by(ChatSession.last_message_at.desc())
        .limit(50)
        .all()
    )

    result = []
    for s in sessions:
        count = (
            db.query(func.count(ChatMessage.id))
            .filter(ChatMessage.session_id == s.id)
            .scalar()
        )
        result.append(
            {
                "id": str(s.id),
                "title": s.title,
                "study_session_id": str(s.study_session_id) if s.study_session_id else None,
                "started_at": s.started_at.isoformat(),
                "last_message_at": s.last_message_at.isoformat(),
                "message_count": count,
            }
        )

    return result


@router.get("/sessions/{session_id}/messages")
async def get_messages(
    session_id: str,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_chat_session(session_id, user, db)

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content_md": m.content_md,
            "cited_sources": m.cited_sources,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


@router.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: str,
    req: SendMessageRequest,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_chat_session(session_id, user, db)

    # Save user message first so it appears in history on retry
    user_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        role="user",
        content_md=req.content_md,
    )
    db.add(user_msg)
    db.flush()

    # Build conversation history (exclude just-saved user msg to avoid duplicate)
    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id, ChatMessage.id != user_msg.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    messages = [{"role": m.role, "content": m.content_md} for m in history]
    messages.append({"role": "user", "content": req.content_md})

    system_prompt = await build_context_prompt(db, user, session, query=req.content_md)

    # Call Anthropic via orchestrator_client
    try:
        result = await orchestrator.chat_completion(
            messages=messages,
            system=system_prompt,
        )
        assistant_content = result["content"]
        tokens_in = result["tokens_in"]
        tokens_out = result["tokens_out"]
    except Exception as exc:
        logger.error("LLM call failed: %s", exc)
        db.rollback()
        raise HTTPException(status_code=502, detail=f"LLM call failed: {exc}") from exc

    cost_usd = tokens_in * _COST_IN + tokens_out * _COST_OUT

    assistant_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        role="assistant",
        content_md=assistant_content,
        provider=f"anthropic/{settings.anthropic_model}",
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        cost_usd=cost_usd,
    )
    db.add(assistant_msg)

    session.last_message_at = datetime.now(timezone.utc)

    db.commit()

    return {
        "user_message_id": str(user_msg.id),
        "assistant_message_id": str(assistant_msg.id),
        "content_md": assistant_content,
    }


@router.post("/sessions/{session_id}/messages/stream")
async def stream_message(
    session_id: str,
    req: SendMessageRequest,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_chat_session(session_id, user, db)

    # Persist user message immediately so history is consistent if stream is interrupted
    user_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        role="user",
        content_md=req.content_md,
    )
    db.add(user_msg)
    db.commit()

    # Build conversation history for LLM
    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id, ChatMessage.id != user_msg.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    llm_messages = [{"role": m.role, "content": m.content_md} for m in history]
    llm_messages.append({"role": "user", "content": req.content_md})

    # Build system prompt (+ RAG) while db is open — generator runs after db may close
    system_prompt = await build_context_prompt(db, user, session, query=req.content_md)

    # Capture IDs so generator closure works after request-scoped db is released
    chat_session_id = session.id
    assistant_msg_id = uuid.uuid4()

    async def generate():
        full_text: list[str] = []
        tokens_in = 0
        tokens_out = 0
        stream_ok = False

        try:
            async for event in orchestrator.chat_stream(
                messages=llm_messages, system=system_prompt
            ):
                if event["type"] == "start":
                    tokens_in = event["tokens_in"]
                elif event["type"] == "delta":
                    full_text.append(event["text"])
                    yield {"event": "chunk", "data": _json.dumps({"delta": event["text"]})}
                elif event["type"] == "usage":
                    tokens_out = event["tokens_out"]
            stream_ok = True

        except Exception as exc:
            logger.error("Stream interrupted: %s", exc)

        # Persist assistant message using a fresh session (request-scoped db may be closing)
        content = "".join(full_text)
        if not stream_ok:
            content += "\n\n[INCOMPLETE]"

        cost_usd = tokens_in * _COST_IN + tokens_out * _COST_OUT
        save_db = SessionLocal()
        try:
            asst = ChatMessage(
                id=assistant_msg_id,
                session_id=chat_session_id,
                role="assistant",
                content_md=content,
                provider=f"anthropic/{settings.anthropic_model}",
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                cost_usd=cost_usd,
            )
            save_db.add(asst)
            chat_sess = save_db.get(ChatSession, chat_session_id)
            if chat_sess:
                chat_sess.last_message_at = datetime.now(timezone.utc)
            save_db.commit()
        except Exception as exc:
            logger.error("Failed to persist assistant message: %s", exc)
            save_db.rollback()
        finally:
            save_db.close()

        yield {
            "event": "done",
            "data": _json.dumps(
                {
                    "message_id": str(assistant_msg_id),
                    "tokens_in": tokens_in,
                    "tokens_out": tokens_out,
                    "cost_usd": round(cost_usd, 6),
                }
            ),
        }

    return EventSourceResponse(generate())
