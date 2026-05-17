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
    kind: Mapped[str] = mapped_column(Text, nullable=False)  # "textbook" | "answers" | "past_paper"
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    job_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    ingested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


# ── Layer 1: Theory / Key Points / Worked Examples ───────────────────────────

class TextbookConcept(Base):
    """Theory blocks, key points, worked examples — the content layer."""
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
    # "theory" | "key_point" | "worked_example" | "be_the_examiner" | "chapter_intro"
    label: Mapped[str | None] = mapped_column(Text, nullable=True)   # "Worked Example 1.3"
    text_md: Mapped[str] = mapped_column(Text, nullable=False)
    latex_blocks: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    solution_steps: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    topic_tags: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
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


# ── Layer 2: Questions ────────────────────────────────────────────────────────

class TextbookQuestion(Base):
    """Exercise questions — the question layer."""
    __tablename__ = "textbook_question"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_doc_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_document.id"), nullable=False
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("topic.id"), nullable=True
    )
    chapter: Mapped[str] = mapped_column(Text, nullable=False)
    exercise_ref: Mapped[str] = mapped_column(Text, nullable=False)   # "1A", "mixed_1"
    question_number: Mapped[str] = mapped_column(Text, nullable=False) # "13"
    subpart: Mapped[str | None] = mapped_column(Text, nullable=True)   # "a", "b", "c" or null
    stem_md: Mapped[str] = mapped_column(Text, nullable=False)
    parts: Mapped[list | None] = mapped_column(JSONB, nullable=True)   # [{label, text_md}]
    question_type: Mapped[str] = mapped_column(Text, nullable=False, default="problem_solving")
    # "drill" | "problem_solving" | "mixed_practice" | "past_paper"
    is_drill: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    colour: Mapped[str | None] = mapped_column(Text, nullable=True)    # "green"|"blue"|"red"|"black"
    difficulty: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-4
    has_solution: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    related_example_ids: Mapped[list | None] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=True
    )  # FK → textbook_concept where kind="worked_example"
    topic_tags: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    origin_page: Mapped[int] = mapped_column(Integer, nullable=False)
    protected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(768), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("ix_tbq_source", "source_doc_id"),
        Index("ix_tbq_topic", "topic_id"),
        Index("ix_tbq_exercise", "exercise_ref"),
        Index("ix_tbq_type", "question_type"),
        Index(
            "ix_tbq_embedding", "embedding",
            postgresql_using="ivfflat",
            postgresql_ops={"embedding": "vector_cosine_ops"},
            postgresql_where="embedding IS NOT NULL",
        ),
        {"schema": None},
    )


# ── Layer 3: Solutions ────────────────────────────────────────────────────────

class TextbookSolution(Base):
    """Worked solutions — the solution layer. Separate from questions."""
    __tablename__ = "textbook_solution"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("textbook_question.id"), nullable=False
    )
    source_doc_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_document.id"), nullable=False
    )
    # source_kind: "worked_solutions_book" | "generated" | "past_paper_markscheme"
    source_kind: Mapped[str] = mapped_column(Text, nullable=False, default="worked_solutions_book")
    steps: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    final_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    solution_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    protected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("ix_tbs_question", "question_id"),
        Index("ix_tbs_source", "source_doc_id"),
    )
