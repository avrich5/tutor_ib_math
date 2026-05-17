from __future__ import annotations

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import ARRAY, Boolean, DateTime, ForeignKey, Index, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SourceDocument(Base):
    __tablename__ = "source_document"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    job_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    ingested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class TextbookQuestion(Base):
    __tablename__ = "textbook_question"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_doc_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_document.id"), nullable=False
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("topic.id"), nullable=True
    )
    chapter: Mapped[str] = mapped_column(Text, nullable=False)
    exercise_ref: Mapped[str] = mapped_column(Text, nullable=False)
    question_number: Mapped[str] = mapped_column(Text, nullable=False)
    stem_md: Mapped[str] = mapped_column(Text, nullable=False)
    parts: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_drill: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    has_answer: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reference_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    solution_steps: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    origin_page: Mapped[int] = mapped_column(Integer, nullable=False)
    protected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(768), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("ix_tbq_source", "source_doc_id"),
        Index("ix_tbq_topic", "topic_id"),
        Index(
            "ix_tbq_embedding", "embedding",
            postgresql_using="ivfflat",
            postgresql_ops={"embedding": "vector_cosine_ops"},
            postgresql_where="embedding IS NOT NULL",
        ),
        {"schema": None},
    )

    # unique constraint handled in migration


class TextbookConcept(Base):
    __tablename__ = "textbook_concept"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_doc_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_document.id"), nullable=False
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("topic.id"), nullable=True
    )
    chapter: Mapped[str | None] = mapped_column(Text, nullable=True)
    section_title: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    text_md: Mapped[str] = mapped_column(Text, nullable=False)
    latex_blocks: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    origin_page: Mapped[int] = mapped_column(Integer, nullable=False)
    protected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(768), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("ix_tbc_source", "source_doc_id"),
        Index(
            "ix_tbc_embedding", "embedding",
            postgresql_using="ivfflat",
            postgresql_ops={"embedding": "vector_cosine_ops"},
            postgresql_where="embedding IS NOT NULL",
        ),
    )
