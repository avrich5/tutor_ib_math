#!/usr/bin/env python3
"""Dump a chat session to stdout as JSON.

Usage:
    python scripts/dump_chat.py <chat_session_id>
    python scripts/dump_chat.py --list           # show last 20 sessions
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Add backend to path so we can import app modules
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

from app.db import SessionLocal
from app.models.chat import ChatSession, ChatMessage


def list_sessions():
    db = SessionLocal()
    try:
        sessions = (
            db.query(ChatSession)
            .order_by(ChatSession.last_message_at.desc())
            .limit(20)
            .all()
        )
        if not sessions:
            print("No chat sessions found.")
            return
        for s in sessions:
            count = db.query(ChatMessage).filter(ChatMessage.session_id == s.id).count()
            title = s.title or "(no title)"
            study = str(s.study_session_id) if s.study_session_id else "—"
            print(
                f"{s.id}  msgs={count:3d}  last={s.last_message_at.strftime('%Y-%m-%d %H:%M')}  "
                f"study={study}  {title}"
            )
    finally:
        db.close()


def dump_session(session_id: str):
    import uuid
    db = SessionLocal()
    try:
        sid = uuid.UUID(session_id)
        session = db.query(ChatSession).filter_by(id=sid).first()
        if not session:
            print(f"Session {session_id!r} not found.", file=sys.stderr)
            sys.exit(1)

        messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )

        out = {
            "session": {
                "id": str(session.id),
                "title": session.title,
                "study_session_id": str(session.study_session_id) if session.study_session_id else None,
                "started_at": session.started_at.isoformat(),
                "last_message_at": session.last_message_at.isoformat(),
            },
            "messages": [
                {
                    "id": str(m.id),
                    "role": m.role,
                    "content_md": m.content_md,
                    "cited_sources": m.cited_sources,
                    "provider": m.provider,
                    "tokens_in": m.tokens_in,
                    "tokens_out": m.tokens_out,
                    "cost_usd": m.cost_usd,
                    "created_at": m.created_at.isoformat(),
                }
                for m in messages
            ],
        }
        print(json.dumps(out, indent=2, ensure_ascii=False))
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)

    if sys.argv[1] == "--list":
        list_sessions()
    else:
        dump_session(sys.argv[1])
