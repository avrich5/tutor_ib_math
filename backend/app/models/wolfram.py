from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class WolframCache(Base):
    __tablename__ = "wolfram_cache"

    query_hash: Mapped[str] = mapped_column(String, primary_key=True)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    response_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class WolframUsage(Base):
    __tablename__ = "wolfram_usage"

    ym: Mapped[str] = mapped_column(String, primary_key=True)  # "2026-05"
    call_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cached_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
